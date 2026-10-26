import type { DtrStatus, HolidayType } from './enums';
import { addDays, DateKey, fromManila, manilaDateKey, weekdayOf } from './time';

export interface ShiftDefinition {
  /** Manila "HH:mm" */
  startTime: string;
  /** Manila "HH:mm"; earlier than startTime means the shift ends the next day */
  endTime: string;
  breakMinutes: number;
  /** Grace period before lateness counts (default 5) */
  graceMinutes?: number;
  /** Excess work shorter than this is not overtime (default 30), so leaving at 17:10 is not 10 minutes of OT */
  otMinimumMinutes?: number;
  /** 0 = Sunday … 6 = Saturday */
  workDays: number[];
  /** When the unpaid lunch starts ("12:00"): only the part of it they were at work is taken out. */
  breakStart?: string | null;
  /** Flexible time: clock in any time from startTime, finish by endTime; no lateness, only requiredMinutes count. */
  flexible?: boolean;
  /** Flexible shifts: minutes to work, not counting lunch (default 8 hours). */
  requiredMinutes?: number | null;
}

export interface HolidayInfo {
  name: string;
  type: HolidayType;
}

export interface ComputeDtrInput {
  /** Manila calendar date the shift starts on */
  date: DateKey;
  /** All punches for the employee around that date (UTC instants); unrelated ones are ignored */
  punches: Date[];
  shift: ShiftDefinition;
  holiday?: HolidayInfo | null;
  /** Approved leave covers this date */
  onLeave?: boolean;
}

export interface DailyTimeRecordResult {
  date: DateKey;
  timeIn: Date | null;
  timeOut: Date | null;
  workedMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  otMinutes: number;
  nightDiffMinutes: number;
  status: DtrStatus;
  remarks: string | null;
}

/** Punches up to this many hours before shift start count for that day. */
const WINDOW_BEFORE_START_H = 4;
/** Standard hours before overtime starts. */
const REGULAR_WORK_MINUTES = 8 * 60;
/** Only deduct the break when the span of work is longer than this. */
const BREAK_THRESHOLD_MINUTES = 5 * 60;
const MINUTE = 60_000;

const minutesBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / MINUTE);

/** Start and end of the shift that starts on `date` (night shifts end the next day), plus the punch window. */
export function shiftBounds(date: DateKey, shift: Pick<ShiftDefinition, 'startTime' | 'endTime'>) {
  const start = fromManila(date, shift.startTime);
  const overnight = shift.endTime <= shift.startTime;
  const end = fromManila(overnight ? addDays(date, 1) : date, shift.endTime);
  const windowStart = new Date(start.getTime() - WINDOW_BEFORE_START_H * 3_600_000);
  const windowEnd = new Date(windowStart.getTime() + 24 * 3_600_000);
  return { start, end, windowStart, windowEnd, overnight };
}

/** Minutes of [from, to) that fall between 22:00 and 06:00 Manila time. */
export function nightDiffMinutes(from: Date, to: Date): number {
  if (to <= from) return 0;
  let total = 0;
  // Night windows that can overlap: start on the day before `from` through the day of `to`.
  const firstDay = addDays(manilaDateKey(from), -1);
  const lastDay = manilaDateKey(to);
  for (let d = firstDay; d <= lastDay; d = addDays(d, 1)) {
    const nightStart = fromManila(d, '22:00');
    const nightEnd = fromManila(addDays(d, 1), '06:00');
    const overlapStart = Math.max(from.getTime(), nightStart.getTime());
    const overlapEnd = Math.min(to.getTime(), nightEnd.getTime());
    if (overlapEnd > overlapStart) total += Math.floor((overlapEnd - overlapStart) / MINUTE);
  }
  return total;
}

/** Unpaid lunch minutes inside [from, to): the overlap with the shift's lunch hour, or (no lunch start set) the whole
 * break once the span of work passes 5 hours. */
function lunchMinutes(date: DateKey, shift: ShiftDefinition, from: Date, to: Date): number {
  const span = Math.max(0, minutesBetween(from, to));
  if (!shift.breakStart) return span > BREAK_THRESHOLD_MINUTES ? shift.breakMinutes : 0;
  const lunchStart = fromManila(date, shift.breakStart);
  const lunchEnd = new Date(lunchStart.getTime() + shift.breakMinutes * MINUTE);
  const overlap = Math.min(to.getTime(), lunchEnd.getTime()) - Math.max(from.getTime(), lunchStart.getTime());
  return overlap > 0 ? Math.floor(overlap / MINUTE) : 0;
}

