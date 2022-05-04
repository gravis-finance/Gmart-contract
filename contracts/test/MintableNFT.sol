//SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MintableNFT is ERC721, Ownable {
    uint256 private lastTokenId;

    mapping(uint256 => uint256) public getTokenType;

    constructor() ERC721("NFT", "NFT") Ownable() {}

    function mint(address _to, uint256 typeId) external onlyOwner returns (uint256) {
        lastTokenId++;
        _mint(_to, lastTokenId);
        getTokenType[lastTokenId] = typeId;
        return lastTokenId;
    }

    function burn(uint256 tokenId) external {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "Caller is not owner nor approved");
        _burn(tokenId);
    }
}
