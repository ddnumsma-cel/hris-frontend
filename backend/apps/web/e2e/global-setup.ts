import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Fresh synthetic data in the TEST database (seed + attendance recompute). */
export default function globalSetup() {
  const root = resolve(__dirname, '../../..');
  const r = spawnSync('node scripts/prepare-test-db.mjs --recompute', {
    cwd: root,
    shell: true,
    stdio: 'inherit',
  });
  if (r.status !== 0)
    throw new Error('Could not prepare the test database. Is Docker running (pnpm db:up)?');
}