/**
 * Compute a Daily Time Record from raw punches (pure function; all times in Asia/Manila).
 *
 * - Uses the first punch of the day as time-in and the last as time-out.
 * - Late: minutes after shift start, counted only beyond the grace period (default 5 min). Flexible shifts have none.
 * - Undertime: minutes left before shift end when timing out early; on flexible shifts, minutes short of the
 *   required hours (default 8).
 * - Lunch: with a lunch start (12:00), only the part of the lunch hour they were at work is unpaid.
 * - OT: only worked minutes beyond 8 hours (break excluded), once the excess reaches the OT minimum (30 min).
 * - Night differential: worked minutes between 22:00 and 06:00.
 * - Rest days and holidays are not scheduled, so they have no late/undertime.
 */
export function computeDailyTimeRecord(input: ComputeDtrInput): DailyTimeRecordResult {
  const { date, shift, holiday, onLeave } = input;
  const { start, end, windowStart, windowEnd } = shiftBounds(date, shift);
  const grace = shift.graceMinutes ?? 5;
  const scheduled = shift.workDays.includes(weekdayOf(date)) && !holiday;

  const dayPunches = input.punches
    .filter((p) => p >= windowStart && p < windowEnd)
    .sort((a, b) => a.getTime() - b.getTime());

  const empty: DailyTimeRecordResult = {
    date,
    timeIn: null,
    timeOut: null,
    workedMinutes: 0,
    lateMinutes: 0,
    undertimeMinutes: 0,
    otMinutes: 0,
    nightDiffMinutes: 0,
    status: 'ABSENT',
    remarks: null,
  };

  if (dayPunches.length === 0) {
    if (onLeave) return { ...empty, status: 'LEAVE' };
    if (holiday) return { ...empty, status: 'HOLIDAY', remarks: holiday.name };
    if (!scheduled) return { ...empty, status: 'RESTDAY' };
    return empty;
  }

  const timeIn = dayPunches[0];
  const timeOut = dayPunches.length > 1 ? dayPunches[dayPunches.length - 1] : null;
  const minutesLate = minutesBetween(start, timeIn);
  const lateMinutes = scheduled && !shift.flexible && minutesLate > grace ? minutesLate : 0;
  const remarks: string[] = [];
  if (holiday) remarks.push(holiday.name);
  if (!scheduled && !holiday) remarks.push('Worked on rest day');

  if (!timeOut) {
    remarks.push('MISSING_TIME_OUT');
    return { ...empty, timeIn, lateMinutes, status: 'PRESENT', remarks: remarks.join('; ') };
  }

  // Work counts from shift start at the earliest (arriving early is not overtime).
  const workStart = scheduled && timeIn < start ? start : timeIn;
  const span = Math.max(0, minutesBetween(workStart, timeOut));
  const workedMinutes = Math.max(0, span - lunchMinutes(date, shift, workStart, timeOut));
  const required = shift.requiredMinutes ?? REGULAR_WORK_MINUTES;
  const undertimeMinutes = !scheduled
    ? 0
    : shift.flexible
      ? Math.max(0, required - workedMinutes)
      : timeOut < end
        ? minutesBetween(timeOut, end)
        : 0;
  const excess = Math.max(0, workedMinutes - (shift.flexible ? required : REGULAR_WORK_MINUTES));
  const otMinutes = excess >= (shift.otMinimumMinutes ?? 30) ? excess : 0;

  return {
    date,
    timeIn,
    timeOut,
    workedMinutes,
    lateMinutes,
    undertimeMinutes,
    otMinutes,
    nightDiffMinutes: nightDiffMinutes(workStart, timeOut),
    status: 'PRESENT',
    remarks: remarks.length ? remarks.join('; ') : null,
  };
}

/**
 * A clock time ("HH:mm", Manila) on the shift that starts on `date`. Night shifts end the next day, so a time
 * before the shift start belongs to the next calendar day.
 */
export function timeOnShift(
  date: DateKey,
  hhmm: string,
  shift: Pick<ShiftDefinition, 'startTime' | 'endTime'>,
): Date {
  const overnight = shift.endTime <= shift.startTime;
  return fromManila(overnight && hhmm < shift.startTime ? addDays(date, 1) : date, hhmm);
}
