const Market = require('../market');
const { models } = require('../mongodb');
const { app, error } = require('./helpers');

const MAX_LIMIT = 10000;

async function addOrder({ body = {} }) {
  const {
    account,
    side = 0,
    commodity,
    tokenId,
    currency,
    amount,
  } = body;

  return Market.addOrder({
    account,
    side,
    commodity,
    tokenId,
    currency,
    amount,
  });
}

async function addAuction({ body = {} }) {
  const {
    account,
    commodity,
    tokenId,
    currency,
    minAmount,
    expiry,
  } = body;

  return Market.addAuction({
    account,
    commodity,
    tokenId,
    currency,
    minAmount,
    expiry,
  });
}

async function reduceOrderAmount({ params = {}, body = {} }) {
  const { acknowledged } = await Market.reduceOrderAmount(params.id, body.sign, body.amount);
  return acknowledged;
}

async function signOrder({ params = {}, body = {} }) {
  const { acknowledged } = await Market.signOrder(params.id, body.sign);
  return acknowledged;
}

async function signAuction({ params = {}, body = {} }) {
  const { acknowledged } = await Market.signAuction(params.id, body.sign);
  return acknowledged;
}

async function addAuctionBid({ params = {}, body = {} }) {
  return Market.addAuctionBid(params.id, body);
}


async function setOrderStatus({ params = {}, body = {} }) {
  return Market.setModelStatus(models.order, params.id, body);
}

async function setAuctionStatus({ params = {}, body = {} }) {
  return Market.setModelStatus(models.auction, params.id, body);
}


// GET Lists

async function getOrder({ params = {} }) {
  return Market.getOrder(params.id);
}

async function getAuction({ params = {} }) {
  return Market.getAuction(params.id);
}

async function getAuctionBids({ params = {}, query = {} }) {
  const find = {
    auctionId: params.id,
    sign: { $exists: true },
    status: 0,
  };

  if (!query.sort) {
    query.sort = { _id: -1 };
    // query.sort = { amount: -1, _id: 1 };
  }

  return getModelList(models.order, find, query);
}


async function getSideOrders({ params = {}, query = {} }) {
  return getModelList(models.order, {
    side: params.side,
    sign: { $exists: true },
    auctionId: { $exists: false },
    status: 0,
  }, query);
}

async function getAccOrders({ params = {}, query = {} }) {
  const account = params.account.toLowerCase();
  return getModelList(models.order, {
    account,
    auctionId: { $exists: false },
  }, query);
}

async function getAccAuctions({ params = {}, query = {} }) {
  const account = params.account.toLowerCase();
  const find = {
    account,
  };

  if (!isNaN(query.active)) {
    find.active = +!!query.active;
  }

  return getModelList(models.auction, find, query);
}

async function getAccBids({ params = {}, query = {} }) {
  const account = params.account.toLowerCase();
  const find = {
    account,
    auctionId: { $exists: true },
  };

  if (typeof query.sign != 'undefined') {
    find.sign = { $exists: !!query.sign };
  }

  return getModelList(models.order, find, query);
}

async function getAuctionsList({ query = {} }) {
  return getModelList(models.auction, {
    expiry: { $gt: Date.now() },
    sign: { $exists: true },
    status: 0,
  }, query);
}


async function getModelList({ model }, find = {}, {
    side,
    account,
    commodity,
    currency,
    tokenId,
    status,
    sort, sortDir = 1,
    skip, limit = MAX_LIMIT,
  }) {

  if (account) find.account = account.toLowerCase();
  if (commodity) {
    if (Array.isArray(commodity)) {
      find.commodity = { $in: commodity.map(i => i.toLowerCase()) };
    }
    else {
      find.commodity = commodity.toLowerCase();
    }
  }

  if (currency) {
    if (Array.isArray(currency)) {
      find.currency = { $in: currency.map(i => i.toLowerCase()) };
    }
    else {
      find.currency = currency.toLowerCase();
    }
  }

  if (tokenId) {
    if (isNaN(tokenId)) throw error('Invalid tokenId value', 400);

    if (Array.isArray(tokenId)) {
      find.tokenId = { $in: tokenId };
    }
    else {
      find.tokenId = Number(tokenId);
    }
  }

  if (side) find.side = side;
  if (find.side) {
    if (isNaN(find.side)) throw error('Invalid side value', 400);

    find.side = Number(find.side) || 0;
  }

  if (status) {
    if (isNaN(status)) throw error('Invalid status value', 400);

    find.status = Number(status) || 0;
  }

  // console.log({find});

  let res = model
    .find(find)
    .select({
      nextCheck: 0,
    });
  // .sort({ id: 1 });

  if (sort) {
    if (typeof sort == 'string') sort = JSON.parse(sort);
    if (typeof sort == 'string') sort = { [sort]: sortDir };

    res = res.sort(sort);
  }

  if (skip) {
    res = res.skip(skip);
  }

  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  res = res.limit(limit);

  return res.exec();
}



