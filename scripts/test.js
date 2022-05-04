const hre = require('hardhat');
require('./utils/logger');
const {
  die, delay,
  chkErrors, chkDeploy,
  sendTx, toEthers, toWeis, pretyEntry,
} = require('./utils/helpers');

const DECIMAL_PRECISION = 2;
const PERSENT = Math.pow(10, DECIMAL_PRECISION);

const cfg = hre.network.config;
const MARKET = cfg.market || die('MARKET');
const NFT = process.env.NFT && process.env.NFT.split(',') || die('NFT');
const NFT_TYPE = process.env.NFT_TYPE || 0;

const CURRENCY = process.env.CURRENCY && process.env.CURRENCY.split(',') || die('CURRENCY');
const CURRENCY_DISCOUNT = 20 * PERSENT;

const FEE = 1 * PERSENT;
const FEE_PARTNER = 2 * PERSENT;

async function main() {
  console.log('Provider:', hre.network.config.url);
  console.log('Network name:', hre.network.name);

  chkErrors();

  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    console.fatal('Deployer account not set.')
    return;
  }

  console.log('Deployer:', deployer.address);
  console.log('Initial balance:', toEthers(await hre.ethers.provider.getBalance(deployer.address)).toString());


  // Deployment
  const MarketFactory = await ethers.getContractFactory('Gmart');

  const contract = MarketFactory.attach(MARKET);
  console.done('Gmart (proxy) exist at:', contract.address);

  const ACCOUNT = deployer.address;
  if (process.env.DEPLOY) {
    if (process.env.SET_COMMODITY) {
      for (const nft of NFT) {
        await sendTx('setCommodityInfo', contract.setCommodityInfo, [
          nft, {
            enabled: true,
            fee1: FEE,
            fee2: FEE_PARTNER,
            feeRecipient1: ACCOUNT,
            feeRecipient2: ACCOUNT,
          }]);
      }
    }
    if (process.env.SET_COMMODITY_TYPE) {
      for (const nft of NFT) {
        await sendTx('setType', contract.setType, [
          nft, NFT_TYPE, true,
        ]);
      }
    }

    if (process.env.SET_CURRENCY) {
      for (const currency of CURRENCY) {
        await sendTx('setCurrency', contract.setCurrency, [
          currency, CURRENCY_DISCOUNT, true,
        ]);
      }
    }
  }
  else {
    console.warn('Write processes are skiped. DEPLOY=1 not setted');
  }

  const staking = (await contract.staking()).toString();
  console.log({ staking });
  discountsLength = Number(await contract.discountsLength());
  console.log({ discountsLength });
  console.log('test discountPercents:');
  for (let i = 0; i < discountsLength; i++) {
    const discountPercent = await contract.discountPercents(i);
    console.log('discount', discountPercent.toString());
  }

  const blockNumber = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNumber);
  console.log('Current block', { blockNumber, timestamp: block.timestamp });
  const ORDER = {
    account: ACCOUNT,
    side: 0,
    commodity: NFT[0],
    tokenIds: [1],
    currency: CURRENCY[0],
    amount: toWeis(1).toString(),
    expiry: block.timestamp + 1000,
    nonce: 1,
  };

  console.log('Test', {
    ORDER,
    discountMultiplier: (await contract.discountMultiplier(ACCOUNT, ORDER)).toString(),
    getFeeAmounts: pretyEntry(await contract.getFeeAmounts(ACCOUNT, ORDER)),
  });

  for (const currency of CURRENCY) {
    console.log({ currency }, (await contract.currencyEnabled(currency)).toString());
    console.log('currencyDiscountPercent', (await contract.currencyDiscountPercent(currency)).toString());
  }

  for (const nft of NFT) {
    const types = {};
    for (let i = 0; i <= 7; i++) {
      types[i] = (await contract.typeEnabled(nft, i)).toString();
    }

    console.log({ nft, types }, pretyEntry(await contract.commodityInfo(nft)));
  }


  /*for (let i = 0; i < Object.keys(STAKING_DISCOUNTS).length; i++) {
    await sendTx('discountDelete', contract.discountDelete, [0]);
  }*/

  console.log('Final balance:', toEthers(await hre.ethers.provider.getBalance(deployer.address)).toString());
  console.done('All done!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
