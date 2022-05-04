const { utils } = require('ethers');
const { splitSignature } = require('ethers/lib/utils');


const toWeis = (val, unit = 'ether') => utils.parseUnits(val.toString(), unit);
const toEthers = (wei, unit = 'ether') => utils.formatUnits(wei, unit);
const toGweis = (wei) => toEthers(wei, 'gwei');

const keccak256 = (...args) => {
  return utils.keccak256(...(
    args.map(i => typeof i === 'string'
      ? utils.toUtf8Bytes(i)
      : i)
  ))
}

const checkSync = async (provider) => {
  provider = provider || require('hardhat').ethers.provider;
  const syncStatus = await provider.send('eth_syncing', []);
  if (!syncStatus) return;

  for (const k in syncStatus) {
    syncStatus[k] = utils.formatUnits(syncStatus[k], 'wei');
  }

  console.warn({ syncStatus });
  throw 'Blockchain endpoint not synced';
}

// splitSignature
const getRSVFromSign = (signature) => {
  return splitSignature(signature);

  /*const sign = signature.substring(2);

  const r = '0x' + sign.substring(0, 64);
  const s = '0x' + sign.substring(64, 128);
  const v = parseInt(sign.substring(128, 130), 16);
  return {
    r,
    s,
    v,
  };*/
}

const toHex = (covertThis, padding = 32, substr = true) => {
  if (padding === 0) return '';
  const hex = utils.hexZeroPad(utils.hexlify(covertThis), padding);
  return substr
    ? hex.substr(2)
    : hex;
};


const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const printJSON = (json) => {
  return JSON.stringify(json, null, 2);
}

const diffArray = (a, b) => {
  return b.filter(function(i) { return a.indexOf(i) < 0; });
}

const diffObj = (a, b) => {
  return Object.keys(b).reduce((diff, key) => {
    if (a[key] === b[key]) return diff;

    return {
      ...diff,
      [key]: b[key],
    }
  }, {});
}

const diffObject = (a, b) => {
  const changed = diffObj(a, b);
  const keysAdded = diffArray(Object.keys(a), Object.keys(b));
  const keysRemoved = diffArray(Object.keys(b), Object.keys(a));

  return {
    diffCount: Object.keys(changed).length + keysAdded.length + keysRemoved.length,
    changed,
    keysAdded,
    keysRemoved,
  }
};


const errors = [];
const die = (name) => errors.push(name);
const chkErrors = () => {
  if (!errors.length) return;

  console.error('Parameters not set:', errors);
  throw 'Please set them first in hardhat.config.js according to the selected network.';
}
/*
const checkSync = async () => {
  const syncStatus = await web3.eth.isSyncing();
  if (!syncStatus) return;

  console.warn(syncStatus);
  throw 'Endpoint not synced';
}*/

const chkDeploy = () => {
  if (process.env['DEPLOY']) return;

  console.warn('Dry run finished. To actually deploy, run with "DEPLOY=1".');
  process.exit();
}

async function sendTx(title, func, args) {
  console.log(title, '..', args);
  const tx = await func(...args);
  console.log(title, 'at', tx.hash);
  const res = await tx.wait();
  console.done(title, 'done');
  return res;
}

function pretyEntry(item) {
  const obj = {};
  for (const k of Object.keys(item)) {
    if (!isNaN(k)) continue;
    obj[k] = item[k].toString();
  }

  return obj;
}
function pretyEvent(event) {
  console.log({ event });
  const eventKeys = [
    'transactionIndex',
    'blockNumber',
    'transactionHash',
    'address',
    'event',
    'eventSignature',
    'data',
  ];
  const obj = {};
  for (const k of eventKeys) {
    obj[k] = event[k] && event[k].toString() || undefined;
  }

  obj.topics = event.topics && event.topics.map(pretyEntry);
  obj.args = event.args && pretyEntry(event.args);

  return obj;
}

function scanApiKey() {
  if (process.env.SCAN_API) return process.env.SCAN_API;

  const apiKey = {};
  if (process.env.ETH_SCAN_API) {
    apiKey.mainnet = process.env.ETH_SCAN_API;
    apiKey.ropsten = process.env.ETH_SCAN_API;
    apiKey.rinkeby = process.env.ETH_SCAN_API;
    apiKey.goerli = process.env.ETH_SCAN_API;
    apiKey.kovan = process.env.ETH_SCAN_API;
  }

  if (process.env.BSC_SCAN_API) {
    apiKey.bsc = process.env.BSC_SCAN_API;
    apiKey.bscTestnet = process.env.BSC_SCAN_API;
  }

  if (process.env.POLYGON_SCAN_API) {
    apiKey.polygon = process.env.POLYGON_SCAN_API;
    apiKey.polygonMumbai = process.env.POLYGON_SCAN_API;
  }

  if (process.env.AURORA_SCAN_API) {
    apiKey.aurora = process.env.AURORA_SCAN_API;
    apiKey.auroraTestnet = process.env.AURORA_SCAN_API;
  }

  return apiKey;
}

module.exports = {
  toWeis,
  toEthers,
  toGweis,

  checkSync,
  getRSVFromSign,
  keccak256,
  toHex,

  delay,
  printJSON,

  diffArray,
  diffObj,
  diffObject,

  scanApiKey,

  die,
  chkErrors,
  // checkSync,
  chkDeploy,

  sendTx,
  pretyEntry,
  pretyEvent,
};
