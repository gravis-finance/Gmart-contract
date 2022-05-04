const hre = require('hardhat');
const { models } = require('../mongodb');
const http = require('../server/helpers');
const {
  delay, printJSON,
  checkSync,
  toWeis,
  getRSVFromSign,
} = require('../../utils/helpers');
const {
  _sec, _min, _hour, _day,
  ORDER_SIDE, ORDER_STATUS,
  STATUS_CHECK_PERIOD,
  ERROR_CODES,
} = require('../constants');

const MIN_AMOUNT = 0;
const FULL_PERCENT = 100;
const MIN_BID_STEP = 3; // 3%
const DEF_EXPIRATION = _day * 90;
const MAX_ATTEMPTS = 3;

class Market {
  _instanse = false;

  contract;
  factoryERC20;
  factoryERC721;

  constructor() {
    if (this._instanse) return this._instanse;

    this._instanse = this;
  }

  async init({ market }) {
    if (!market) throw 'market not defined';

    console.log('Provider:', hre.network.config.url);
    const { name, chainId } = await ethers.provider.getNetwork();
    console.log('Network:', { name, chainId });
    await checkSync(ethers.provider);
    console.log('Market:', market);

    const factoryMarket = await ethers.getContractFactory('Gmart');
    this.factoryERC20 = await ethers.getContractFactory('ERC20');
    this.factoryERC721 = await ethers.getContractFactory('MintableNFT');

    this.contract = factoryMarket.attach(market);
  }

  async addOrder(order) {
    order = await this.orderCheck(order);
    order.tokenType = await this.tokenType(order);

    try {
      const { id } = await models.order.add(order);

      return {
        id,
        order: models.order.format(order),
      };
    }
    catch (err) {
      throw this.modelError(err);
    }
  }

  async reduceOrderAmount(id, sign, amount) {
    const order = await models.order.get(id);
    if (!order) throw http.error('Order not found', 404);
    if (order.auctionId) {
      throw http.error('Reducing the amount is available only for orders', 400);
    }

    try {
      amount = toWeis(amount, 'wei');
    }
    catch (err) {
      console.warn(err);
      throw http.error('Invalid amount', 400);
    }

    if (amount.gte(order.amount)) {
      throw http.error('Amount is greater or equal to the old value', 400, { oldAmount: order.amount });
    }

    order.amount = amount;
    order.sign = sign;
    await this.orderCheck(order);
    await this.orderSign(order, sign);

    return models.order.update(id, { amount, sign });
  }

  async signOrder(id, sign) {
    const order = await models.order.get(id);
    if (!order) throw http.error('Order not found', 404);
    if (order.sign) throw http.error('Order already signed', 400);
    if (order.status != ORDER_STATUS.NONE) {
      throw http.error('Order status changed', 400);
    }

    await this.orderCheck(order);
    await this.orderSign(order, sign);

    return models.order.update(id, { sign });
  }

// Auction

  async addAuction(data) {
    if (isNaN(data.expiry) || Number(data.expiry) < Date.now()) {
      throw http.error('Invalid expiry', 400);
    }

    await this.auctionCheck(data);
    data.tokenType = await this.tokenType(data);
    const auction = await models.auction.add(data);
    const order = models.order.format(this.auctionOrder(auction));

    try {
      return {
        auction,
        order,
      }
    }
    catch (err) {
      throw this.modelError(err);
    }
  }

  async signAuction(id, sign) {
    const auction = await models.auction.get(id, 0);
    if (!auction) throw http.error('Auction not found', 404);
    if (auction.active) throw http.error('Auction already signed', 400);
    if (auction.status != ORDER_STATUS.NONE) throw http.error('Auction status changed', 400);

    const order = await this.auctionCheck(auction);
    await this.orderSign(order, sign);

    return models.auction.update(id, { active: 1 });
  }

