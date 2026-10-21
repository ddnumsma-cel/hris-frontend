// The present streak (components/PresentStreak): consecutive work days with a time-in, late included.

import { addDays, type DateKey } from '@msma/shared';

export interface AttendanceDay {
  date: DateKey;
  timeIn: string | null;
  lateMinutes: number;
  status: string;
}

export const WORKDAY_OFF = new Set(['RESTDAY', 'HOLIDAY', 'ON_LEAVE']);

/** Consecutive work days with a time-in, counting back from today (today only once they've clocked in). */
export function presentStreak(days: AttendanceDay[], today: DateKey): number {
  const byDate = new Map(days.map((d) => [d.date, d]));
  let n = 0;
  for (let d = today; byDate.has(d); d = addDays(d, -1)) {
    const day = byDate.get(d)!;
    if (day.timeIn) n++;
    else if (WORKDAY_OFF.has(day.status)) continue;
    else if (d === today) continue; // Not in yet today: the streak isn't broken until the day is over.
    else break;
  }
  return n;
}

