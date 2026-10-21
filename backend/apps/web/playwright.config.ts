import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { defineConfig, devices } from '@playwright/test';

// The browser test runs its own API (port 4100) and web app (port 3100) on the TEST database,
// so it never changes the demo data and can run while `pnpm dev` is up.
const rootEnv = resolve(__dirname, '../../.env');
const fileEnv = existsSync(rootEnv) ? parseEnv(readFileSync(rootEnv, 'utf8')) : {};
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL ?? '';
const API_PORT = 4100;
const WEB_PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'node ../api/dist/main.js',
      url: `http://localhost:${API_PORT}/health`,
      env: {
        API_PORT: String(API_PORT),
        DATABASE_URL: TEST_DATABASE_URL,
        JWT_SECRET: 'playwright-test-secret',
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm exec next dev --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/login`,
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`, NEXT_DIST_DIR: '.next-e2e' },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
