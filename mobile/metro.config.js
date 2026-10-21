const http = require('node:http');
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The website's code (../src: permissions, data, backend connection) is shared with the app as "@web/…".
// Every package resolves from this app's node_modules, so both use one React.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../src')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

/**
 * API pass-through: the dev server forwards /__api/* to the MSMA API on this PC.
 * The app calls the API on the same address it loaded from (LAN IP or Expo tunnel), so it keeps
 * working when the Wi-Fi changes, when the network only lets one port through, and with `--tunnel`.
 */
const API_PREFIX = '/__api';
const API_TARGET = new URL(
  process.env.MSMA_API_TARGET || `http://127.0.0.1:${process.env.API_PORT || 4000}`,
);

function proxyToApi(req, res) {
  const upstream = http.request(
    {
      hostname: API_TARGET.hostname,
      port: API_TARGET.port,
      path: req.url.slice(API_PREFIX.length) || '/',
      method: req.method,
      headers: { ...req.headers, host: API_TARGET.host },
    },
    (apiRes) => {
      res.writeHead(apiRes.statusCode ?? 502, apiRes.headers);
      apiRes.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (res.headersSent) return res.end();
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        statusCode: 502,
        message: `The MSMA API is not running on this PC (${API_TARGET.origin}). Start it with: pnpm dev`,
      }),
    );
  });
  req.pipe(upstream);
}

const previous = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = previous ? previous(middleware, server) : middleware;
    return (req, res, next) => {
      if (req.url === API_PREFIX || req.url.startsWith(`${API_PREFIX}/`))
        return proxyToApi(req, res);
      return base(req, res, next);
    };
  },
};

module.exports = config;
