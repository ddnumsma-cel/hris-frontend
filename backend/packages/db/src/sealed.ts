import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Government and bank numbers are stored encrypted (AES-256-GCM) so a database copy or backup on its own reveals
 * nothing. The key is HRIS_DATA_KEY (32 random bytes, base64) in backend/.env, kept apart from the database and its
 * backups: without it the stored numbers can't be read, so keep a copy of it somewhere safe.
 *
 * Stored form: "enc:v1:" + base64(12-byte IV ‖ 16-byte tag ‖ ciphertext). A value without the prefix is a number
 * saved before encryption came in; it reads as it is until `pnpm --filter @msma/db seal:existing` encrypts it.
 */
const PREFIX = 'enc:v1:';

let cached: Buffer | null = null;
function dataKey(): Buffer {
  if (cached) return cached;
  const raw = process.env.HRIS_DATA_KEY;
  if (!raw) throw new Error('HRIS_DATA_KEY is not set. Add it to backend/.env (32 random bytes, base64) before starting.');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('HRIS_DATA_KEY must be 32 bytes, base64-encoded.');
  cached = key;
  return key;
}

/** Fails at start-up rather than at the first save when the key is missing or malformed. */
export function assertDataKey() {
  dataKey();
}

export const isSealed = (v: string | null | undefined) => !!v && v.startsWith(PREFIX);

/** Encrypt a value for storage (blank and already-encrypted values are left as they are). */
export function seal(value: string): string;
export function seal(value: string | null | undefined): string | null;
export function seal(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (value === '' || isSealed(value)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dataKey(), iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

/** Decrypt a stored value (one saved before encryption came in reads as it is). */
export function unseal(value: string): string;
export function unseal(value: string | null | undefined): string | null;
export function unseal(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (!isSealed(value)) return value;
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', dataKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

type GovIds = { tin: string; sss: string; philhealth: string; pagibig: string };

/** The four government numbers, encrypted for storage. */
export const sealGovIds = <T extends GovIds>(g: T): T => ({ ...g, tin: seal(g.tin), sss: seal(g.sss), philhealth: seal(g.philhealth), pagibig: seal(g.pagibig) });

/** The four government numbers, readable again. */
export const unsealGovIds = <T extends GovIds>(g: T): T => ({ ...g, tin: unseal(g.tin), sss: unseal(g.sss), philhealth: unseal(g.philhealth), pagibig: unseal(g.pagibig) });
