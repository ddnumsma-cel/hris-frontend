/**
 * SAMPLE payroll calculation. NOT for real payroll: statutory rates are approximate and unverified.
 * All money uses decimal.js; results are rounded to centavos (half-up).
 */
import Decimal from 'decimal.js';
import type { DtrStatus, HolidayType } from './enums';
import { money, MoneyInput, roundMoney } from './money';
import { addDays, DateKey, weekdayOf } from './time';

// ---------- Statutory rate configs (stored as JSON in StatutoryRate.config) ----------

export interface SssConfig {
  verified: boolean;
  source: string;
  employeeRate: string;
  employerRate: string;
  mscMin: string;
  mscMax: string;
  mscStep: string;
}

export interface PhilHealthConfig {
  verified: boolean;
  source: string;
  premiumRate: string;
  /** Employee pays this share of the premium */
  employeeShare: string;
  floor: string;
  ceiling: string;
}

export interface PagIbigConfig {
  verified: boolean;
  source: string;
  employeeRate: string;
  lowIncomeEmployeeRate: string;
  lowIncomeThreshold: string;
  maxFundSalary: string;
}

export interface TaxBracket {
  /** Taxable income above this amount… */
  over: string;
  /** …pays this fixed amount… */
  base: string;
  /** …plus this rate on the excess */
  rate: string;
}

export interface WithholdingTaxConfig {
  verified: boolean;
  source: string;
  period: 'SEMI_MONTHLY';
  brackets: TaxBracket[];
}

export interface StatutoryRates {
  sss: SssConfig;
  philhealth: PhilHealthConfig;
  pagibig: PagIbigConfig;
  withholdingTax: WithholdingTaxConfig;
}

/** Approximate 2025–2026 rates used by the seed. Every table is marked verified: false. */
export const SAMPLE_STATUTORY_RATES: StatutoryRates = {
  sss: {
    verified: false,
    source: 'Approximation of the SSS 2025 contribution schedule (15% total; 5% employee)',
    employeeRate: '0.05',
    employerRate: '0.10',
    mscMin: '5000',
    mscMax: '35000',
    mscStep: '500',
  },
  philhealth: {
    verified: false,
    source: 'Approximation of PhilHealth 2024–2026 premium (5%, shared 50/50)',
    premiumRate: '0.05',
    employeeShare: '0.5',
    floor: '10000',
    ceiling: '100000',
  },
  pagibig: {
    verified: false,
    source: 'Approximation of Pag-IBIG (2% employee, fund salary capped at 10,000)',
    employeeRate: '0.02',
    lowIncomeEmployeeRate: '0.01',
    lowIncomeThreshold: '1500',
    maxFundSalary: '10000',
  },
  withholdingTax: {
    verified: false,
    source: 'Approximation of the TRAIN semi-monthly withholding table (2023 onwards)',
    period: 'SEMI_MONTHLY',
    brackets: [
      { over: '0', base: '0', rate: '0' },
      { over: '10417', base: '0', rate: '0.15' },
      { over: '16667', base: '937.50', rate: '0.20' },
      { over: '33333', base: '4270.70', rate: '0.25' },
      { over: '83333', base: '16770.70', rate: '0.30' },
      { over: '333333', base: '91770.70', rate: '0.35' },
    ],
  },
};

const clamp = (v: Decimal, min: Decimal, max: Decimal) => Decimal.max(min, Decimal.min(max, v));
/** Half of a monthly amount for one cut-off, the half centavo to the even centavo (workbook sheet C: 584.375 → 584.38, 403.125 → 403.12). */
const perCutoff = (monthlyAmount: Decimal) => monthlyAmount.dividedBy(2).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

/** SSS employee share for one cut-off: the monthly salary credit (nearest step, halfway to the even step) × rate, halved. */
export function sssEmployeeShare(monthly: MoneyInput, cfg: SssConfig): Decimal {
  if (money(monthly).lte(0)) return new Decimal(0);
  const step = money(cfg.mscStep);
  const msc = clamp(
    money(monthly).dividedBy(step).toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN).times(step),
    money(cfg.mscMin),
    money(cfg.mscMax),
  );
  return perCutoff(roundMoney(msc.times(cfg.employeeRate)));
}

