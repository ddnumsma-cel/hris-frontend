// One employee's pay for one semi-monthly cutoff, from their attendance.
// Pure: no storage, no React. Payroll runs, the payroll register and payslips all use this.
//
// Company rules (confirmed with the CEO, 2026-10-06):
// - Monthly-paid, 261 working days a year: daily = monthly × 12 ÷ 261, hourly = daily ÷ 8.
//   The monthly pay already covers workdays, including holidays that fall on them.
// - Late is never deducted from pay; it stays on record and HR flags repeated lateness.
// - Undertime is deducted in exact minutes. Excused undertime is still unpaid.
// - Absent on a workday: one day's pay. Absent 3 workdays in a row: the 3rd day on is AWOL
//   (same deduction, flagged for HR). Rest days and holidays don't break a run; leave does.
// - Late 3 days in a row: no deduction; HR gets a flag and can send a notice.
// - Unpaid leave: one day's pay per day.
// - Overtime is paid only when approved.
// Verify the rates with the accountant before real pay.

import type { DayRow } from "../timekeeping/api";
import { NIGHT_DIFFERENTIAL, WORKING_DAYS_PER_YEAR } from "../timekeeping/compute";
import { pagibig, philhealth, round2, sss, withholding } from "../reports/statutory";

/** Absent this many workdays in a row and the run counts as AWOL from that day on. */
export const AWOL_AFTER = 3;

export interface DayRates {
  /** Multiplier for the first 8 hours worked that day. */
  first8: number;
  /** Multiplier for approved hours beyond 8 (or past the shift on an ordinary day). */
  ot: number;
  label: string;
}

/** Philippine premium pay by kind of day (Labor Code Arts. 87, 93, 94; DOLE handbook). */
export function dayRates(d: Pick<DayRow, "dayType" | "kind">): DayRates {
  const rest = d.kind === "rest" || d.kind === "unscheduled";
  if (d.dayType === "regular") return rest ? { first8: 2.6, ot: 3.38, label: "Regular holiday on a rest day" } : { first8: 2, ot: 2.6, label: "Regular holiday" };
  if (d.dayType === "special") return rest ? { first8: 1.5, ot: 1.95, label: "Special day on a rest day" } : { first8: 1.3, ot: 1.69, label: "Special non-working day" };
  if (rest) return { first8: 1.3, ot: 1.69, label: "Rest day" };
  return { first8: 1, ot: 1.25, label: "Ordinary day" };
}

/** Dates in a run of absences that count as AWOL (the 3rd straight absent workday on). */
export function awolDates(days: Pick<DayRow, "date" | "kind" | "status">[]): Set<string> {
  const out = new Set<string>();
  let run: string[] = [];
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    if (d.kind === "rest" || d.kind === "holiday" || d.kind === "unscheduled") continue;
    if (d.kind === "work" && d.status === "absent") {
      run.push(d.date);
      if (run.length >= AWOL_AFTER) out.add(d.date);
    } else if (d.kind === "work" && (d.status === "upcoming" || d.status === "not-in")) break;
    else run = [];
  }
  return out;
}

export interface Adjustment {
  id: string;
  label: string;
  /** Positive adds to pay, negative takes away. */
  amount: number;
  /** Taxable adjustments go into gross before tax; non-taxable ones are added after. */
  taxable: boolean;
  reason: string;
}

export interface PayInput {
  monthlySalary: number;
  from: string;
  to: string;
  /** Hired or separated mid-cutoff: only these dates are paid. */
  employedFrom?: string;
  employedTo?: string;
  /** The cutoff's days for this person. */
  days: DayRow[];
  /** The cutoff's days plus at least two weeks before, so an AWOL run from the last cutoff carries over. */
  history: DayRow[];
  unpaidLeaveDays: number;
  adjustments?: Adjustment[];
}

export interface PayResult {
  daily: number;
  hourly: number;
  /** Half the monthly pay, or the days employed when hired or separated mid-cutoff. */
  basic: number;
  present: number;
  absentDays: number;
  awolDays: number;
  awolDates: string[];
  absentDeduction: number;
  unpaidLeaveDays: number;
  unpaidLeaveDeduction: number;
  /** On record only; late is not deducted. */
  lateMinutes: number;
  undertimeMinutes: number;
  undertimeDeduction: number;
  overtimeMinutes: number;
  overtimePay: number;
  premiumMinutes: number;
  premiumPay: number;
  nightMinutes: number;
  nightPay: number;
  taxableAdjustments: number;
  nonTaxableAdjustments: number;
  gross: number;
  sssEe: number;
  sssEr: number;
  ec: number;
  phEe: number;
  phEr: number;
  piEe: number;
  piEr: number;
  contributions: number;
  taxable: number;
  tax: number;
  net: number;
}

const inRange = (date: string, from?: string, to?: string) => (!from || date >= from) && (!to || date <= to);

