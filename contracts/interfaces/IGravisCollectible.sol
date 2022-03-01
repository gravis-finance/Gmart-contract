// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

interface IGravisCollectible {
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external;

    function getTokenType(uint256 _tokenId) external returns (uint256);
}
