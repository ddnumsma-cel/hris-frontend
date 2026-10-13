// One employee's pay for one cut-off, from their attendance.
// Pure: no storage, no React. Payroll runs, the payroll register and payslips all use this.
//
// Rules follow MSMA's payroll workbook (Payroll Template, sheets A, A_1, A_2, B, C, D, FT_MSMA):
// - Monthly-paid. Daily = monthly × 12 ÷ 261, hourly = daily ÷ 8, each rounded to the centavo.
//   Both work weeks are 40 hours: 5-day (Mon–Fri, 8 h) or 6-day (Mon–Fri 7 h, Sat 5 h).
// - Absent on a workday: that day's scheduled hours (8, or 7 / 5 on a 6-day week) × hourly.
// - Half day (HD): arriving 30 minutes or more after the shift starts (9:00 on an 8:30 shift),
//   and every 3rd late in the same week: half the day's hours.
// - Undertime (UT): a flat 4 hours for each day with undertime.
// - Unpaid leave: one day's pay per day. Absent 3 workdays in a row: the 3rd on is AWOL (flagged).
// - Premium pay on rest days and holidays and overtime use the day-type rates below (A_1 rate table).
//   A holiday on a workday is already in the monthly pay, so only the premium on top is added.
// - Overtime is paid only when approved. Night hours: +10% of the day's rate; night hours inside
//   overtime are paid at the "with OT and NSD" rate (overtime × 1.1).
// - OT meal: days with approved overtime × the employee's OT meal rate (taxable).
// - Transport allowance: the cut-off amount × workdays attended ÷ workdays scheduled (not taxed).
// - Taxable pay (sheet D) = basic − de minimis − other non-taxable + premiums + overtime + OT meal
//   − absences, lates and undertime. Contributions are not taken off before tax.
// - SSS, PhilHealth and Pag-IBIG: the employee share of the monthly amount, half each cut-off.

import type { DayRow } from "../timekeeping/api";
import { NIGHT_DIFFERENTIAL, WORKING_DAYS_PER_YEAR } from "../timekeeping/compute";
import { pagibig, philhealth, round2, sss, withholding } from "../reports/statutory";
import { DEFAULT_PROFILE, scheduledHours, type PayProfile } from "./settings";

/** Absent this many workdays in a row and the run counts as AWOL from that day on. */
export const AWOL_AFTER = 3;
/** Arriving this many minutes after the shift starts counts as a half day. */
export const HALF_DAY_LATE = 30;
/** Every this-many lates in one week count as a half day. */
export const LATES_PER_HALF_DAY = 3;
/** Hours deducted for a day with undertime. */
export const UNDERTIME_HOURS = 4;

export interface DayRates {
  code: string;
  label: string;
  /** Multiplier for the first 8 hours worked that day ("No OT" / premium pay). */
  first8: number;
  /** Multiplier for approved hours beyond 8, or past the shift on an ordinary day ("With OT"). */
  ot: number;
  /** Multiplier for overtime hours at night ("With OT and NSD"). */
  nsd: number;
}

/** The workbook's rate table (sheet A_1), by kind of day. */
export const DAY_RATES: DayRates[] = [
  { code: "OD", label: "Ordinary day", first8: 1, ot: 1.25, nsd: 1.375 },
  { code: "RD", label: "Sunday or rest day", first8: 1.3, ot: 1.69, nsd: 1.859 },
  { code: "SD", label: "Special day", first8: 1.3, ot: 1.69, nsd: 1.859 },
  { code: "SRD", label: "Special day on a rest day", first8: 1.5, ot: 1.95, nsd: 2.145 },
  { code: "RH", label: "Regular holiday", first8: 2, ot: 2.6, nsd: 2.86 },
  { code: "RRH", label: "Regular holiday on a rest day", first8: 2.6, ot: 3.38, nsd: 3.718 },
  { code: "DH", label: "Double holiday", first8: 3, ot: 3.9, nsd: 4.29 },
  { code: "DRH", label: "Double holiday on a rest day", first8: 3.9, ot: 5.07, nsd: 5.577 },
];

const rate = (code: string) => DAY_RATES.find((r) => r.code === code)!;

export function dayRates(d: Pick<DayRow, "dayType" | "kind">): DayRates {
  const rest = d.kind === "rest" || d.kind === "unscheduled";
  if (d.dayType === "regular") return rate(rest ? "RRH" : "RH");
  if (d.dayType === "special") return rate(rest ? "SRD" : "SD");
  return rate(rest ? "RD" : "OD");
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
  /** Work week, allowances and tax-free pay (lib/pay/settings.ts). */
  profile?: PayProfile;
}

