const Cfg = require('./config');
const { initSentry } = require('../utils/logger');
const MongoDB = require('./mongodb');
const Moralis = require('./moralis');
const Market = require('./market');
const Server = require('./server');
const loop = require('../utils/looper');

const _sec = 1000;
const _min = _sec * 60;
const _hour = _min * 60;

const PERIOD = 30 * _min;
const DELAY_RETRY = 30 * _sec;

async function main() {
  const cfg = await Cfg.get();
  await initSentry(cfg);

  await MongoDB.connect(cfg.mongo);
  await Moralis.init(cfg.MoralisApiKey);
  await Market.init(cfg);
  await Cfg.azureListen();

  Server.init(cfg.httpPort);

  if (cfg.reread) {
    await Market.reReadFromRemote();
  }

  loop(Market, 'scanAll', PERIOD, PERIOD, DELAY_RETRY);
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