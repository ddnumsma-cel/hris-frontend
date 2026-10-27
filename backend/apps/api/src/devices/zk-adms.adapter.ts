import { Injectable } from '@nestjs/common';
import { fromManila, type VerifyMode } from '@msma/shared';
import type { ParsedPunch, PunchProtocolAdapter } from './punch-protocol';

/**
 * ZKTeco ADMS (Push SDK) attendance lines, tab-separated:
 *   PIN \t YYYY-MM-DD HH:mm:ss \t status \t verify \t workcode \t reserved...
 * Terminal clocks are set to Asia/Manila local time.
 */
@Injectable()
export class ZkAdmsAdapter implements PunchProtocolAdapter {
  readonly name = 'zkteco-adms';

  private verifyMode(code: string | undefined): VerifyMode {
    switch (Number(code)) {
      case 15:
        return 'FACE';
      case 0:
      case 2:
      case 3:
        return 'PIN'; // password / card fallbacks
      default:
        return 'FINGER';
    }
  }

  parseAttendance(body: string): { punches: ParsedPunch[]; rejected: number } {
    const punches: ParsedPunch[] = [];
    let rejected = 0;
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const [pin, stamp, , verify] = line.split('\t');
      const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(stamp?.trim() ?? '');
      if (!pin || !/^\w{1,24}$/.test(pin) || !match) {
        rejected++;
        continue;
      }
      const [, date, hh, mm, ss] = match;
      const punchedAt = fromManila(date, `${hh}:${mm}`, Number(ss));
      if (Number.isNaN(punchedAt.getTime())) {
        rejected++;
        continue;
      }
      punches.push({ pin, punchedAt, verifyMode: this.verifyMode(verify) });
    }
    return { punches, rejected };
  }

  handshakeResponse(serial: string): string {
    return [
      `GET OPTION FROM: ${serial}`,
      'ATTLOGStamp=None',
      'OPERLOGStamp=9999',
      'ATTPHOTOStamp=None',
      'ErrorDelay=30',
      'Delay=10',
      'TransTimes=00:00;14:05',
      'TransInterval=1',
      // Also push user changes (OpLog), so the HRIS knows who is enrolled.
      'TransFlag=TransData AttLog OpLog EnrollUser ChgUser',
      'TimeZone=8',
      'Realtime=1',
      'Encrypt=None',
    ].join('\n');
  }

  /** "C:<id>:<command>" lines, one per command (ZKTeco ADMS). */
  formatCommands(commands: { id: number; command: string }[]): string {
    return commands.map((c) => `C:${c.id}:${c.command}`).join('\n');
  }

  /** Lines like "ID=12&Return=0&CMD=DATA"; Return 0 means done. */
  parseCommandReplies(body: string): { id: number; ok: boolean; code: string }[] {
    const out: { id: number; ok: boolean; code: string }[] = [];
    for (const line of body.split(/\r?\n/)) {
      const fields = new URLSearchParams(line.trim());
      const id = Number(fields.get('ID'));
      const code = fields.get('Return') ?? '';
      if (Number.isInteger(id) && id > 0) out.push({ id, ok: code === '0', code });
    }
    return out;
  }

  /** "USER PIN=1001\tName=..." (user uploads) or "user ...\tpin=1001\t...\tname=..." (query replies, newer firmware). */
  parseUsers(body: string): { pin: string; name: string | null }[] {
    const out: { pin: string; name: string | null }[] = [];
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.trim();
      if (!/^user\b/i.test(line)) continue;
      const pin = /(?:^|\s)pin=([^\s]+)/i.exec(line)?.[1];
      const name = /(?:^|\t)name=([^\t]*)/i.exec(line)?.[1]?.trim();
      if (pin && /^\w{1,24}$/.test(pin)) out.push({ pin, name: name || null });
    }
    return out;
  }

  queryUsersCommand(): string {
    return 'DATA QUERY USERINFO';
  }

  /** Adds or updates a normal user (not an admin) with no password or card. Names are plain ASCII, at most 24 letters. */
  upsertUserCommand(pin: string, name: string): string {
    const plain = name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\x20-\x7e]/g, '')
      .slice(0, 24);
    return `DATA UPDATE USERINFO PIN=${pin}\tName=${plain}\tPri=0\tPasswd=\tCard=\tGrp=1\tTZ=0000000100000000\tVerify=-1`;
  }

  deleteUserCommand(pin: string): string {
    return `DATA DELETE USERINFO PIN=${pin}`;
  }
}
