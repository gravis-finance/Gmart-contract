const { Schema, model } = require('mongoose');
const {
  _sec,
  STATUS_CHECK_PERIOD,
  ORDER_SIDE, ORDER_STATUS,
} = require('../../constants');

/*
  enum OrderSide {
    Buy,
    Sell
  }

  /// @notice Structure representing order
  /// @param account Account signing order
  /// @param side Order side
  /// @param commodity Address of the commodity token (ERC721)
  /// @param tokenIds List of token IDs included in this order
  /// @param currency Address of the currency token (ERC20)
  /// @param amount Amount of currency paid in this order (as wei)
  /// @param expiry Timestamp when order expires
  /// @param nonce Nonce of the order (to make several orders with same params possible)
  struct Order {
    address account;
    OrderSide side;
    address commodity;
    uint256[] tokenIds;
    address currency;
    uint256 amount;
    uint64 expiry;
    uint8 nonce;
  }
*/


const scheme = new Schema({
  account: {
    type: String,
    required: true,
    index: true,
  },
  side: {
    type: Number,
    enum: Object.values(ORDER_SIDE),
    default: 0,
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
  amount: {
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
    default: 100,
  },

  auctionId: {
    // type: String,
    type: Schema.Types.ObjectId,
    ref: 'Auction',
    index: true,
  },

  sign: {
    type: String,
    // type: Schema.Types.Mixed, // { v, r, s }
    // required: true,
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

// Duplicate the ID field.
/*scheme.virtual('id').get(function() {
  return this._id.toHexString();
});*/

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
  side: 1,
  commodity: 1,
  tokenId: 1,
  currency: 1,
  amount: 1,
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
    this.model = model('Order', scheme);
  }

  format({
    account,
    side = 0,
    commodity,
    tokenId = 0,
    currency,
    amount,
    expiry,
    nonce = 100,
  }) {
    return {
      account,
      side,
      commodity,
      tokenIds: [tokenId],
      currency,
      amount: amount.toString(),
      expiry: Math.floor(expiry / _sec),
      nonce,
    };
  }

  async add(item) {
    item.account = item.account.toLowerCase();
    item.currency = item.currency.toLowerCase();
    item.commodity = item.commodity.toLowerCase();

    const {
      account,
      side,
      commodity,
      tokenId,
      currency,
      amount,
    } = item;

    const dup = await this.model.findOne({
      account,
      side,
      commodity,
      tokenId,
      currency,
      amount,
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

  async update(_id, updates = {}, $unset = {}) {
    return this.model.updateOne({ _id }, updates);
  }

  async delete(_id, statusReason, status = ORDER_STATUS.FAILED) {
    // return this.model.deleteOne({ _id });
    return this.model.updateOne({ _id }, {
      statusReason, status, nextCheck: 0,
    });
  }

  async deleteMany(find, statusReason, status = ORDER_STATUS.FAILED) {
    // return this.model.deleteMany(find);
    return this.model.updateMany(find, {
      statusReason, status, nextCheck: 0,
    });
  }

  async get(_id) {
    return this.model.findOne({ _id })
      .exec();
  }

}


module.exports = new Model();