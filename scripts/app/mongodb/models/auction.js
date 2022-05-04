const { Schema, model } = require('mongoose');
const {
  _min,
  ORDER_STATUS,
} = require('../../constants');

const STATUS_CHECK_PERIOD = _min * 5;

const scheme = new Schema({
  account: {
    type: String,
    required: true,
    index: true,
  },
  commodity: {
    type: String,
    required: true,
    index: true,
  },
  tokenId: {
    type: Number,
    required: true,
  },
  tokenType: {
    type: Number,
    required: false,
  },
  currency: {
    type: String,
    required: true,
    index: true,
  },
  minAmount: {
    type: String, // BN
    required: true,
    index: true,
  },

  expiry: {
    type: Date,
    required: true,
    index: true,
    min: Date.now,
    default: Date.now,
  },

  nonce: {
    type: Number,
    default: 0,
  },

  active: {
    type: Boolean,
    default: 0,
  },

  status: {
    type: Number,
    enum: Object.values(ORDER_STATUS),
    default: 0,
    index: true,
  },
  statusTx: {
    type: String,
  },
  statusReason: {
    type: String,
  },

  created: {
    type: Date,
    default: Date.now,
  },

  nextCheck: {
    type: Date,
    default: () => { return Date.now() + STATUS_CHECK_PERIOD },
  },
});

// Ensure virtual fields are serialised.
scheme.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function(doc, ret) {
    delete ret._id;
    // delete ret.nextCheck;
  }
});

// Unique index
scheme.index({
  account: 1,
  commodity: 1,
  tokenId: 1,
  currency: 1,
  nonce: 1,
}, { unique: true });


class Model {
  _instanse = false;
  schema;
  model;

  constructor() {
    if (this._instanse) return this._instanse;

    this._instanse = this;
    this.scheme = scheme;
    this.model = model('Auction', this.scheme);
  }

  async add(item) {
    item.account = item.account.toLowerCase();
    item.currency = item.currency.toLowerCase();
    item.commodity = item.commodity.toLowerCase();

    const {
      account,
      commodity,
      tokenId,
      currency,
    } = item;

    const dup = await this.model.findOne({
      account,
      commodity,
      tokenId,
      currency,
    }).sort({ nonce: -1 });

    if (dup) {
      if (dup.nextCheck.getTime() > 0) {
        const err = new Error('duplicate key');
        err.extra = { duplicateId: dup._id };
        throw err;
      }

      item.nonce = dup.nonce + 1;
    }

    return this.model.create(item);
  }

  async update(_id, updates = {}) {
    return this.model.updateOne({ _id }, updates);
  }

  async delete(_id, statusReason, status = ORDER_STATUS.FAILED) {
    const { matchedCount } = await require('./order').deleteMany({ auctionId: _id }, statusReason, status);
    // await this.model.deleteOne({ _id });
    await this.model.updateOne({ _id }, {
      statusReason, status,
    });

    return { bidsCount: matchedCount };
  }

  async get(_id) {
    return this.model.findOne({ _id })
      .exec();
  }
}


module.exports = new Model();