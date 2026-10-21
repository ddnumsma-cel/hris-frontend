// Put the MSMA HRIS on the internet TEMPORARILY, straight from this laptop (for demos and user testing
// before the AWS deployment). Synthetic data only.
//
//   pnpm share            build, start a production copy, and open a Cloudflare quick tunnel
//   pnpm share --lan      same, but only for PCs on this Wi-Fi/office network (no tunnel, no cloudflared)
//
// What it does:
// 1. Builds the API and web app, then runs a separate production copy on ports 4010/3010 so it can
//    run next to `pnpm dev` (same database).
// 2. Puts an access-code page in front of it on port 3020: nobody reaches the app without the
//    8-digit code printed below, even if the link leaks. (Then they still sign in normally.)
// 3. Opens a free Cloudflare quick tunnel (https://<random>.trycloudflare.com) to that gate.
//    No account, no router settings. The link changes every run; it stops when you press Ctrl+C.
// Each run uses a new random sign-in secret, so sessions from earlier runs stop working.
//
// Needs cloudflared once:  winget install --id Cloudflare.cloudflared   (then open a new Command Prompt)
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_PORT = 4010;
const WEB_PORT = 3010;
const GATE_PORT = 3020;
const isWin = process.platform === 'win32';
const LAN = process.argv.includes('--lan');
const children = [];

const say = (msg = '') => console.log(msg);
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  void shutdown(1);
};

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('error', () => resolve(false));
    s.setTimeout(1500, () => (s.destroy(), resolve(false)));
  });
}

async function waitFor(url, label, ms = 90_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  fail(`${label} did not start. Scroll up for its error message.`);
}