app.post('/api/v1/order', addOrder /*
#swagger.tags = ['Order']
#swagger.description = 'Add new order'
#swagger.parameters['body'] = {in: 'body', description: 'Where side 0 - buy(default), 1 - sell', schema: {
  account: '0xDAb770d15397fddfbac85d334709C92C2B473b01',
  side: 0,
  commodity: '0x536af9300FbEEf4bCf6ef669B571f56A5C710e1A',
  tokenId: 109,
  currency: '0x944f3308686961d1676496EB72433f20CB908ed6',
  amount: '1200000000000000000000',
}}
#swagger.responses[200] = { schema: { id: '6232e92a3d0d63faa893cb48', order: { $ref: '#/definitions/MarketOrder' } } }
*/);
app.post('/api/v1/auction', addAuction /*
#swagger.tags = ['Auction']
#swagger.description = 'Add new auction'
#swagger.parameters['body'] = {in: 'body', schema: {
  account: '0xDAb770d15397fddfbac85d334709C92C2B473b01',
  commodity: '0x536af9300FbEEf4bCf6ef669B571f56A5C710e1A',
  tokenId: 109,
  currency: '0x944f3308686961d1676496EB72433f20CB908ed6',
  minAmount: '1200000000000000000000',
  expiry: 1647452588000,
}}
#swagger.responses[200] = { schema: { auction: { $ref: '#/definitions/Auction' }, order: { $ref: '#/definitions/MarketOrder' } } }
*/);
app.post('/api/v1/order/:id/reduce', reduceOrderAmount /*
#swagger.tags = ['Order']
#swagger.description = 'Reduce order amount'
#swagger.parameters['id'] = {in: 'path', description: 'Order ID', schema: '6232e92a3d0d63faa893cb48'}
#swagger.parameters['body'] = {in: 'body', schema: {
  sign: '0xDAb770d15397fddfbac85d334709C92C2B473b01DAb770d15397fddfbac85d334709C92C2B473b01DAb770d15397fddfbac85d334709C92C2B473b01DAb770d153',
  amount: '1200000000000000000000',
}}
#swagger.responses[200] = { schema: true }
*/);
app.post('/api/v1/order/:id/sign', signOrder /*
#swagger.tags = ['Order']
#swagger.description = 'Sign order after creating'
#swagger.parameters['id'] = {in: 'path', description: 'Order ID', schema: '6232e92a3d0d63faa893cb48'}
#swagger.parameters['body'] = {in: 'body', schema: {
  sign: '0xDAb770d15397fddfbac85d334709C92C2B473b01DAb770d15397fddfbac85d334709C92C2B473b01DAb770d15397fddfbac85d334709C92C2B473b01DAb770d153',
}}
#swagger.responses[200] = { schema: true }
*/);
app.post('/api/v1/auction/bid/:id/sign', signOrder /*
#swagger.tags = ['Auction']
#swagger.description = 'Sign auction bid after creating'
#swagger.parameters['id'] = {in: 'path', description: 'Auction bid ID', schema: '6232e92a3d0d63faa893cb48'}
#swagger.parameters['body'] = {in: 'body', schema: {
  sign: '0xDAb770d15397fddfbac85d334709C92C2B473b01DAb770d15397fddfbac85d334709C92C2B473b01DAb770d15397fddfbac85d334709C92C2B473b01DAb770d153',
}}
#swagger.responses[200] = { schema: true }
*/);
app.post('/api/v1/auction/:id/sign', signAuction /*
#swagger.tags = ['Auction']
#swagger.description = 'Sign auction after creating'
#swagger.parameters['id'] = {in: 'path', description: 'Auction ID', schema: '6232e92a3d0d63faa893cb48'}
#swagger.parameters['body'] = {in: 'body', schema: {
  sign: '0xDAb770d15397fddfbac85d334709C92C2B473b01DAb770d15397fddfbac85d334709C92C2B473b01DAb770d15397fddfbac85d334709C92C2B473b01DAb770d153',
}}
#swagger.responses[200] = { schema: true }
*/);
app.post('/api/v1/auction/:id/bid', addAuctionBid /*
#swagger.tags = ['Auction']
#swagger.description = 'Add auction bid'
#swagger.parameters['id'] = {in: 'path', description: 'Auction ID', schema: '6232e92a3d0d63faa893cb48'}
#swagger.parameters['body'] = {in: 'body', schema: {account: '0xDAb770d15397fddfbac85d334709C92C2B473b01', amount: '1200000000000000000000'}}
#swagger.responses[200] = { schema: { id: '6232e92a3d0d63faa893cb48', auctionId: '6232e92a3d0d63faa893cb48', order: { $ref: '#/definitions/MarketOrder' } } }
*/);

