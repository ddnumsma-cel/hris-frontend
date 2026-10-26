// Worked payroll examples, checked by hand against the payroll workbook's rules. Run: npm run check:payroll
// ₱26,100/month → daily ₱1,200 (× 12 ÷ 261), hourly ₱150 (÷ 8).

import { computePay, type PayInput } from "../src/lib/pay/engine";
import { DEFAULT_PROFILE } from "../src/lib/pay/settings";
import type { DayRow } from "../src/lib/timekeeping/api";

const day = (date: string, o: Partial<DayRow> = {}) =>
  ({ date, kind: "work", dayType: "ordinary", status: "done", lateMinutes: 0, undertimeMinutes: 0, approvedOvertimeMinutes: 0, workedMinutes: 480, nightMinutes: 0, ...o }) as DayRow;
const weekdays = ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"];
const cutoff = (over: Record<string, Partial<DayRow>> = {}, extra: DayRow[] = [], profile = DEFAULT_PROFILE): PayInput => {
  const days = [...weekdays.map((d) => day(d, over[d])), ...extra];
  return { monthlySalary: 26100, from: "2026-10-01", to: "2026-10-15", days, history: days, unpaidLeaveDays: 0, profile };
};

let failed = 0;
const check = (name: string, got: number, want: number) => {
  const ok = Math.abs(got - want) < 0.006;
  if (!ok) failed++;
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : `(got ${got}, want ${want})`);
};

let r = computePay(cutoff({ "2026-10-02": { lateMinutes: 9 }, "2026-10-05": { undertimeMinutes: 30 }, "2026-10-06": { approvedOvertimeMinutes: 120 } }));
check("Daily = 26,100 × 12 ÷ 261", r.daily, 1200);
check("Hourly = daily ÷ 8", r.hourly, 150);
check("One late in a week: no deduction", r.halfDayDeduction, 0);
check("Undertime (any length) = a flat 4 hours = ₱600", r.undertimeDeduction, 600);
check("Approved OT 2h on an ordinary day at 1.25 = ₱375", r.overtimePay, 375);
check("Gross = 13,050 − 600 undertime + 375 OT", r.gross, 12825);
check("Contributions: SSS 650 + PhilHealth 326.25 + Pag-IBIG 100", r.contributions, 1076.25);
check("Taxable = gross (contributions not taken off, sheet D)", r.taxable, 12825);
check("Tax: 15% of the excess over ₱10,417", r.tax, 361.2);
check("Net = gross − contributions − tax", r.net, 11387.55);

const absent = { status: "absent" as const, workedMinutes: 0 };
r = computePay(cutoff({ "2026-10-08": absent, "2026-10-09": absent, "2026-10-12": absent }, [day("2026-10-10", { kind: "rest", dayType: "rest", status: "rest", workedMinutes: 0 })]));
check("3 absences = 3 × 8h × ₱150", r.absentDeduction, 3600);
check("3rd straight absence is AWOL (weekend doesn't break the run)", r.awolDays, 1);

r = computePay(cutoff({ "2026-10-12": { lateMinutes: 10 }, "2026-10-13": { lateMinutes: 10 }, "2026-10-14": { lateMinutes: 10 } }));
check("3 lates in one week = a half day (4h) = ₱600", r.halfDayDeduction, 600);
check("…and no absence charged", r.absentDeduction, 0);
r = computePay(cutoff({ "2026-10-09": { lateMinutes: 10 }, "2026-10-12": { lateMinutes: 10 }, "2026-10-13": { lateMinutes: 10 } }));
check("3 lates across two weeks: no half day", r.halfDayDeduction, 0);
r = computePay(cutoff({ "2026-10-06": { lateMinutes: 25, lateRawMinutes: 30 } }));
check("30 minutes late (9:00 on an 8:30 shift) = a half day", r.halfDays, 1);

r = computePay(cutoff({}, [day("2026-10-03", { kind: "rest", dayType: "rest", workedMinutes: 600, approvedOvertimeMinutes: 120 })]));
check("Rest day, first 8h at 1.3 = ₱1,560", r.premiumPay, 1560);
check("Rest day, 2h approved past 8 at 1.69 = ₱507", r.overtimePay, 507);

r = computePay(cutoff({ "2026-10-07": { kind: "holiday", dayType: "regular" } }));
check("Regular holiday worked 8h: full 200% on top of the monthly pay (A_1) = ₱2,400", r.premiumPay, 2400);

r = computePay({ ...cutoff(), employedFrom: "2026-10-08" });
check("Hired Oct 8: half month less 5 workdays × 8 h × ₱150 (workbook sheet B) = ₱7,050", r.basic, 7050);

r = computePay(cutoff({ "2026-10-06": { nightMinutes: 60 } }));
check("1h night shift on regular hours: +10% = ₱15", r.nightPay, 15);
r = computePay(cutoff({ "2026-10-06": { approvedOvertimeMinutes: 120, nightMinutes: 60 } }));
check("2h OT, 1 of it at night: 1h × 1.25 + 1h × 1.375 = ₱393.75", r.overtimePay, 393.75);

const extras = { ...DEFAULT_PROFILE, otMealRate: 100, transportAllowance: 1000, deMinimis: 1000 };
r = computePay(cutoff({ "2026-10-06": { approvedOvertimeMinutes: 60 }, "2026-10-07": absent }, [], extras));
check("OT meal: 1 overtime day × ₱100", r.otMeal, 100);
check("Transport: ₱1,000 × 10 of 11 workdays attended", r.transportAllowance, 909.09);
check("De minimis comes off taxable pay", r.taxable, r.gross - 1000);
check("Transport is added after tax", r.net, r.gross - r.contributions - r.tax + 909.09);

const sixDay = { ...DEFAULT_PROFILE, workWeek: "6-day" as const };
r = computePay(cutoff({ "2026-10-07": absent }, [day("2026-10-03", absent)], sixDay));
check("6-day week: absent a weekday (7h) and a Saturday (5h) = 12h × ₱150", r.absentDeduction, 1800);

console.log(failed ? `\n${failed} failed` : "\nAll examples pass");
process.exit(failed ? 1 : 0);
