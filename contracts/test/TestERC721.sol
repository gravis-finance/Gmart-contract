// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';

contract TestERC721 is ERC721('test', 'TST') {
    constructor() public {}

    function mint(address to, uint256 tokenId) public returns (bool) {
        _mint(to, tokenId);
        return true;
    }
}
