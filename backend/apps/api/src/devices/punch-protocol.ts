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
  /** Commands for the terminal's check-in reply. */
  formatCommands(commands: { id: number; command: string }[]): string;
  /** The terminal's replies to commands: which command, and whether it worked. */
  parseCommandReplies(body: string): { id: number; ok: boolean; code: string }[];
  /** Users in an upload (user list or user changes): enrolled ID and name. */
  parseUsers(body: string): { pin: string; name: string | null }[];
  /** Command text to ask for the user list, add or update a user, and delete a user. */
  queryUsersCommand(): string;
  upsertUserCommand(pin: string, name: string): string;
  deleteUserCommand(pin: string): string;
}

export const PUNCH_PROTOCOL = Symbol('PUNCH_PROTOCOL');
