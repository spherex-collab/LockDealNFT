// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./LockDealBundleProviderModifiers.sol";
import "../Provider/ProviderModifiers.sol";
import "../ProviderInterface/IProvider.sol";
import "../ProviderInterface/IProviderExtend.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

contract LockDealBundleProvider is
    ProviderModifiers,
    LockDealBundleProviderModifiers,
    IProvider,
    ERC721Holder
{
    constructor(address nft) {
        require(
            nft != address(0x0),
            "invalid address"
        );
        lockDealNFT = LockDealNFT(nft);
    }

    ///@param providerParams[][0] = leftAmount
    ///@param providerParams[][1] = startTime
    ///@param providerParams[][2] = finishTime
    ///@param providerParams[][3] = startAmount
    function createNewPool(
        address owner,
        address token,
        address[] calldata providers,
        uint256[][] calldata providerParams
    ) external returns (uint256 poolId) {
        // amount for LockDealProvider = `totalAmount` - `startAmount`
        // amount for TimedDealProvider = `startAmount`

        // mint the NFT owned by the BunderDealProvider on LockDealProvider for `totalAmount` - `startAmount` token amount
        // mint the NFT owned by the BunderDealProvider on TimedDealProvider for `startAmount` token amount
        // mint the NFT owned by the owner on LockDealBundleProvider for `totalAmount` token transfer amount

        // To optimize the token transfer (for 1 token transfer)
        // mint the NFT owned by the BunderDealProvider with 0 token transfer amount on LockDealProvider
        // mint the NFT owned by the BunderDealProvider with 0 token transfer amount on TimedDealProvider
        // mint the NFT owned by the owner with `totalAmount` token transfer amount on LockDealBundleProvider

        uint256 providerCount = providers.length;
        require(providerCount == providerParams.length, "providers and params length mismatch");
        require(providerCount > 1, "providers length must be greater than 1");

        uint256 firstSubPoolId;
        uint256 totalStartAmount;
        for (uint256 i; i < providerCount; ++i) {
            address provider = providers[i];
            uint256[] memory params = providerParams[i];

            // check if the provider address is valid
            require(
                lockDealNFT.approvedProviders(provider) &&
                provider != address(lockDealNFT),
                "invalid provider address"
            );

            // create the pool and store the first sub poolId
            // mint the NFT owned by the BunderDealProvider with 0 token transfer amount
            uint256 subPoolId = _createNewPool(address(this), token, msg.sender, 0, provider, params);
            if (i == 0) firstSubPoolId = subPoolId;

            // increase the `totalStartAmount`
            totalStartAmount += params[0];
        }

        // create a new pool owned by the owner with `totalStartAmount` token trasnfer amount
        poolId = lockDealNFT.mint(owner, token, msg.sender, totalStartAmount);
        poolIdToLockDealBundle[poolId].firstSubPoolId = firstSubPoolId;
        isLockDealBundlePoolId[poolId] = true;
    }

    function _createNewPool(
        address owner,
        address token,
        address from,
        uint256 amount,
        address provider,
        uint256[] memory params
    ) internal returns (uint256 poolId) {
        poolId = lockDealNFT.mint(owner, token, from, amount);
        IProviderExtend(provider).registerPool(poolId, owner, token, params);
    }

    /// @dev use revert only for permissions
    function withdraw(
        uint256 poolId
    ) public override onlyNFT onlyBundlePoolId(poolId) returns (uint256 withdrawnAmount, bool isFinal) {
    }

    function _withdraw(
        uint256 provider,
        uint256 poolId
    ) internal returns (uint256 withdrawnAmount, bool isFinal) {
    }

    function split(
        uint256 oldPoolId,
        uint256 newPoolId,
        uint256 splitAmount
    ) public onlyProvider {
    }

    function getData(uint256 poolId) public view override onlyBundlePoolId(poolId) returns (IDealProvierEvents.BasePoolInfo memory poolInfo, uint256[] memory params) {
        address owner = lockDealNFT.ownerOf(poolId);
        poolInfo = IDealProvierEvents.BasePoolInfo(poolId, owner, address(0));
        params = new uint256[](1);
        params[0] = poolIdToLockDealBundle[poolId].firstSubPoolId; // firstSubPoolId
    }
}
