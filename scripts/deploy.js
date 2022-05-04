const hre = require('hardhat');
require('./utils/logger');
const {
  die, delay,
  chkErrors, chkDeploy,
  checkSync,
  sendTx, toEthers, toWeis, pretyEntry,
} = require('./utils/helpers');

const cfg = hre.network.config;
const MARKET = cfg.market;
const TREASURY = process.env.TREASURY || die('TREASURY');
const STAKING = cfg.staking;

const DECIMAL_PRECISION = 2;
const PERSENT = Math.pow(10, DECIMAL_PRECISION);
console.log(PERSENT);

const FEE = process.env.FEE * PERSENT || 0;
const STAKING_DISCOUNTS = [
  0,
  25 * PERSENT,
  50 * PERSENT,
  75 * PERSENT,
  100 * PERSENT,
]

async function main() {
  console.log('Provider:', hre.network.config.url);
  console.log('Network name:', hre.network.name);

  chkErrors();
  await checkSync();

  const provider = hre.ethers.provider;
  const deployer = new hre.ethers.Wallet(hre.network.config.accounts[0], provider);
/*
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    console.fatal('Deployer account not set.')
    return;
  }*/

  console.log('Deployer:', deployer.address);
  console.log('Initial balance:', toEthers(await provider.getBalance(deployer.address)).toString());

  chkDeploy();

  // Deployment
  const MarketFactory = await ethers.getContractFactory('Gmart');
  let impl, contract;

  if (MARKET) {
    contract = MarketFactory.attach(MARKET);
    console.done('Gmart (proxy) exist at:', contract.address);
  }
  else {
    const args = [
      TREASURY,
      FEE,
      // STAKING,
    ];
    contract = await upgrades/*.connect(deployer)*/.deployProxy(MarketFactory, args, { deployer });
    await contract.deployed();
    console.log('Gmart (proxy) deployed to:', contract.address);

  }

  const proxyAdmin = await upgrades.admin.getInstance();
  impl = await proxyAdmin.getProxyImplementation(contract.address);
  console.log('Gmart (implementation) at:', impl);

  if (STAKING) {
    const staking = await contract.staking();
    if (staking == STAKING) {
      console.done('Staking already setted', STAKING);
    }
    else {
      console.log({staking, STAKING});
      await sendTx('setStaking', contract.setStaking, [STAKING]);
    }

    if (process.env.SET_DISCOUNTS) {
      // console.log({ STAKING_DISCOUNTS });
      await sendTx('discountsSet', contract.discountsSet, [STAKING_DISCOUNTS]);
    }
  }

  // Verification
  if (network.name !== 'localhost' /*&& network.name !== 'env'*/) {
    console.log('Sleeping before verification...');
    await delay(5000);

    await hre.run('verify:verify', {
      address: impl,
    });
  }

  console.log('Final balance:', toEthers(await provider.getBalance(deployer.address)).toString());
  console.done('All done!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
