// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import { Context, AccessControl } from '@openzeppelin/contracts/access/AccessControl.sol';

contract GravisCollectionMintable is Context, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256('MINTER_ROLE');

    constructor() public {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), 'GravisCollectible: must have admin role');
        _;
    }
}
