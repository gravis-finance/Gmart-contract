const error = (message, status = 400, extra) => {
  const err = new Error(message);
  err.status = status;
  err.extra = extra;
  return err;
}

const routes = [];

const app = {
  routes,
  get: (path, method) => {
    routes.push({
      route: path,
      method,
    })
  },
  post: (path, method) => {
    routes.push({
      route: path,
      type: 'post',
      method,
    })
  },
}

module.exports = {
  error,
  app,
}