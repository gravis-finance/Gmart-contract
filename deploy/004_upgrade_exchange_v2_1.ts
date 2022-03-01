import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { sleep } from '../src/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { upgrades, ethers } = hre

  const EXCHANGE_ADDRESS = process.env.EXCHANGE_ADDRESS!

  const ExchangeContract = await ethers.getContractFactory('GravisTradingPostV2_1')

  const exchangeProxy = await upgrades.upgradeProxy(EXCHANGE_ADDRESS, ExchangeContract)

  const proxyAdmin = await upgrades.admin.getInstance()
  console.log('Proxy admin is:', proxyAdmin.address)

  const exchangeImplAddress = await proxyAdmin.getProxyImplementation(exchangeProxy.address)
  console.log('Exchange implementation upgraded to:', exchangeImplAddress)

  if (hre.network.name !== 'hardhat' && hre.network.name !== 'localhost') {
    sleep(10000)
    await hre.run('verify:verify', {
      address: exchangeImplAddress,
      constructorArguments: [],
    })
  }
}
export default func
func.tags = ['ExchangeV2_1']
