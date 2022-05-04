const { AppConfigurationClient } = require('@azure/app-configuration');
const { V, decrypt } = require('./crypto');

const _sec = 1000;
const _min = 60 * _sec;

const AZURE_EXIT_APP = 1 * _min;
const AZURE_CHECK_PERIOD = 30 * _sec;
let _azureConfigs;
let _azureClient;
let _azureExitTimer;

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

const azureRead = async () => {
  /**
     * Filters for labels. There are two types of matching:
     *
     * 1. Exact matching. Up to 5 labels are allowed, separated by commas (',')
     * 2. Wildcard matching. A single wildcard expression can be specified.
     *
     *    | Value        | Matches                                           |
     *    |--------------|---------------------------------------------------|
     *    | omitted or * | Matches any key                                   |
     *    | %00          | Matches any key without a label                   |
     *    | prod         | Matches a key with label named prod               |
     *    | prod*        | Matches key with label names that start with prod |
     *
     * These characters are reserved and must be prefixed with backslash in order
     * to be specified: * or \\ or ,
     */
  if (!process.env.AZURE_LABEL) console.warn('AZURE_LABEL not defined');
  const labelFilter = process.env.AZURE_LABEL || '%00';
  const settingsIterator = _azureClient.listConfigurationSettings({ labelFilter });
  const list = {};
  for await (const { key, value, label, lastModified } of settingsIterator) {
    // console.log('1', { key, value, label, lastModified });
    list[key] = value;
  }

  return list;
}

const azureCheck = async () => {
  try {
    const list = await azureRead();

    const changes = diffObject(_azureConfigs, list);
    _azureConfigs = list;

    if (changes.diffCount) {
      // TODO: don't exit on some keys

      console.warn(`Config changed by azure. Exit in ${(AZURE_EXIT_APP / _min).toFixed(2)} minutes`, { changes });

      process.beforeQuit();

      if (_azureExitTimer) clearTimeout(_azureExitTimer);
      _azureExitTimer = setTimeout(() => {
        console.warn('Exit by Azure config changed');
        process.quit();
      }, AZURE_EXIT_APP);
    }
  }
  catch (err) {
    console.error(err);
  }

  setTimeout(() => azureCheck(), AZURE_CHECK_PERIOD);
}

const azureClient = () => {
  let connectionString = process.env.AZURE;
  if (process.env.AZURE_ENPOINT && process.env.AZURE_ID && process.env.AZURE_SECRET) {
    connectionString = `Endpoint=${process.env.AZURE_ENPOINT};Id=${process.env.AZURE_ID};Secret=${AZURE_SECRET}`;
  }

  if (!connectionString) {
    console.warn('Azure config endpoint is undefined');
    return;
  }

  return _azureClient = new AppConfigurationClient(connectionString);
}

const azureInit = async () => {
  azureClient();
  if (!_azureClient) return;
  const list = await azureRead();

  for (const key of Object.keys(list)) {
    process.env[key] = list[key];
  }
}

const azureListen = async () => {
  azureClient();
  if (!_azureClient) return;

  _azureConfigs = await azureRead();
  azureCheck();
}


const formatVal = (val, type, extra) => {
  if (type.includes('priv') && val.substring(0, V.length) == V) type = type.replace('priv', 'sec');
  if (type.includes('sec')) {
    val = decrypt(val, extra || process.env.SECRET);
    type = type.replace('sec', '');
  }

  if (type.includes('list')) return val.split(',');

  if (type == 'num') return isNaN(val) ? def : +val;

  if (type == 'bool') {
    if (['false', '0'].includes(val)) return false;
    return !!val;
  }

  return val;
}

const envVal = (key, def, type = 'string', extra) => {
  const val = process.env[key];
  if (typeof val == 'undefined') return def;

  return formatVal(val, type, extra);
}

module.exports = {
  azureInit,
  azureListen,
  envVal,
};
