require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');
require('dotenv').config();
const { task } = require('hardhat/config');
const { envVal, azureInit } = require('./scripts/utils/config');

const { scanApiKey } = require('./scripts/utils/helpers');

task('run', '(injected) Runs a user-defined script after compiling the project', async (args, hre, runSuper) => {
  await azureInit();
  await runSuper(args);
});


const sentry = {
  dsn: envVal('SENTRY_DSN', 'https://sentry_dsn', 'sentry_priv'),
  levels: envVal('SENTRY_LEVELS', ['warning', 'error', 'fatal'], 'list'),
};

const defaultCfg = {
  url: envVal('RPC_URL', 'RPC NOT SETTED'),
  accounts: envVal('PRIVATE_KEYS', [], 'privlist'),

  market: envVal('MARKET'),
  mongo: envVal('MONGO_CFG', 'mongodb://localhost:27017', 'privstring'),
  staking: envVal('STAKING'),
  sentry,
  httpPort: envVal('HTTP_PORT', 3001),
};

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: '0.8.11',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      }
    }
  },
  etherscan: {
    apiKey: scanApiKey(),
  },
  defaultNetwork: 'env',
  networks: {
    'env': defaultCfg,
    'aurora-testnet': Object.assign({}, defaultCfg, {
      url: 'https://testnet.aurora.dev',
      chainId: 1313161555,
      // gasPrice: 120 * 1000000000,
      // gasPrice: 30000000000000000,

      market: '',
      mongo: 'mongodb://localhost:27017/market_aurora',
    }),
    'bsc-testnet': Object.assign({}, defaultCfg, {
      url: envVal('RPC_URL', 'https://data-seed-prebsc-1-s1.binance.org:8545/'),
      market: '',
      mongo: 'mongodb://localhost:27017/market',
    }),
    'matic-testnet': Object.assign({}, defaultCfg, {
      market: '',
      url: envVal('RPC_URL', 'https://matic-mumbai.chainstacklabs.com'),
    }),

    'matic-mainnet': Object.assign({}, defaultCfg, {
      url: envVal('RPC_URL', 'https://rpc-mainnet.matic.quiknode.pro'),
      market: '',
      mongo: envVal('MONGO_CFG', 'mongodb://localhost:27017/market', 'privstring'),
    }),
    'bsc-mainnet': Object.assign({}, defaultCfg, {
      url: envVal('RPC_URL', 'https://bsc-dataseed.binance.org'),
      market: '',
      mongo: envVal('MONGO_CFG', 'mongodb://localhost:27017/market', 'privstring'),
    }),
  },
};
