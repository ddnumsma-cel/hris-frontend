import { describe, expect, it } from 'vitest';
import { formatPHP, moneyString, roundMoney, sumMoney } from './money';
import {
  cutoffFor,
  formatDate,
  formatDateRange,
  formatTime,
  fromManila,
  manilaDateKey,
  parseCutoff,
  weekdayOf,
} from './time';

describe('money', () => {
  it('formats Philippine peso', () => {
    expect(formatPHP('14862.5')).toBe('₱14,862.50');
    expect(formatPHP('3112450')).toBe('₱3,112,450.00');
  });

  it('adds without float drift', () => {
    expect(sumMoney(['0.1', '0.2']).toFixed(2)).toBe('0.30');
    expect(moneyString(sumMoney(['610.10', '0.005']))).toBe('610.11');
  });

  it('rounds half-up to centavos', () => {
    expect(roundMoney('1.005').toFixed(2)).toBe('1.01');
    expect(roundMoney('2.344').toFixed(2)).toBe('2.34');
  });
});

describe('Asia/Manila time', () => {
  it('converts Manila wall time to UTC', () => {
    expect(fromManila('2026-09-25', '08:00').toISOString()).toBe('2026-09-25T00:00:00.000Z');
    expect(fromManila('2026-09-25', '06:30').toISOString()).toBe('2026-09-24T22:30:00.000Z');
  });

  it('reads Manila dates and times from UTC instants', () => {
    const lateNightUtc = new Date('2026-09-24T17:30:00Z'); // 01:30 on 25 Sep in Manila
    expect(manilaDateKey(lateNightUtc)).toBe('2026-09-25');
    expect(formatTime(lateNightUtc)).toBe('01:30');
  });

  it('formats dates like "25 Sep 2026"', () => {
    expect(formatDate('2026-09-25')).toBe('25 Sep 2026');
    expect(formatDateRange('2026-09-16', '2026-09-30')).toBe('16–30 Sep 2026');
    expect(weekdayOf('2026-09-25')).toBe(5); // Friday
  });

  it('finds semi-monthly cutoffs', () => {
    expect(cutoffFor('2026-09-25').code).toBe('2026-09-16..2026-09-30');
    expect(cutoffFor('2026-02-03').code).toBe('2026-02-01..2026-02-15');
    expect(cutoffFor('2026-02-20').to).toBe('2026-02-28');
    expect(parseCutoff('2026-09-16..2026-09-30').label).toBe('16–30 Sep 2026');
    expect(() => parseCutoff('2026-09-30..2026-09-16')).toThrow();
  });
});

describe('request helpers', () => {
  it('formats durations in plain words', async () => {
    const { formatMinutes } = await import('./time');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 hr');
    expect(formatMinutes(120)).toBe('2 hrs');
    expect(formatMinutes(90)).toBe('1 hr 30 min');
    expect(formatMinutes(0)).toBe('0 min');
  });

  it('puts a time on the right day of a night shift', async () => {
    const { shiftBounds, timeOnShift } = await import('./attendance');
    const { formatTime, manilaDateKey } = await import('./time');
    const night = { startTime: '22:00', endTime: '06:00' };
    const early = timeOnShift('2026-09-28', '03:00', night);
    expect(manilaDateKey(early)).toBe('2026-09-29');
    expect(formatTime(early)).toBe('03:00');
    const { start, end } = shiftBounds('2026-09-28', night);
    expect(end.getTime() - start.getTime()).toBe(8 * 3_600_000);
    const day = { startTime: '08:00', endTime: '17:00' };
    expect(manilaDateKey(timeOnShift('2026-09-28', '15:00', day))).toBe('2026-09-28');
  });
});

describe('request forms', () => {
  it('accepts times like 07:05 and 17:30, and refuses 24:00 or 7:5', async () => {
    const { CreateUndertimeRequestSchema } = await import('./schemas');
    const ok = (t: string) =>
      CreateUndertimeRequestSchema.safeParse({
        date: '2026-09-28',
        leaveTime: t,
        reason: 'Dentist',
      }).success;
    expect(ok('07:05')).toBe(true);
    expect(ok('17:30')).toBe(true);
    expect(ok('23:59')).toBe(true);
    expect(ok('24:00')).toBe(false);
    expect(ok('7:5')).toBe(false);
  });
});