app.post('/api/v1/order/:id/status', setOrderStatus /*
#swagger.tags = ['Order']
#swagger.description = 'Set order status (canceled, executed)'
#swagger.parameters['id'] = {in: 'path', description: 'Order ID', schema: '6232e92a3d0d63faa893cb48'}
#swagger.parameters['body'] = {in: 'body', schema: {
  status: 1,
  tx: '0x8102feb1b57bbe071e303264de1fd1f3ba690d27706c185c8c81fa75bda8327a',
}}
#swagger.responses[200] = { schema: {$ref: '#/definitions/Order'} }
*/);

app.post('/api/v1/auction/:id/status', setAuctionStatus /*
#swagger.tags = ['Auction']
#swagger.description = 'Set auction status (canceled, executed)'
#swagger.parameters['id'] = {in: 'path', description: 'Auction ID', schema: '6232e92a3d0d63faa893cb48'}
#swagger.parameters['body'] = {in: 'body', schema: {
  status: 1,
  tx: '0x8102feb1b57bbe071e303264de1fd1f3ba690d27706c185c8c81fa75bda8327a',
}}
#swagger.responses[200] = { schema: {$ref: '#/definitions/Auction'} }
*/);

app.get('/api/v1/order/:id/get', getOrder /*
#swagger.tags = ['Order']
#swagger.description = 'Get order'
#swagger.parameters['id'] = {in: 'path', description: 'Order ID', schema: '6232e92a3d0d63faa893cb48'}
#swagger.responses[200] = { schema: { id: '6232e92a3d0d63faa893cb48', order: { $ref: '#/definitions/MarketOrder' } } }
*/);
app.get('/api/v1/auction/:id/get', getAuction /*
#swagger.tags = ['Auction']
#swagger.description = 'Get auction'
#swagger.parameters['id'] = {in: 'path', description: 'Auction ID', schema: '6232e92a3d0d63faa893cb48'}
#swagger.responses[200] = { schema: { auction: { $ref: '#/definitions/Auction' }, order: { $ref: '#/definitions/MarketOrder' } } }
*/);
app.get('/api/v1/auction/:id/bids', getAuctionBids /*
#swagger.tags = ['Auction']
#swagger.description = 'Get auction bids'
#swagger.parameters['id'] = {in: 'path', description: 'Auction ID', schema: '6232e92a3d0d63faa893cb48'}
#swagger.responses[200] = { schema: [{ $ref: '#/definitions/Order' }] }
*/);
app.get('/api/v1/auction/bid/:id', getOrder /*
#swagger.tags = ['Auction']
#swagger.description = 'Get auction bid'
#swagger.parameters['id'] = {in: 'path', description: 'Auction bid ID', schema: '6232e92a3d0d63faa893cb48'}
#swagger.responses[200] = { schema: { id: '6232e92a3d0d63faa893cb48', order: { $ref: '#/definitions/MarketOrder' } } }
*/);
app.get('/api/v1/orders/:side/list', getSideOrders /*
#swagger.tags = ['Order']
#swagger.description = 'Get orders list'
#swagger.parameters['side'] = {in: 'path', description: 'Order side, 0 - buy, 1, sell', schema: '0'}
#swagger.parameters['account'] = {in: 'query', description: 'Order account', schema: '0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772'}
#swagger.parameters['tokenId'] = {in: 'query', description: 'Order tokenIds array', schema: [12,13]}
#swagger.parameters['currency'] = {in: 'query', description: 'Order currency array', schema: ['0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772']}
#swagger.parameters['commodity'] = {in: 'query', description: 'Order commodity array', schema: ['0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772']}
#swagger.responses[200] = { schema: [{ $ref: '#/definitions/Order' }] }
*/);
app.get('/api/v1/auction/list', getAuctionsList /*
#swagger.tags = ['Auction']
#swagger.description = 'Get auctions list'
#swagger.parameters['side'] = {in: 'query', description: 'Order side, 0 - buy, 1, sell', schema: '0'}
#swagger.parameters['account'] = {in: 'query', description: 'Order account', schema: '0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772'}
#swagger.parameters['tokenId'] = {in: 'query', description: 'Order tokenIds array', schema: [12,13]}
#swagger.parameters['currency'] = {in: 'query', description: 'Order currency array', schema: ['0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772']}
#swagger.parameters['commodity'] = {in: 'query', description: 'Order commodity array', schema: ['0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772']}
#swagger.responses[200] = { schema: [{ $ref: '#/definitions/Auction' }] }
*/);

