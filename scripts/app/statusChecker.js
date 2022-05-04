require('../utils/logger');

const cfg = require('hardhat').network.config;

const MongoDB = require('./mongodb');
const Market = require('./market');

const { azureListen } = require('../utils/config');
const loop = require('../utils/looper');
const { _sec, _min } = require('./constants');

const PERIOD = 15 * _sec;
const PERIOD_AUCTION = PERIOD + 5 * _sec;
const DELAY_RETRY = 30 * _sec;

async function main() {
  await azureListen();
  await MongoDB.connect(cfg.mongo);
  await Market.init(cfg);

  loop(Market, 'checkStatusNextOrder', PERIOD, PERIOD, DELAY_RETRY);
  loop(Market, 'checkStatusNextAuction', PERIOD_AUCTION, PERIOD_AUCTION, DELAY_RETRY);
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