// The present streak rule (src/lib/streak.ts). Run: npm run check:streak
import assert from 'node:assert/strict';
import { presentStreak, type AttendanceDay } from '../src/lib/streak';

const day = (date: string, status: string, timeIn: string | null = null, lateMinutes = 0): AttendanceDay => ({ date, status, timeIn, lateMinutes });
const IN = '2026-10-19T00:00:00.000Z';

// Mon–Fri present (one late), weekend off, today (Tue) not in yet: the streak carries over the weekend.
const days = [
  day('2026-10-12', 'PRESENT', IN), day('2026-10-13', 'ABSENT'), day('2026-10-14', 'PRESENT', IN),
  day('2026-10-15', 'PRESENT', IN, 12), day('2026-10-16', 'PRESENT', IN), day('2026-10-17', 'RESTDAY'),
  day('2026-10-18', 'RESTDAY'), day('2026-10-19', 'PRESENT', IN), day('2026-10-20', 'ABSENT'),
];
assert.equal(presentStreak(days, '2026-10-20'), 4, 'today not in yet does not break it; the absence on the 13th does');
// Once they clock in today it grows.
assert.equal(presentStreak([...days.slice(0, -1), day('2026-10-20', 'PRESENT', IN)], '2026-10-20'), 5);
// Leave and holidays are skipped, not counted.
assert.equal(presentStreak([day('2026-10-19', 'PRESENT', IN), day('2026-10-20', 'ON_LEAVE')], '2026-10-20'), 1);
// An absence yesterday ends it.
assert.equal(presentStreak([day('2026-10-19', 'ABSENT'), day('2026-10-20', 'PRESENT', IN)], '2026-10-20'), 1);
// No records: 0.
assert.equal(presentStreak([], '2026-10-20'), 0);
console.log('present streak: all checks passed');
