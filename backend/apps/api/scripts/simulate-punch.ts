/**
 * Simulate a biometric terminal: posts a ZKTeco ADMS ATTLOG punch for a random employee "now",
 * exactly like a real terminal would, so the dashboard's live punches update.
 *
 *   pnpm simulate:punch               one punch
 *   pnpm simulate:punch --count 5     five punches
 *   pnpm simulate:punch --every 20    one punch every 20 seconds + terminal heartbeats (Ctrl+C to stop)
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { PrismaClient } from '@msma/db';
import { formatTime, manilaParts } from '@msma/shared';

const envFile = resolve(__dirname, '../../../.env');
if (existsSync(envFile)) {
  for (const [k, v] of Object.entries(parseEnv(readFileSync(envFile, 'utf8'))))
    process.env[k] ??= v;
}

const API = process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`;
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : undefined;
};
const prisma = new PrismaClient();
const pad = (n: number) => String(n).padStart(2, '0');

function admsStamp(date: Date) {
  const p = manilaParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

async function post(path: string, body?: string) {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}: ${text}`);
  return text;
}

async function heartbeats() {
  const devices = await prisma.device.findMany();
  for (const d of devices) await post(`/iclock/getrequest?SN=${d.serial}`).catch(() => undefined);
}

async function punchOnce() {
  const demoEmployee = await prisma.user.findUnique({
    where: { email: 'employee@msma.test' },
    select: { employeeId: true },
  });
  const candidates = await prisma.employee.findMany({
    where: {
      active: true,
      ...(demoEmployee?.employeeId ? { id: { not: demoEmployee.employeeId } } : {}),
    },
    include: { site: true, department: true },
  });
  const devices = await prisma.device.findMany({ include: { site: true } });
  const e = candidates[Math.floor(Math.random() * candidates.length)];
  const siteDevices = devices.filter((d) => d.siteId === e.siteId);
  const device =
    siteDevices.find(
      (d) => (e.department.code === 'WHS') === d.name.toLowerCase().includes('warehouse'),
    ) ?? siteDevices[0];
  const now = new Date();
  const verify = Math.random() < 0.6 ? 15 : 1; // 15 = face, 1 = fingerprint
  const line = `${e.biometricPin}\t${admsStamp(now)}\t0\t${verify}\t0\t0`;
  const reply = await post(
    `/iclock/cdata?SN=${device.serial}&table=ATTLOG&Stamp=9999`,
    line + '\n',
  );
  console.log(
    `${formatTime(now)}  ${e.firstName} ${e.lastName} (${e.site.name}) → ${device.name} [${verify === 15 ? 'Face' : 'Fingerprint'}]  API: ${reply}`,
  );
}

async function main() {
  const every = arg('every');
  const count = arg('count') ?? 1;
  console.log(`Posting to ${API}/iclock/cdata`);
  if (!every) {
    for (let i = 0; i < count; i++) await punchOnce();
    return;
  }
  console.log(`Punching every ${every}s and sending terminal heartbeats. Press Ctrl+C to stop.`);
  for (;;) {
    await heartbeats();
    await punchOnce().catch((err) => console.error(String(err)));
    await new Promise((r) => setTimeout(r, every * 1000));
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    console.error('Is the API running? Start it with: pnpm dev');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
