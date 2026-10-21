// Run `prisma generate` only when the schema differs from the generated client.
// On Windows a running API keeps the Prisma engine DLL locked, so regenerating on every build
// would fail with EPERM while `pnpm dev` is running.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const schema = readFileSync(join(pkgDir, 'prisma/schema.prisma'), 'utf8');
let generatedSchema = null;
try {
  const clientDir = dirname(
    createRequire(join(pkgDir, 'package.json')).resolve('.prisma/client/package.json'),
  );
  const file = join(clientDir, 'schema.prisma');
  if (existsSync(file)) generatedSchema = readFileSync(file, 'utf8');
} catch {
  // not generated yet
}

// Prisma re-aligns columns in its copy of the schema, so compare with whitespace collapsed.
const normalize = (s) => s.replace(/\s+/g, ' ').trim();
if (generatedSchema && normalize(generatedSchema) === normalize(schema)) {
  console.log('Prisma client is up to date (schema unchanged); skipping prisma generate.');
} else {
  execSync('prisma generate', { cwd: pkgDir, stdio: 'inherit' });
}
