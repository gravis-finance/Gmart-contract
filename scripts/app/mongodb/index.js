const mongoose = require('mongoose');

const MODELS = [
  'auction',
  'order',
];

class MongoDb {
  cfg;
  mongoose = mongoose;
  connection = false;
  _instanse = false;
  models = {};

  constructor() {
    if (this._instanse) return this._instanse;

    this._instanse = this;
  }

  async connect(cfg) {
    this.mongoConnectionLine(cfg);
    return this.connection || this.init();
  }

  mongoConnectionLine(cfg) {
    if (!cfg) throw 'Mongodb: Empty cfg';

    if (typeof cfg == 'string') return this.cfg = cfg;

    if (!cfg.line) throw 'Mongodb: Invalid cfg';

    const mongo_creds = cfg.acc && cfg.pass
      ? `${cfg.acc}:${cfg.pass}`
      : cfg.creds || '';

    return this.cfg = `mongodb://${mongo_creds && mongo_creds + '@'}${cfg.line}`;
  }

  async init() {
    for (const model of MODELS) {
      this.models[model] = require('./models/' + model);
    }

    this.connection = await mongoose.connect(this.cfg, {
      family: 4, // Use IPv4, skip trying IPv6
    });
    return this.connection;
  }
}


module.exports = new MongoDb();