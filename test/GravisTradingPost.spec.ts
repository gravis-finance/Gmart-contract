import { expect } from './chai-setup'
import hre, { getNamedAccounts, getUnnamedAccounts, ethers } from 'hardhat'

import { BigNumber } from 'ethers'
import { Address } from 'hardhat-deploy/types'

import { TestERC20 } from '../typechain/TestERC20'
import { GravisTradingPostV1 } from '../typechain/GravisTradingPostV1'
import { GravisCollectible } from '../typechain/GravisCollectible'

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
const tokenIdByType0 = [
  [0, 1, 2], //0
  [3, 4, 5], //1
  [6, 7, 8], //2
]
const tokenIdByType1 = [
  [9, 10, 11], //0
  [12, 13, 14], //1
  [15, 16, 17], //2
]

const getTokenIdsByType = (user: number, type: BigNumber, amount: BigNumber | undefined): number[] => {
  const ids = user === 0 ? tokenIdByType0[type.toNumber()] : tokenIdByType1[type.toNumber()]
  return ids.slice(0, amount?.toNumber())
}

const nominalPrice = BigNumber.from(100)
const maxTotal = BigNumber.from(20000)

const { upgrades } = hre

context('GravisTradingPostV1', () => {
  let deployer: Address
  let feeRecipient: Address
  let wallet1: Address
  let wallet2: Address
  let wallet3: Address
  let wallet4: Address

  let exchange: GravisTradingPostV1
  let collection: GravisCollectible
  let stableInstance: TestERC20

  before(async () => {
    deployer = (await getNamedAccounts()).deployer
    const accounts = await getUnnamedAccounts()

    feeRecipient = accounts[0]
    wallet1 = accounts[1]
    wallet2 = accounts[2]
    wallet3 = accounts[3]
    wallet4 = accounts[4]
    hre.tracer.nameTags[ethers.constants.AddressZero] = 'Zero'
    hre.tracer.nameTags[deployer] = 'Deployer'
    hre.tracer.nameTags[feeRecipient] = 'FeeRecipient'
    hre.tracer.nameTags[wallet1] = 'Wallet1'
    hre.tracer.nameTags[wallet2] = 'Wallet2'
    hre.tracer.nameTags[wallet3] = 'Wallet3'
    hre.tracer.nameTags[wallet4] = 'Wallet4'
  })

  beforeEach(async () => {
    const TokenContract = await ethers.getContractFactory('TestERC20')
    stableInstance = (await TokenContract.deploy('stable', 'USD', 0)) as TestERC20

    const CollectionContract = await ethers.getContractFactory('GravisCollectible')
    collection = (await CollectionContract.deploy()) as GravisCollectible
    await collection.createNewTokenType(nominalPrice, maxTotal, `type1`, `1.json`)
    await collection.createNewTokenType(nominalPrice, maxTotal, `type2`, `2.json`)
    await collection.createNewTokenType(nominalPrice, maxTotal, `type3`, `3.json`)

    const ExchangeContract = await ethers.getContractFactory('GravisTradingPostV1')
    exchange = (await upgrades.deployProxy(ExchangeContract, [
      deployer,
      fee,
      [collection.address],
      [stableInstance.address],
      [allowedType, anotherAllowedType],
    ])) as GravisTradingPostV1

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

    await collection.addMinter(deployer)
    await collection.mint(deployer, 0, 3)
    await collection.mint(deployer, 1, 3)
    await collection.mint(deployer, 2, 3)
    await collection.setApprovalForAll(exchange.address, true)

    await collection.mint(wallet1, 0, 3)
    await collection.mint(wallet1, 1, 3)
    await collection.mint(wallet1, 2, 3)
    await collection.connect(await ethers.getSigner(wallet1)).setApprovalForAll(exchange.address, true)
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
    beforeEach('set up new order', async () => {
      await exchange
        .connect(await ethers.getSigner(wallet1))
        .placeOrder(collection.address, allowedType, twoAmount, onePrice, getTokenIdsByType(1, allowedType, twoAmount))
    })

    it('Admin can delete order with correct params', async () => {
      await expect(exchange.deleteOrder(collection.address, allowedType, wallet1))
        .to.emit(exchange, 'OrderDeleted')
        .withArgs(wallet1, collection.address, allowedType, twoAmount, getTokenIdsByType(1, allowedType, twoAmount))
    })

    it('Admin can not delete order with not allowed token', async () => {
      await expect(exchange.deleteOrder(wallet1, allowedType, wallet1)).to.revertedWith('GravisTradingPost: NFT not allowed')
    })

    it('Admin can not delete order with not allowed type', async () => {
      await expect(exchange.deleteOrder(collection.address, notAllowedType, wallet1)).to.revertedWith(
        'GravisTradingPost: Token type not allowed'
      )
    })

    it('Admin can not delete non-existing order', async () => {
      await expect(exchange.deleteOrder(collection.address, anotherAllowedType, wallet1)).to.revertedWith(
        'GravisTradingPost: Order not exists'
      )
    })

    it('non-admin can not delete order', async () => {
      await expect(
        exchange.connect(await ethers.getSigner(wallet1)).deleteOrder(collection.address, allowedType, wallet1)
      ).to.be.revertedWith('Ownable: caller is not the owner')
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

  describe('#isTypeAllowed()', async () => {
    it('should return TRUE if type is allowed', async () => {
      expect(await exchange.isTypeAllowed(allowedType)).to.be.equal(true)
    })

    it('should return FALSE if type is not allowed', async () => {
      expect(await exchange.isTypeAllowed(notAllowedType)).to.be.equal(false)
    })
  })

  describe('#isUserExists()', async () => {
    it('should return TRUE if user exists in the index', async () => {
      await exchange.placeOrder(collection.address, allowedType, twoAmount, onePrice, getTokenIdsByType(0, allowedType, twoAmount))
      expect(await exchange.isUserExists(deployer)).to.be.equal(true)
    })

    it('should return FALSE if user doesnt exists in the index', async () => {
      expect(await exchange.isUserExists(deployer)).to.be.equal(false)
    })
  })

  describe('#placeOrder()', async () => {
    it('Maker can place order with correct params', async () => {
      await expect(exchange.placeOrder(collection.address, allowedType, oneAmount, onePrice, getTokenIdsByType(0, allowedType, oneAmount)))
        .to.emit(exchange, 'OrderPlaced')
        .withArgs(deployer, collection.address, allowedType, oneAmount, onePrice, getTokenIdsByType(0, allowedType, oneAmount))
    })

    it('Maker can not place order with zero amount', async () => {
      await expect(
        exchange.placeOrder(collection.address, allowedType, zeroAmount, onePrice, getTokenIdsByType(0, allowedType, zeroAmount))
      ).to.revertedWith('GravisTradingPost: Zero amount')
    })

    it('Maker can not place order with zero price', async () => {
      await expect(
        exchange.placeOrder(collection.address, allowedType, oneAmount, zeroPrice, getTokenIdsByType(0, allowedType, oneAmount))
      ).to.revertedWith('GravisTradingPost: Zero price')
    })

    it('Maker can not place order with not allowed token', async () => {
      await expect(
        exchange.placeOrder(deployer, allowedType, oneAmount, onePrice, getTokenIdsByType(0, allowedType, oneAmount))
      ).to.revertedWith('GravisTradingPost: NFT not allowed')
    })

    it('Maker can not place order with not allowed type', async () => {
      await expect(
        exchange.placeOrder(collection.address, notAllowedType, oneAmount, onePrice, getTokenIdsByType(0, allowedType, oneAmount))
      ).to.revertedWith('GravisTradingPost: Token type not allowed')
    })

    it('Maker can not place duplicated order with same nft and type', async () => {
      await expect(exchange.placeOrder(collection.address, allowedType, oneAmount, onePrice, getTokenIdsByType(0, allowedType, oneAmount)))
        .to.emit(exchange, 'OrderPlaced')
        .withArgs(deployer, collection.address, allowedType, oneAmount, onePrice, getTokenIdsByType(0, allowedType, oneAmount))
      await expect(
        exchange.placeOrder(collection.address, allowedType, oneAmount, onePrice, getTokenIdsByType(0, allowedType, oneAmount))
      ).to.revertedWith('GravisTradingPost: Order already exists')
    })

    it('Two different makers can place orders with same nft and type', async () => {
      await expect(exchange.placeOrder(collection.address, allowedType, oneAmount, onePrice, getTokenIdsByType(0, allowedType, oneAmount)))
        .to.emit(exchange, 'OrderPlaced')
        .withArgs(deployer, collection.address, allowedType, oneAmount, onePrice, getTokenIdsByType(0, allowedType, oneAmount))
      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .placeOrder(collection.address, allowedType, oneAmount, onePrice, getTokenIdsByType(1, allowedType, oneAmount))
      )
        .to.emit(exchange, 'OrderPlaced')
        .withArgs(wallet1, collection.address, allowedType, oneAmount, onePrice, getTokenIdsByType(1, allowedType, oneAmount))
    })

    it('Maker can not place order with incorrect token types', async () => {
      await expect(
        exchange.placeOrder(collection.address, allowedType, twoAmount, onePrice, getTokenIdsByType(0, anotherAllowedType, twoAmount))
      ).to.revertedWith('GravisTradingPost: Invalid token type')
    })
  })

  describe('#fillOrder()', async () => {
    beforeEach('set up new order', async () => {
      await exchange.placeOrder(collection.address, allowedType, twoAmount, onePrice, getTokenIdsByType(0, allowedType, twoAmount))
    })

    it('Taker can fully fill order', async () => {
      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(deployer, collection.address, allowedType, twoAmount, stableInstance.address)
      )
        .to.emit(exchange, 'OrderFilled')
        .withArgs(
          deployer,
          wallet1,
          collection.address,
          allowedType,
          twoAmount,
          twoAmount.mul(onePrice),
          getTokenIdsByType(0, allowedType, twoAmount)
        )
    })

    it('Taker can partially fill order', async () => {
      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(deployer, collection.address, allowedType, oneAmount, stableInstance.address)
      )
        .to.emit(exchange, 'OrderFilled')
        .withArgs(deployer, wallet1, collection.address, allowedType, oneAmount, onePrice, getTokenIdsByType(0, allowedType, oneAmount))

      const orders = await exchange.getOrders()

      expect(orders[0].amount).to.be.equal(oneAmount)
    })

    it('Taker can not fill order with zero maker', async () => {
      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(ethers.constants.AddressZero, collection.address, allowedType, twoAmount, stableInstance.address)
      ).to.revertedWith('GravisTradingPost: Zero maker')
    })

    it('Taker can not fill order with zero amount', async () => {
      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(deployer, collection.address, allowedType, zeroAmount, stableInstance.address)
      ).to.revertedWith('GravisTradingPost: Zero amount')
    })

    it('Taker can not fill order with not allowed token', async () => {
      await expect(
        exchange.connect(await ethers.getSigner(wallet1)).fillOrder(deployer, deployer, allowedType, twoAmount, stableInstance.address)
      ).to.revertedWith('GravisTradingPost: NFT not allowed')
    })

    it('Taker can not fill order with not allowed type', async () => {
      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(deployer, collection.address, notAllowedType, twoAmount, stableInstance.address)
      ).to.revertedWith('GravisTradingPost: Token type not allowed')
    })

    it('Taker can not fill order with not allowed stable', async () => {
      await expect(
        exchange.connect(await ethers.getSigner(wallet1)).fillOrder(deployer, collection.address, allowedType, twoAmount, deployer)
      ).to.revertedWith('GravisTradingPost: Stable not allowed')
    })

    it('Taker can not fill non exist order', async () => {
      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(deployer, collection.address, anotherAllowedType, twoAmount, stableInstance.address)
      ).to.revertedWith('GravisTradingPost: Order not exists')
    })

    it('Taker can not fill order with exceed amound', async () => {
      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(deployer, collection.address, allowedType, twoAmount.add(oneAmount), stableInstance.address)
      ).to.revertedWith('GravisTradingPost: Not enough amount')
    })
  })

  describe('fee calculation', async () => {
    beforeEach('set up new order', async () => {
      await exchange.changeFeeRecipient(wallet2)
      await exchange.placeOrder(collection.address, allowedType, twoAmount, onePrice, getTokenIdsByType(0, allowedType, twoAmount))
    })

    it('should transfer correct fee to the fee recipient when full fill', async () => {
      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(deployer, collection.address, allowedType, twoAmount, stableInstance.address)
      )
        .to.emit(stableInstance, 'Transfer')
        .withArgs(wallet1, wallet2, calculateFee(fee, twoAmount.mul(onePrice)))
    })

    it('should transfer correct (price - fee) to the taker when full fill', async () => {
      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(deployer, collection.address, allowedType, twoAmount, stableInstance.address)
      )
        .to.emit(stableInstance, 'Transfer')
        .withArgs(wallet1, deployer, applyFee(fee, twoAmount.mul(onePrice)))
    })
  })

  describe('#getOrders() getOrdersByMaker()', async () => {
    beforeEach('set up two new orders', async () => {
      await exchange.placeOrder(collection.address, allowedType, twoAmount, onePrice, getTokenIdsByType(0, allowedType, twoAmount))
      await exchange.placeOrder(
        collection.address,
        anotherAllowedType,
        twoAmount,
        onePrice,
        getTokenIdsByType(0, anotherAllowedType, twoAmount)
      )
    })

    it('Should correcly return length of the orders', async () => {
      const orders = await exchange.getOrders()
      expect(orders.length).to.be.equals(2)
      const makerOrders = await exchange.getOrdersByMaker(deployer)
      expect(makerOrders.length).to.be.equals(2)
    })

    it('Cancel one orders, check length', async () => {
      await exchange.cancelOrder(collection.address, allowedType)

      const orders = await exchange.getOrders()
      expect(orders.length).to.be.equals(1)

      const makerOrders = await exchange.getOrdersByMaker(deployer)
      expect(makerOrders.length).to.be.equals(1)
    })

    it('Fill one orders, check length', async () => {
      await exchange
        .connect(await ethers.getSigner(wallet1))
        .fillOrder(deployer, collection.address, allowedType, twoAmount, stableInstance.address)

      const orders = await exchange.getOrders()
      expect(orders.length).to.be.equals(1)

      const makerOrders = await exchange.getOrdersByMaker(deployer)
      expect(makerOrders.length).to.be.equals(1)
    })
  })

  describe('place/update/fill/cancel orders flow', async () => {
    beforeEach('set up new order', async () => {
      await exchange.placeOrder(collection.address, allowedType, twoAmount, onePrice, getTokenIdsByType(0, allowedType, twoAmount))
    })
    it('Maker can update order price', async () => {
      await expect(exchange.updateOrder(collection.address, allowedType, twoPrice))
        .to.emit(exchange, 'OrderUpdated')
        .withArgs(deployer, collection.address, allowedType, twoPrice)
    })

    it('Taker can fully fill order', async () => {
      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(deployer, collection.address, allowedType, twoAmount, stableInstance.address)
      )
        .to.emit(exchange, 'OrderFilled')
        .withArgs(
          deployer,
          wallet1,
          collection.address,
          allowedType,
          twoAmount,
          twoAmount.mul(onePrice),
          getTokenIdsByType(0, allowedType, twoAmount)
        )
    })

    it('Taker can partially fill order', async () => {
      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(deployer, collection.address, allowedType, oneAmount, stableInstance.address)
      )
        .to.emit(exchange, 'OrderFilled')
        .withArgs(deployer, wallet1, collection.address, allowedType, oneAmount, onePrice, getTokenIdsByType(0, allowedType, oneAmount))

      const orders = await exchange.getOrders()

      expect(orders[0].amount).to.be.equal(oneAmount)
    })

    it('Maker can cancel order and claim remaining tokens', async () => {
      await expect(exchange.cancelOrder(collection.address, allowedType))
        .to.emit(exchange, 'OrderCancelled')
        .withArgs(deployer, collection.address, allowedType, twoAmount, getTokenIdsByType(0, allowedType, twoAmount))
    })
  })

  describe('place/cancel/place/cancel orders flow', async () => {
    it('Maker can place/cancel twice', async () => {
      await exchange.placeOrder(collection.address, allowedType, twoAmount, onePrice, getTokenIdsByType(0, allowedType, twoAmount))
      await expect(exchange.cancelOrder(collection.address, allowedType))
        .to.emit(exchange, 'OrderCancelled')
        .withArgs(deployer, collection.address, allowedType, twoAmount, getTokenIdsByType(0, allowedType, twoAmount))

      await exchange.placeOrder(collection.address, allowedType, twoAmount, onePrice, getTokenIdsByType(0, allowedType, twoAmount))
      await expect(exchange.cancelOrder(collection.address, allowedType))
        .to.emit(exchange, 'OrderCancelled')
        .withArgs(deployer, collection.address, allowedType, twoAmount, getTokenIdsByType(0, allowedType, twoAmount))
    })

    it('Maker can place 2 orders then cancel first one only once', async () => {
      await exchange.placeOrder(collection.address, allowedType, twoAmount, onePrice, getTokenIdsByType(0, allowedType, twoAmount))
      await exchange.placeOrder(
        collection.address,
        anotherAllowedType,
        twoAmount,
        onePrice,
        getTokenIdsByType(0, anotherAllowedType, twoAmount)
      )

      await expect(exchange.cancelOrder(collection.address, allowedType))
        .to.emit(exchange, 'OrderCancelled')
        .withArgs(deployer, collection.address, allowedType, twoAmount, getTokenIdsByType(0, allowedType, twoAmount))

      await expect(exchange.cancelOrder(collection.address, allowedType)).to.revertedWith('GravisTradingPost: Order not exists')
    })

    it('Maker can not place same order twice after cancel', async () => {
      await exchange.placeOrder(collection.address, allowedType, twoAmount, onePrice, getTokenIdsByType(0, allowedType, twoAmount))
      await expect(exchange.cancelOrder(collection.address, allowedType))
        .to.emit(exchange, 'OrderCancelled')
        .withArgs(deployer, collection.address, allowedType, twoAmount, getTokenIdsByType(0, allowedType, twoAmount))

      await exchange.placeOrder(collection.address, allowedType, twoAmount, onePrice, getTokenIdsByType(0, allowedType, twoAmount))
      await expect(
        exchange.placeOrder(collection.address, allowedType, twoAmount, onePrice, getTokenIdsByType(0, allowedType, twoAmount))
      ).to.revertedWith('GravisTradingPost: Order already exists')
    })
  })

  describe('place/fill/fill orders flow', async () => {
    beforeEach('set up new order', async () => {
      await exchange.placeOrder(collection.address, allowedType, threeAmount, onePrice, getTokenIdsByType(0, allowedType, threeAmount))
    })

    it('Taker can fill order multiple times', async () => {
      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(deployer, collection.address, allowedType, oneAmount, stableInstance.address)
      )
        .to.emit(exchange, 'OrderFilled')
        .withArgs(deployer, wallet1, collection.address, allowedType, oneAmount, onePrice, [0])

      let orders = await exchange.getOrders()

      expect(orders[0].amount).to.be.equal(twoAmount)
      expect(orders[0].tokenIds[0]).to.be.equal(1)
      expect(orders[0].tokenIds[1]).to.be.equal(2)

      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(deployer, collection.address, allowedType, oneAmount, stableInstance.address)
      )
        .to.emit(exchange, 'OrderFilled')
        .withArgs(deployer, wallet1, collection.address, allowedType, oneAmount, onePrice, [1])

      orders = await exchange.getOrders()

      expect(orders[0].amount).to.be.equal(oneAmount)
      expect(orders[0].tokenIds[0]).to.be.equal(2)

      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(deployer, collection.address, allowedType, oneAmount, stableInstance.address)
      )
        .to.emit(exchange, 'OrderFilled')
        .withArgs(deployer, wallet1, collection.address, allowedType, oneAmount, onePrice, [2])
    })

    it('Maker can cancel partially filled order and claim remaining tokens', async () => {
      await expect(
        exchange
          .connect(await ethers.getSigner(wallet1))
          .fillOrder(deployer, collection.address, allowedType, oneAmount, stableInstance.address)
      )
        .to.emit(exchange, 'OrderFilled')
        .withArgs(deployer, wallet1, collection.address, allowedType, oneAmount, onePrice, [0])

      await expect(exchange.cancelOrder(collection.address, allowedType))
        .to.emit(exchange, 'OrderCancelled')
        .withArgs(deployer, collection.address, allowedType, twoAmount, [1, 2])
    })
  })
})
