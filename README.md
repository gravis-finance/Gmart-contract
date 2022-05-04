# Offchain Auction

### Compile

Copy `.env.example` to a new file called `.env` and fill the values in it.

```
npx hardhat compile
```

### Test

```
npx hardhat test
```

### Deploy

Fill all empty value in file `scripts/deploy.ts`
Then run:

```
npx hardhat run scripts/deploy.ts --network [Your Network]
```

### Upgrade

Fill all empty value in file `scripts/upgrade.ts`
Run:

```
npx hardhat run scripts/upgrade.ts --network [Your Network]
```

### Configuration

To connect to contract using hardhat console, execute following in terminal at this project directory:

```
npx hardhat --network [Your network] console
```

```
market = await ethers.getContractAt("Market", "[Market proxy address]");
```

To configure contract execute functions from documentation as following:

```
await market.setCurrency("0xab...yz", true)
```

## Functions

Functions documentation is available [here](/Market.md)

## Offchain Orders

This contract is based on offchain order signing. Orders (signed by maker) are stored in backend until someone (taker) decides to accept it and submit to blockchain.

EIP-712 is used for signing orders. More information about it you can find over here: https://eips.ethereum.org/EIPS/eip-712

Following EIP-712 domain is used:

```
EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)
```

Following Order typehash is used:

```
Order(address account,uint8 side,address commodity,uint256[] tokenIds,address currency,uint256 amount,uint64 expiry,uint8 nonce)
```

So in your code you're supposed to pass something like that as types object to "sign typed data" function:

```jsx
const TypesOrder = {
    Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
    ]
    Order: [
        { name: "account", type: "address" },
        { name: "side", type: "uint8" },
        { name: "commodity", type: "address" },
        { name: "tokenIds", type: "uint256[]" },
        { name: "currency", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "expiry", type: "uint64" },
        { name: "nonce", type: "uint8" },
    ],
};
```
