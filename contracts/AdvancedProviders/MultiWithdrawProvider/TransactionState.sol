// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MultiWithdrawState.sol";

abstract contract TransactionState is MultiWithdrawState{
    uint8 internal iterator;
    uint256 internal mintedPoolId;
    uint256[] internal uniqueVaultIds;
    mapping(uint256 => uint256) internal vaultIdToSum;
    mapping(uint256 => uint256) internal vaultIdToPoolId;

    modifier validataPoolId(uint256 poolId) {
        require(mintedPoolId != 0 && poolId == mintedPoolId, "Invalid poolId");
        _;
    }
}