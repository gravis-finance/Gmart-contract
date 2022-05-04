//SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IERC721Typed {
    function getTokenType(uint256 tokenId) external view returns (uint256);
}
