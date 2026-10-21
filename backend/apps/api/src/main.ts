import './load-env';
import 'reflect-metadata';
import { SwaggerModule } from '@nestjs/swagger';
import { buildOpenApi, createApp } from './bootstrap-app';
import { config } from './config';

async function main() {
  if (config.jwtSecret.length < 32 || config.jwtSecret.startsWith('replace-with'))
    console.warn(
      '! JWT_SECRET in .env is the example value or too short. Anyone who knows it can forge a sign-in.\n' +
        '  Set a long random value before anyone else can reach this PC (pnpm share does this for you).',
    );
  const app = await createApp();
  SwaggerModule.setup('docs', app, buildOpenApi(app), { jsonDocumentUrl: 'docs-json' });
  // 0.0.0.0 so the Android emulator and phones on the same Wi-Fi can reach the API.
  await app.listen(config.port, config.host);
  console.log(
    `MSMA HRIS API on http://localhost:${config.port}  (Swagger: http://localhost:${config.port}/docs)`,
  );
}

void main();