  async addAuctionBid(auctionId, { account, amount }) {
    const auction = await models.auction.get(auctionId);

    if (!auction) {
      throw http.error('Auction not found', 404);
    }

    if (auction.expiry < Date.now()) {
      throw http.error('Auction expiried', 400);
    }

    if (auction.account == account) {
      throw http.error('Same account', 400);
    }

    try {
      amount = toWeis(amount, 'wei');
    }
    catch (err) {
      console.warn(err);
      throw http.error('Invalid amount', 400);
    }

    if (amount.lt(auction.minAmount)) {
      throw http.error('Low amount', 400);
    }

    await this.checkBidAmount(auctionId, amount);

    try {
      await this.auctionCheck(auction);
    }
    catch (err) {
      if (err.status) {
        await models.auction.delete(auctionId, err.message); // TODO: notifications
      }

      throw err;
    }

    let order = {
      account,
      commodity: auction.commodity,
      tokenId: auction.tokenId,
      currency: auction.currency,
      amount,
      side: 0,
    };

    order = await this.orderCheck(order);
    order.auctionId = auctionId;
    order.tokenType = auction.tokenType;

    try {
      const { id } = await models.order.add(order);

      return {
        id,
        auctionId,
        order: models.order.format(order),
      };
    }
    catch (err) {
      throw this.modelError(err);
    }
  }

  async checkBidAmount(auctionId, amount) {
    const lastBid = await models.order.model.findOne({ auctionId, status: ORDER_STATUS.NONE }).sort({ _id: -1 });
    if (!lastBid) return;

    const minBidAmount = toWeis(lastBid.amount, 'wei').mul(FULL_PERCENT + MIN_BID_STEP).div(FULL_PERCENT);
    if (!minBidAmount.gt(amount)) return;

    if (lastBid.sign) {
      throw http.error('Low amount (exist greater bid)', 400, { minBidAmount: minBidAmount.toString() });
    }

    await models.order.delete(lastBid, 'Low amount (created greater bid)');
    return this.checkBidAmount(auctionId, amount);
  }

  async getOrder(id) {
    const order = await models.order.get(id);
    // console.log({order, id});
    if (!order) throw http.error('Order not found', 404);
    const status = await this.checkOrderStatus(models.order, order);
    try {
      if (status == ORDER_STATUS.CANCELLED) throw http.error('Order status canceled', 400);
      if (status == ORDER_STATUS.EXECUTED) throw http.error('Order status executed', 400);

      await this.orderCheck(order);
      return {
        id,
        order: models.order.format(order),
        sign: order.sign,
      }
    }
    catch(err) {
      if (err.status) {
        await models.order.delete(id, err.message, status || ORDER_STATUS.FAILED); // TODO: notifications
      }

      throw err;
    }
  }

  async getAuction(id) {
    const auction = await models.auction.get(id);
    if (!auction) throw http.error('Auction not found', 404);

    const status = await this.checkOrderStatus(models.auction, auction);
    try {
      if (status == ORDER_STATUS.CANCELLED) throw http.error('Order status canceled', 400);
      if (status == ORDER_STATUS.EXECUTED) throw http.error('Order status executed', 400);

      const order = await this.auctionCheck(auction);
      return {
        auction,
        order: models.order.format(order),
      }
    }
    catch (err) {
      if (err.status) {
        await models.auction.delete(id, err.message, status || ORDER_STATUS.FAILED);// TODO: notifications
      }

      throw err;
    }
  }


// helpers

