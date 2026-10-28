import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { PrismaClient } from '@prisma/client';

/** How many government or bank numbers in this database are already encrypted (0 when the tables don't exist yet). */
async function sealedCount(prisma: PrismaClient): Promise<number> {
  try {
    const [row] = await prisma.$queryRaw<{ n: bigint }[]>`
      select (select count(*) from "GovId" where tin like 'enc:v1:%' or sss like 'enc:v1:%' or philhealth like 'enc:v1:%' or pagibig like 'enc:v1:%')
           + (select count(*) from "Employee" where "bankAccountNo" like 'enc:v1:%') as n`;
    return Number(row?.n ?? 0);
  } catch {
    return 0; // a database the migrations haven't built yet holds nothing encrypted
  }
}

/**
 * Makes sure HRIS_DATA_KEY is there before anything encrypts or decrypts, so a fresh copy of the project just works:
 * - already set: nothing to do;
 * - missing on a development copy whose database holds no encrypted numbers yet (a new teammate, a fresh database):
 *   a new random key is created and saved in backend/.env;
 * - missing while the database already holds encrypted numbers: refuses, because a new key could never read them
 *   (the original key has to be put back);
 * - missing on a live server (NODE_ENV=production): refuses; there the key is always set on purpose.
 */
export async function ensureDataKey(prisma: PrismaClient, envFile: string): Promise<'present' | 'created'> {
  if (process.env.HRIS_DATA_KEY) return 'present';
  if (process.env.NODE_ENV === 'production')
    throw new Error('HRIS_DATA_KEY is not set. On a live server the encryption key must be set on purpose (never generated).');
  const sealed = await sealedCount(prisma);
  if (sealed > 0)
    throw new Error(
      `HRIS_DATA_KEY is missing from backend/.env, but this database already holds ${sealed} encrypted government or bank number record(s). ` +
        'Put the original key back (from where you saved it, e.g. your password manager). A new key could never read them, so none was created.',
    );
  const key = randomBytes(32).toString('base64');
  const line = `HRIS_DATA_KEY="${key}"`;
  const text = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const next = /^HRIS_DATA_KEY=.*$/m.test(text)
    ? text.replace(/^HRIS_DATA_KEY=.*$/m, line)
    : `${text}${text && !text.endsWith('\n') ? nl : ''}${nl}# Encryption key for government and bank numbers, created for this copy. Keep a copy somewhere safe.${nl}${line}${nl}`;
  writeFileSync(envFile, next);
  process.env.HRIS_DATA_KEY = key;
  return 'created';
}
