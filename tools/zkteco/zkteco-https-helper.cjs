// HTTPS helper for the ZKTeco MB10-VL, which only talks https to its server.
// Listens on this PC's office-network addresses (192.168.1.x) only, accepts only ADMS requests (/iclock/...) from
// the registered terminal, and passes them to the HRIS backend on localhost:4000 over plain http.
// Started at sign-in by start-hris.ps1 (Startup folder shortcut "HRIS autostart").
const fs = require('node:fs');
const https = require('node:https');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const OFFICE_PREFIX = '192.168.1.';
const LISTEN_PORT = 4443;
const BACKEND = { host: '127.0.0.1', port: 4000 };
const ALLOWED_SERIALS = new Set(['UDP3262600211']);
const MAX_BODY = 1024 * 1024; // 1 MB per upload

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);

const tls = {
  key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
  minVersion: 'TLSv1.2',
};

function handle(req, res) {
  const url = new URL(req.url, 'https://device');
  const sn = url.searchParams.get('SN') ?? '';
  if (!url.pathname.startsWith('/iclock/') || !ALLOWED_SERIALS.has(sn)) {
    log(`REFUSED ${req.socket.remoteAddress} ${req.method} ${url.pathname} SN=${sn || '-'}`);
    res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Forbidden');
    return;
  }
  let size = 0;
  const up = http.request(
    { ...BACKEND, method: req.method, path: req.url, headers: { ...req.headers, host: `${BACKEND.host}:${BACKEND.port}` } },
    (r) => {
      // Heartbeats every few seconds would flood the log; record everything else.
      if (!(url.pathname === '/iclock/getrequest' && r.statusCode === 200))
        log(`${req.socket.remoteAddress} ${req.method} ${url.pathname}?${url.searchParams} -> ${r.statusCode}`);
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    },
  );
  up.on('error', (e) => {
    log(`backend not reachable: ${e.message}`);
    if (!res.headersSent) res.writeHead(502).end();
  });
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY) {
      log('REFUSED body over 1 MB');
      up.destroy();
      req.destroy();
    }
  });
  req.pipe(up);
}

const hosts = Object.values(os.networkInterfaces())
  .flat()
  .filter((a) => a && a.family === 'IPv4' && a.address.startsWith(OFFICE_PREFIX))
  .map((a) => a.address);

if (hosts.length === 0) {
  log(`no ${OFFICE_PREFIX}x address on this PC (not on the office network?) - nothing to listen on`);
  process.exit(1);
}

for (const host of hosts) {
  const server = https.createServer(tls, handle);
  server.on('tlsClientError', (e, s) => log(`TLS error from ${s.remoteAddress}: ${e.code ?? e.message}`));
  server.on('error', (e) => log(`could not listen on ${host}:${LISTEN_PORT}: ${e.code ?? e.message}`));
  server.listen(LISTEN_PORT, host, () => log(`ZKTeco https helper on https://${host}:${LISTEN_PORT} -> http://localhost:${BACKEND.port}/iclock`));
}