/** PhilHealth employee share for one cut-off: the monthly premium's employee half, halved. */
export function philhealthEmployeeShare(monthly: MoneyInput, cfg: PhilHealthConfig): Decimal {
  if (money(monthly).lte(0)) return new Decimal(0);
  const base = clamp(money(monthly), money(cfg.floor), money(cfg.ceiling));
  return perCutoff(roundMoney(base.times(cfg.premiumRate).times(cfg.employeeShare)));
}

/** Pag-IBIG employee share for one cut-off. */
export function pagibigEmployeeShare(monthly: MoneyInput, cfg: PagIbigConfig): Decimal {
  const m = money(monthly);
  if (m.lte(0)) return new Decimal(0);
  const rate = m.lte(cfg.lowIncomeThreshold) ? cfg.lowIncomeEmployeeRate : cfg.employeeRate;
  return perCutoff(roundMoney(Decimal.min(m, money(cfg.maxFundSalary)).times(rate)));
}

/** Withholding tax for one semi-monthly cutoff. */
export function withholdingTax(taxable: MoneyInput, cfg: WithholdingTaxConfig): Decimal {
  const t = money(taxable);
  if (t.lte(0)) return new Decimal(0);
  const bracket = [...cfg.brackets].reverse().find((b) => t.gt(b.over)) ?? cfg.brackets[0];
  return roundMoney(money(bracket.base).plus(t.minus(bracket.over).times(bracket.rate)));
}

// ---------- MSMA's payroll workbook (Payroll Template - Sample_1.xlsx, visible sheets) ----------

/** Hours a workday counts for: DTR_FT turns ABS into 8 hours, HD into 4. */
export const HOURS_PER_DAY = 8;
/** daily = monthly × 12 ÷ 261 (sheet B). */
export const WORKING_DAYS_PER_YEAR = 261;
/** Arriving this many minutes after the shift starts is a half day (9:00 on an 8:30 shift). */
export const HALF_DAY_LATE_MINUTES = 30;
/** Every this-many lates under 30 minutes in one cut-off is a day absent. */
export const LATES_PER_ABSENT_DAY = 3;
/** Hours deducted for a day with undertime, however early they left. */
export const UNDERTIME_HOURS = 4;
/** Night differential: +10% of the day's rate from 10 PM to 6 AM. */
export const NIGHT_DIFFERENTIAL = '0.10';

/** Sheet A_2's day types: multiplier for the first 8 hours, for overtime, and for overtime at night. */
export const DAY_RATES = {
  OD: { label: 'Ordinary day', first8: '1', ot: '1.25', nsd: '1.375' },
  RD: { label: 'Sunday or rest day', first8: '1.3', ot: '1.69', nsd: '1.859' },
  SD: { label: 'Special day', first8: '1.3', ot: '1.69', nsd: '1.859' },
  SRD: { label: 'Special day on a rest day', first8: '1.5', ot: '1.95', nsd: '2.145' },
  RH: { label: 'Regular holiday', first8: '2', ot: '2.6', nsd: '2.86' },
  RRH: { label: 'Regular holiday on a rest day', first8: '2.6', ot: '3.38', nsd: '3.718' },
} as const;
export type DayRateCode = keyof typeof DAY_RATES;

export function dayRateCode(holidayType: HolidayType | null | undefined, restDay: boolean): DayRateCode {
  if (holidayType === 'REGULAR') return restDay ? 'RRH' : 'RH';
  if (holidayType === 'SPECIAL') return restDay ? 'SRD' : 'SD';
  return restDay ? 'RD' : 'OD';
}

/** Sample pay date: 5 days after the cutoff ends. */
export function payDateFor(cutoffTo: DateKey): DateKey {
  return addDays(cutoffTo, 5);
}

// ---------- Inputs / outputs ----------

