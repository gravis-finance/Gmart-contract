require('../utils/logger');

const cfg = require('hardhat').network.config;

const MongoDB = require('./mongodb');
const Market = require('./market');
const Server = require('./server');

const { azureListen } = require('../utils/config');

async function main() {
  await azureListen();
  await MongoDB.connect(cfg.mongo);
  await Market.init(cfg);

  Server.init(cfg.httpPort);
}

main()
  .catch(err => {
    console.error(err);
    process.quit(1);
  });


process
  .on('unhandledRejection', err => {
    console.fatal('unhandledRejection', err);
    process.quit(1);
  })
  .on('uncaughtException', err => {
    console.fatal('uncaughtException', err);
    process.quit(1);
  });