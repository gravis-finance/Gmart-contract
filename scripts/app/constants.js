const _sec = 1000;
const _min = _sec * 60;
const _hour = _min * 60;
const _day = 24 * _hour;
module.exports = {
  _sec,
  _min,
  _hour,
  _day,
};

module.exports.STATUS_CHECK_PERIOD = _min * 3;

module.exports.ORDER_SIDE = {
  BUY: 0,
  SELL: 1,
};

module.exports.ORDER_STATUS = {
  NONE: 0,
  CANCELLED: 1,
  EXECUTED: 2,
  FAILED: 999, // not present at contract
};

module.exports.ERROR_CODES = {
  OTHER: 9999,

  DB_ERROR: 2000,
  CONTRACT_ERROR: 3000,

  CONTRACT_NOT_OWNER_NFT: 3021,
  CONTRACT_NOT_ALLOWED_NFT: 3023,
  CONTRACT_NOT_ALLOWED_ERC20: 3024,

  CONTRACT_INSUFFICIENT_ERC20: 3031,
};