// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC721/ERC721HolderUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol';

import '@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/SafeERC20Upgradeable.sol';

contract GravisTradingPostV3 is OwnableUpgradeable, ERC721HolderUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeMathUpgradeable for uint256;

    uint256 public constant FEE_BASE = 10000;

    // Recipient of fees.
    address public feeRecipient;

    // Fee amount in basis points
    uint256 public feeAmount;

    struct Order {
        // Order ID
        uint256 orderId;
        // Order maker
        address maker;
        // NFT contract instance.
        address nft;
        // Price for each token.
        uint256 price;
        // Token IDs
        uint256[] tokenIds;
        // Fee coefficient
        uint256 feeMultiplier;
    }

    struct CollectionInfo {
        // If record exists
        bool exists;
        // First fee in basis points
        uint256 feeAmount1;
        // second fee in basis points
        uint256 feeAmount2;
        // Fee coefficient
        uint256 feeMultiplier;
        // Collection floor price
        uint256 floorPrice;
    }

    address[] public allowedTokens;
    address[] public allowedStables;

    uint256 public orderId;
    mapping(uint256 => Order) private ordersById;

    mapping(address => CollectionInfo) public collectionInfos;

    event OrderPlaced(uint256 indexed orderId, address indexed maker, address indexed nft, uint256 price, uint256[] ids);
    event OrderUpdated(uint256 indexed orderId, uint256 indexed price);

    event OrderFilled(
        address indexed nft,
        address indexed maker,
        address indexed taker,
        address stable,
        uint256 orderId,
        uint256 amount,
        uint256 price,
        uint256[] ids
    );
    event OrderCancelled(uint256 indexed orderId);
    event OrderDeleted(uint256 indexed orderId);

    function initialize(
        address _feeRecipient,
        uint256 _feeAmount,
        address[] memory _tokens,
        address[] memory _stables
    ) public initializer {
        __Ownable_init();
        __ERC721Holder_init_unchained();
        __Pausable_init_unchained();
        __ReentrancyGuard_init_unchained();

        __GravisTradingPost_init_unchained(_feeRecipient, _feeAmount, _tokens, _stables);
    }

    function __GravisTradingPost_init_unchained(
        address _feeRecipient,
        uint256 _feeAmount,
        address[] memory _tokens,
        address[] memory _stables
    ) internal initializer {
        feeRecipient = _feeRecipient;
        feeAmount = _feeAmount;
        allowedTokens = _tokens;
        allowedStables = _stables;
    }

    function getOrderById(uint256 _orderId) public view returns (Order memory) {
        return ordersById[_orderId];
    }

    function getOrders() public view returns (Order[] memory orders) {
        uint256 totalOrders = 0;

        for (uint256 i = 1; i <= orderId; i++) {
            if (ordersById[i].tokenIds.length > 0 && ordersById[i].price > 0) {
                totalOrders++;
            }
        }

        uint256 orderIndex = 0;
        orders = new Order[](totalOrders);

        for (uint256 i = 1; i <= orderId; i++) {
            if (ordersById[i].tokenIds.length > 0 && ordersById[i].price > 0) {
                orders[orderIndex] = ordersById[i];
                orderIndex++;
            }
        }
    }

    function getOrdersByMaker(address _maker) public view returns (Order[] memory orders) {
        uint256 totalOrders = 0;

        for (uint256 i = 1; i <= orderId; i++) {
            if (ordersById[i].tokenIds.length > 0 && ordersById[i].price > 0 && ordersById[i].maker == _maker) {
                totalOrders++;
            }
        }

        uint256 orderIndex = 0;
        orders = new Order[](totalOrders);

        for (uint256 i = 1; i <= orderId; i++) {
            if (ordersById[i].tokenIds.length > 0 && ordersById[i].price > 0 && ordersById[i].maker == _maker) {
                orders[orderIndex] = ordersById[i];
                orderIndex++;
            }
        }
    }

    function getOrdersByCollection(address[] memory _nfts) public view returns (Order[] memory orders) {
        uint256 totalOrders = 0;

        for (uint256 i = 1; i <= orderId; i++) {
            if (ordersById[i].tokenIds.length > 0 && ordersById[i].price > 0) {
                for (uint256 j = 0; j < _nfts.length; j++) {
                    if (ordersById[i].nft == _nfts[j]) {
                        totalOrders++;
                    }
                }
            }
        }

        uint256 orderIndex = 0;
        orders = new Order[](totalOrders);

        for (uint256 i = 1; i <= orderId; i++) {
            if (ordersById[i].tokenIds.length > 0 && ordersById[i].price > 0) {
                for (uint256 j = 0; j < _nfts.length; j++) {
                    if (ordersById[i].nft == _nfts[j]) {
                        orders[orderIndex] = ordersById[i];
                        orderIndex++;
                    }
                }
            }
        }
    }

    function placeOrder(
        address _nft,
        uint256 _price,
        uint256[] memory _ids
    ) public whenNotPaused {
        require(_price > 0, 'GravisTradingPost: Zero price');
        require(_ids.length > 0, 'GravisTradingPost: Incorrect tokens amount');

        require(isTokenAllowed(_nft), 'GravisTradingPost: NFT not allowed');

        safeMassTransferAssets(_nft, _msgSender(), address(this), _ids);

        orderId = orderId.add(1);
        ordersById[orderId] = Order(orderId, _msgSender(), _nft, _price, _ids, 1);

        emit OrderPlaced(orderId, _msgSender(), _nft, _price, _ids);
    }

    function updateOrder(uint256 _orderId, uint256 _price) public whenNotPaused {
        Order storage order = findOrder(_orderId);

        require(_price > 0, 'GravisTradingPost: Zero price');
        require(orderExists(order), 'GravisTradingPost: Order not exists');
        require(order.maker == _msgSender(), 'GravisTradingPost: Sender is not an owner of the order');

        order.price = _price;

        emit OrderUpdated(_orderId, _price);
    }

    function cancelOrder(uint256 _orderId) public whenNotPaused {
        Order storage order = findOrder(_orderId);

        require(orderExists(order), 'GravisTradingPost: Order not exists');
        require(order.maker == _msgSender(), 'GravisTradingPost: Sender is not an owner of the order');

        uint256[] memory ids = order.tokenIds;
        address nft = order.nft;

        removeOrder(_orderId);

        // Still has the balance of NFT on the contract
        // Should transfer NFTs back to the caller
        if (ids.length > 0) {
            safeMassTransferAssets(nft, address(this), _msgSender(), ids);
        }

        emit OrderCancelled(_orderId);
    }

    function fillOrder(
        uint256 _orderId,
        uint256 _amount,
        address _stable
    ) public whenNotPaused nonReentrant {
        Order storage order = findOrder(_orderId);

        require(_amount > 0, 'GravisTradingPost: Zero amount');
        require(isStableAllowed(_stable), 'GravisTradingPost: Stable not allowed');
        require(orderExists(order), 'GravisTradingPost: Order not exists');
        require(order.tokenIds.length >= _amount, 'GravisTradingPost: Not enough amount');

        uint256 fullPrice = _amount.mul(order.price);

        uint256[] memory idsToTransfer = new uint256[](_amount);

        address nft = order.nft;
        address maker = order.maker;

        for (uint256 i = 0; i < _amount; i++) {
            idsToTransfer[i] = order.tokenIds[i];
        }

        // Reset order if its fully filled
        if (order.tokenIds.length == _amount) {
            removeOrder(_orderId);
        } else {
            uint256 left = order.tokenIds.length.sub(_amount);

            // should sub array of token ids
            uint256[] memory whatsLeft = new uint256[](left);

            for (uint256 i = _amount; i < order.tokenIds.length; i++) {
                whatsLeft[i.sub(_amount)] = order.tokenIds[i];
            }

            order.tokenIds = whatsLeft;
        }

        IERC20Upgradeable stable = IERC20Upgradeable(_stable);

        //Calculate default fee
        uint256 fee = calculateFee(fullPrice, feeAmount);

        //Calculate maker amount
        uint256 makerAmount = fullPrice.sub(fee);

        // Transfer fee to feeRecipient
        if (fee > 0) stable.safeTransferFrom(_msgSender(), feeRecipient, fee);
        // Transfer stables to maker
        stable.safeTransferFrom(_msgSender(), maker, makerAmount);
        // Transfer NFTs to taker
        safeMassTransferAssets(nft, address(this), _msgSender(), idsToTransfer);

        emit OrderFilled(nft, maker, _msgSender(), _stable, _orderId, _amount, fullPrice, idsToTransfer);
    }

    function deleteOrder(uint256 _orderId) public onlyOwner {
        Order storage order = findOrder(_orderId);

        require(orderExists(order), 'GravisTradingPost: Order not exists');

        uint256[] memory ids = order.tokenIds;
        address nft = order.nft;

        removeOrder(_orderId);

        // Still has the balance of NFT on the contract
        // Should transfer NFTs back to the caller
        if (ids.length > 0) {
            safeMassTransferAssets(nft, address(this), _msgSender(), ids);
        }

        emit OrderDeleted(_orderId);
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
     * @dev Find an order by orderId
     * @param _orderId orderId
     * @return Order
     */
    function findOrder(uint256 _orderId) internal view returns (Order storage) {
        return ordersById[_orderId];
    }

    /**
     * @dev Delete an order by orderId
     * @param _orderId orderId
     */
    function removeOrder(uint256 _orderId) internal {
        delete ordersById[_orderId];
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
            IERC721Upgradeable(_asset).safeTransferFrom(_from, _to, _ids[i]);
        }
    }

    /**
     * @dev Check that order exists in the order list
     * @param _order Order
     * @return exists
     */
    function orderExists(Order memory _order) internal pure returns (bool exists) {
        return _order.price > 0 && _order.tokenIds.length > 0;
    }

    /**
     * Calculates the fee amount.
     * @dev it calculates fee * amount
     * @param _amount Amount to calculate the fee from
     * @param _fee fee value
     */
    function calculateFee(uint256 _amount, uint256 _fee) internal pure returns (uint256) {
        return _amount.mul(_fee).div(FEE_BASE);
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