export interface PayrollDay {
  date: DateKey;
  status: DtrStatus;
  holidayType?: HolidayType | null;
  /** Not one of the shift's work days. */
  restDay?: boolean;
  /** For LEAVE days: is the leave paid? */
  paidLeave?: boolean;
  /** Worked time (lunch taken out); used on rest days and holidays. */
  workedMinutes?: number;
  lateMinutes: number;
  undertimeMinutes: number;
  /** Approved overtime only (never more than the time clock shows). */
  otMinutes: number;
  nightDiffMinutes: number;
}

export interface PayslipComputation {
  daysPaid: Decimal;
  /** Half the monthly salary, less the workdays before the hire date (or after separation). */
  basicPay: Decimal;
  overtimePay: Decimal;
  nightDiffPay: Decimal;
  /** Holiday and premium pay: the first 8 hours worked on a rest day or holiday at the day's rate (sheet A). */
  holidayPay: Decimal;
  /** Absences, lates and undertime (sheet B). */
  lateUndertimeDeduction: Decimal;
  grossPay: Decimal;
  sss: Decimal;
  philhealth: Decimal;
  pagibig: Decimal;
  withholdingTax: Decimal;
  totalDeductions: Decimal;
  netPay: Decimal;
  monthlySalary: Decimal;
  dailyRate: Decimal;
  hourlyRate: Decimal;
  otMinutes: number;
  nightDiffMinutes: number;
  lateUndertimeMinutes: number;
  /** Hours deducted as absences: absent workdays, every 3rd late, unpaid leave. */
  absentHours: number;
  halfDayHours: number;
  undertimeHours: number;
}

/**
 * One employee's pay for a cut-off, as MSMA's payroll workbook computes it:
 * - basic = half the monthly salary (FT_MSMA H), less 8 h × hourly for each workday before the hire date or after separation;
 * - sheet B: absent day 8 h, 30+ min late a half day (4 h), every 3rd shorter late in the cut-off a day absent,
 *   undertime a flat 4 h, unpaid leave 8 h; hourly = round(round(monthly × 12 ÷ 261) ÷ 8);
 * - sheet A: rest day / holiday worked: first 8 h at the day's rate; approved overtime at the day's OT rate
 *   (night overtime at the "with OT and NSD" rate); other night hours +10%; OT and night OT rounded separately;
 * - sheet C: SSS, PhilHealth and Pag-IBIG on the monthly salary, half each cut-off; none in a first cut-off
 *   that started before the hire date;
 * - sheet D: tax on gross pay, contributions NOT taken off first;
 * - net = gross − contributions − tax.
 */
