// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../LockDealNFT/LockDealNFT.sol";
import "poolz-helper-v2/contracts/ERC20Helper.sol";
import "./DealProviderModifiers.sol";
import "../interface/IProvider.sol";

contract DealProvider is DealProviderModifiers, ERC20Helper, IProvider {
    constructor(address _nftContract) {
        nftContract = LockDealNFT(_nftContract);
    }

    /// params[0] = amount
    function createNewPool(
        address owner,
        address token,
        uint256[] memory params
    )
        public
        notZeroAddress(owner)
        notZeroAddress(token)
        notZeroAmount(params[0])
        validParamsLength(params.length, currentParamsTargetLenght)
        returns (uint256 poolId)
    {
        poolId = nftContract.totalSupply();
        poolIdToDeal[poolId] = Deal(token, params[0]);
        nftContract.mint(owner);
        if (!nftContract.approvedProviders(msg.sender)) {
            TransferInToken(token, msg.sender, params[0]);
        }
        emit NewPoolCreated(BasePoolInfo(poolId, owner, token), params);
    }

    /// @dev no use of revert to make sure the loop will work
    function withdraw(
        uint256 poolId
    ) public override returns (uint256 withdrawnAmount) {
        if (
            poolIdToDeal[poolId].leftAmount >= 0 &&
            nftContract.approvedProviders(msg.sender)
        ) {
            withdrawnAmount = poolIdToDeal[poolId].leftAmount;
            poolIdToDeal[poolId].leftAmount = 0;
            TransferToken(
                poolIdToDeal[poolId].token,
                nftContract.ownerOf(poolId),
                withdrawnAmount
            );
            emit TokenWithdrawn(
                BasePoolInfo(
                    poolId,
                    nftContract.ownerOf(poolId),
                    poolIdToDeal[poolId].token
                ),
                withdrawnAmount,
                poolIdToDeal[poolId].leftAmount
            );
        }
    }

    function split(
        uint256 oldPoolId,
        uint256 newPoolId,
        uint256 splitAmount
    )
        public
        override
        notZeroAmount(splitAmount)
        onlyProvider
        invalidSplitAmount(poolIdToDeal[oldPoolId].leftAmount, splitAmount)
    {
        poolIdToDeal[oldPoolId].leftAmount -= splitAmount;
        poolIdToDeal[newPoolId].leftAmount = splitAmount;
        emit PoolSplit(
            oldPoolId,
            nftContract.ownerOf(oldPoolId),
            newPoolId,
            nftContract.ownerOf(newPoolId),
            poolIdToDeal[oldPoolId].leftAmount,
            poolIdToDeal[newPoolId].leftAmount
        );
    }

    function registerPool(
        uint256 poolId,
        uint256[] memory params
    )
        public
        onlyProvider
        validParamsLength(params.length, currentParamsTargetLenght)
    {
        poolIdToDeal[poolId].leftAmount = params[0];
    }
}