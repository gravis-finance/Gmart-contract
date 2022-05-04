const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const routeList = require('./routeList');
const { error } = require('./helpers');
const { ERROR_CODES } = require('../constants');

const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('../swagger-output.json');

const _sec = 1000;
const _min = 60 * _sec;


class Server {
  app;

  init(port = 3001) {
    this.app = express();

    // req in
    /*this.app.use(function(req, res, next) {
      console.log('get req from', req.url);
      return next();
    });*/

    // adding Helmet to enhance your API's security
    this.app.use(helmet());
    // this.app.disable('etag');

    // using bodyParser to parse JSON bodies into JS objects
    this.app.use(bodyParser.json());

    // enabling CORS for all requests
    this.app.use(cors());

    // adding morgan to log HTTP requests
    this.app.use(morgan(':date[iso] :method::url [:status] :response-time ms ":remote-addr :referrer" ":user-agent"'));

    const limiter = rateLimit({
      windowMs: 1 * _min,
      max: 100,
      handler: this.rateHandler,
    });
    // set 100 requests per IP for 1 min
    this.app.use(limiter);

    if (!process.env.NODE_ENV || !process.env.NODE_ENV.includes('prod')) {
      this.app.use('/doc', swaggerUi.serve, swaggerUi.setup(swaggerFile));
    }


    // start process req
    /*this.app.use(function(req, res, next) {
      console.log('start route', req.url);
      return next();
    });*/

    this.setRoutes();

    // catch 404 and forward to error handler
    this.app.use(function(req, res, next) {
      return next(error('Unknown method', 404));
    });

    // error handler
    this.app.use(this.formatError);

    // starting the server
    this.app.listen(port, () => {
      console.done('Server: listening', { port });
    });
  }

  rateHandler(req, res, next, event) {
    return next(error(event.message, event.statusCode));
  }


  async processMethod(func, req, res, next) {
    let status = 200;
    let data = {};
    try {
      data = await func(req);
    }
    catch (err) {
      return next(err);
    }

    if (data && data.raw) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(data.raw, 'binary');
      // return res.status(status)
        // .send(data.raw)
    }

    return sendResp(res, status, data);
  }

  setRoutes() {
    for (const { type = 'get', route, method } of routeList) {
      this.app[type](route, (req, res, next) => this.processMethod(method, req, res, next));
    }
  }

  formatError(err, req, res, next) {
    const { url, method, body } = req;
    err.req = { url, method, body };

    let code = ERROR_CODES.OTHER;
    const status = err.status || 500;
    const level = status >= 500 ? 'error' : 'warn';
    console[level](err);
    const message = status != 500 && err.message || 'Unknown error';

    if (typeof err.extra == 'object' && err.extra.errorCode) {
      code = err.extra.errorCode;
      delete err.extra.errorCode;
      if (!Object.keys(err.extra).length) delete err.extra;
    }

    const resp = {
      message,
      code,
      extra: err.extra,
    };

    return sendResp(res, status, resp);
  }


}

function sendResp(res, status, data) {
  return res
    .status(status)
    .send(data);
  /*.send({
    status,
    data,
  });*/
}

module.exports = new Server();
