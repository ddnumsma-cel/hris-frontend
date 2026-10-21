import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Reset and seed the test database once before the e2e suite. */
export default function setup() {
  const root = resolve(__dirname, '../../..');
  const r = spawnSync('node scripts/prepare-test-db.mjs', {
    cwd: root,
    shell: true,
    stdio: 'inherit',
  });
  if (r.status !== 0)
    throw new Error('Could not prepare the test database. Is Docker running (pnpm db:up)?');
}
