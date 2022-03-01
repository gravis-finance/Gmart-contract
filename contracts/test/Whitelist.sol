// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import '@openzeppelin/contracts/access/Ownable.sol';

/**
 * @title Whitelist
 * @author Alberto Cuesta Canada
 * @dev Implements a simple whitelist of addresses.
 */
contract Whitelist is Ownable {
    event MemberAdded(address member);
    event MemberRemoved(address member);

    mapping(address => bool) private members;
    uint256 public whitelisted;

    /**
     * @dev A method to verify whether an address is a member of the whitelist
     * @param _member The address to verify.
     * @return Whether the address is a member of the whitelist.
     */
    function isMember(address _member) public view returns (bool) {
        return members[_member];
    }

    /**
     * @dev A method to add a member to the whitelist
     * @param _member The member to add as a member.
     */
    function addMember(address _member) public onlyOwner {
        address[] memory mem = new address[](1);
        mem[0] = _member;
        _addMembers(mem);
    }

    /**
     * @dev A method to add a member to the whitelist
     * @param _members The members to add as a member.
     */
    function addMembers(address[] memory _members) public onlyOwner {
        _addMembers(_members);
    }

    /**
     * @dev A method to remove a member from the whitelist
     * @param _member The member to remove as a member.
     */
    function removeMember(address _member) public onlyOwner {
        require(isMember(_member), 'Whitelist: Not member of whitelist');

        delete members[_member];
        --whitelisted;
        emit MemberRemoved(_member);
    }

    function _addMembers(address[] memory _members) internal {
        uint256 l = _members.length;
        for (uint256 i = 0; i < l; i++) {
            require(!isMember(_members[i]), 'Whitelist: Address is member already');

            members[_members[i]] = true;
            emit MemberAdded(_members[i]);
        }
        whitelisted += _members.length;
    }

    /**
     * @dev Access modifier for whitelisted members.
     */
    modifier canParticipate() {
        require(whitelisted == 0 || isMember(msg.sender), 'Seller: not from private list');
        _;
    }
}
