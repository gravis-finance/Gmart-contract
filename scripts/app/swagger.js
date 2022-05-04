const swaggerAutogen = require('swagger-autogen')({
  autoHeaders: false,     // Enable/Disable automatic headers capture. By default is true
  autoQuery: false,       // Enable/Disable automatic query capture. By default is true
  autoBody: false,        // Enable/Disable automatic body capture. By default is true
})

const Order = require('./mongodb/models/order');
const { ORDER_SIDE, ORDER_STATUS, ERROR_CODES } = require('./constants');

const doc = {
  info: {
    version: process.env.npm_package_version,
    title: 'API: ' + process.env.npm_package_name,
    description: process.env.npm_package_description,
  },
  host: 'localhost:3001',
  basePath: '/',
  schemes: ['http', 'https'],
  consumes: ['application/json'],
  produces: ['application/json'],
  tags: [
    {
      name: 'Order',
      description: 'Orders endpoints'
    },
    {
      name: 'Auction',
      description: 'Auctions endpoints'
    },
    {
      name: 'Account',
      description: 'Account endpoints'
    }
  ],
  definitions: {
    // Order: Order.scheme.obj,
    // Auction: Auction.scheme.obj,
    Order: {
      id: '6232e92a3d0d63faa893cb48',
      account: '0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772',
      side: 0,
      commodity: '0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772',
      tokenId: 13,
      tokenType: 0,
      currency: '0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772',
      amount: '1200000000000000000000',
      expiry: 1648638722,
      nonce: 0,
      sign: '0xDAb770d15397fddfbac85d334709C92C2B473b01DAb770d15397fddfbac85d334709C92C2B473b01DAb770d15397fddfbac85d334709C92C2B473b01DAb770d153',
      created: 1647452588000,
      status: 0,
    },
    Auction: {
      id: '6232e92a3d0d63faa893cb48',
      account: '0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772',
      commodity: '0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772',
      tokenId: 13,
      tokenType: 0,
      currency: '0xe2472Fc12053B8F8deB050D7e2975C4d4bb77772',
      minAmount: '1200000000000000000000',
      expiry: 1647452588000,

      active: 0,
      created: 1647452588000,
      status: 0,
    },
  }
}
doc.definitions = Object.assign(doc.definitions, {
  MarketOrder: Order.format(doc.definitions.Order),

  ORDER_SIDE,
  ORDER_STATUS,
  ERROR_CODES,

  /*SuccessResponse: {
      status: 200,
      data: {},
    },*/
  FailedResponse: {
    // status: 400,
    message: 'Error message',
    code: 9999,
    extra: {},
  },
});

const outputFile = './swagger-output.json'
const endpointsFiles = ['./server/routeList.js']

swaggerAutogen(outputFile, endpointsFiles, doc)
// .then(console.log);