export function computePayslip(input: {
  monthlySalary: MoneyInput;
  days: PayrollDay[];
  rates: StatutoryRates;
  /** The cut-off's dates; with workDays, used for a mid-cut-off hire or separation. */
  cutoff?: { from: DateKey; to: DateKey };
  hireDate?: DateKey;
  separationDate?: DateKey | null;
  /** The shift's work days (0 = Sunday); default Monday to Friday. */
  workDays?: number[];
}): PayslipComputation {
  const monthly = money(input.monthlySalary);
  const daily = roundMoney(monthly.times(12).dividedBy(WORKING_DAYS_PER_YEAR));
  const hourly = roundMoney(daily.dividedBy(HOURS_PER_DAY));
  const perMinute = hourly.dividedBy(60);
  const employed = (d: DateKey) =>
    (!input.hireDate || d >= input.hireDate) && (!input.separationDate || d <= input.separationDate);
  const workDays = input.workDays ?? [1, 2, 3, 4, 5];

  // Mid-cut-off hire or separation: the half month less 8 h for each workday outside employment.
  let notEmployedHours = 0;
  if (input.cutoff)
    for (let d = input.cutoff.from; d <= input.cutoff.to; d = addDays(d, 1))
      if (!employed(d) && workDays.includes(weekdayOf(d))) notEmployedHours += HOURS_PER_DAY;
  const half = roundMoney(monthly.dividedBy(2));
  const basicPay = half.minus(Decimal.min(half, roundMoney(hourly.times(notEmployedHours))));

  let daysPaid = new Decimal(0);
  let absentHours = 0;
  let halfDayHours = 0;
  let undertimeHours = 0;
  let lates = 0;
  let lateUtMinutes = 0;
  let otMinutes = 0;
  let ndMinutes = 0;
  let premium = new Decimal(0);
  let otOrdinary = new Decimal(0);
  let otNight = new Decimal(0);
  let night = new Decimal(0);

  for (const day of [...input.days].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!employed(day.date)) continue;
    const rest = Boolean(day.restDay);
    const rate = DAY_RATES[dayRateCode(day.holidayType, rest)];
    if (day.status === 'PRESENT') {
      daysPaid = daysPaid.plus(1);
      if (!rest && !day.holidayType) {
        // Ordinary workday: lates and undertime (sheet B).
        lateUtMinutes += day.lateMinutes + day.undertimeMinutes;
        if (day.lateMinutes >= HALF_DAY_LATE_MINUTES) halfDayHours += HOURS_PER_DAY / 2;
        else if (day.lateMinutes > 0 && ++lates % LATES_PER_ABSENT_DAY === 0) absentHours += HOURS_PER_DAY;
        if (day.undertimeMinutes > 0) undertimeHours += UNDERTIME_HOURS;
      } else {
        // Rest day or holiday worked: the first 8 hours at the day's rate, on top of the half month.
        premium = premium.plus(perMinute.times(Math.min(day.workedMinutes ?? 0, 480)).times(rate.first8));
      }
      const nightOt = Math.min(day.nightDiffMinutes, day.otMinutes);
      otMinutes += day.otMinutes;
      ndMinutes += day.nightDiffMinutes;
      otOrdinary = otOrdinary.plus(perMinute.times(day.otMinutes - nightOt).times(rate.ot));
      otNight = otNight.plus(perMinute.times(nightOt).times(rate.nsd));
      night = night.plus(perMinute.times(day.nightDiffMinutes - nightOt).times(rate.first8).times(NIGHT_DIFFERENTIAL));
    } else if (day.status === 'ABSENT') {
      absentHours += HOURS_PER_DAY;
    } else if (day.status === 'LEAVE') {
      if (day.paidLeave === false) absentHours += HOURS_PER_DAY;
      else daysPaid = daysPaid.plus(1);
    } else if (day.status === 'HOLIDAY') {
      daysPaid = daysPaid.plus(1); // paid within the half month
    }
  }

  // The workbook rounds its OT and night-OT columns separately (sheet A).
  const overtimePay = roundMoney(otOrdinary).plus(roundMoney(otNight));
  const nightDiffPay = roundMoney(night);
  const holidayPay = roundMoney(premium);
  const lateUndertimeDeduction = roundMoney(hourly.times(absentHours + halfDayHours + undertimeHours));
  const earned = Decimal.max(0, basicPay.minus(lateUndertimeDeduction));
  const grossPay = roundMoney(earned.plus(overtimePay).plus(nightDiffPay).plus(holidayPay));

  // No contributions in a first cut-off that started before the hire date (the workbook's new hires).
  const basis = input.cutoff && input.hireDate && input.hireDate > input.cutoff.from ? new Decimal(0) : monthly;
  const sss = sssEmployeeShare(basis, input.rates.sss);
  const philhealth = philhealthEmployeeShare(basis, input.rates.philhealth);
  const pagibig = pagibigEmployeeShare(basis, input.rates.pagibig);
  // Sheet D: contributions are not taken off before tax.
  const tax = withholdingTax(grossPay, input.rates.withholdingTax);
  const totalDeductions = roundMoney(sss.plus(philhealth).plus(pagibig).plus(tax));

  return {
    daysPaid,
    basicPay,
    overtimePay,
    nightDiffPay,
    holidayPay,
    lateUndertimeDeduction,
    grossPay,
    sss,
    philhealth,
    pagibig,
    withholdingTax: tax,
    totalDeductions,
    netPay: roundMoney(grossPay.minus(totalDeductions)),
    monthlySalary: monthly,
    dailyRate: daily,
    hourlyRate: hourly,
    otMinutes,
    nightDiffMinutes: ndMinutes,
    lateUndertimeMinutes: lateUtMinutes,
    absentHours,
    halfDayHours,
    undertimeHours,
  };
}
