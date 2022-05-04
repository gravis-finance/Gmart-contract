// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "./interfaces/IERC721Typed.sol";
import "./interfaces/IStaking.sol";

contract Gmart is OwnableUpgradeable, PausableUpgradeable {
    uint256 constant DECIMAL_PRECISION = 2;
    uint256 constant PERCENTS_SUM = 100 * 10**DECIMAL_PRECISION;

    /// @notice Maximal possible protocol defaultFee
    uint256 public constant MAX_FEE = 3333; // 33,33% (in order to avoid sum of fees exceeding 100%)

    /// @notice EIP-712 domain typehash
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );

    /// @notice EIP-712 domain version hash
    bytes32 private constant VERSION_HASH = keccak256("1");

    /// @notice EIP-812 domain name hash
    bytes32 private constant NAME_HASH = keccak256("Gmart");

    /// @notice EIP-712 order typehash
    bytes32 private constant ORDER_TYPEHASH =
        keccak256(
            "Order(address account,uint8 side,address commodity,uint256[] tokenIds,address currency,uint256 amount,uint64 expiry,uint8 nonce)"
        );

    /// @notice Enum representing two possible order sides
    enum OrderSide {
        Buy,
        Sell
    }

    /// @notice Structure representing ECDSA signature
    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /// @notice Structure representing order
    /// @param account Account signing order
    /// @param side Order side
    /// @param commodity Address of the commodity token (ERC721)
    /// @param tokenIds List of token IDs included in this order
    /// @param currency Address of the currency token (ERC20)
    /// @param amount Amount of currency paid in this order (as wei)
    /// @param expiry Timestamp when order expires
    /// @param nonce Nonce of the order (to make several orders with same params possible)
    struct Order {
        address account;
        OrderSide side;
        address commodity;
        uint256[] tokenIds;
        address currency;
        uint256 amount;
        uint64 expiry;
        uint8 nonce;
    }

    /// @notice Enum representing possible order states
    enum OrderState {
        None,
        Cancelled,
        Executed
    }

    /// @notice Mapping of order hashes to their states
    mapping(bytes32 => OrderState) public orderStates;

    /// @notice Protocol treasury address
    address public treasury;

    /// @notice Staking
    address public staking;

    /// @notice Protocol default fee as percents (with 2 decimals)
    uint256 public defaultFee;

    struct CommodityInfo {
        bool enabled;
        address feeRecipient1;
        address feeRecipient2;
        uint256 fee1;
        uint256 fee2;
    }

    /// @notice Mapping of commodity addresses to flags if they are enabled
    mapping(address => CommodityInfo) public commodityInfo;

    /// @notice Mapping of combinations of commodity addresses and types to flags if they are enabled
    mapping(address => mapping(uint256 => bool)) public typeEnabled;

    /// @notice Mapping of currency addresses to flags if they are enabled
    mapping(address => bool) public currencyEnabled;

    /// @notice Mapping of currency addresses to discount percent
    mapping(address => uint256) public currencyDiscountPercent;


    /// @notice Discounts count
    uint256 public discountsLength;

    /// @notice Mapping of staked amount to discount percents
    mapping(uint256 => uint256) public discountPercents;

    // CONSTRUCTOR

    /// @notice Upgradeable contract constructor
    /// @param treasury_ Protocol treasury address
    /// @param defaultFee_ Protocol default fee as percents (with 2 decimals)
    function initialize(
        address treasury_,
        uint256 defaultFee_
    ) external initializer {
        require(treasury_ != address(0), "Gmart: zero address of treasury");
        require(defaultFee_ <= MAX_FEE, "Gmart: invalid fee");

        __Ownable_init();
        treasury = treasury_;
        defaultFee = defaultFee_;
    }

    // EVENTS

    /// @notice Event emitted when order is cancelled
    event OrderCancelled(Order order);

    /// @notice Event emitted when order is executed with some taker
    event OrderExecuted(Order order, address taker);

    // PUBLIC FUNCTIONS

    /// @notice Function used to cancel order
    /// @param order Order object representing order being cancelled
    function cancelOrder(Order memory order) external whenNotPaused {
        require(order.account == msg.sender, "Gmart: sender is not order account");
        bytes32 orderHash = hashOrder(order);
        require(orderStates[orderHash] == OrderState.None, "Gmart: order is in wrong state");

        orderStates[orderHash] = OrderState.Cancelled;
        emit OrderCancelled(order);
    }

    /// @notice Function used to match given order (execute it)
    /// @param order Order being executed
    /// @param sig Order signature
    function matchOrder(Order memory order, Signature memory sig) external whenNotPaused {
        bytes32 orderHash = checkSignature(order, sig);
        _checkOrder(order, orderHash);
        CommodityInfo memory info = commodityInfo[order.commodity];
        _checkCommodity(order, info);

        orderStates[orderHash] = OrderState.Executed;

        address seller;
        address buyer;

        if (order.side == OrderSide.Buy) {
            seller = msg.sender;
            buyer = order.account;
        } else {
            seller = order.account;
            buyer = msg.sender;
        }

        // Transfer fee
        (
            uint256 defaultFeeAmount,
            uint256 collectionFeeAmount1,
            uint256 collectionFeeAmount2
        ) = getFeeAmounts(seller, order);

        if (defaultFeeAmount > 0) {
            IERC20Upgradeable(order.currency).transferFrom(
                buyer,
                treasury,
                defaultFeeAmount
            );
        }

        if (collectionFeeAmount1 > 0) {
            IERC20Upgradeable(order.currency).transferFrom(
                buyer,
                info.feeRecipient1,
                collectionFeeAmount1
            );
        }

        if (collectionFeeAmount2 > 0) {
            IERC20Upgradeable(order.currency).transferFrom(
                buyer,
                info.feeRecipient2,
                collectionFeeAmount2
            );
        }

        // Pay for order
        uint256 amount = order.amount - defaultFeeAmount - collectionFeeAmount1 - collectionFeeAmount2;
        IERC20Upgradeable(order.currency).transferFrom(
            buyer,
            seller,
            amount
        );

        // Transfer commodity
        for (uint256 i = 0; i < order.tokenIds.length; i++) {
            IERC721Upgradeable(order.commodity).safeTransferFrom(seller, buyer, order.tokenIds[i]);
        }

        emit OrderExecuted(order, msg.sender);
    }

    // RESTRICTED FUNCTIONS

    function setStaking(address staking_) external onlyOwner {
        staking = staking_;
    }

    function setPaused(bool value) external onlyOwner {
        if (value) {
            _pause();
        } else {
            _unpause();
        }
    }

    /// @notice Owner function to set new treasury
    /// @param treasury_ New treasury address
    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "Gmart: zero address");
        treasury = treasury_;
    }

    /// @notice Owner function to set new default fee
    /// @param defaultFee_ New default fee as percents (with 2 decimals)
    function setFee(uint256 defaultFee_) external onlyOwner {
        require(defaultFee_ <= MAX_FEE, "Gmart: invalid fee");
        defaultFee = defaultFee_;
    }

    /// @notice Owner function to set some commodity as enabled or disabled
    /// @param commodity Commodity address
    /// @param info CommodityInfo structure
    function setCommodityInfo(address commodity, CommodityInfo memory info) external onlyOwner {
        require(defaultFee + info.fee1 + info.fee2 <= MAX_FEE, "Gmart: invalid fee");
        commodityInfo[commodity] = info;
    }

    /// @notice Owner function to set some commodity type as enabled or disabled
    /// @param commodity Commodity address
    /// @param typeId Type ID
    /// @param enabled True to enable, false to disable
    function setType(
        address commodity,
        uint256 typeId,
        bool enabled
    ) external onlyOwner {
        typeEnabled[commodity][typeId] = enabled;
    }

    /// @notice Owner function to set some currency as enabled or disabled
    /// @param currency Currency address
    /// @param discountPercent Curency discount percent (with 2 decimals)
    /// @param enabled True to enable, false to disable
    function setCurrency(address currency, uint256 discountPercent, bool enabled) external onlyOwner {
        // require(discountPercent > 0, "Gmart: percent must be greater than 0");
        require(discountPercent <= PERCENTS_SUM, "Gmart: percent greater than PERCENTS_SUM");

        currencyEnabled[currency] = enabled;
        currencyDiscountPercent[currency] = discountPercent;
    }

    function discountsSet(uint256[] memory percents) external onlyOwner {
        for (uint256 i; i < percents.length; i++) {
            require(percents[i] <= PERCENTS_SUM, "Gmart: percent greater then PERCENTS_SUM");

            discountPercents[i] = percents[i];
        }

        if (discountsLength > percents.length) {
            discountsPop(discountsLength - percents.length);
        }
        else {
            discountsLength = percents.length;
        }
    }

    function discountsPop(uint256 times) public onlyOwner {
        require(times <= discountsLength, "Gmart: over discounts length");

        discountsLength-= times;
        for (uint256 i; i < times; i++) {
            delete discountPercents[i];
        }
    }

    // VIEW FUNCTIONS

    /// @notice Function to get EIP-712 domain hash
    /// @return Domain hash
    function domainHash() public view returns (bytes32) {
        uint256 chainId;

        assembly {
            chainId := chainid()
        }

        return
            keccak256(
                abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, chainId, address(this))
            );
    }

    /// @notice Public library function that hashes order according to EIP-712
    /// @param order Order to hash
    /// @return EIP-712 order hash
    function hashOrder(Order memory order) public pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    ORDER_TYPEHASH,
                    order.account,
                    order.side,
                    order.commodity,
                    keccak256(abi.encodePacked(order.tokenIds)),
                    order.currency,
                    order.amount,
                    order.expiry,
                    order.nonce
                )
            );
    }

    function checkOrder(Order memory order) external view returns (bytes32) {
        bytes32 orderHash = hashOrder(order);
        _checkOrder(order, orderHash);
        CommodityInfo memory info = commodityInfo[order.commodity];
        _checkCommodity(order, info);

        return orderHash;
    }

    /// @notice Public function that checks order EIP-712 signature and returns it's hash
    /// @param order Order to check signature for
    /// @param sig EIP-712 signature
    /// @return Order hash
    function checkSignature(Order memory order, Signature memory sig)
        public
        view
        returns (bytes32)
    {
        bytes32 orderHash = hashOrder(order);
        bytes32 digest = keccak256(abi.encodePacked(uint16(0x1901), domainHash(), orderHash));
        address signer = ECDSAUpgradeable.recover(digest, sig.v, sig.r, sig.s);

        require(signer == order.account, "Gmart: invalid signature");

        return orderHash;
    }

    // Discount percent = PERCENTS_SUM - discountMultiplier
    function discountMultiplier(address seller, Order memory order) public view returns (uint256) {
        uint256 discount = PERCENTS_SUM;

        if (staking != address(0)) {
            uint256 stakingLevel = IStaking(staking).currentLevelIndex(seller);
            discount = PERCENTS_SUM - discountPercents[stakingLevel];
        }

        if (currencyDiscountPercent[order.currency] > 0) {
            discount = discount * (PERCENTS_SUM - currencyDiscountPercent[order.currency]) / PERCENTS_SUM;
        }

        return discount;
    }

    function getFeeAmounts(address seller, Order memory order) public view returns (
        uint256 defaultFeeAmount,
        uint256 collectionFeeAmount1,
        uint256 collectionFeeAmount2
    ) {
        CommodityInfo memory info = commodityInfo[order.commodity];
        uint256 discount = discountMultiplier(seller, order);

        defaultFeeAmount = _calcFee(order, defaultFee, discount);
        collectionFeeAmount1 = _calcFee(order, info.fee1, PERCENTS_SUM);
        collectionFeeAmount2 = _calcFee(order, info.fee2, PERCENTS_SUM);

        return (defaultFeeAmount, collectionFeeAmount1, collectionFeeAmount2);
    }

    // INTERNAL FUNCTIONS

    function _checkOrder(Order memory order, bytes32 orderHash) internal view {
        require(orderStates[orderHash] == OrderState.None, "Gmart: order is in wrong state");
        require(currencyEnabled[order.currency], "Gmart: contract not enabled as currency");
        require(block.timestamp < order.expiry, "Gmart: order expired");
    }

    function _checkCommodity(Order memory order, CommodityInfo memory info) internal view {
        if (!info.enabled) {
            for (uint256 i = 0; i < order.tokenIds.length; i++) {
                uint256 typeId = IERC721Typed(order.commodity).getTokenType(order.tokenIds[i]);
                require(typeEnabled[order.commodity][typeId], "Gmart: this commodity not enabled");
            }
        }
    }

    function _calcFee(Order memory order, uint256 fee, uint256 discount) internal pure returns (uint256) {
        uint256 feeAmount = (order.amount * fee) / PERCENTS_SUM;

        return (feeAmount * discount) / PERCENTS_SUM;
    }
}
