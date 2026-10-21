import './load-env';
import { resolve } from 'node:path';

function required(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env (or run pnpm bootstrap).`,
    );
  return value;
}

export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  /** 0.0.0.0 so phones and the Android emulator can reach `pnpm dev`; `pnpm share` uses 127.0.0.1 (behind its gate). */
  host: process.env.API_HOST ?? '0.0.0.0',
  get jwtSecret() {
    return required('JWT_SECRET');
  },
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  /**
   * Temporary: employees may clock in from the phone app (confirmed with the phone's fingerprint, face or PIN).
   * Set PHONE_CLOCK_ENABLED=false once the attendance machines are in use.
   */
  phoneClockEnabled: process.env.PHONE_CLOCK_ENABLED !== 'false',
  /** 201 file documents on this PC (gitignored). The seed writes its sample PDFs here too. */
  get documentStorageDir() {
    return process.env.DOCUMENT_STORAGE_DIR ?? resolve(__dirname, '../../../storage/documents');
  },
};
