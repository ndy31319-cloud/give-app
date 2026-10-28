const { createProxyMiddleware } = require('http-proxy-middleware');

// Keep client-side routes such as /locker in the React app. Only API and
// uploaded media requests belong to the local backend during development.
const target = process.env.REACT_APP_DEV_API_URL || 'http://localhost:3001';

module.exports = function setupProxy(app) {
  app.use(
    ['/api', '/uploads'],
    createProxyMiddleware({
      target,
      changeOrigin: true,
      logLevel: 'warn',
    }),
  );
};