export interface PayResult {
  daily: number;
  hourly: number;
  /** Half the monthly pay, or the days employed when hired or separated mid-cutoff. */
  basic: number;
  present: number;
  absentDays: number;
  absentHours: number;
  awolDays: number;
  awolDates: string[];
  absentDeduction: number;
  unpaidLeaveDays: number;
  unpaidLeaveDeduction: number;
  lateMinutes: number;
  /** Lates that became half days: 30+ minutes late, or every 3rd late in a week. */
  halfDays: number;
  halfDayHours: number;
  halfDayDeduction: number;
  undertimeMinutes: number;
  undertimeDays: number;
  undertimeHours: number;
  undertimeDeduction: number;
  overtimeMinutes: number;
  overtimeDays: number;
  overtimePay: number;
  premiumMinutes: number;
  premiumPay: number;
  nightMinutes: number;
  nightPay: number;
  otMeal: number;
  /** Workdays attended ÷ scheduled, for the transport allowance. */
  workdaysAttended: number;
  workdaysScheduled: number;
  transportAllowance: number;
  deMinimis: number;
  otherNonTaxable: number;
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
const weekday = (date: string) => new Date(`${date}T12:00:00`).getDay();
/** Monday of the date's week, so lates are counted Monday to Sunday. */
const weekOf = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

export function computePay(input: PayInput): PayResult {
  const profile = { ...DEFAULT_PROFILE, ...input.profile };
  const daily = round2((input.monthlySalary * 12) / WORKING_DAYS_PER_YEAR);
  const hourly = round2(daily / 8);
  const perMinute = hourly / 60;
  const hoursOf = (d: Pick<DayRow, "date">) => scheduledHours(profile.workWeek, weekday(d.date)) || 8;
  const days = input.days.filter((d) => inRange(d.date, input.employedFrom, input.employedTo));
  const partial = (input.employedFrom && input.employedFrom > input.from) || (input.employedTo && input.employedTo < input.to);
  // Mid-cutoff hire or separation: pay the workdays employed (holidays on workdays included), not the half month.
  const basic = partial ? daily * days.filter((d) => d.kind === "work" || d.kind === "holiday" || d.kind === "leave").length : input.monthlySalary / 2;

  const awol = awolDates(input.history.filter((d) => inRange(d.date, input.employedFrom, input.employedTo)));
  let present = 0;
  let absentDays = 0;
  let absentHours = 0;
  let awolDays = 0;
  const awolHere: string[] = [];
  let lateMinutes = 0;
  let halfDays = 0;
  let halfDayHours = 0;
  let undertimeMinutes = 0;
  let undertimeDays = 0;
  let undertimeHours = 0;
  let overtimeMinutes = 0;
  let overtimeDays = 0;
  let overtimePay = 0;
  let premiumMinutes = 0;
  let premiumPay = 0;
  let nightMinutes = 0;
  let nightPay = 0;
  let workdaysScheduled = 0;
  let workdaysAttended = 0;
  const latesByWeek = new Map<string, number>();

  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const attended = d.status === "done" || d.status === "working";
    if (attended) present++;
    if (d.kind === "work") {
      workdaysScheduled++;
      if (attended) workdaysAttended++;
    }
    if (d.kind === "work" && d.status === "absent") {
      absentDays++;
      absentHours += hoursOf(d);
      if (awol.has(d.date)) {
        awolDays++;
        awolHere.push(d.date);
      }
    }

    // Lates: 30+ minutes is a half day; shorter ones count toward 3-a-week.
    lateMinutes += d.lateMinutes;
    if (d.kind === "work" && attended && d.lateMinutes > 0) {
      if ((d.lateRawMinutes ?? d.lateMinutes) >= HALF_DAY_LATE) {
        halfDays++;
        halfDayHours += hoursOf(d) / 2;
      } else {
        const week = weekOf(d.date);
        const n = (latesByWeek.get(week) ?? 0) + 1;
        latesByWeek.set(week, n);
        if (n % LATES_PER_HALF_DAY === 0) {
          halfDays++;
          halfDayHours += hoursOf(d) / 2;
        }
      }
    }

    // Undertime: a flat 4 hours for the day, never more than the day's hours.
    undertimeMinutes += d.undertimeMinutes;
    if (d.kind === "work" && d.undertimeMinutes > 0) {
      undertimeDays++;
      undertimeHours += Math.min(UNDERTIME_HOURS, hoursOf(d));
    }

    const r = dayRates(d);
    let otToday = 0;
    if (d.kind === "work") {
      // Ordinary day: only approved time past the shift is overtime.
      otToday = d.approvedOvertimeMinutes;
    } else if (d.workedMinutes > 0) {
      // Rest day or holiday: the first 8 hours carry the day's premium; beyond 8 needs approval.
      const first = Math.min(d.workedMinutes, 480);
      // A holiday on a workday is already in the monthly pay, so only the premium is added; a rest day isn't.
      const covered = d.kind === "holiday" ? 1 : 0;
      premiumMinutes += first;
      premiumPay += first * perMinute * (r.first8 - covered);
      otToday = Math.min(Math.max(0, d.workedMinutes - 480), d.approvedOvertimeMinutes);
    }
    // Night hours inside overtime take the "with OT and NSD" rate; the rest get +10% of the day's rate.
    const nightOt = Math.min(d.nightMinutes, otToday);
    overtimeMinutes += otToday;
    overtimePay += (otToday - nightOt) * perMinute * r.ot + nightOt * perMinute * r.nsd;
    if (otToday > 0) overtimeDays++;
    nightMinutes += d.nightMinutes;
    nightPay += (d.nightMinutes - nightOt) * perMinute * r.first8 * NIGHT_DIFFERENTIAL;
  }

