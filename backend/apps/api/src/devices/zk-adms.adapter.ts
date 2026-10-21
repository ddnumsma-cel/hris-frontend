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
      'TransFlag=TransData AttLog',
      'TimeZone=8',
      'Realtime=1',
      'Encrypt=None',
    ].join('\n');
  }
}
