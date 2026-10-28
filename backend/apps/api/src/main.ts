import './load-env';
import 'reflect-metadata';
import { SwaggerModule } from '@nestjs/swagger';
import { buildOpenApi, createApp } from './bootstrap-app';
import { config } from './config';
import { resolve } from 'node:path';
import { assertDataKey, createPrismaClient, ensureDataKey } from '@msma/db';

async function main() {
  const production = process.env.NODE_ENV === 'production';
  if (config.jwtSecret.length < 32 || config.jwtSecret.startsWith('replace-with')) {
    // Anyone who knows a weak or example secret can forge a Super Admin sign-in: never run like that for real.
    if (production) throw new Error('JWT_SECRET is missing, too short or the example value. Set a long random value in .env.');
    console.warn(
      '! JWT_SECRET in .env is the example value or too short. Anyone who knows it can forge a sign-in.\n' +
        '  Set a long random value before anyone else can reach this PC (pnpm share does this for you).',
    );
  }
  // Government and bank numbers are encrypted with HRIS_DATA_KEY. A fresh copy gets its own key on first start; a
  // database that already holds encrypted numbers never gets a new one (see ensureDataKey).
  const db = createPrismaClient();
  try {
    if ((await ensureDataKey(db, resolve(__dirname, '../../../.env'))) === 'created')
      console.log('Created an encryption key for this database in backend/.env (HRIS_DATA_KEY). Keep a copy somewhere safe.');
  } finally {
    await db.$disconnect();
  }
  assertDataKey();
  const app = await createApp();
  // The API map is for development; a live server doesn't publish it.
  if (!production) SwaggerModule.setup('docs', app, buildOpenApi(app), { jsonDocumentUrl: 'docs-json' });
  // 0.0.0.0 so the Android emulator and phones on the same Wi-Fi can reach the API.
  await app.listen(config.port, config.host);
  console.log(
    `MSMA HRIS API on http://localhost:${config.port}  (Swagger: http://localhost:${config.port}/docs)`,
  );
}

void main();