export function computePay(input: PayInput): PayResult {
  const daily = (input.monthlySalary * 12) / WORKING_DAYS_PER_YEAR;
  const hourly = daily / 8;
  const perMinute = hourly / 60;
  const days = input.days.filter((d) => inRange(d.date, input.employedFrom, input.employedTo));
  const partial = (input.employedFrom && input.employedFrom > input.from) || (input.employedTo && input.employedTo < input.to);
  // Mid-cutoff hire or separation: pay the workdays employed (holidays on workdays included), not the half month.
  const basic = partial ? daily * days.filter((d) => d.kind === "work" || d.kind === "holiday" || d.kind === "leave").length : input.monthlySalary / 2;

  const awol = awolDates(input.history.filter((d) => inRange(d.date, input.employedFrom, input.employedTo)));
  let present = 0;
  let absentDays = 0;
  let awolDays = 0;
  const awolHere: string[] = [];
  let lateMinutes = 0;
  let undertimeMinutes = 0;
  let overtimeMinutes = 0;
  let overtimePay = 0;
  let premiumMinutes = 0;
  let premiumPay = 0;
  let nightMinutes = 0;
  let nightPay = 0;

  for (const d of days) {
    if (d.status === "done" || d.status === "working") present++;
    if (d.kind === "work" && d.status === "absent") {
      absentDays++;
      if (awol.has(d.date)) {
        awolDays++;
        awolHere.push(d.date);
      }
    }
    lateMinutes += d.lateMinutes;
    undertimeMinutes += d.undertimeMinutes;

    const r = dayRates(d);
    if (d.kind === "work") {
      // Ordinary day: only approved time past the shift is extra pay.
      overtimeMinutes += d.approvedOvertimeMinutes;
      overtimePay += d.approvedOvertimeMinutes * perMinute * r.ot;
    } else if (d.workedMinutes > 0) {
      // Rest day or holiday: the first 8 hours carry the day's premium; beyond 8 needs approval.
      const first = Math.min(d.workedMinutes, 480);
      // A holiday on a workday is already in the monthly pay, so only the premium is added; a rest day isn't.
      const covered = d.kind === "holiday" ? 1 : 0;
      premiumMinutes += first;
      premiumPay += first * perMinute * (r.first8 - covered);
      const beyond = Math.min(Math.max(0, d.workedMinutes - 480), d.approvedOvertimeMinutes);
      overtimeMinutes += beyond;
      overtimePay += beyond * perMinute * r.ot;
    }
    // Night differential: 10% of that day's rate for hours between 10 PM and 6 AM.
    nightMinutes += d.nightMinutes;
    nightPay += d.nightMinutes * perMinute * r.first8 * NIGHT_DIFFERENTIAL;
  }

  const absentDeduction = absentDays * daily;
  const unpaidLeaveDeduction = input.unpaidLeaveDays * daily;
  const undertimeDeduction = undertimeMinutes * perMinute;
  const adjustments = input.adjustments ?? [];
  const taxableAdjustments = adjustments.filter((a) => a.taxable).reduce((n, a) => n + a.amount, 0);
  const nonTaxableAdjustments = adjustments.filter((a) => !a.taxable).reduce((n, a) => n + a.amount, 0);

  const earned = Math.max(0, basic - absentDeduction - unpaidLeaveDeduction - undertimeDeduction);
  const gross = round2(Math.max(0, earned + overtimePay + premiumPay + nightPay + taxableAdjustments));

  // Monthly contributions on the monthly pay, half each cutoff, at the rates in force on payday.
  const s = sss(input.monthlySalary, input.to);
  const ph = philhealth(input.monthlySalary, input.to);
  const pi = pagibig(input.monthlySalary, input.to);
  const half = (n: number) => round2(n / 2);
  const sssEe = half(s.ee);
  const phEe = half(ph.ee);
  const piEe = half(pi.ee);
  const contributions = round2(sssEe + phEe + piEe);
  const taxable = round2(Math.max(0, gross - contributions));
  const tax = withholding(taxable, "semi-monthly", input.to);

  return {
    daily: round2(daily),
    hourly: round2(hourly),
    basic: round2(basic),
    present,
    absentDays,
    awolDays,
    awolDates: awolHere,
    absentDeduction: round2(absentDeduction),
    unpaidLeaveDays: input.unpaidLeaveDays,
    unpaidLeaveDeduction: round2(unpaidLeaveDeduction),
    lateMinutes,
    undertimeMinutes,
    undertimeDeduction: round2(undertimeDeduction),
    overtimeMinutes,
    overtimePay: round2(overtimePay),
    premiumMinutes,
    premiumPay: round2(premiumPay),
    nightMinutes,
    nightPay: round2(nightPay),
    taxableAdjustments: round2(taxableAdjustments),
    nonTaxableAdjustments: round2(nonTaxableAdjustments),
    gross,
    sssEe,
    sssEr: half(s.er),
    ec: half(s.ec),
    phEe,
    phEr: half(ph.er),
    piEe,
    piEr: half(pi.er),
    contributions,
    taxable,
    tax,
    net: round2(gross - contributions - tax + nonTaxableAdjustments),
  };
}
