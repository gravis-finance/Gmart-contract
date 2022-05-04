# Market

\*\*

## Table of contents:

-   [Variables](#variables)
-   [Functions:](#functions)
    -   [`initialize(address treasury_, uint256 defaultFee_)` (external) ](#market-initialize-address-uint256-)
    -   [`cancelOrder(struct Market.Order order)` (external) ](#market-cancelorder-struct-market-order-)
    -   [`matchOrder(struct Market.Order order, struct Market.Signature sig)` (external) ](#market-matchorder-struct-market-order-struct-market-signature-)
    -   [`setTreasury(address treasury_)` (external) ](#market-settreasury-address-)
    -   [`setFee(uint256 defaultFee_)` (external) ](#market-setdefaultFee-uint256-)
    -   [`setCommodity(address commodity, bool enabled)` (external) ](#market-setcommodity-address-bool-)
    -   [`setType(uint256 typeId, bool enabled)` (external) ](#market-settype-uint256-bool-)
    -   [`setCurrency(address currency, bool enabled)` (external) ](#market-setcurrency-address-bool-)
    -   [`domainHash() → bytes32` (public) ](#market-domainhash--)
-   [Events:](#events)

## Variables <a name="variables"></a>

-   `uint256 MAX_FEE`
-   `mapping(bytes32 => enum Market.OrderState) orderStates`
-   `address treasury`
-   `uint256 defaultFee`
-   `mapping(address => bool) commodityEnabled`
-   `mapping(uint256 => bool) typeEnabled`
-   `mapping(address => bool) currencyEnabled`

## Functions <a name="functions"></a>

### `initialize(address treasury_, uint256 defaultFee_)` (external) <a name="market-initialize-address-uint256-"></a>

_Description_: Upgradeable contract constructor

#### Params

-   `treasury_`: Protocol treasury address

-   `defaultFee_`: Protocol defaultFee as percents (with 2 decimals)

### `cancelOrder(struct Market.Order order)` (external) <a name="market-cancelorder-struct-market-order-"></a>

_Description_: Function used to cancel order

#### Params

-   `order`: Order object representing order being cancelled

### `matchOrder(struct Market.Order order, struct Market.Signature sig)` (external) <a name="market-matchorder-struct-market-order-struct-market-signature-"></a>

_Description_: Function used to match given order (execute it)

#### Params

-   `order`: Order being executed

-   `sig`: Order signature

### `setTreasury(address treasury_)` (external) <a name="market-settreasury-address-"></a>

_Description_: Owner function to set new treasury

#### Params

-   `treasury_`: New treasury address

### `setFee(uint256 defaultFee_)` (external) <a name="market-setdefaultFee-uint256-"></a>

_Description_: Owner function to set new defaultFee

#### Params

-   `defaultFee_`: New defaultFee as percents (with 2 decimals)

### `setCommodityInfo(address commodity, CommodityInfo memory info)` (external) <a name="market-setcommodity-address-bool-"></a>

_Description_: Owner function to set some commodity info

#### Params

-   `commodity`: Commodity address

-   `info`: CommodityInfo structure

```jsx
struct CommodityInfo {
    bool enabled;
    address feeRecipient1;
    address feeRecipient2;
    uint256 fee1;
    uint256 fee2;
}
```

### `setType(uint256 typeId, bool enabled)` (external) <a name="market-settype-uint256-bool-"></a>

_Description_: Owner function to set some commodity type as enabled or disabled

#### Params

-   `typeId`: Type ID

-   `enabled`: True to enable, false to disable

### `setCurrency(address currency, bool enabled)` (external) <a name="market-setcurrency-address-bool-"></a>

_Description_: Owner function to set some currency as enabled or disabled

#### Params

-   `currency`: Currency address

-   `enabled`: True to enable, false to disable

### `domainHash() → bytes32` (public) <a name="market-domainhash--"></a>

_Description_: Function to get EIP-712 domain hash

#### Returns

-   Domain hash

### `_hashOrder(struct Market.Order order) → bytes32` (internal) <a name="market-_hashorder-struct-market-order-"></a>

_Description_: Internal library function that hashes order according to EIP-712

#### Params

-   `order`: Order to hash

#### Returns

-   712 order hash

### `_checkSignature(struct Market.Order order, struct Market.Signature sig) → bytes32` (internal) <a name="market-_checksignature-struct-market-order-struct-market-signature-"></a>

_Description_: Internal function that checks order EIP-712 signature and returns it's hash

#### Params

-   `order`: Order to check signature for

-   `sig`: EIP-712 signature

#### Returns

-   Order hash

## Events <a name="events"></a>

### event `OrderCancelled(struct Market.Order order)` <a name="market-ordercancelled-struct-market-order-"></a>

_Description_: Event emitted when order is cancelled

### event `OrderExecuted(struct Market.Order order, address taker)` <a name="market-orderexecuted-struct-market-order-address-"></a>

_Description_: Event emitted when order is executed with some taker
