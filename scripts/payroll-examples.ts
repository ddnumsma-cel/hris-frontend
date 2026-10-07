// Worked payroll examples, checked by hand. Run: npm run check:payroll
// ₱26,100/month → daily ₱1,200 (× 12 ÷ 261), hourly ₱150, per minute ₱2.50.

import { computePay, type PayInput } from "../src/lib/pay/engine";
import type { DayRow } from "../src/lib/timekeeping/api";

const day = (date: string, o: Partial<DayRow> = {}) =>
  ({ date, kind: "work", dayType: "ordinary", status: "done", lateMinutes: 0, undertimeMinutes: 0, approvedOvertimeMinutes: 0, workedMinutes: 480, nightMinutes: 0, ...o }) as DayRow;
const weekdays = ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"];
const cutoff = (over: Record<string, Partial<DayRow>> = {}, extra: DayRow[] = []): PayInput => {
  const days = [...weekdays.map((d) => day(d, over[d])), ...extra];
  return { monthlySalary: 26100, from: "2026-10-01", to: "2026-10-15", days, history: days, unpaidLeaveDays: 0 };
};

let failed = 0;
const check = (name: string, got: number, want: number) => {
  const ok = Math.abs(got - want) < 0.006;
  if (!ok) failed++;
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : `(got ${got}, want ${want})`);
};

let r = computePay(cutoff({ "2026-10-02": { lateMinutes: 9 }, "2026-10-05": { undertimeMinutes: 30 }, "2026-10-06": { approvedOvertimeMinutes: 120 } }));
check("Late 9 min: on record, not deducted", r.lateMinutes, 9);
check("Undertime 30 min = ₱75", r.undertimeDeduction, 75);
check("Approved OT 2h on an ordinary day at 125% = ₱375", r.overtimePay, 375);
check("Gross = 13,050 − 75 undertime + 375 OT (late not deducted)", r.gross, 13350);
check("Contributions: SSS 650 + PhilHealth 326.25 + Pag-IBIG 100", r.contributions, 1076.25);
check("Tax: 15% of the excess over ₱10,417", r.tax, 278.51);
check("Net", r.net, 11995.24);

const absent = { status: "absent" as const, workedMinutes: 0 };
r = computePay(cutoff({ "2026-10-08": absent, "2026-10-09": absent, "2026-10-12": absent }, [day("2026-10-10", { kind: "rest", dayType: "rest", status: "rest", workedMinutes: 0 })]));
check("3 absences = 3 days' pay", r.absentDeduction, 3600);
check("3rd straight absence is AWOL (weekend doesn't break the run)", r.awolDays, 1);

r = computePay(cutoff({}, [day("2026-10-03", { kind: "rest", dayType: "rest", workedMinutes: 600, approvedOvertimeMinutes: 120 })]));
check("Rest day, first 8h at 130% = ₱1,560", r.premiumPay, 1560);
check("Rest day, 2h approved past 8 at 169% = ₱507", r.overtimePay, 507);

r = computePay(cutoff({ "2026-10-07": { kind: "holiday", dayType: "regular" } }));
check("Regular holiday worked 8h: +100% on top of the monthly pay = ₱1,200", r.premiumPay, 1200);

r = computePay(cutoff({ "2026-10-12": { lateMinutes: 10 }, "2026-10-13": { lateMinutes: 10 }, "2026-10-14": { lateMinutes: 10 } }));
check("Late 3 days in a row: nothing deducted", r.gross, 13050);
check("…and no absence charged", r.absentDeduction, 0);

r = computePay({ ...cutoff(), employedFrom: "2026-10-08" });
check("Hired Oct 8: 6 workdays paid = ₱7,200", r.basic, 7200);

r = computePay(cutoff({ "2026-10-06": { nightMinutes: 60 } }));
check("1h night differential at 10% = ₱15", r.nightPay, 15);

console.log(failed ? `\n${failed} failed` : "\nAll examples pass");
process.exit(failed ? 1 : 0);
