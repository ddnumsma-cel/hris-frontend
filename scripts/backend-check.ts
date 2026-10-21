// Reading the backend's one-line request descriptions (lib/backend/requests.ts), on the exact
// formats its approvals service writes. Run: npm run check:backend
import assert from "node:assert/strict";
import { parseDetail, parseMinutes, parseRange } from "../src/lib/backend/requests";

assert.deepEqual(parseRange("20 Oct 2026"), { start: "2026-10-20", end: "2026-10-20" });
assert.deepEqual(parseRange("21–22 Oct 2026"), { start: "2026-10-21", end: "2026-10-22" });
assert.deepEqual(parseRange("30 Oct – 2 Nov 2026"), { start: "2026-10-30", end: "2026-11-02" });
assert.deepEqual(parseRange("30 Dec 2026 – 2 Jan 2027"), { start: "2026-12-30", end: "2027-01-02" });

assert.equal(parseMinutes("45 min"), 45);
assert.equal(parseMinutes("2 hrs"), 120);
assert.equal(parseMinutes("1 hr 30 min"), 90);

const leave = parseDetail("LEAVE", "Vacation · 21–22 Oct 2026 · 2 days · Family event · Bohol");
assert.deepEqual([leave.label, leave.start, leave.end, leave.days, leave.reason], ["Vacation", "2026-10-21", "2026-10-22", 2, "Family event · Bohol"]);
assert.equal(parseDetail("LEAVE", "Sick · 20 Oct 2026 · 1 day").reason, "");

const ot = parseDetail("OT", "Overtime · 15 Oct 2026 · 2 hrs · Month-end stock count");
assert.deepEqual([ot.start, ot.minutes, ot.reason], ["2026-10-15", 120, "Month-end stock count"]);

const ut = parseDetail("UNDERTIME", "Undertime · 14 Oct 2026 · leave at 15:00 (2 hrs early) · Dental appointment");
assert.deepEqual([ut.start, ut.minutes, ut.reason], ["2026-10-14", 120, "Dental appointment"]);

const fix = parseDetail("DTR_FIX", "Time adjustment · 16 Oct 2026 · time in 08:02, time out 17:04 · Forgot to time out");
assert.deepEqual([fix.start, fix.timeIn, fix.timeOut, fix.reason], ["2026-10-16", "08:02", "17:04", "Forgot to time out"]);

console.log("backend request descriptions: all checks passed");
