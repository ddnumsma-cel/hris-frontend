import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

// Load the repo-root .env (and an optional apps/api/.env) before anything reads process.env.
// Variables that are already set win, so tests and CI can override values.
for (const file of [resolve(__dirname, '../../../.env'), resolve(process.cwd(), '.env')]) {
  if (!existsSync(file)) continue;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
