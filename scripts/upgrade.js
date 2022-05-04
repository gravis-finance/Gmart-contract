const hre = require('hardhat');
require('./utils/logger');
const {
    die, delay,
    chkErrors, chkDeploy,
    sendTx, toEthers, pretyEntry,
} = require('./utils/helpers');

const MARKET = process.env.MARKET || die('MARKET');

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

    chkDeploy();

    // Deployment
    const MarketFactory = await ethers.getContractFactory('Gmart');
    const proxyAdmin = await upgrades.admin.getInstance();

    await upgrades.upgradeProxy(MARKET, MarketFactory);
    console.log('Gmart proxy upgraded at', MARKET);

    const impl = await proxyAdmin.getProxyImplementation(MARKET);
    console.log('Gmart (implementation) at:', impl);

    // Verification
    if (network.name !== 'localhost' && network.name !== 'env') {
        console.log('Sleeping before verification...');
        await delay(20000);

        await hre.run('verify:verify', {
            address: impl,
        });
    }

    console.log('Final balance:', toEthers(await hre.ethers.provider.getBalance(deployer.address)).toString());
    console.done('All done!');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
