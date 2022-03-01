import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { Constants } from '../src/constants'
import { sleep } from '../src/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { upgrades, ethers } = hre

  const { Exchange } = Constants

  const args = [Exchange.feeRecipient, Exchange.feeAmount, Exchange.tokens, Exchange.stables, Exchange.types]

  const ExchangeContract = await ethers.getContractFactory('GravisTradingPostV2')

  const exchangeProxy = await upgrades.deployProxy(ExchangeContract, args)
  await exchangeProxy.deployed()
  console.log('Exchange proxy deployed to:', exchangeProxy.address)

  const proxyAdmin = await upgrades.admin.getInstance()
  console.log('Proxy admin is:', proxyAdmin.address)

  const exchangeImplAddress = await proxyAdmin.getProxyImplementation(exchangeProxy.address)
  console.log('Exchange implementation deployed to:', exchangeImplAddress)

  if (hre.network.name !== 'hardhat' && hre.network.name !== 'localhost') {
    sleep(10000)
    await hre.run('verify:verify', {
      address: exchangeImplAddress,
      constructorArguments: [],
    })
  }
}
export default func
func.tags = ['ExchangeV2']