  const absentDeduction = absentHours * hourly;
  const halfDayDeduction = halfDayHours * hourly;
  const undertimeDeduction = undertimeHours * hourly;
  const unpaidLeaveDeduction = input.unpaidLeaveDays * daily;
  const otMeal = overtimeDays * profile.otMealRate;
  const transportAllowance = workdaysScheduled ? (profile.transportAllowance * workdaysAttended) / workdaysScheduled : 0;
  const adjustments = input.adjustments ?? [];
  const taxableAdjustments = adjustments.filter((a) => a.taxable).reduce((n, a) => n + a.amount, 0);
  const nonTaxableAdjustments = adjustments.filter((a) => !a.taxable).reduce((n, a) => n + a.amount, 0);

  const earned = Math.max(0, basic - absentDeduction - halfDayDeduction - undertimeDeduction - unpaidLeaveDeduction);
  const gross = round2(Math.max(0, earned + overtimePay + premiumPay + nightPay + otMeal + taxableAdjustments));

  // Monthly contributions on the monthly pay, half each cutoff, at the rates in force on payday.
  const s = sss(input.monthlySalary, input.to);
  const ph = philhealth(input.monthlySalary, input.to);
  const pi = pagibig(input.monthlySalary, input.to);
  const half = (n: number) => round2(n / 2);
  const sssEe = half(s.ee);
  const phEe = half(ph.ee);
  const piEe = half(pi.ee);
  const contributions = round2(sssEe + phEe + piEe);
  // Sheet D: the tax-free part of the basic pay comes off; contributions don't.
  const deMinimis = Math.min(profile.deMinimis, earned);
  const otherNonTaxable = Math.min(profile.otherNonTaxable, earned - deMinimis);
  const taxable = round2(Math.max(0, gross - deMinimis - otherNonTaxable));
  const tax = withholding(taxable, "semi-monthly", input.to);

  return {
    daily,
    hourly,
    basic: round2(basic),
    present,
    absentDays,
    absentHours,
    awolDays,
    awolDates: awolHere,
    absentDeduction: round2(absentDeduction),
    unpaidLeaveDays: input.unpaidLeaveDays,
    unpaidLeaveDeduction: round2(unpaidLeaveDeduction),
    lateMinutes,
    halfDays,
    halfDayHours,
    halfDayDeduction: round2(halfDayDeduction),
    undertimeMinutes,
    undertimeDays,
    undertimeHours,
    undertimeDeduction: round2(undertimeDeduction),
    overtimeMinutes,
    overtimeDays,
    overtimePay: round2(overtimePay),
    premiumMinutes,
    premiumPay: round2(premiumPay),
    nightMinutes,
    nightPay: round2(nightPay),
    otMeal: round2(otMeal),
    workdaysAttended,
    workdaysScheduled,
    transportAllowance: round2(transportAllowance),
    deMinimis: round2(deMinimis),
    otherNonTaxable: round2(otherNonTaxable),
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
    net: round2(gross - contributions - tax + round2(transportAllowance) + nonTaxableAdjustments),
  };
}