  async orderCheck(order) {
    // params validations
    if (isNaN(order.tokenId)) {
      throw http.error('Invalid tokenId', 400);
    }

    this.validateAddress(order.account, 'Invalid account');
    this.validateAddress(order.currency, 'Invalid currency');
    this.validateAddress(order.commodity, 'Invalid commodity');

    let amount;
    try {
      amount = toWeis(order.amount, 'wei');
    }
    catch (err) {
      console.warn(err);
      throw http.error('Invalid amount', 400);
    }

    if (amount.lte(MIN_AMOUNT)) {
      throw http.error('low amount', 400); // TODO: min amount
    }

    // set order expiration
    if (!order.expiry) {
      const { timestamp } = (await ethers.provider.getBlock('latest'));
      order.expiry = timestamp * _sec + DEF_EXPIRATION; // TODO
    }

    // validation on contract
    try {
      // console.log(models.order.format(order));
      await this.contract.checkOrder(models.order.format(order));
    }
    catch (err) {
      throw this.contractError(err);
    }

    // validation of tokens
    try {
      if (order.side == ORDER_SIDE.SELL) { // sell
        const nft = await this.factoryERC721.attach(order.commodity);
        const owner = await nft.ownerOf(order.tokenId);
        if (order.account.toLowerCase() != owner.toLowerCase()) {
          throw http.error('Not owner of NFT', 400, { errorCode: ERROR_CODES.CONTRACT_NOT_OWNER_NFT });
        }

        const approved = await nft.getApproved(order.tokenId);
        const approvedAll = nft.isApprovedForAll && await nft.isApprovedForAll(order.account, this.contract.address);
        if (!approvedAll && this.contract.address.toLowerCase() != approved.toLowerCase()) {
          throw http.error('NFT not allowed for contract', 400, { errorCode: ERROR_CODES.CONTRACT_NOT_ALLOWED_NFT });
        }
      }
      else { // buy
        const token = await this.factoryERC20.attach(order.currency);
        const balance = await token.balanceOf(order.account);
        if (amount.gt(balance)) {
          throw http.error('Insufficient funds', 400, { errorCode: ERROR_CODES.CONTRACT_INSUFFICIENT_ERC20 });
        }

        const approved = await token.allowance(order.account, this.contract.address);
        if (amount.gt(approved)) {
          throw http.error('Funds not allowed for contract', 400, { errorCode: ERROR_CODES.CONTRACT_NOT_ALLOWED_ERC20 });
        }
      }
    }
    catch (err) {
      throw this.contractError(err);
    }

    return order;
  }

  auctionOrder({
    account,
    commodity,
    tokenId,
    currency,
    minAmount,
    expiry,
    nonce = 0,
  }) {
    if (typeof expiry == 'object') expiry = expiry.getTime();
    expiry = Number(expiry) + _day * 3650;

    return {
      account,
      commodity,
      tokenId,
      currency,
      expiry, // + 10 years
      nonce,
      amount: minAmount,
      side: 1,
    };
  }

  async auctionCheck(auction) {
    const order = this.auctionOrder(auction);
    // TODO: check expiry

    return this.orderCheck(order);
  }

  async orderSign(order, sign) {
    if (
      sign.substr(0, 2) != '0x'
      || sign.length < 132
    ) throw http.error('Invalid sign', 400);

    try {
      const args = [
        models.order.format(order),
        getRSVFromSign(sign),
      ];
      console.log('checkSignature', args);
      await this.contract.checkSignature(...args);
    }
    catch (err) {
      throw this.contractError(err, 'Signature: ');
    }

    return true;
  }


  async setModelStatus(Model, id, {
    status,
    tx,
  }) {
    if (!ethers.utils.isHexString(tx, 32)) throw http.error('Invalid tx hash', 400);
    if (isNaN(status) || !Object.values(ORDER_STATUS).includes(Number(status))) {
      throw http.error('Invalid status', 400);
    }

    const model = await Model.get(id);
    if (!model) throw http.error('Model not found: ' + id, 404);

    if (model.status == status) throw http.error('Status already changed', 400);
    if (model.status != ORDER_STATUS.NONE) throw http.error('Status already changed', 400);
    // TODO: maybe check tx acc

    const orderStatus = await this.getOrderStatus(model);
    const nextCheck = orderStatus == status ? 0 // tx already executed
      : Date.now() + STATUS_CHECK_PERIOD; // need check later

    await Model.update(id, {
      status,
      tx,
      nextCheck,
    });

    // TODO: update auction for bid
    // TODO: update bids

    model.status = status;
    return model;
  }

