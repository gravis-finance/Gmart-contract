const hre = require('hardhat');
require('./utils/logger');
const {
  die, delay,
  chkErrors, chkDeploy,
  sendTx, toEthers, toWeis, pretyEntry,
} = require('./utils/helpers');

const DECIMAL_PRECISION = 2;
const PERSENT = Math.pow(10, DECIMAL_PRECISION);

const MARKET = process.env.MARKET || die('MARKET');

const ORDER = {
  "account": "0xdab770d15397fddfbac85d334709c92c2b473b01",
  "side": 1,
  "commodity": "0x536af9300fbeef4bcf6ef669b571f56a5c710e1a",
  "tokenIds": [
    109
  ],
  "currency": "0x944f3308686961d1676496eb72433f20cb908ed6",
  "amount": "103000000000000000000",
  "expiry": 1651143087,
  "nonce": 0
}

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

  const contract = MarketFactory.attach(process.env.MARKET);
  console.done('Gmart (proxy) exist at:', contract.address);

  await sendTx('cancelOrder', contract.cancelOrder, [ORDER]);

  console.log('Final balance:', toEthers(await hre.ethers.provider.getBalance(deployer.address)).toString());
  console.done('All done!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
