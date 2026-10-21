import { describe, expect, it } from 'vitest';
import { computeDailyTimeRecord, nightDiffMinutes, ShiftDefinition } from './attendance';
import { fromManila } from './time';

const DAY: ShiftDefinition = {
  startTime: '08:00',
  endTime: '17:00',
  breakMinutes: 60,
  graceMinutes: 5,
  workDays: [1, 2, 3, 4, 5, 6],
};
const NIGHT: ShiftDefinition = {
  startTime: '22:00',
  endTime: '07:00',
  breakMinutes: 60,
  graceMinutes: 5,
  workDays: [1, 2, 3, 4, 5, 6],
};
const at = (date: string, time: string) => fromManila(date, time);

// 2026-09-25 is a Friday; 2026-09-27 is a Sunday; 2026-08-31 is National Heroes Day (regular holiday).
const FRIDAY = '2026-09-25';

describe('computeDailyTimeRecord', () => {
  it('computes a normal on-time day', () => {
    const r = computeDailyTimeRecord({
      date: FRIDAY,
      punches: [at(FRIDAY, '07:52'), at(FRIDAY, '17:04')],
      shift: DAY,
    });
    expect(r).toMatchObject({
      status: 'PRESENT',
      lateMinutes: 0,
      undertimeMinutes: 0,
      otMinutes: 0,
      nightDiffMinutes: 0,
      workedMinutes: 484,
    });
  });

  it('uses first and last punch of the day (extra punches in between are ignored)', () => {
    const r = computeDailyTimeRecord({
      date: FRIDAY,
      punches: [at(FRIDAY, '12:01'), at(FRIDAY, '17:00'), at(FRIDAY, '07:55'), at(FRIDAY, '12:58')],
      shift: DAY,
    });
    expect(r.timeIn).toEqual(at(FRIDAY, '07:55'));
    expect(r.timeOut).toEqual(at(FRIDAY, '17:00'));
  });

  it('applies the 5-minute grace period for lateness', () => {
    const within = computeDailyTimeRecord({
      date: FRIDAY,
      punches: [at(FRIDAY, '08:05'), at(FRIDAY, '17:00')],
      shift: DAY,
    });
    const beyond = computeDailyTimeRecord({
      date: FRIDAY,
      punches: [at(FRIDAY, '08:06'), at(FRIDAY, '17:00')],
      shift: DAY,
    });
    expect(within.lateMinutes).toBe(0);
    expect(beyond.lateMinutes).toBe(6);
  });

  it('handles a missing time-out', () => {
    const r = computeDailyTimeRecord({ date: FRIDAY, punches: [at(FRIDAY, '08:20')], shift: DAY });
    expect(r).toMatchObject({
      status: 'PRESENT',
      timeOut: null,
      lateMinutes: 20,
      workedMinutes: 0,
      otMinutes: 0,
      undertimeMinutes: 0,
    });
    expect(r.remarks).toContain('MISSING_TIME_OUT');
  });

  it('computes undertime when leaving early', () => {
    const r = computeDailyTimeRecord({
      date: FRIDAY,
      punches: [at(FRIDAY, '07:58'), at(FRIDAY, '16:30')],
      shift: DAY,
    });
    expect(r.undertimeMinutes).toBe(30);
    expect(r.otMinutes).toBe(0);
  });

  it('counts OT only beyond 8 worked hours, and only from the 30-minute minimum', () => {
    const ot = computeDailyTimeRecord({
      date: FRIDAY,
      punches: [at(FRIDAY, '07:50'), at(FRIDAY, '19:05')],
      shift: DAY,
    });
    expect(ot.workedMinutes).toBe(605); // counted from 08:00, minus 1-hour break
    expect(ot.otMinutes).toBe(125);
    const short = computeDailyTimeRecord({
      date: FRIDAY,
      punches: [at(FRIDAY, '07:50'), at(FRIDAY, '17:20')],
      shift: DAY,
    });
    expect(short.otMinutes).toBe(0);
  });

  it('counts night differential for work between 22:00 and 06:00', () => {
    const r = computeDailyTimeRecord({
      date: FRIDAY,
      punches: [at(FRIDAY, '08:00'), at(FRIDAY, '23:00')],
      shift: DAY,
    });
    expect(r.nightDiffMinutes).toBe(60);
    expect(r.otMinutes).toBe(360);
  });

  it('handles an overnight shift (22:00–07:00) across midnight', () => {
    const r = computeDailyTimeRecord({
      date: '2026-09-24',
      punches: [at('2026-09-24', '22:10'), at('2026-09-25', '07:02')],
      shift: NIGHT,
    });
    expect(r.status).toBe('PRESENT');
    expect(r.lateMinutes).toBe(10);
    expect(r.undertimeMinutes).toBe(0);
    expect(r.workedMinutes).toBe(472); // 22:10 → 07:02 = 532 min, minus break
    expect(r.nightDiffMinutes).toBe(470); // 22:10 → 06:00
    expect(r.timeOut).toEqual(at('2026-09-25', '07:02'));
  });

  it('does not steal the next night shift punches', () => {
    const r = computeDailyTimeRecord({
      date: '2026-09-24',
      punches: [at('2026-09-24', '21:58'), at('2026-09-25', '07:00'), at('2026-09-25', '21:57')],
      shift: NIGHT,
    });
    expect(r.timeOut).toEqual(at('2026-09-25', '07:00'));
  });

  it('marks an unworked holiday as HOLIDAY', () => {
    const r = computeDailyTimeRecord({
      date: '2026-08-31',
      punches: [],
      shift: DAY,
      holiday: { name: 'National Heroes Day', type: 'REGULAR' },
    });
    expect(r.status).toBe('HOLIDAY');
    expect(r.remarks).toBe('National Heroes Day');
  });

  it('records work on a holiday without lateness or undertime', () => {
    const r = computeDailyTimeRecord({
      date: '2026-08-31',
      punches: [at('2026-08-31', '08:30'), at('2026-08-31', '16:00')],
      shift: DAY,
      holiday: { name: 'National Heroes Day', type: 'REGULAR' },
    });
    expect(r).toMatchObject({
      status: 'PRESENT',
      lateMinutes: 0,
      undertimeMinutes: 0,
      workedMinutes: 390,
    });
  });

  it('marks Sunday without punches as a rest day', () => {
    const r = computeDailyTimeRecord({ date: '2026-09-27', punches: [], shift: DAY });
    expect(r.status).toBe('RESTDAY');
  });

  it('records rest-day work without lateness', () => {
    const r = computeDailyTimeRecord({
      date: '2026-09-27',
      punches: [at('2026-09-27', '09:00'), at('2026-09-27', '15:00')],
      shift: DAY,
    });
    expect(r).toMatchObject({
      status: 'PRESENT',
      lateMinutes: 0,
      undertimeMinutes: 0,
      workedMinutes: 300,
    });
    expect(r.remarks).toContain('rest day');
  });

  it('marks approved leave and absences', () => {
    expect(
      computeDailyTimeRecord({ date: FRIDAY, punches: [], shift: DAY, onLeave: true }).status,
    ).toBe('LEAVE');
    expect(computeDailyTimeRecord({ date: FRIDAY, punches: [], shift: DAY }).status).toBe('ABSENT');
  });

  it('ignores punches that belong to other days', () => {
    const r = computeDailyTimeRecord({
      date: FRIDAY,
      punches: [at('2026-09-24', '17:02'), at('2026-09-26', '07:59')],
      shift: DAY,
    });
    expect(r.status).toBe('ABSENT');
  });
});

describe('nightDiffMinutes', () => {
  it('spans two nights', () => {
    expect(nightDiffMinutes(at(FRIDAY, '21:00'), at('2026-09-27', '07:00'))).toBe(960);
  });
});
