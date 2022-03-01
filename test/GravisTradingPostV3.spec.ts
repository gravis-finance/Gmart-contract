import { expect } from './chai-setup'
import hre, { getNamedAccounts, getUnnamedAccounts, ethers } from 'hardhat'

import { BigNumber } from 'ethers'
import { Address } from 'hardhat-deploy/types'

import {} from '../typechain/TestERC20'
import { TestERC20, TestERC721, GravisTradingPostV3 } from '../typechain'

const FEE_BASE = BigNumber.from('10000')

const applyFee = (_feeInBips: BigNumber, _amount: BigNumber) => {
  return _amount.mul(FEE_BASE.sub(_feeInBips)).div(FEE_BASE)
}

const calculateFee = (_feeInBips: BigNumber, _amount: BigNumber) => {
  return _amount.mul(_feeInBips).div(FEE_BASE)
}

const fee = BigNumber.from(300)
const allowedType = BigNumber.from(0)
const anotherAllowedType = BigNumber.from(1)
const notAllowedType = BigNumber.from(100)
const zeroPrice = ethers.utils.parseUnits('0')
const onePrice = ethers.utils.parseUnits('1')
const twoPrice = ethers.utils.parseUnits('2')
const zeroAmount = BigNumber.from(0)
const oneAmount = BigNumber.from(1)
const twoAmount = BigNumber.from(2)
const threeAmount = BigNumber.from(3)

const getTokenIds = (user: number, amount: BigNumber | undefined): number[] => {
  const ids = user === 0 ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10]
  return ids.slice(0, amount?.toNumber())
}

const nominalPrice = BigNumber.from(100)
const maxTotal = BigNumber.from(20000)

const { upgrades } = hre

