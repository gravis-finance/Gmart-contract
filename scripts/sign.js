const hre = require('hardhat');
require('./utils/logger');
const {
  die, delay,
  chkErrors, chkDeploy,
  sendTx, toEthers, toWeis, pretyEntry,
  getRSVFromSign,
} = require('./utils/helpers');
const { ORDER_SIDE } = require('./app/constants');


const cfg = hre.network.config;
const MARKET = cfg.market || die('MARKET');

const commodity = process.env.NFT && process.env.NFT.split(',')[0] || die('NFT');
const currency = process.env.CURRENCY && process.env.CURRENCY.split(',')[0] || die('CURRENCY');

const ORDER = {
  "account": "0xBbA33901Db9Ce3B18578799bde301Ef02CF5D263",
  "side": 1,
  "commodity": "0xe9d553d7b7050d6d0a48c15ad2efc2bb6ccdfd60",
  "tokenIds": [
    105
  ],
  "currency": "0x1138eBb3101f557b28326a28B6f192c7feCC95f7",
  "amount": "2000000000000000000",
  "expiry": 4000000000,
  "nonce": 0
}

const Domain = async (market) => {
  const { chainId } = await market.provider.getNetwork();
  return {
    name: 'Gmart',
    version: '1',
    chainId,
    verifyingContract: market.address,
  }
};

const TypesOrder = {
  Order: [
    { name: 'account', type: 'address' },
    { name: 'side', type: 'uint8' },
    { name: 'commodity', type: 'address' },
    { name: 'tokenIds', type: 'uint256[]' },
    { name: 'currency', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'expiry', type: 'uint64' },
    { name: 'nonce', type: 'uint8' },
  ],
};



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
  ORDER.account = deployer.address;

  // Deployment
  const MarketFactory = await ethers.getContractFactory('Gmart');

  const contract = MarketFactory.attach(MARKET);
  console.done('Gmart (proxy) exist at:', contract.address);

  // const block = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
  // console.log('Current block', block);

  const domain = await Domain(contract);
  console.log('domain', { domain });

  ORDER.account = ORDER.account.toLowerCase();
  ORDER.commodity = ORDER.commodity.toLowerCase();
  ORDER.currency = ORDER.currency.toLowerCase();

  console.log('Order', ORDER);
  const sign = await deployer._signTypedData(domain, TypesOrder, ORDER);
  console.done({ sign });

  console.log('Verify sign', await contract.checkSignature(ORDER, getRSVFromSign(sign)));

  console.done('All done!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
