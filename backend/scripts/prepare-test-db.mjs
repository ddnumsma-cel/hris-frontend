// Prepare the e2e test database (TEST_DATABASE_URL): apply migrations and reload the synthetic seed.
// Used by the API e2e tests and the Playwright test. Never touches the demo database.
// Usage: node scripts/prepare-test-db.mjs [--recompute]   (--recompute needs `pnpm --filter @msma/api build`)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env');
const fileEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
const testUrl = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL;
if (!testUrl) {
  console.error('TEST_DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}
if (!/_test\b|_test\?/.test(testUrl)) {
  console.error(`Refusing to reset "${testUrl}": the test database name must end in _test.`);
  process.exit(1);
}

const env = {
  ...process.env,
  DATABASE_URL: testUrl,
  JWT_SECRET: process.env.JWT_SECRET ?? fileEnv.JWT_SECRET ?? 'test-secret',
};
const run = (command) => {
  const r = spawnSync(command, {
    cwd: root,
    env,
    stdio: process.env.VERBOSE ? 'inherit' : 'pipe',
    shell: true,
  });
  if (r.status !== 0) {
    console.error(`\n"${command}" failed:\n${r.stdout ?? ''}${r.stderr ?? ''}`);
    process.exit(r.status ?? 1);
  }
};

// Call prisma/tsx directly (not the dotenv-wrapped scripts) so only the test URL is ever used.
// `migrate deploy` only applies pending migrations; the seed itself clears the tables before loading synthetic data.
run('pnpm --filter @msma/db exec prisma migrate deploy');
run('pnpm --filter @msma/db exec tsx prisma/seed.ts');
if (process.argv.includes('--recompute')) run('node apps/api/dist/cli/recompute.js');
console.log('Test database ready.');