function run(cmd, env = {}, { quiet = false } = {}) {
  const child = spawn(cmd, {
    cwd: root,
    shell: true,
    env: { ...process.env, ...env },
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  children.push(child);
  return child;
}

function findCloudflared() {
  const probe = spawnSync(isWin ? 'where' : 'which', ['cloudflared'], { encoding: 'utf8' });
  if (probe.status === 0) return probe.stdout.split(/\r?\n/)[0].trim();
  const candidates = isWin
    ? [
        'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
        'C:\\Program Files\\cloudflared\\cloudflared.exe',
        join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Links', 'cloudflared.exe'),
      ]
    : ['/opt/homebrew/bin/cloudflared', '/usr/local/bin/cloudflared'];
  return candidates.find((p) => existsSync(p)) ?? null;
}

// ---------- access-code gate ----------
// An 8-digit code (easy to read out over the phone). Entering it sets a cookie for this session;
// the app itself still needs a normal sign-in after that.
const digits = () => String(randomBytes(4).readUInt32BE() % 100_000_000).padStart(8, '0');
const CODE = digits().replace(/^(\d{4})(\d{4})$/, '$1-$2');
const SESSION = randomBytes(24).toString('base64url');
const COOKIE = 'msma_gate';
/** Wrong codes per visitor (Cloudflare passes the visitor IP; on the LAN it is the socket address). */
const wrongCodes = new Map();
const visitor = (req) => String(req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress ?? '?');
/** Only same-site paths like "/records?tab=1": no "//host", "/\host", spaces or control characters. */
const safeNext = (v) => (typeof v === 'string' && /^\/(?![/\\])[\x21-\x7e]*$/.test(v) ? v : '/');

const same = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const hasSession = (req) =>
  (req.headers.cookie ?? '')
    .split(';')
    .map((c) => c.trim().split('='))
    .some(([k, v]) => k === COOKIE && v && same(v, SESSION));

function gatePage(res, { status = 200, error = '', next = '/' } = {}) {
  const esc = (s) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Frame-Options': 'DENY',
    'X-Robots-Tag': 'noindex, nofollow',
  });
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MSMA HRIS (sample)</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F6F5F1;color:#1B1D1F;font:16px/1.5 system-ui,sans-serif}
form{background:#fff;border:1px solid #E4E2DC;border-radius:14px;padding:28px;width:min(360px,calc(100% - 32px))}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 16px;color:#5F6368;font-size:14px}
input{width:100%;box-sizing:border-box;font-size:22px;letter-spacing:4px;text-align:center;padding:10px;border:1px solid #E4E2DC;border-radius:8px}
button{margin-top:14px;width:100%;padding:12px;border:0;border-radius:8px;background:#0E6B63;color:#fff;font-size:16px;font-weight:600;cursor:pointer}
.err{color:#B42318;margin:10px 0 0}.tag{display:inline-block;background:#FEF0C7;color:#B45309;border-radius:99px;padding:1px 8px;font-size:12px;margin-bottom:12px}
@media (prefers-color-scheme:dark){body{background:#111315;color:#ECEAE4}form{background:#1B1D1F;border-color:#2C2F33}p{color:#A1A4A8}input{background:#111315;color:#ECEAE4;border-color:#2C2F33}button{background:#3DB5A8;color:#0B0C0D}}
</style></head><body><form method="post" action="/__gate">
<span class="tag">Sample data</span><h1>MSMA HRIS</h1><p>Enter the 8-digit access code you received with this link.</p>
<input name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="1234-5678" autofocus aria-label="Access code">
<input type="hidden" name="next" value="${esc(next)}">
${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}<button type="submit">Continue</button></form></body></html>`);
}

function handleGatePost(req, res) {
  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 2000) req.destroy();
  });
  req.on('end', () => {
    const form = new URLSearchParams(body);
    const next = safeNext(form.get('next'));
    const who = visitor(req);
    let tries = wrongCodes.get(who);
    if (!tries || Date.now() - tries.since > 60_000) tries = { count: 0, since: Date.now() };
    wrongCodes.set(who, tries);
    if (wrongCodes.size > 5000) wrongCodes.clear();
    if (tries.count >= 10)
      return gatePage(res, {
        status: 429,
        error: 'Too many wrong codes. Wait a minute and try again.',
        next,
      });
    const entered = (form.get('code') ?? '').replace(/\D/g, '');
    if (!same(entered, CODE.replace('-', ''))) {
      tries.count += 1;
      return gatePage(res, {
        status: 401,
        error: 'That code is not right. Check it and try again.',
        next,
      });
    }
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    res.writeHead(303, {
      Location: next,
      'Set-Cookie': `${COOKIE}=${SESSION}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secure}`,
    });
    res.end();
  });
}

function startGate() {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__gate') return handleGatePost(req, res);
    if (!hasSession(req)) {
      // API calls get JSON; pages get the access-code form.
      if (req.url?.startsWith('/api/')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({
            statusCode: 401,
            message: 'Enter the access code first (reload the page).',
          }),
        );
      }
      return gatePage(res, { next: safeNext(req.url) });
    }
    const headers = { ...req.headers, host: `127.0.0.1:${WEB_PORT}` };
    const upstream = http.request(
      { host: '127.0.0.1', port: WEB_PORT, path: req.url, method: req.method, headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, 'x-robots-tag': 'noindex, nofollow' });
        up.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('The MSMA HRIS on the laptop is not responding. Try again in a moment.');
    });
    req.pipe(upstream);
  });
  // --lan: reachable from other PCs on the network; otherwise only the local tunnel reaches it.
  server.listen(GATE_PORT, LAN ? '0.0.0.0' : '127.0.0.1');
  return server;
}

// ---------- main ----------
let gate;
async function main() {
  say('\n=== MSMA HRIS: temporary online access ===\n');
  const cloudflared = LAN ? null : findCloudflared();
  if (!LAN && !cloudflared)
    return fail(
      'cloudflared is not installed. Install it once with:\n\n    winget install --id Cloudflare.cloudflared\n\n' +
        '  then close and reopen Command Prompt and run pnpm share again.\n' +
        '  (macOS: brew install cloudflared)',
    );
  if (!(await portOpen(5432)))
    return fail('The database is not running. Open Docker Desktop, then run: pnpm db:up');
  for (const p of [API_PORT, WEB_PORT, GATE_PORT])
    if (await portOpen(p))
      return fail(`Port ${p} is in use. Is pnpm share already running in another window?`);

  const jwtSecret = randomBytes(32).toString('hex');
  const apiUrl = `http://127.0.0.1:${API_PORT}`;
  const shareEnv = {
    API_INTERNAL_URL: apiUrl,
    NEXT_DIST_DIR: '.next-share',
    NEXT_PUBLIC_API_URL: '',
  };

  say('1/4  Building the API and the web app (production build, 1–3 minutes)…');
  const build = spawnSync(
    'pnpm exec turbo run build --filter=@msma/api && pnpm --filter @msma/web exec next build',
    {
      cwd: root,
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, ...shareEnv },
    },
  );
  if (build.status !== 0) return fail('The build failed (see above).');

  say('\n2/4  Starting the API and web app…');
  run('node apps/api/dist/main.js', {
    API_PORT: String(API_PORT),
    API_HOST: '127.0.0.1', // only reachable through the web server behind the gate
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: '8h',
  });
  run(`pnpm --filter @msma/web exec next start --port ${WEB_PORT} --hostname 127.0.0.1`, shareEnv);
  await waitFor(`${apiUrl}/health`, 'The API');
  await waitFor(`http://127.0.0.1:${WEB_PORT}/login`, 'The web app');

  say('3/4  Starting the access-code gate…');
  gate = startGate();

  if (LAN) {
    const ip = Object.entries(os.networkInterfaces())
      .filter(
        ([name]) =>
          !/vEthernet|WSL|Hyper-V|VirtualBox|VMware|Docker|Loopback|Bluetooth/i.test(name),
      )
      .flatMap(([, a]) => a ?? [])
      .find(
        (a) => a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'),
      )?.address;
    say('4/4  Office network only (no tunnel).');
    return banner(`http://${ip ?? '<this PC IP>'}:${GATE_PORT}`, true);
  }
  say('4/4  Opening the Cloudflare tunnel…');
  const tunnel = spawn(
    cloudflared,
    ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${GATE_PORT}`],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  children.push(tunnel);
  let shown = false;
  const onOutput = (chunk) => {
    const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(chunk));
    if (m && !shown) {
      shown = true;
      banner(m[0]);
    }
  };
  tunnel.stdout.on('data', onOutput);
  tunnel.stderr.on('data', onOutput);
  tunnel.on('exit', (code) => {
    if (!stopping)
      fail(
        `The tunnel stopped (code ${code}). Check the internet connection and run pnpm share again.`,
      );
  });
  setTimeout(() => {
    if (!shown)
      fail(
        'No tunnel link after 60 seconds. Check the internet connection (or a firewall/VPN) and try again.',
      );
  }, 60_000);
}

function banner(url, lan = false) {
  const line = '='.repeat(64);
  say(`\n${line}`);
  say(
    lan
      ? '  MSMA HRIS is open to PCs on this network (sample data only)'
      : '  MSMA HRIS is ONLINE (temporary, sample data only)',
  );
  say(line);
  say(`  Link:              ${url}`);
  say(`  Access code:       ${CODE}`);
  say('                     (the page asks for it first)');
  say('  Then sign in with a demo account, e.g. hr@msma.test / Demo@2026');
  say('                     (payroll@, manager@ ... see README)');
  say(line);
  say(
    '  Send the link and the browser password to your colleagues separately (e.g. link by email,',
  );
  say('  password by phone). Keep this window open and the laptop awake and online.');
  say('  Press Ctrl+C to take it offline. The link and password change every time.');
  if (lan) say('  If other PCs cannot open it, allow Node.js in Windows Firewall (see README).');
  say('  Phone app from anywhere: run  pnpm mobile:tunnel  in another window.');
  say(`${line}\n`);
}

let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  gate?.close();
  for (const c of children) {
    if (c.exitCode !== null) continue;
    if (isWin) spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
    else c.kill('SIGTERM');
  }
  if (code === 0) say('\nOffline. The link no longer works.');
  process.exit(code);
}
process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));

void main().catch((e) => fail(e.message));
