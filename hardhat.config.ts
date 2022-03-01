require('dotenv').config()

import 'hardhat-deploy'
import 'hardhat-deploy-ethers'
import 'hardhat-gas-reporter'
import '@nomiclabs/hardhat-etherscan'
import '@openzeppelin/hardhat-upgrades'
import '@typechain/hardhat'
import 'hardhat-tracer'
import 'solidity-coverage'

import { HardhatUserConfig } from 'hardhat/config'

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      gas: 'auto',
      gasPrice: 'auto',
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      gas: 'auto',
      gasPrice: 'auto',
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      gas: 'auto',
      gasPrice: 'auto',
      accounts: [`${process.env.DEPLOYER_PK}`],
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      gas: 'auto',
      gasPrice: 'auto',
      accounts: [`${process.env.DEPLOYER_PK}`],
    },
    bsctest: {
      url: `https://data-seed-prebsc-2-s3.binance.org:8545`,
      gas: 'auto',
      gasPrice: 'auto',
      chainId: 97,
      saveDeployments: true,
      accounts: [`${process.env.DEPLOYER_PK}`],
    },
    bsc: {
      url: `https://bsc-dataseed.binance.org`,
      gas: 'auto',
      gasPrice: 'auto',
      chainId: 56,
      saveDeployments: true,
      accounts: [`${process.env.DEPLOYER_PK}`],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  namedAccounts: {
    deployer: {
      default: 0,
      1: 0,
      4: 0,
    },
  },
  gasReporter: {
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    currency: 'USD',
    gasPrice: 100,
    enabled: false,
  },
  solidity: {
    version: '0.6.12',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
}

export default config