app.get('/api/v1/account/:account/orders', getAccOrders /*
#swagger.tags = ['Account']
#swagger.description = 'Get account orders'
#swagger.parameters['side'] = {in: 'query', description: 'Order side, 0 - buy, 1, sell', schema: '0'}
#swagger.parameters['account'] = {in: 'path', description: 'Account address', schema: '0xDAb770d15397fddfbac85d334709C92C2B473b01'}
#swagger.parameters['tokenId'] = {in: 'query', description: 'Order tokenIds array', schema: [12,13]}
#swagger.parameters['currency'] = {in: 'query', description: 'Order currency array', schema: ['0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772']}
#swagger.parameters['commodity'] = {in: 'query', description: 'Order commodity array', schema: ['0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772']}
#swagger.parameters['status'] = {in: 'query', description: 'Order status', schema: 0}
#swagger.responses[200] = { schema: [{ $ref: '#/definitions/Order' }] }
*/);
app.get('/api/v1/account/:account/auctions', getAccAuctions /*
#swagger.tags = ['Account']
#swagger.description = 'Get account's auctions'
#swagger.parameters['side'] = {in: 'query', description: 'Order side, 0 - buy, 1, sell', schema: '0'}
#swagger.parameters['account'] = {in: 'path', description: 'Account address', schema: '0xDAb770d15397fddfbac85d334709C92C2B473b01'}
#swagger.parameters['tokenId'] = {in: 'query', description: 'Order tokenIds array', schema: [12,13]}
#swagger.parameters['currency'] = {in: 'query', description: 'Order currency array', schema: ['0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772']}
#swagger.parameters['commodity'] = {in: 'query', description: 'Order commodity array', schema: ['0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772']}
#swagger.parameters['status'] = {in: 'query', description: 'Order status', schema: 0}
#swagger.responses[200] = { schema: [{ $ref: '#/definitions/Auction' }] }
*/);
app.get('/api/v1/account/:account/bids', getAccBids /*
#swagger.tags = ['Account']
#swagger.description = 'Get account's bids'
#swagger.parameters['side'] = {in: 'query', description: 'Order side, 0 - buy, 1, sell', schema: '0'}
#swagger.parameters['account'] = {in: 'path', description: 'Account address', schema: '0xDAb770d15397fddfbac85d334709C92C2B473b01'}
#swagger.parameters['tokenId'] = {in: 'query', description: 'Order tokenIds array', schema: [12,13]}
#swagger.parameters['currency'] = {in: 'query', description: 'Order currency array', schema: ['0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772']}
#swagger.parameters['commodity'] = {in: 'query', description: 'Order commodity array', schema: ['0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772']}
#swagger.parameters['status'] = {in: 'query', description: 'Order status', schema: 0}
#swagger.responses[200] = { schema: [{ $ref: '#/definitions/Order' }] }
*/);

module.exports = app.routes;