/** Write the OpenAPI spec to packages/api-client/openapi.json (input for the typed client). No database needed. */
import '../load-env';
import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildOpenApi, createApp } from '../bootstrap-app';

async function main() {
  process.env.JWT_SECRET ??= 'openapi-generation-only';
  const app = await createApp({ logger: false });
  const doc = buildOpenApi(app);
  const out = resolve(__dirname, '../../../../packages/api-client/openapi.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
  console.log(`OpenAPI spec written to ${out} (${Object.keys(doc.paths).length} paths)`);
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
