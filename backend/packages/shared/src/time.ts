/**
 * Time rules (see CLAUDE.md): store UTC, compute and display in Asia/Manila.
 *
 * Asia/Manila is UTC+08:00 all year (no daylight saving since 1978), so a fixed
 * offset gives exact results and keeps calculations deterministic on any machine,
 * phone or server regardless of its own time zone.
 */
export const MANILA_TZ = 'Asia/Manila';
export const MANILA_OFFSET_MINUTES = 8 * 60;
const OFFSET_MS = MANILA_OFFSET_MINUTES * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** A Manila calendar date as "YYYY-MM-DD". */
export type DateKey = string;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Wall-clock parts of an instant in Manila. weekday: 0 = Sunday. */
export function manilaParts(value: Date | string | number) {
  const shifted = new Date(toDate(value).getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Manila calendar date of an instant, e.g. "2026-09-25". */
export function manilaDateKey(value: Date | string | number): DateKey {
  const p = manilaParts(value);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Today's date in Manila. */
export function manilaToday(now: Date = new Date()): DateKey {
  return manilaDateKey(now);
}

/** UTC instant for a Manila wall-clock time, e.g. fromManila("2026-09-25", "08:00"). */
export function fromManila(dateKey: DateKey, hhmm = '00:00', seconds = 0): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, seconds) - OFFSET_MS);
}

/** Midnight UTC of a date key: how Prisma stores a DATE column. */
export function dateKeyToUtcDate(dateKey: DateKey): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Inverse of dateKeyToUtcDate: read a DATE column back as a date key. */
export function utcDateToDateKey(value: Date | string): DateKey {
  return toDate(value).toISOString().slice(0, 10);
}

export function addDays(dateKey: DateKey, days: number): DateKey {
  return utcDateToDateKey(new Date(dateKeyToUtcDate(dateKey).getTime() + days * DAY_MS));
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(dateKey: DateKey): number {
  return dateKeyToUtcDate(dateKey).getUTCDay();
}

/** Inclusive list of date keys from `from` to `to`. */
export function dateRange(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Display a date like "25 Sep 2026". Accepts a date key or an instant. */
export function formatDate(value: DateKey | Date): string {
  const key =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : manilaDateKey(value);
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Display like "Friday, 25 Sep 2026". */
export function formatLongDate(value: DateKey | Date): string {
  const key =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : manilaDateKey(value);
  return `${WEEKDAYS[weekdayOf(key)]}, ${formatDate(key)}`;
}

/** Display a Manila time like "07:58" (24-hour). */
export function formatTime(value: Date | string | number | null | undefined): string {
  if (value == null) return '--:--';
  const p = manilaParts(value);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Display a date range like "16–30 Sep 2026" or "28 Sep – 2 Oct 2026". */
export function formatDateRange(from: DateKey, to: DateKey): string {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  if (fy === ty && fm === tm)
    return fd === td ? formatDate(from) : `${fd}–${td} ${MONTHS[tm - 1]} ${ty}`;
  if (fy === ty) return `${fd} ${MONTHS[fm - 1]} – ${td} ${MONTHS[tm - 1]} ${ty}`;
  return `${formatDate(from)} – ${formatDate(to)}`;
}

/** A duration like "45 min", "2 hrs" or "1 hr 30 min". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h ? `${h} hr${h === 1 ? '' : 's'}` : '';
  return [hours, m || !h ? `${m} min` : ''].filter(Boolean).join(' ');
}

/** "5 min ago", "2 hrs ago" relative to now. */
export function formatAgo(value: Date | string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - toDate(value).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export interface Cutoff {
  from: DateKey;
  to: DateKey;
  /** e.g. "2026-09-16..2026-09-30" */
  code: string;
  /** e.g. "16–30 Sep 2026" */
  label: string;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Semi-monthly payroll cutoff containing the given date: 1–15 or 16–end of month. */
export function cutoffFor(dateKey: DateKey): Cutoff {
  const [y, m, d] = dateKey.split('-').map(Number);
  const from = `${y}-${pad(m)}-${d <= 15 ? '01' : '16'}`;
  const to = `${y}-${pad(m)}-${d <= 15 ? '15' : pad(lastDayOfMonth(y, m))}`;
  return { from, to, code: `${from}..${to}`, label: formatDateRange(from, to) };
}

/** Parse "2026-09-16..2026-09-30" into a cutoff. */
export function parseCutoff(code: string): Cutoff {
  const match = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(code.trim());
  if (!match || match[1] > match[2])
    throw new Error(`Invalid cutoff "${code}", expected YYYY-MM-DD..YYYY-MM-DD`);
  return {
    from: match[1],
    to: match[2],
    code: `${match[1]}..${match[2]}`,
    label: formatDateRange(match[1], match[2]),
  };
}