  async getOrderStatus(data) {
    let order = data;
    if (data.minAmount) { // auction
      order = this.auctionOrder(data);
    }

    console.log(data, order);
    const hash = await this.contract.hashOrder(models.order.format(order));
    const status = (await this.contract.orderStates(hash)).toString();
    // console.log(order, { status });

    if (isNaN(status) || !Object.values(ORDER_STATUS).includes(Number(status))) {
      throw http.error('Invalid order status: ' + printJSON(status), 400);
    }

    return Number(status);
  }


  async checkOrderStatus(Model, order) {
    if (!order.nextCheck) return order.status;

    const status = await this.getOrderStatus(order);
    if (status == ORDER_STATUS.NONE && order.status == status) {
      return status;
    }

    const { id } = order;
    await Model.update(id, {
      status,
      nextCheck: 0,
    });

    return status;
  }

  async checkStatusNextOrder() {
    return this.checkStatusNext(models.order);
  }
  async checkStatusNextAuction() {
    return this.checkStatusNext(models.auction);
  }

  async checkStatusNext(Model) {
    const order = await Model.model.findOneAndUpdate({
      nextCheck: {
        $gt: new Date(0),
        $lte: new Date()
      }
    }, {
      $set: {
        nextCheck: new Date(Date.now() + STATUS_CHECK_PERIOD),
      },
    });
    if (!order) return console.log('Skip check');

    console.log('Check status for', order._id);
    const status = await this.attemptCheckOrderStatus(Model, order);

    if (order.status != status) {
      console.done('Status changed', order, { status });
    }
  }

  async attemptCheckOrderStatus(Model, order, attempt = 0) {
    try {
      return await this.checkOrderStatus(Model, order);
    }
    catch (err) {
      if (attempt >= MAX_ATTEMPTS) return console.error('Max attempts checkOrderStatus', { order, attempt }, err);

      console.warn('checkOrderStatus', order, err);
      attempt++;
      return await this.attemptCheckOrderStatus(Model, order, attempt);
    }
  }

  async tokenType(tokenId, commodity) {
    if (!commodity) { // tokenId = order
      commodity = tokenId.commodity;

      if (tokenId.tokenIds) { // formated order
        tokenId = tokenId.tokenIds[0];
      }
      else {
        tokenId = tokenId.tokenId;
      }
    }

    const nft = await this.factoryERC721.attach(commodity);
    try {
      const tokenType = await nft.getTokenType(tokenId);
      return tokenType.toString();
    }
    catch (err) {
      if (err.code != 'UNPREDICTABLE_GAS_LIMIT') {
        throw this.contractError(err);
      }

      return;
    }
  }


  validateAddress(address, message) {
    try {
      return ethers.utils.getAddress(address);
    }
    catch (err) {
      throw http.error(message, 400);
    }
  }

  modelError(err) {
    if (err.message.includes('validation failed')) {
      return http.error('Validation failed'
        + (err.errors && ', fields: ' + Object.keys(err.errors).join(', ')), 400, { errorCode: ERROR_CODES.DB_ERROR });
    }

    if (err.message.includes('duplicate key')) {
      const extra = err.extra || {};
      extra.errorCode = ERROR_CODES.DB_ERROR;
      return http.error('Duplicated data', 400, extra);
    }

    return err;
  }

  contractError(err, title = '') {
    if (err.status) return err;

    if ([
      'INVALID_ARGUMENT',
      // 'UNPREDICTABLE_GAS_LIMIT',
    ].includes(err.code)) return http.error(title + err.reason, 400, { errorCode: ERROR_CODES.CONTRACT_ERROR });
    if (err.error && err.error.message.includes('execution reverted: ')) {
      return http.error(title + err.error.message.replace('execution reverted: ', ''), 400, { errorCode: ERROR_CODES.CONTRACT_ERROR });
    }

    return err;
  }

}


module.exports = new Market();