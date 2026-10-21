import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// e2e tests run against TEST_DATABASE_URL (a separate database), never the demo data.
const envFile = resolve(import.meta.dirname, '../../.env');
const fileEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
// 201 documents uploaded by the tests (and the seed's sample PDFs) go to their own folder.
const testStorage = resolve(import.meta.dirname, '../../storage/test-documents');
process.env.DOCUMENT_STORAGE_DIR = testStorage; // also seen by the global setup (test DB seed)

export default defineConfig({
  // SWC keeps NestJS decorator metadata, which the default esbuild transform drops.
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
      module: { type: 'es6' },
    }),
  ],
  test: {
    include: ['test/**/*.e2e.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL ?? '',
      JWT_SECRET: 'e2e-test-secret',
      JWT_EXPIRES_IN: '1h',
      DOCUMENT_STORAGE_DIR: testStorage,
    },
  },
});
