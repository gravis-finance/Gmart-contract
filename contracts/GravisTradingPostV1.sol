// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC721/ERC721HolderUpgradeable.sol';

import '@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol';

import './interfaces/IGravisCollectible.sol';

contract GravisTradingPostV1 is OwnableUpgradeable, ERC721HolderUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeMathUpgradeable for uint256;

    uint256 public constant FEE_BASE = 10000;

    // Recipient of fees.
    address public feeRecipient;

    // Fee amount in basis points
    uint256 public feeAmount;

    struct Order {
        // Order maker
        address maker;
        // Gravis NFT contract instance.
        address nft;
        // Gravis NFT token type ID.
        uint256 tokenType;
        // Amount of NFTs for this order.
        uint256 amount;
        // Price for each token.
        uint256 price;
        // Token IDs
        uint256[] tokenIds;
    }

    address[] public allowedTokens;
    address[] public allowedStables;
    uint256[] public allowedTypes;

    Order private _emptyOrder;

    address[] public _userIndexes;
    mapping(address => Order[]) private _userOrders;

    event OrderPlaced(address indexed maker, address indexed nft, uint256 indexed tokenType, uint256 amount, uint256 price, uint256[] ids);
    event OrderUpdated(address indexed maker, address indexed nft, uint256 indexed tokenType, uint256 price);
    event OrderCancelled(address indexed maker, address indexed nft, uint256 indexed tokenType, uint256 amount, uint256[] ids);
    event OrderFilled(
        address indexed maker,
        address indexed taker,
        address indexed nft,
        uint256 tokenType,
        uint256 amount,
        uint256 price,
        uint256[] ids
    );
    event OrderDeleted(address indexed maker, address indexed nft, uint256 indexed tokenType, uint256 amount, uint256[] ids);

    function initialize(
        address _feeRecipient,
        uint256 _feeAmount,
        address[] memory _tokens,
        address[] memory _stables,
        uint256[] memory _types
    ) public initializer {
        __Ownable_init();
        __ERC721Holder_init_unchained();
        __Pausable_init_unchained();
        __ReentrancyGuard_init_unchained();

        __GravisTradingPost_init_unchained(_feeRecipient, _feeAmount, _tokens, _stables, _types);
    }

    function __GravisTradingPost_init_unchained(
        address _feeRecipient,
        uint256 _feeAmount,
        address[] memory _tokens,
        address[] memory _stables,
        uint256[] memory _types
    ) internal initializer {
        feeRecipient = _feeRecipient;
        feeAmount = _feeAmount;
        allowedTokens = _tokens;
        allowedStables = _stables;
        allowedTypes = _types;
        _emptyOrder = Order(address(0), address(0), 0, 0, 0, new uint256[](0));
    }

    function getOrders() public view returns (Order[] memory orders) {
        uint256 totalOrders = 0;

        for (uint256 i = 0; i < _userIndexes.length; i++) {
            for (uint256 j = 0; j < _userOrders[_userIndexes[i]].length; j++) {
                if (_userOrders[_userIndexes[i]][j].amount > 0 && _userOrders[_userIndexes[i]][j].price > 0) {
                    totalOrders++;
                }
            }
        }

        uint256 orderIndex = 0;
        orders = new Order[](totalOrders);

        for (uint256 i = 0; i < _userIndexes.length; i++) {
            for (uint256 j = 0; j < _userOrders[_userIndexes[i]].length; j++) {
                if (_userOrders[_userIndexes[i]][j].amount > 0 && _userOrders[_userIndexes[i]][j].price > 0) {
                    orders[orderIndex] = _userOrders[_userIndexes[i]][j];
                    orderIndex++;
                }
            }
        }
    }

    function getOrdersByMaker(address _maker) public view returns (Order[] memory) {
        return _userOrders[_maker];
    }

    function placeOrder(
        address _nft,
        uint256 _tokenType,
        uint256 _amount,
        uint256 _price,
        uint256[] memory _ids
    ) public whenNotPaused {
        require(_amount > 0, 'GravisTradingPost: Zero amount');
        require(_price > 0, 'GravisTradingPost: Zero price');
        require(_ids.length == _amount, 'GravisTradingPost: Incorrect tokens amount');

        require(isTokenAllowed(_nft), 'GravisTradingPost: NFT not allowed');
        require(isTypeAllowed(_tokenType), 'GravisTradingPost: Token type not allowed');

        require(!orderExists(_msgSender(), _nft, _tokenType), 'GravisTradingPost: Order already exists');

        for (uint256 i = 0; i < _ids.length; i++) {
            require(IGravisCollectible(_nft).getTokenType(_ids[i]) == _tokenType, 'GravisTradingPost: Invalid token type');
        }

        safeMassTransferAssets(_nft, _msgSender(), address(this), _ids);

        _userOrders[_msgSender()].push(Order(_msgSender(), _nft, _tokenType, _amount, _price, _ids));

        // if user not in the index, push new value to the array
        if (!isUserExists(_msgSender())) {
            _userIndexes.push(_msgSender());
        }

        emit OrderPlaced(_msgSender(), _nft, _tokenType, _amount, _price, _ids);
    }

    function updateOrder(
        address _nft,
        uint256 _tokenType,
        uint256 _price
    ) public whenNotPaused {
        require(_price > 0, 'GravisTradingPost: Zero price');

        require(isTokenAllowed(_nft), 'GravisTradingPost: NFT not allowed');
        require(isTypeAllowed(_tokenType), 'GravisTradingPost: Token type not allowed');

        require(orderExists(_msgSender(), _nft, _tokenType), 'GravisTradingPost: Order not exists');

        (Order storage order, ) = findOrder(_msgSender(), _nft, _tokenType);

        order.price = _price;

        emit OrderUpdated(_msgSender(), _nft, _tokenType, _price);
    }

    function cancelOrder(address _nft, uint256 _tokenType) public whenNotPaused {
        require(isTokenAllowed(_nft), 'GravisTradingPost: NFT not allowed');
        require(isTypeAllowed(_tokenType), 'GravisTradingPost: Token type not allowed');

        require(orderExists(_msgSender(), _nft, _tokenType), 'GravisTradingPost: Order not exists');

        (Order storage order, uint256 index) = findOrder(_msgSender(), _nft, _tokenType);

        uint256[] memory ids = order.tokenIds;

        deleteOrder(_msgSender(), index);

        // Still has the balance of NFT on the contract
        // Should transfer NFTs back to the caller
        if (ids.length > 0) {
            safeMassTransferAssets(_nft, address(this), _msgSender(), ids);
        }

        emit OrderCancelled(_msgSender(), _nft, _tokenType, ids.length, ids);
    }

    function fillOrder(
        address _maker,
        address _nft,
        uint256 _tokenType,
        uint256 _amount,
        address _stable
    ) public whenNotPaused nonReentrant {
        require(_maker != address(0), 'GravisTradingPost: Zero maker');
        require(_amount > 0, 'GravisTradingPost: Zero amount');

        require(isTokenAllowed(_nft), 'GravisTradingPost: NFT not allowed');
        require(isTypeAllowed(_tokenType), 'GravisTradingPost: Token type not allowed');
        require(isStableAllowed(_stable), 'GravisTradingPost: Stable not allowed');

        require(orderExists(_maker, _nft, _tokenType), 'GravisTradingPost: Order not exists');

        (Order storage order, uint256 index) = findOrder(_maker, _nft, _tokenType);

        require(order.amount >= _amount, 'GravisTradingPost: Not enough amount');

        uint256 fullPrice = _amount.mul(order.price);

        uint256[] memory idsToTransfer = new uint256[](_amount);

        for (uint256 i = 0; i < _amount; i++) {
            idsToTransfer[i] = order.tokenIds[i];
        }

        // Reset order if its fully filled
        if (order.amount == _amount) {
            deleteOrder(_maker, index);
        } else {
            uint256 left = order.amount.sub(_amount);

            // should sub array of token ids
            uint256[] memory whatsLeft = new uint256[](left);

            for (uint256 i = _amount; i < order.tokenIds.length; i++) {
                whatsLeft[i.sub(_amount)] = order.tokenIds[i];
            }

            order.amount = left;
            order.tokenIds = whatsLeft;
        }

        IERC20Upgradeable stable = IERC20Upgradeable(_stable);

        // Transfer fee to feeRecipient
        stable.safeTransferFrom(_msgSender(), feeRecipient, calculateFee(fullPrice));
        // Transfer stables to maker
        stable.safeTransferFrom(_msgSender(), _maker, applyFee(fullPrice));
        // Transfer NFTs to taker
        //IGravisCollectible(_nft).transferFor(address(this), _msgSender(), _tokenType, _amount);
        safeMassTransferAssets(_nft, address(this), _msgSender(), idsToTransfer);

        emit OrderFilled(_maker, _msgSender(), _nft, _tokenType, _amount, fullPrice, idsToTransfer);
    }

    function deleteOrder(
        address _nft,
        uint256 _tokenType,
        address _maker
    ) public onlyOwner {
        require(isTokenAllowed(_nft), 'GravisTradingPost: NFT not allowed');
        require(isTypeAllowed(_tokenType), 'GravisTradingPost: Token type not allowed');

        require(orderExists(_maker, _nft, _tokenType), 'GravisTradingPost: Order not exists');

        (Order storage order, uint256 index) = findOrder(_maker, _nft, _tokenType);

        uint256[] memory ids = order.tokenIds;

        deleteOrder(_maker, index);

        // Still has the balance of NFT on the contract
        // Should transfer NFTs back to the caller
        if (ids.length > 0) {
            safeMassTransferAssets(_nft, address(this), _msgSender(), ids);
        }

        emit OrderDeleted(_maker, _nft, _tokenType, ids.length, ids);
    }

    /**
     * @dev Change the fee paid to the protocol (owner only)
     * @param _fee New fee to set in basis points
     */
    function changeFee(uint256 _fee) public onlyOwner {
        feeAmount = _fee;
    }

    /**
     * @dev Change the protocol fee recipient (owner only)
     * @param _recipient New protocol fee recipient address
     */
    function changeFeeRecipient(address _recipient) public onlyOwner {
        require(_recipient != address(0), 'GravisTradingPost: Zero fee recipient');
        feeRecipient = _recipient;
    }

    /**
     * @dev Change the protocol allowed tokens (owner only)
     * @param _list Array of allowed token addresses
     */
    function changeAllowedTokens(address[] memory _list) public onlyOwner {
        require(_list.length > 0, 'GravisTradingPost: Zero length');
        allowedTokens = _list;
    }

    /**
     * @dev Change the protocol allowed stables (owner only)
     * @param _list Array of allowed stable addresses
     */
    function changeAllowedStables(address[] memory _list) public onlyOwner {
        require(_list.length > 0, 'GravisTradingPost: Zero length');
        allowedStables = _list;
    }

    /**
     * @dev Change the protocol allowed token types (owner only)
     * @param _list Array of allowed token types
     */
    function changeAllowedTypes(uint256[] memory _list) public onlyOwner {
        require(_list.length > 0, 'GravisTradingPost: Zero length');
        allowedTypes = _list;
    }

    /**
     * @dev Find an order for the maker of nft type
     * @param _maker Address of order maker
     * @param _nft Address of nft token
     * @param _tokenType Type of nft token
     * @return order, and index of order
     */
    function findOrder(
        address _maker,
        address _nft,
        uint256 _tokenType
    ) internal view returns (Order storage, uint256) {
        Order storage order = _emptyOrder;
        for (uint256 i = 0; i < _userOrders[_maker].length; i++) {
            if (_userOrders[_maker][i].nft == _nft && _userOrders[_maker][i].tokenType == _tokenType) {
                return (_userOrders[_maker][i], i);
            }
        }
        return (order, 0);
    }

    /**
     * @dev Delete an order at index from users orders array
     * @param _maker Address of order maker
     * @param _index Index of an order
     */
    function deleteOrder(address _maker, uint256 _index) internal {
        _userOrders[_maker][_index] = _userOrders[_maker][_userOrders[_maker].length - 1];
        _userOrders[_maker].pop();
    }

    /**
     * @dev Mass transfer NFT assets from/to contract
     * @param _asset Address of NFT
     * @param _from Address to transfer from
     * @param _to Address to transfer to
     * @param _ids Array of token IDs
     */
    function safeMassTransferAssets(
        address _asset,
        address _from,
        address _to,
        uint256[] memory _ids
    ) internal {
        for (uint256 i = 0; i < _ids.length; i++) {
            IGravisCollectible(_asset).safeTransferFrom(_from, _to, _ids[i]);
        }
    }

    /**
     * @dev Check that order exists in the order list
     * @param _maker Address of order maker
     * @param _nft Address of nft token
     * @param _tokenType Type of nft token
     * @return exists
     */
    function orderExists(
        address _maker,
        address _nft,
        uint256 _tokenType
    ) internal view returns (bool exists) {
        (Order storage order, ) = findOrder(_maker, _nft, _tokenType);
        return order.price > 0 && order.amount > 0;
    }

    /**
     * Applies the fee by subtracting fees from the amount and returns
     * the amount after deducting the fee.
     * @dev it calculates (1 - fee) * amount
     * @param _amount Amount to calculate the fee from
     */
    function applyFee(uint256 _amount) internal view returns (uint256) {
        return _amount.mul(FEE_BASE.sub(feeAmount)).div(FEE_BASE);
    }

    /**
     * Calculates the fee amount.
     * @dev it calculates fee * amount
     * @param _amount Amount to calculate the fee from
     */
    function calculateFee(uint256 _amount) internal view returns (uint256) {
        return _amount.mul(feeAmount).div(FEE_BASE);
    }

    /**
     * @dev Check that nft token is in the allowed list
     * @param _token Address of token
     */
    function isTokenAllowed(address _token) public view returns (bool) {
        for (uint256 i = 0; i < allowedTokens.length; i++) {
            if (allowedTokens[i] == _token) {
                return true;
            }
        }
    }

    /**
     * @dev Check that erc token is in the allowed list
     * @param _erc Address of token
     */
    function isStableAllowed(address _erc) public view returns (bool) {
        for (uint256 i = 0; i < allowedStables.length; i++) {
            if (allowedStables[i] == _erc) {
                return true;
            }
        }
    }

    /**
     * @dev Check that type of nft token is in the allowed list
     * @param _type Type of NFT token
     */
    function isTypeAllowed(uint256 _type) public view returns (bool) {
        for (uint256 i = 0; i < allowedTypes.length; i++) {
            if (allowedTypes[i] == _type) {
                return true;
            }
        }
    }

    /**
     * @dev Check that user is already in the index, i.e. placed any order
     * @param _user Address of user
     */
    function isUserExists(address _user) public view returns (bool) {
        for (uint256 i = 0; i < _userIndexes.length; i++) {
            if (_userIndexes[i] == _user) {
                return true;
            }
        }
    }

    /**
     * @dev Pause all activity of contract orders (owner only)
     */
    function pause() public onlyOwner whenNotPaused {
        _pause();
    }

    /**
     * @dev Unpause all activity of contract orders (owner only)
     */
    function unpause() public onlyOwner whenPaused {
        _unpause();
    }
}
