const { getDefaultConfig } = require('expo/metro-config');
const { normalizeMetroProxyHeaders } = require('./metro-proxy-headers.cjs');
const config = getDefaultConfig(__dirname);
const enhance = config.server.enhanceMiddleware;
const seen = new Set();
config.server.enhanceMiddleware = (middleware, server) => {
  const enhanced = enhance ? enhance(middleware, server) : middleware;
  return (request, response, next) => {
    const report = normalizeMetroProxyHeaders(request);
    const key = report && JSON.stringify(report);
    if (key && !seen.has(key)) {
      seen.add(key);
      // Never log URLs, query strings, header values, authorization or cookies.
      console.warn('[form0 device Metro]', key);
    }
    return enhanced(request, response, next);
  };
};
module.exports = config;