context('GravisTradingPostV3', () => {
  let deployer: Address
  let feeRecipient1: Address
  let feeRecipient2: Address
  let wallet1: Address
  let wallet2: Address
  let wallet3: Address
  let wallet4: Address

  let exchange: GravisTradingPostV3
  let collection: TestERC721
  let collection1: TestERC721
  let stableInstance: TestERC20

  before(async () => {
    deployer = (await getNamedAccounts()).deployer
    const accounts = await getUnnamedAccounts()

    feeRecipient1 = accounts[0]
    feeRecipient2 = accounts[1]
    wallet1 = accounts[2]
    wallet2 = accounts[3]
    wallet3 = accounts[4]
    wallet4 = accounts[5]
    hre.tracer.nameTags[ethers.constants.AddressZero] = 'Zero'
    hre.tracer.nameTags[deployer] = 'Deployer'
    hre.tracer.nameTags[feeRecipient1] = 'FeeRecipient1'
    hre.tracer.nameTags[feeRecipient2] = 'FeeRecipient2'
    hre.tracer.nameTags[wallet1] = 'Wallet1'
    hre.tracer.nameTags[wallet2] = 'Wallet2'
    hre.tracer.nameTags[wallet3] = 'Wallet3'
    hre.tracer.nameTags[wallet4] = 'Wallet4'
  })

  beforeEach(async () => {
    const TokenContract = await ethers.getContractFactory('TestERC20')
    stableInstance = (await TokenContract.deploy('stable', 'USD', 0)) as TestERC20

    const CollectionContract = await ethers.getContractFactory('TestERC721')
    collection = (await CollectionContract.deploy()) as TestERC721
    collection1 = (await CollectionContract.deploy()) as TestERC721

    const ExchangeContract = await ethers.getContractFactory('GravisTradingPostV3')
    exchange = (await upgrades.deployProxy(ExchangeContract, [
      deployer,
      fee,
      [collection.address, collection1.address],
      [stableInstance.address],
    ])) as GravisTradingPostV3

    hre.tracer.nameTags[stableInstance.address] = 'Stable'
    hre.tracer.nameTags[collection.address] = 'CollectionContract'
    hre.tracer.nameTags[exchange.address] = 'ExchangeContract'

    await stableInstance.setBalance(wallet1, ethers.utils.parseUnits('1000'))
    await stableInstance.setBalance(wallet2, ethers.utils.parseUnits('1000'))
    await stableInstance.setBalance(wallet3, ethers.utils.parseUnits('1000'))
    await stableInstance.setBalance(wallet4, ethers.utils.parseUnits('1000'))

    await stableInstance.connect(await ethers.getSigner(wallet1)).approve(exchange.address, BigNumber.from(2).pow(BigNumber.from(255)))
    await stableInstance.connect(await ethers.getSigner(wallet2)).approve(exchange.address, BigNumber.from(2).pow(BigNumber.from(255)))
    await stableInstance.connect(await ethers.getSigner(wallet3)).approve(exchange.address, BigNumber.from(2).pow(BigNumber.from(255)))
    await stableInstance.connect(await ethers.getSigner(wallet4)).approve(exchange.address, BigNumber.from(2).pow(BigNumber.from(255)))

    await collection.mint(deployer, 1)
    await collection.mint(deployer, 2)
    await collection.mint(deployer, 3)
    await collection.mint(deployer, 4)
    await collection.mint(deployer, 5)
    await collection.setApprovalForAll(exchange.address, true)

    await collection.mint(wallet1, 6)
    await collection.mint(wallet1, 7)
    await collection.mint(wallet1, 8)
    await collection.mint(wallet1, 9)
    await collection.mint(wallet1, 10)
    await collection.connect(await ethers.getSigner(wallet1)).setApprovalForAll(exchange.address, true)

    await collection1.mint(deployer, 1)
    await collection1.mint(deployer, 2)
    await collection1.mint(deployer, 3)
    await collection1.mint(deployer, 4)
    await collection1.mint(deployer, 5)
    await collection1.setApprovalForAll(exchange.address, true)

    await collection1.mint(wallet1, 6)
    await collection1.mint(wallet1, 7)
    await collection1.mint(wallet1, 8)
    await collection1.mint(wallet1, 9)
    await collection1.mint(wallet1, 10)
    await collection1.connect(await ethers.getSigner(wallet1)).setApprovalForAll(exchange.address, true)
  })

  describe('#initializer()', async () => {
    it('should set fee amount and fee recipient', async () => {
      expect(await exchange.feeRecipient()).to.be.equal(deployer)
      expect(await exchange.feeAmount()).to.be.equal(fee)
    })
  })

  describe('#changeFee()', async () => {
    it('admin can update fee', async () => {
      await exchange.changeFee(0)
      expect(await exchange.feeAmount()).to.be.equal(0)
    })

    it('non-admin can not update fee', async () => {
      await expect(exchange.connect(await ethers.getSigner(wallet1)).changeFee(0)).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('#changeFeeRecipient()', async () => {
    it('admin can update fee recipient', async () => {
      await exchange.changeFeeRecipient(wallet1)
      expect(await exchange.feeRecipient()).to.be.equal(wallet1)
    })

    it('fee recipient can not be zero address', async () => {
      await expect(exchange.changeFeeRecipient(ethers.constants.AddressZero)).to.be.revertedWith('GravisTradingPost: Zero fee recipient')
    })

    it('non-admin can not update fee recipient', async () => {
      await expect(exchange.connect(await ethers.getSigner(wallet1)).changeFeeRecipient(wallet2)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('#pause() unpause()', async () => {
    it('admin can pause when not paused', async () => {
      await expect(exchange.pause()).to.emit(exchange, 'Paused').withArgs(deployer)
      expect(await exchange.paused()).to.be.equal(true)
    })

    it('admin can not pause when already paused', async () => {
      await exchange.pause()
      await expect(exchange.pause()).to.be.revertedWith('Pausable: paused')
    })

    it('admin can unpause when paused', async () => {
      await exchange.pause()
      await expect(exchange.unpause()).to.emit(exchange, 'Unpaused').withArgs(deployer)
      expect(await exchange.paused()).to.be.equal(false)
    })

    it('admin can not unpause when already unpaused', async () => {
      await expect(exchange.unpause()).to.be.revertedWith('Pausable: not paused')
    })

    it('non-admin can not pause or unpause', async () => {
      await expect(exchange.connect(await ethers.getSigner(wallet1)).pause()).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('#deleteOrder()', async () => {
    let orderId = 0
    beforeEach('set up new order', async () => {
      await exchange.connect(await ethers.getSigner(wallet1)).placeOrder(collection.address, onePrice, getTokenIds(1, twoAmount))
      orderId++
    })

    it('Admin can delete order with correct params', async () => {
      await expect(exchange.deleteOrder(orderId)).to.emit(exchange, 'OrderDeleted').withArgs(orderId)
    })

    it('Admin can not delete non-existing order', async () => {
      await expect(exchange.deleteOrder(orderId + 1000)).to.revertedWith('GravisTradingPost: Order not exists')
    })

    it('non-admin can not delete order', async () => {
      await expect(exchange.connect(await ethers.getSigner(wallet1)).deleteOrder(orderId)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('#isTokenAllowed()', async () => {
    it('should return TRUE if token is allowed', async () => {
      expect(await exchange.isTokenAllowed(collection.address)).to.be.equal(true)
    })

    it('should return FALSE if token is not allowed', async () => {
      expect(await exchange.isTokenAllowed(wallet1)).to.be.equal(false)
    })
  })

  describe('#isStableAllowed()', async () => {
    it('should return TRUE if stable is allowed', async () => {
      expect(await exchange.isStableAllowed(stableInstance.address)).to.be.equal(true)
    })

    it('should return FALSE if stable is not allowed', async () => {
      expect(await exchange.isStableAllowed(wallet1)).to.be.equal(false)
    })
  })

  describe('#placeOrder()', async () => {
    let orderId = 0
    it('Maker can place order with correct params', async () => {
      orderId++
      await expect(exchange.placeOrder(collection.address, onePrice, getTokenIds(0, oneAmount)))
        .to.emit(exchange, 'OrderPlaced')
        .withArgs(orderId, deployer, collection.address, onePrice, getTokenIds(0, oneAmount))
    })

    it('Maker can not place order with zero price', async () => {
      await expect(exchange.placeOrder(collection.address, zeroPrice, getTokenIds(0, oneAmount))).to.revertedWith(
        'GravisTradingPost: Zero price'
      )
    })

    it('Maker can not place order with not allowed token', async () => {
      await expect(exchange.placeOrder(deployer, onePrice, getTokenIds(0, oneAmount))).to.revertedWith('GravisTradingPost: NFT not allowed')
    })

    it('Maker can place orders with same nft and type', async () => {
      orderId = 1

      const tokenIds = getTokenIds(0, twoAmount)

      await expect(exchange.placeOrder(collection.address, onePrice, [tokenIds[0]]))
        .to.emit(exchange, 'OrderPlaced')
        .withArgs(orderId, deployer, collection.address, onePrice, [tokenIds[0]])

      orderId++

      await expect(exchange.placeOrder(collection.address, onePrice, [tokenIds[1]]))
        .to.emit(exchange, 'OrderPlaced')
        .withArgs(orderId, deployer, collection.address, onePrice, [tokenIds[1]])
    })

    it('Two different makers can place orders with same nft and type', async () => {
      orderId = 1

      await expect(exchange.placeOrder(collection.address, onePrice, getTokenIds(0, oneAmount)))
        .to.emit(exchange, 'OrderPlaced')
        .withArgs(orderId, deployer, collection.address, onePrice, getTokenIds(0, oneAmount))

      orderId++

      await expect(exchange.connect(await ethers.getSigner(wallet1)).placeOrder(collection.address, onePrice, getTokenIds(1, oneAmount)))
        .to.emit(exchange, 'OrderPlaced')
        .withArgs(orderId, wallet1, collection.address, onePrice, getTokenIds(1, oneAmount))
    })
  })

  describe('#fillOrder()', async () => {
    let orderId = 1
    beforeEach('set up new order', async () => {
      await exchange.placeOrder(collection.address, onePrice, getTokenIds(0, twoAmount))
    })

    it('Taker can fully fill order', async () => {
      await expect(exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, twoAmount, stableInstance.address))
        .to.emit(exchange, 'OrderFilled')
        .withArgs(
          collection.address,
          deployer,
          wallet1,
          stableInstance.address,
          orderId,
          twoAmount,
          twoAmount.mul(onePrice),
          getTokenIds(0, twoAmount)
        )
    })

    it('Taker can partially fill order', async () => {
      await expect(exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, oneAmount, stableInstance.address))
        .to.emit(exchange, 'OrderFilled')
        .withArgs(collection.address, deployer, wallet1, stableInstance.address, orderId, oneAmount, onePrice, getTokenIds(0, oneAmount))

      const order = await exchange.getOrderById(orderId)

      expect(order.tokenIds.length).to.be.equal(oneAmount)
    })

    it('Taker can not fill order with zero amount', async () => {
      await expect(
        exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, zeroAmount, stableInstance.address)
      ).to.revertedWith('GravisTradingPost: Zero amount')
    })

    it('Taker can not fill order with not allowed stable', async () => {
      await expect(exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, twoAmount, deployer)).to.revertedWith(
        'GravisTradingPost: Stable not allowed'
      )
    })

    it('Taker can not fill non exist order', async () => {
      await expect(
        exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId + 1000, twoAmount, stableInstance.address)
      ).to.revertedWith('GravisTradingPost: Order not exists')
    })

    it('Taker can not fill order with exceed amound', async () => {
      await expect(
        exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, twoAmount.add(oneAmount), stableInstance.address)
      ).to.revertedWith('GravisTradingPost: Not enough amount')
    })
  })

  describe('fee calculation', async () => {
    let orderId = 1
    beforeEach('set up new order', async () => {
      await exchange.changeFeeRecipient(wallet2)
      await exchange.placeOrder(collection.address, onePrice, getTokenIds(0, twoAmount))
    })

    it('should transfer correct fee to the fee recipient when full fill', async () => {
      await expect(exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, twoAmount, stableInstance.address))
        .to.emit(stableInstance, 'Transfer')
        .withArgs(wallet1, wallet2, calculateFee(fee, twoAmount.mul(onePrice)))
    })

    it('should transfer correct (price - fee) to the taker when full fill', async () => {
      await expect(exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, twoAmount, stableInstance.address))
        .to.emit(stableInstance, 'Transfer')
        .withArgs(wallet1, deployer, applyFee(fee, twoAmount.mul(onePrice)))
    })
  })

  describe('#getOrders() getOrdersByMaker()', async () => {
    let orderId = 2
    beforeEach('set up two new orders', async () => {
      const tokenIds = getTokenIds(0, twoAmount.mul(2))
      await exchange.placeOrder(collection.address, onePrice, tokenIds.slice(0, 2))
      await exchange.placeOrder(collection.address, onePrice, tokenIds.slice(2, 4))
    })

    it('Should correcly return length of the orders', async () => {
      const orders = await exchange.getOrders()
      expect(orders.length).to.be.equals(orderId)
      const makerOrders = await exchange.getOrdersByMaker(deployer)
      expect(makerOrders.length).to.be.equals(orderId)
    })

    it('Cancel one orders, check length', async () => {
      await exchange.cancelOrder(orderId)

      const orders = await exchange.getOrders()
      expect(orders.length).to.be.equals(orderId - 1)

      const makerOrders = await exchange.getOrdersByMaker(deployer)
      expect(makerOrders.length).to.be.equals(orderId - 1)
    })

    it('Fill one orders, check length', async () => {
      await exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, twoAmount, stableInstance.address)

      const orders = await exchange.getOrders()
      expect(orders.length).to.be.equals(orderId - 1)

      const makerOrders = await exchange.getOrdersByMaker(deployer)
      expect(makerOrders.length).to.be.equals(orderId - 1)
    })
  })

  describe('#getOrdersByCollection', async () => {
    let orderId = 4
    beforeEach('set up new orders', async () => {
      const tokenIds = getTokenIds(0, twoAmount.mul(2))
      await exchange.placeOrder(collection.address, onePrice, tokenIds.slice(0, 2))
      await exchange.placeOrder(collection.address, onePrice, tokenIds.slice(2, 4))

      await exchange.placeOrder(collection1.address, onePrice, tokenIds.slice(0, 2))
      await exchange.placeOrder(collection1.address, onePrice, tokenIds.slice(2, 4))
    })

    it('Should correcly return length of the orders', async () => {
      let orders = await exchange.getOrdersByCollection([collection.address, collection1.address])
      expect(orders.length).to.be.equals(orderId)

      orders = await exchange.getOrdersByCollection([collection.address])
      expect(orders.length).to.be.equals(orderId / 2)

      orders = await exchange.getOrdersByCollection([collection1.address])
      expect(orders.length).to.be.equals(orderId / 2)
    })

    it('Cancel one orders, check length', async () => {
      await exchange.cancelOrder(orderId)

      let orders = await exchange.getOrdersByCollection([collection.address, collection1.address])
      expect(orders.length).to.be.equals(orderId - 1)

      orders = await exchange.getOrdersByCollection([collection.address])
      expect(orders.length).to.be.equals(orderId / 2)

      orders = await exchange.getOrdersByCollection([collection1.address])
      expect(orders.length).to.be.equals(orderId / 2 - 1)
    })

    it('Fill one orders, check length', async () => {
      await exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, twoAmount, stableInstance.address)

      let orders = await exchange.getOrdersByCollection([collection.address, collection1.address])
      expect(orders.length).to.be.equals(orderId - 1)

      orders = await exchange.getOrdersByCollection([collection.address])
      expect(orders.length).to.be.equals(orderId / 2)

      orders = await exchange.getOrdersByCollection([collection1.address])
      expect(orders.length).to.be.equals(orderId / 2 - 1)
    })
  })

  describe('place/update/fill/cancel orders flow', async () => {
    let orderId = 1
    beforeEach('set up new order', async () => {
      await exchange.placeOrder(collection.address, onePrice, getTokenIds(0, twoAmount))
    })
    it('Maker can update order price', async () => {
      await expect(exchange.updateOrder(orderId, twoPrice)).to.emit(exchange, 'OrderUpdated').withArgs(orderId, twoPrice)
    })

    it('Taker can fully fill order', async () => {
      await expect(exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, twoAmount, stableInstance.address))
        .to.emit(exchange, 'OrderFilled')
        .withArgs(
          collection.address,
          deployer,
          wallet1,
          stableInstance.address,
          orderId,
          twoAmount,
          twoAmount.mul(onePrice),
          getTokenIds(0, twoAmount)
        )
    })

    it('Taker can partially fill order', async () => {
      await expect(exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, oneAmount, stableInstance.address))
        .to.emit(exchange, 'OrderFilled')
        .withArgs(collection.address, deployer, wallet1, stableInstance.address, orderId, oneAmount, onePrice, getTokenIds(0, oneAmount))

      const order = await exchange.getOrderById(orderId)

      expect(order.tokenIds.length).to.be.equal(oneAmount)
    })

    it('Maker can cancel order and claim remaining tokens', async () => {
      await expect(exchange.cancelOrder(orderId)).to.emit(exchange, 'OrderCancelled').withArgs(orderId)
    })
  })

  describe('place/cancel/place/cancel orders flow', async () => {
    let orderId = 1
    it('Maker can place/cancel twice', async () => {
      await exchange.placeOrder(collection.address, onePrice, getTokenIds(0, twoAmount))
      await expect(exchange.cancelOrder(orderId)).to.emit(exchange, 'OrderCancelled').withArgs(orderId)

      orderId++
      await exchange.placeOrder(collection.address, onePrice, getTokenIds(0, twoAmount))
      await expect(exchange.cancelOrder(orderId)).to.emit(exchange, 'OrderCancelled').withArgs(orderId)
    })
  })

  describe('place/fill/fill orders flow', async () => {
    let orderId = 1
    beforeEach('set up new order', async () => {
      await exchange.placeOrder(collection.address, onePrice, getTokenIds(0, threeAmount))
    })

    it('Taker can fill order multiple times', async () => {
      await expect(exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, oneAmount, stableInstance.address))
        .to.emit(exchange, 'OrderFilled')
        .withArgs(collection.address, deployer, wallet1, stableInstance.address, orderId, oneAmount, onePrice, [1])

      let order = await exchange.getOrderById(orderId)

      expect(order.tokenIds.length).to.be.equal(twoAmount)
      expect(order.tokenIds[0]).to.be.equal(2)
      expect(order.tokenIds[1]).to.be.equal(3)

      await expect(exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, oneAmount, stableInstance.address))
        .to.emit(exchange, 'OrderFilled')
        .withArgs(collection.address, deployer, wallet1, stableInstance.address, orderId, oneAmount, onePrice, [2])

      order = await exchange.getOrderById(orderId)

      expect(order.tokenIds.length).to.be.equal(oneAmount)
      expect(order.tokenIds[0]).to.be.equal(3)

      await expect(exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, oneAmount, stableInstance.address))
        .to.emit(exchange, 'OrderFilled')
        .withArgs(collection.address, deployer, wallet1, stableInstance.address, orderId, oneAmount, onePrice, [3])

      order = await exchange.getOrderById(orderId)

      expect(order.tokenIds.length).to.be.equal(zeroAmount)
      expect(order.tokenIds.length).to.be.equal(0)
    })

    it('Maker can cancel partially filled order and claim remaining tokens', async () => {
      await expect(exchange.connect(await ethers.getSigner(wallet1)).fillOrder(orderId, oneAmount, stableInstance.address))
        .to.emit(exchange, 'OrderFilled')
        .withArgs(collection.address, deployer, wallet1, stableInstance.address, orderId, oneAmount, onePrice, [1])

      await expect(exchange.cancelOrder(orderId)).to.emit(exchange, 'OrderCancelled').withArgs(orderId)
    })
  })
})
