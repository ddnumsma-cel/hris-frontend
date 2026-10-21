// Start the Expo dev server for the Mobile UI app (hris-frontend/mobile) and keep it reachable when the network changes.
//
// - Always runs Expo from apps/mobile (running `expo start` in the repo root breaks the app).
// - Picks the real Wi-Fi/Ethernet address. PCs often also have virtual adapters (WSL, Docker,
//   Hyper-V, VirtualBox, VPNs) with similar-looking IPs that a phone can't reach.
// - Watches the network: when you join another Wi-Fi, Expo restarts with the new address and a new QR code.
// - The app reaches the API through the Expo server itself (/__api, see apps/mobile/metro.config.js),
//   so only one address and port has to work, on any network.
// - `--tunnel`: public address through Expo's tunnel, so the phone can be on any network (even mobile data).
//
// Usage: npm run mobile -- [--tunnel] [--ip 192.168.1.25] [--clear] [--port 8081] [other `expo start` flags]
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mobileDir = root;
const API_PORT = Number(process.env.API_PORT ?? 4000);
const WATCH_INTERVAL_MS = 5000;

// ---------- arguments ----------
const args = process.argv.slice(2);
const take = (flag) => {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
};
const forcedIp = take('--ip');
const tunnel = args.includes('--tunnel');
const expoGo = args.includes('--go');
// Expo Go only opens a project when the phone is signed in to an Expo account that belongs to the
// project owner (the Expo CLI on this PC must be signed in too). The owner is the Expo organization.
const OWNER = (() => {
  try {
    return JSON.parse(readFileSync(join(mobileDir, 'app.json'), 'utf8')).expo.owner ?? null;
  } catch {
    return null;
  }
})();
const portIndex = args.findIndex((a) => a === '--port' || a === '-p');
const METRO_PORT = portIndex > -1 ? Number(args[portIndex + 1]) : 8081;

// ---------- network ----------
const VIRTUAL =
  /vEthernet|WSL|Hyper-V|Default Switch|VirtualBox|VMware|Docker|vboxnet|Loopback|Bluetooth|ZeroTier|Tailscale|Hamachi|TAP|TUN|utun|wg\d|br-|veth/i;
const PREFERRED = /Wi-?Fi|Wireless|WLAN|^wl|^en0$/i;
const isPrivate = (ip) =>
  /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

function lanAddresses() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (
        (a.family === 'IPv4' || a.family === 4) &&
        !a.internal &&
        !a.address.startsWith('169.254.')
      ) {
        out.push({ name, address: a.address, virtual: VIRTUAL.test(name) });
      }
    }
  }
  const rank = (x) =>
    (x.virtual ? 100 : 0) + (PREFERRED.test(x.name) ? 0 : 10) + (isPrivate(x.address) ? 0 : 5);
  return out.sort((a, b) => rank(a) - rank(b));
}

const pickAddress = () => forcedIp ?? lanAddresses().find((c) => !c.virtual)?.address ?? null;

function wifiName() {
  if (process.platform !== 'win32') return null;
  const r = spawnSync('netsh', ['wlan', 'show', 'interfaces'], { encoding: 'utf8' });
  const m = /^\s*SSID\s*:\s*(.+)$/m.exec(r.stdout ?? '');
  return m ? m[1].trim() : null;
}

function portInUse(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('error', () => resolve(false));
    s.setTimeout(1500, () => (s.destroy(), resolve(false)));
  });
}

async function apiRunning() {
  try {
    const res = await fetch(`http://127.0.0.1:${API_PORT}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------- Expo process ----------
let child = null;
let stopping = false;
const quote = (a) => (/^[\w./:=@-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`);

function stopExpo() {
  if (!child) return Promise.resolve();
  const proc = child;
  child = null;
  return new Promise((resolve) => {
    proc.once('exit', () => resolve());
    // shell: true starts a shell that starts node; kill the whole tree.
    if (process.platform === 'win32')
      spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    else proc.kill('SIGTERM');
    setTimeout(resolve, 5000);
  });
}

function printBanner(address) {
  console.log('\n=== MSMA HRIS mobile ===');
  if (expoGo && OWNER)
    console.log(
      `Expo Go: the phone must be signed in to Expo Go with an account that is a member of "${OWNER}"\n` +
        `(expo.dev/accounts/${OWNER}/settings/members). This PC must be signed in too (npx expo whoami).`,
    );
  if (tunnel) {
    console.log(
      'Tunnel mode: the phone can be on ANY network (Wi-Fi or mobile data). Scan the QR code below.',
    );
    console.log('The app reaches the API through the same tunnel (/__api).');
    return;
  }
  console.log('Network addresses on this PC:');
  for (const c of lanAddresses()) {
    const note =
      c.address === address
        ? '  <- using this one'
        : c.virtual
          ? '  (virtual adapter, the phone cannot reach it)'
          : '';
    console.log(`  ${c.name.padEnd(36)} ${c.address}${note}`);
  }
  const ssid = wifiName();
  if (ssid) console.log(`Wi-Fi network: "${ssid}". Your phone must be on this same Wi-Fi.`);
  console.log(
    `\nTest from the phone browser: http://${address}:${METRO_PORT}/__api/health  (should show {"status":"ok"...})`,
  );
  console.log(
    `Expo Go: scan the QR code below, or "Enter URL manually":  exp://${address}:${METRO_PORT}`,
  );
  console.log(
    'Switching Wi-Fi? Leave this running: it restarts with the new address automatically.\n',
  );
}

function startExpo(address, extraArgs = []) {
  printBanner(address);
  const env = { ...process.env };
  if (address && !tunnel) env.REACT_NATIVE_PACKAGER_HOSTNAME = address; // address used in the QR code
  child = spawn(['npx', 'expo', 'start', ...args, ...extraArgs].map(quote).join(' '), {
    cwd: mobileDir,
    stdio: 'inherit',
    shell: true,
    env,
  });
  const proc = child;
  proc.on('exit', (code) => {
    if (child === proc && !stopping) process.exit(code ?? 0); // Expo stopped by itself (Ctrl+C / error)
  });
}

// ---------- main ----------
let current = pickAddress();
if (!current && !tunnel) {
  console.error(
    'No network address found. Connect this PC to Wi-Fi (the same one as your phone) and try again.',
  );
  process.exit(1);
}
if (!(await apiRunning())) {
  console.warn(
    `\n! The API is not running on port ${API_PORT}. Start it in another window (MSMA-HRIS-backend):  pnpm --filter @msma/api dev`,
  );
}
if (await portInUse(METRO_PORT)) {
  console.warn(
    `\n! Port ${METRO_PORT} is already in use, probably by another Expo window. Stop that one with Ctrl+C first.`,
  );
}
startExpo(current);

// Restart Expo when the Wi-Fi address changes (not needed with a tunnel or a fixed --ip).
if (!tunnel && !forcedIp) {
  let restarting = false;
  setInterval(async () => {
    const next = pickAddress();
    if (!next || next === current || restarting) return; // offline for a moment, or unchanged
    restarting = true;
    console.log(
      `\n*** Network changed: ${current} -> ${next}. Restarting Expo with the new address... ***`,
    );
    current = next;
    stopping = true;
    await stopExpo();
    stopping = false;
    startExpo(next);
    console.log('On the phone: scan the new QR code (or reload the app in Expo Go).');
    restarting = false;
  }, WATCH_INTERVAL_MS);
}

const shutdown = async () => {
  stopping = true;
  await stopExpo();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
