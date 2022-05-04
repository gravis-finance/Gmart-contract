//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IStaking {
    function currentLevelIndex(address) external view returns (uint256);
}
