import type { VerifyMode } from '@msma/shared';

export interface ParsedPunch {
  /** Employee PIN as enrolled on the terminal */
  pin: string;
  punchedAt: Date;
  verifyMode: VerifyMode;
}

/**
 * Biometric terminal protocol. The sample ships a ZKTeco ADMS ("iclock") adapter;
 * other vendors can be added by implementing this interface and binding PUNCH_PROTOCOL.
 */
export interface PunchProtocolAdapter {
  readonly name: string;
  /** Parse an attendance upload body into punches. Malformed lines are counted, not thrown. */
  parseAttendance(body: string): { punches: ParsedPunch[]; rejected: number };
  /** Text the terminal expects on its initial GET handshake. */
  handshakeResponse(serial: string): string;
}

export const PUNCH_PROTOCOL = Symbol('PUNCH_PROTOCOL');
