// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import '@openzeppelin/contracts/introspection/ERC165.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721Enumerable.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721Metadata.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import './utils/CountedMap.sol';
import './GravisCollectionMintable.sol';
import './Whitelist.sol';

/**
 * @title GravisCollectible - Collectible token implementation,
 * from Gravis project, based on bitmap implementation.
 *
 * @author Darth Andeddu <Darth@gravis.finance>
 */
contract GravisCollectible is GravisCollectionMintable, Whitelist, ERC165, IERC721, IERC721Metadata, IERC721Enumerable {
    using SafeMath for uint256;
    using CountedMap for CountedMap.Map;

    // Bitmask size in slots (256 bit words) to fit all NFTs in the round
    uint256 internal constant VAULT_SIZE_SLOTS = 79;

    // Equals to `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
    // which can be also obtained as `IERC721Receiver(0).onERC721Received.selector`
    bytes4 private constant _ERC721_RECEIVED = 0x150b7a02;

    struct TokenVault {
        uint256[VAULT_SIZE_SLOTS] data;
    }
    struct TypeData {
        address minterOnly;
        string info;
        uint256 nominalPrice;
        uint256 totalSupply;
        uint256 maxSupply;
        TokenVault vault;
        string uri;
    }

    TypeData[] private typeData;
    mapping(address => TokenVault) private tokens;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    uint256 public last = 0;
    string public baseURI;
    CountedMap.Map owners;

    /*
     *     bytes4(keccak256('balanceOf(address)')) == 0x70a08231
     *     bytes4(keccak256('ownerOf(uint256)')) == 0x6352211e
     *     bytes4(keccak256('approve(address,uint256)')) == 0x095ea7b3
     *     bytes4(keccak256('getApproved(uint256)')) == 0x081812fc
     *     bytes4(keccak256('setApprovalForAll(address,bool)')) == 0xa22cb465
     *     bytes4(keccak256('isApprovedForAll(address,address)')) == 0xe985e9c5
     *     bytes4(keccak256('transferFrom(address,address,uint256)')) == 0x23b872dd
     *     bytes4(keccak256('safeTransferFrom(address,address,uint256)')) == 0x42842e0e
     *     bytes4(keccak256('safeTransferFrom(address,address,uint256,bytes)')) == 0xb88d4fde
     *
     *     => 0x70a08231 ^ 0x6352211e ^ 0x095ea7b3 ^ 0x081812fc ^
     *        0xa22cb465 ^ 0xe985e9c5 ^ 0x23b872dd ^ 0x42842e0e ^ 0xb88d4fde == 0x80ac58cd
     */
    bytes4 private constant _INTERFACE_ID_ERC721 = 0x80ac58cd;

    /*
     *     bytes4(keccak256('name()')) == 0x06fdde03
     *     bytes4(keccak256('symbol()')) == 0x95d89b41
     *     bytes4(keccak256('tokenURI(uint256)')) == 0xc87b56dd
     *
     *     => 0x06fdde03 ^ 0x95d89b41 ^ 0xc87b56dd == 0x5b5e139f
     */
    bytes4 private constant _INTERFACE_ID_ERC721_METADATA = 0x5b5e139f;

    /*
     *     bytes4(keccak256('totalSupply()')) == 0x18160ddd
     *     bytes4(keccak256('tokenOfOwnerByIndex(address,uint256)')) == 0x2f745c59
     *     bytes4(keccak256('tokenByIndex(uint256)')) == 0x4f6ccce7
     *
     *     => 0x18160ddd ^ 0x2f745c59 ^ 0x4f6ccce7 == 0x780e9d63
     */
    bytes4 private constant _INTERFACE_ID_ERC721_ENUMERABLE = 0x780e9d63;

    /**
     * @dev Initializes the contract.
     */
    constructor() public {
        // register the supported interfaces to conform to ERC721 via ERC165
        _registerInterface(_INTERFACE_ID_ERC721);
        _registerInterface(_INTERFACE_ID_ERC721_METADATA);
        _registerInterface(_INTERFACE_ID_ERC721_ENUMERABLE);
    }

    /**
     * @dev Returns the token collection name.
     */
    function name() external view override returns (string memory) {
        return 'Gravis Cards Collection';
    }

    /**
     * @dev Returns the token collection symbol.
     */
    function symbol() external view override returns (string memory) {
        return 'GRVSNFT';
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     */
    function decimals() public pure virtual returns (uint8) {
        return 0;
    }

    /**
     * @dev Default transfer from ERC20 is not possible so disabled.
     */
    function transfer(address, uint256) public pure virtual returns (bool) {
        revert('This type of token cannot be transferred from this type of wallet');
    }

    /**
     * @dev Returns the Uniform Resource Identifier (URI) for `tokenId` token.
     */
    function tokenURI(uint256 _tokenId) external view override returns (string memory) {
        uint256 typ = getTokenType(_tokenId);
        require(typ != uint256(-1), 'ERC721Metadata: URI query for nonexistent token');

        return string(abi.encodePacked(baseURI, typeData[typ].uri));
    }

    /**
     * @dev Returns the balance for the `_who` address.
     */
    function balanceOf(address _who) public view override returns (uint256) {
        return owners.counter(_who);
    }

    /**
     * @dev See {IERC721Enumerable-tokenOfOwnerByIndex}.
     */
    function tokenOfOwnerByIndex(address _who, uint256 _index) public view virtual override returns (uint256) {
        TokenVault storage vault = tokens[_who];
        uint256 index = 0;
        uint256 bit = 0;
        uint256 cnt = 0;
        while (true) {
            uint256 val = vault.data[index];
            if (val != 0) {
                while (bit < 256 && (val & (1 << bit) == 0)) ++bit;
            }
            if (val == 0 || bit == 256) {
                bit = 0;
                ++index;
                require(index < VAULT_SIZE_SLOTS, 'GravisCollectible: not enough tokens');
                continue;
            }
            if (cnt == _index) break;
            ++cnt;
            ++bit;
        }
        return index * 256 + bit;
    }

    /**
     * @dev See {IERC721Enumerable-totalSupply}.
     */
    function totalSupply() public view virtual override returns (uint256) {
        return last;
    }

    /**
     * @dev See {IERC721Enumerable-tokenByIndex}.
     */
    function tokenByIndex(uint256 index) public view virtual override returns (uint256) {
        return index;
    }

    /**
     * @dev Returns data about token collection by type id `_typeId`.
     */
    function getTypeInfo(uint256 _typeId)
        public
        view
        returns (
            uint256 nominalPrice,
            uint256 capSupply,
            uint256 maxSupply,
            string memory info,
            address minterOnly,
            string memory uri
        )
    {
        TypeData memory t = typeData[_typeId];

        return (t.nominalPrice, t.totalSupply, t.maxSupply, t.info, t.minterOnly, t.uri);
    }

    /**
     * @dev Returns token type by token id `_tokenId`.
     */
    function getTokenType(uint256 _tokenId) public view returns (uint256) {
        if (_tokenId < last) {
            (uint256 index, uint256 mask) = _position(_tokenId);
            for (uint256 i = 0; i < typeData.length; ++i) {
                if (typeData[i].vault.data[index] & mask != 0) return i;
            }
        }
        return uint256(-1);
    }

    /**
     * @dev See {IERC721-approve}.
     */
    function approve(address _to, uint256 _tokenId) public virtual override {
        if (isOwner(_msgSender(), _tokenId)) {
            require(_to != _msgSender(), 'ERC721: approval to current owner');
            _approve(_to, _tokenId, _msgSender());
        } else {
            address owner = ownerOf(_tokenId);
            require(isApprovedForAll(owner, _msgSender()), 'ERC721: approve caller is not owner nor approved for all');
            _approve(_to, _tokenId, owner);
        }
    }

    /**
     * @dev See {IERC721-getApproved}.
     */
    function getApproved(uint256 _tokenId) public view virtual override returns (address) {
        require(exists(_tokenId), 'ERC721: approved query for nonexistent token');

        return _tokenApprovals[_tokenId];
    }

    /**
     * @dev See {IERC721-setApprovalForAll}.
     */
    function setApprovalForAll(address _operator, bool _approved) public virtual override {
        require(_operator != _msgSender(), 'ERC721: approve to caller');

        _operatorApprovals[_msgSender()][_operator] = _approved;
        emit ApprovalForAll(_msgSender(), _operator, _approved);
    }

    /**
     * @dev See {IERC721-isApprovedForAll}.
     */
    function isApprovedForAll(address _owner, address _operator) public view virtual override returns (bool) {
        return _operatorApprovals[_owner][_operator];
    }

    /**
     * @dev See {IERC721-transferFrom}.
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) public virtual override {
        require(_isApprovedOrOwner(_msgSender(), _tokenId, _from), 'ERC721: transfer caller is not owner nor approved');

        _transfer(_from, _to, _tokenId);
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) public virtual override {
        safeTransferFrom(_from, _to, _tokenId, '');
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    ) public virtual override {
        require(_isApprovedOrOwner(_msgSender(), _tokenId, _from), 'ERC721: transfer caller is not owner nor approved');

        _safeTransfer(_from, _to, _tokenId, _data);
    }

    /**
     * @dev See {ERC71-_exists}.
     */
    function exists(uint256 _tokenId) public view returns (bool) {
        return getTokenType(_tokenId) != uint256(-1);
    }

    /**
     * @dev See {ERC71-_setBaseURI}.
     */
    function setBaseURI(string memory _baseURI) public onlyAdmin {
        baseURI = _baseURI;
    }

    /**
     * @dev Create new token collection, with uniq id.
     *
     * Permission: onlyAdmin
     *
     * @param _nominalPrice - nominal price per item, should be set in USD,
     *        with decimal zero
     * @param _maxTotal - maximum total amount items in collection
     * @param _info - general information about collection
     * @param _uri - JSON metadata address based on `baseURI`
     */
    function createNewTokenType(
        uint256 _nominalPrice,
        uint256 _maxTotal,
        string memory _info,
        string memory _uri
    ) public onlyAdmin {
        require(_nominalPrice != 0, 'GravisCollectible: nominal price is zero');

        TypeData memory t;
        t.nominalPrice = _nominalPrice;
        t.maxSupply = _maxTotal;
        t.info = _info;
        t.uri = _uri;

        typeData.push(t);
    }

    /**
     * @dev Setter for lock minter rights by `_minter` and `_type`.
     *
     * Permission: onlyAdmin
     */
    function setMinterOnly(address _minter, uint256 _type) external onlyAdmin {
        require(typeData[_type].minterOnly == address(0), 'GravisCollectible: minter locked already');

        typeData[_type].minterOnly = _minter;
    }

    /**
     * @dev Add new user with MINTER_ROLE permission.
     *
     * Permission: onlyAdmin
     */
    function addMinter(address _newMinter) public onlyAdmin {
        _setupRole(MINTER_ROLE, _newMinter);
    }

    /**
     * @dev Mint one NFT token to specific address `_to` with specific type id `_type`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function mint(
        address _to,
        uint256 _type,
        uint256 _amount
    ) public returns (uint256) {
        require(hasRole(MINTER_ROLE, _msgSender()), 'GravisCollectible: must have minter role to mint');
        require(_type < typeData.length, 'GravisCollectible: type not exist');
        TypeData storage currentType = typeData[_type];
        if (currentType.minterOnly != address(0)) {
            require(typeData[_type].minterOnly == _msgSender(), 'GravisCollectible: minting locked by another account');
        }

        return _mint(_to, _type, _amount);
    }

    function mintFor(
        address[] calldata _to,
        uint256[] calldata _amount,
        uint256 _type
    ) external {
        require(hasRole(MINTER_ROLE, _msgSender()), 'GravisCollectible: must have minter role to mint');
        require(_to.length == _amount.length, "GravisCollectible: input arrays don't match");
        require(_type < typeData.length, 'GravisCollectible: type not exist');
        TypeData storage currentType = typeData[_type];
        if (currentType.minterOnly != address(0)) {
            require(typeData[_type].minterOnly == _msgSender(), 'GravisCollectible: minting locked by another account');
        }

        for (uint256 i = 0; i < _to.length; ++i) {
            _mint(_to[i], _type, _amount[i]);
        }
    }

    function _mint(
        address _to,
        uint256 _type,
        uint256 _amount
    ) internal returns (uint256) {
        require(_to != address(0), 'ERC721: mint to the zero address');

        TokenVault storage vaultUser = tokens[_to];
        TokenVault storage vaultType = typeData[_type].vault;
        uint256 tokenId = last;
        (uint256 index, uint256 mask) = _position(tokenId);
        uint256 userBuf = vaultUser.data[index];
        uint256 typeBuf = vaultType.data[index];
        while (tokenId < last.add(_amount)) {
            userBuf |= mask;
            typeBuf |= mask;
            mask <<= 1;
            if (mask == 0) {
                mask = 1;
                vaultUser.data[index] = userBuf;
                vaultType.data[index] = typeBuf;
                ++index;
                userBuf = vaultUser.data[index];
                typeBuf = vaultType.data[index];
            }
            emit Transfer(address(0), _to, tokenId);
            ++tokenId;
        }
        last = tokenId;
        vaultUser.data[index] = userBuf;
        vaultType.data[index] = typeBuf;
        typeData[_type].totalSupply = typeData[_type].totalSupply.add(_amount);
        owners.add(_to, _amount);
        require(typeData[_type].totalSupply <= typeData[_type].maxSupply, 'GravisCollectible: max supply reached');

        return last;
    }

    /**
     * @dev Moves one NFT token to specific address `_to` with specific token id `_tokenId`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFromContract(address _to, uint256 _tokenId) public onlyAdmin returns (bool) {
        _transfer(address(this), _to, _tokenId);

        return true;
    }

    /**
     * @dev Returns address of the caller if the token `_tokenId` belongs to her, 0 otherwise.
     */
    function ownerOf(uint256 _tokenId) public view override returns (address) {
        (uint256 index, uint256 mask) = _position(_tokenId);
        if (tokens[_msgSender()].data[index] & mask != 0) return _msgSender();
        for (uint256 i = 0; i < owners.length(); ++i) {
            address candidate = owners.at(i);
            if (tokens[candidate].data[index] & mask != 0) return candidate;
        }
        revert('ERC721: owner query for nonexistent token');
    }

    /**
     * @dev Returns true if `_who` owns token `_tokenId`.
     */
    function isOwner(address _who, uint256 _tokenId) public view returns (bool) {
        (uint256 index, uint256 mask) = _position(_tokenId);
        return tokens[_who].data[index] & mask != 0;
    }

    function ownersLength() public view returns (uint256) {
        return owners.length();
    }

    function ownerAt(uint256 _index) public view returns (address) {
        return owners.at(_index);
    }

    /**
     * @dev See {ERC71-_burn}.
     */
    function burn(uint256 _tokenId) public {
        if (isOwner(_msgSender(), _tokenId)) {
            _burnFor(_msgSender(), _tokenId);
        } else {
            address owner = ownerOf(_tokenId);
            require(
                getApproved(_tokenId) == _msgSender() || isApprovedForAll(owner, _msgSender()),
                'GravisCollectible: caller is not owner nor approved'
            );
            _burnFor(owner, _tokenId);
        }
    }

    /**
     * @dev Burn `_amount` tokens ot type `_type` for account `_who`.
     */
    function burnFor(
        address _who,
        uint256 _type,
        uint256 _amount
    ) public {
        require(_who == _msgSender() || isApprovedForAll(_who, _msgSender()), 'GravisCollectible: must have approval');
        require(_type < typeData.length, 'GravisCollectible: type not exist');

        TokenVault storage vaultUser = tokens[_who];
        TokenVault storage vaultType = typeData[_type].vault;
        uint256 index = 0;
        uint256 burned = 0;
        uint256 userBuf;
        uint256 typeBuf;
        while (burned < _amount) {
            while (index < VAULT_SIZE_SLOTS && vaultUser.data[index] == 0) ++index;
            require(index < VAULT_SIZE_SLOTS, 'GravisCollectible: not enough tokens');
            userBuf = vaultUser.data[index];
            typeBuf = vaultType.data[index];
            uint256 bit = 0;
            while (burned < _amount) {
                while (bit < 256) {
                    uint256 mask = 1 << bit;
                    if (userBuf & mask != 0 && typeBuf & mask != 0) break;
                    ++bit;
                }
                if (bit == 256) {
                    vaultUser.data[index] = userBuf;
                    vaultType.data[index] = typeBuf;
                    ++index;
                    break;
                }
                uint256 tokenId = index * 256 + bit;
                _unapprove(_who, tokenId);
                uint256 mask = ~(1 << bit);
                userBuf &= mask;
                typeBuf &= mask;
                emit Transfer(_who, address(0), tokenId);
                ++burned;
            }
        }
        vaultUser.data[index] = userBuf;
        vaultType.data[index] = typeBuf;
        owners.remove(_who, _amount);
    }

    /**
     * @dev Transfer `_amount` tokens ot type `_type` between accounts `_from` and `_to`.
     */
    function transferFor(
        address _from,
        address _to,
        uint256 _type,
        uint256 _amount
    ) public {
        require(_from == _msgSender() || isApprovedForAll(_from, _msgSender()), 'GravisCollectible: must have approval');
        require(_type < typeData.length, 'GravisCollectible: type not exist');

        TokenVault storage vaultFrom = tokens[_from];
        TokenVault storage vaultTo = tokens[_to];
        TokenVault storage vaultType = typeData[_type].vault;
        uint256 index = 0;
        uint256 transfered = 0;
        uint256 fromBuf;
        uint256 toBuf;
        while (transfered < _amount) {
            while (index < VAULT_SIZE_SLOTS && vaultFrom.data[index] == 0) ++index;
            require(index < VAULT_SIZE_SLOTS, 'GravisCollectible: not enough tokens');
            fromBuf = vaultFrom.data[index];
            toBuf = vaultTo.data[index];
            uint256 bit = 0;
            while (transfered < _amount) {
                while (bit < 256) {
                    uint256 mask = 1 << bit;
                    if (fromBuf & mask != 0 && vaultType.data[index] & mask != 0) break;
                    ++bit;
                }
                if (bit == 256) {
                    vaultFrom.data[index] = fromBuf;
                    vaultTo.data[index] = toBuf;
                    ++index;
                    break;
                }
                uint256 tokenId = index * 256 + bit;
                _unapprove(_from, tokenId);
                uint256 mask = 1 << bit;
                toBuf |= mask;
                fromBuf &= ~mask;
                emit Transfer(_from, _to, tokenId);
                ++transfered;
            }
        }
        vaultFrom.data[index] = fromBuf;
        vaultTo.data[index] = toBuf;
        owners.add(_to, _amount);
        owners.remove(_from, _amount);
    }

    /**
     * @dev Approve `_to` to operate on `_tokenId`
     *
     * Emits an {Approval} event.
     */
    function _approve(
        address _to,
        uint256 _tokenId,
        address _owner
    ) internal virtual {
        _tokenApprovals[_tokenId] = _to;
        emit Approval(_owner, _to, _tokenId);
    }

    function _unapprove(address _owner, uint256 _tokenId) internal virtual {
        if (_tokenApprovals[_tokenId] != address(0)) {
            delete _tokenApprovals[_tokenId];
            emit Approval(_owner, address(0), _tokenId);
        }
    }

    /**
     * @dev Burn a single token `_tokenId` for address `_who`.
     */
    function _burnFor(address _who, uint256 _tokenId) internal virtual {
        (uint256 index, uint256 mask) = _position(_tokenId);
        require(tokens[_who].data[index] & mask != 0, 'not owner');

        _unapprove(_who, _tokenId);

        mask = ~mask;
        tokens[_who].data[index] &= mask;
        for (uint256 i = 0; i < typeData.length; ++i) {
            typeData[i].vault.data[index] &= mask;
        }
        owners.remove(_who, 1);

        emit Transfer(_who, address(0), _tokenId);
    }

    /**
     * @dev Transfers `_tokenId` from `_from` to `_to`.
     *  As opposed to {transferFrom}, this imposes no restrictions on msg.sender.
     *
     * Emits a {Transfer} event.
     */
    function _transfer(
        address _from,
        address _to,
        uint256 _tokenId
    ) internal virtual {
        require(isOwner(_from, _tokenId), 'ERC721: transfer of token that is not own');
        require(_to != address(0), 'ERC721: transfer to the zero address');

        // Clear approvals from the previous owner
        _approve(address(0), _tokenId, _from);

        (uint256 index, uint256 mask) = _position(_tokenId);
        tokens[_from].data[index] &= ~mask;
        tokens[_to].data[index] |= mask;
        owners.add(_to, 1);
        owners.remove(_from, 1);

        emit Transfer(_from, _to, _tokenId);
    }

    /**
     * @dev Safely transfers `tokenId` token from `from` to `to`, checking first that contract
     * recipients are aware of the ERC721 protocol to prevent tokens from being forever locked.
     *
     * `_data` is additional data, it has no specified format and it is sent in call to `to`.
     *
     * Emits a {Transfer} event.
     */
    function _safeTransfer(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    ) internal virtual {
        _transfer(_from, _to, _tokenId);
        require(_checkOnERC721Received(_from, _to, _tokenId, _data), 'ERC721: transfer to non ERC721Receiver implementer');
    }

    /**
     * @dev Internal function to invoke {IERC721Receiver-onERC721Received} on a target address.
     * The call is not executed if the target address is not a contract.
     *
     * @param _from address representing the previous owner of the given token ID
     * @param _to target address that will receive the tokens
     * @param _tokenId uint256 ID of the token to be transferred
     * @param _data bytes optional data to send along with the call
     * @return bool whether the call correctly returned the expected magic value
     */
    function _checkOnERC721Received(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    ) private returns (bool) {
        if (!_to.isContract()) {
            return true;
        }
        bytes memory returndata = _to.functionCall(
            abi.encodeWithSelector(IERC721Receiver(_to).onERC721Received.selector, _msgSender(), _from, _tokenId, _data),
            'ERC721: transfer to non ERC721Receiver implementer'
        );
        bytes4 retval = abi.decode(returndata, (bytes4));
        return (retval == _ERC721_RECEIVED);
    }

    /**
     * @dev Returns whether `_spender` is allowed to manage `_tokenId`.
     */
    function _isApprovedOrOwner(
        address _spender,
        uint256 _tokenId,
        address _owner
    ) internal view virtual returns (bool) {
        return (_spender == _owner || getApproved(_tokenId) == _spender || isApprovedForAll(_owner, _spender));
    }

    function _position(uint256 _tokenId) internal pure returns (uint256 index, uint256 mask) {
        index = _tokenId / 256;
        require(index < VAULT_SIZE_SLOTS, 'GravisCollectible: OOB');
        mask = uint256(1 << (_tokenId % 256));
    }
}
