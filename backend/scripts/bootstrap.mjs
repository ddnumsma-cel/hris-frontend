// One-step local setup: env files, install, database, migrations, seed.
// Cross-platform (Windows cmd/PowerShell, macOS, Linux). Usage: pnpm bootstrap
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function ensureEnv(relPath, transform) {
  const target = join(root, relPath);
  const example = `${target}.example`;
  if (existsSync(target)) {
    console.log(`- ${relPath} already exists, leaving it unchanged`);
    return;
  }
  copyFileSync(example, target);
  if (transform) writeFileSync(target, transform(readFileSync(target, 'utf8')));
  console.log(`- created ${relPath} from ${relPath}.example`);
}

function run(label, command) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, { cwd: root, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`\n"${command}" failed. See the README "Troubleshooting" section.`);
    process.exit(result.status ?? 1);
  }
}

console.log('=== Environment files ===');
ensureEnv('.env', (text) =>
  text.replace('replace-with-a-long-random-string', randomBytes(32).toString('hex')),
);
ensureEnv('apps/mobile/.env');

run('Installing packages', 'pnpm install');
run('Starting PostgreSQL (Docker)', 'pnpm db:up');
run('Applying database migrations', 'pnpm db:migrate');
run('Seeding synthetic data', 'pnpm db:seed');

console.log(
  '\nAll set. Next: `pnpm dev` then open http://localhost:3000 (hr@msma.test / Demo@2026).',
);
