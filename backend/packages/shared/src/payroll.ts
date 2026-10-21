/**
 * SAMPLE payroll calculation. NOT for real payroll: statutory rates are approximate and unverified.
 * All money uses decimal.js; results are rounded to centavos (half-up).
 */
import Decimal from 'decimal.js';
import type { DtrStatus, HolidayType } from './enums';
import { money, MoneyInput, roundMoney } from './money';
import { addDays, DateKey } from './time';

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

// ---------- Multipliers (Labor Code basics, simplified for the sample) ----------

export const PAY_RULES = {
  /** Hours in a regular workday */
  hoursPerDay: 8,
  /** Ordinary-day overtime premium: +25% */
  overtimeMultiplier: '1.25',
  /** Night differential premium: +10% of the hourly rate */
  nightDiffRate: '0.10',
  /** Regular holiday worked: 200% of the daily rate (basic 100% + holiday premium 100%) */
  regularHolidayWorkedExtra: '1.00',
  /** Regular holiday not worked: still paid 100% */
  regularHolidayUnworked: '1.00',
  /** Special non-working day worked: +30% */
  specialHolidayWorkedExtra: '0.30',
  /** Days per year for a 6-day work week, used to convert daily rate to monthly equivalent */
  workDaysPerYear: 313,
} as const;

/** Sample pay date: 5 days after the cutoff ends. */
export function payDateFor(cutoffTo: DateKey): DateKey {
  return addDays(cutoffTo, 5);
}

// ---------- Inputs / outputs ----------

export interface PayrollDay {
  status: DtrStatus;
  holidayType?: HolidayType | null;
  /** For LEAVE days: is the leave paid? */
  paidLeave?: boolean;
  lateMinutes: number;
  undertimeMinutes: number;
  otMinutes: number;
  nightDiffMinutes: number;
}

export interface PayslipComputation {
  daysPaid: Decimal;
  basicPay: Decimal;
  overtimePay: Decimal;
  nightDiffPay: Decimal;
  holidayPay: Decimal;
  lateUndertimeDeduction: Decimal;
  grossPay: Decimal;
  sss: Decimal;
  philhealth: Decimal;
  pagibig: Decimal;
  withholdingTax: Decimal;
  totalDeductions: Decimal;
  netPay: Decimal;
  /** Monthly-equivalent salary used for contribution brackets */
  monthlyEquivalent: Decimal;
  otMinutes: number;
  nightDiffMinutes: number;
  lateUndertimeMinutes: number;
}

const clamp = (v: Decimal, min: Decimal, max: Decimal) => Decimal.max(min, Decimal.min(max, v));

/** Monthly equivalent of a daily rate: daily × 313 / 12. */
export function monthlyEquivalent(dailyRate: MoneyInput): Decimal {
  return roundMoney(money(dailyRate).times(PAY_RULES.workDaysPerYear).dividedBy(12));
}

/** SSS employee share for one semi-monthly cutoff (half of the monthly share). */
export function sssEmployeeShare(monthly: MoneyInput, cfg: SssConfig): Decimal {
  const step = money(cfg.mscStep);
  const msc = clamp(
    money(monthly).dividedBy(step).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(step),
    money(cfg.mscMin),
    money(cfg.mscMax),
  );
  return roundMoney(msc.times(cfg.employeeRate).dividedBy(2));
}

/** PhilHealth employee share for one semi-monthly cutoff. */
export function philhealthEmployeeShare(monthly: MoneyInput, cfg: PhilHealthConfig): Decimal {
  const base = clamp(money(monthly), money(cfg.floor), money(cfg.ceiling));
  return roundMoney(base.times(cfg.premiumRate).times(cfg.employeeShare).dividedBy(2));
}

/** Pag-IBIG employee share for one semi-monthly cutoff. */
export function pagibigEmployeeShare(monthly: MoneyInput, cfg: PagIbigConfig): Decimal {
  const m = money(monthly);
  const rate = m.lte(cfg.lowIncomeThreshold) ? cfg.lowIncomeEmployeeRate : cfg.employeeRate;
  const base = Decimal.min(m, money(cfg.maxFundSalary));
  return roundMoney(base.times(rate).dividedBy(2));
}

/** Withholding tax for one semi-monthly cutoff. */
export function withholdingTax(taxable: MoneyInput, cfg: WithholdingTaxConfig): Decimal {
  const t = money(taxable);
  if (t.lte(0)) return new Decimal(0);
  const bracket = [...cfg.brackets].reverse().find((b) => t.gt(b.over)) ?? cfg.brackets[0];
  return roundMoney(money(bracket.base).plus(t.minus(bracket.over).times(bracket.rate)));
}

/**
 * Compute one employee's payslip for a cutoff from their DTR days.
 * SAMPLE ONLY: simplified rules, approximate statutory tables.
 */
export function computePayslip(input: {
  dailyRate: MoneyInput;
  days: PayrollDay[];
  rates: StatutoryRates;
}): PayslipComputation {
  const daily = money(input.dailyRate);
  const minutesPerDay = PAY_RULES.hoursPerDay * 60;
  // Multiply before dividing so e.g. 1,150 × 30 / 480 is exactly 71.875 (→ 71.88), not 71.8749…
  const minutePay = (minutes: number, multiplier: string = '1') =>
    daily.times(minutes).times(multiplier).dividedBy(minutesPerDay);
  let daysPaid = new Decimal(0);
  let basic = new Decimal(0);
  let holiday = new Decimal(0);
  let otMinutes = 0;
  let ndMinutes = 0;
  let lateUtMinutes = 0;

  for (const day of input.days) {
    otMinutes += day.otMinutes;
    ndMinutes += day.nightDiffMinutes;
    if (day.status === 'PRESENT') {
      daysPaid = daysPaid.plus(1);
      basic = basic.plus(daily);
      lateUtMinutes += day.lateMinutes + day.undertimeMinutes;
      if (day.holidayType === 'REGULAR')
        holiday = holiday.plus(daily.times(PAY_RULES.regularHolidayWorkedExtra));
      if (day.holidayType === 'SPECIAL')
        holiday = holiday.plus(daily.times(PAY_RULES.specialHolidayWorkedExtra));
    } else if (day.status === 'LEAVE' && day.paidLeave !== false) {
      daysPaid = daysPaid.plus(1);
      basic = basic.plus(daily);
    } else if (day.status === 'HOLIDAY' && day.holidayType === 'REGULAR') {
      daysPaid = daysPaid.plus(1);
      holiday = holiday.plus(daily.times(PAY_RULES.regularHolidayUnworked));
    }
  }

  const basicPay = roundMoney(basic);
  const holidayPay = roundMoney(holiday);
  const overtimePay = roundMoney(minutePay(otMinutes, PAY_RULES.overtimeMultiplier));
  const nightDiffPay = roundMoney(minutePay(ndMinutes, PAY_RULES.nightDiffRate));
  const lateUndertimeDeduction = roundMoney(minutePay(lateUtMinutes));
  const grossPay = roundMoney(
    basicPay.plus(holidayPay).plus(overtimePay).plus(nightDiffPay).minus(lateUndertimeDeduction),
  );

  const monthly = monthlyEquivalent(daily);
  const sss = sssEmployeeShare(monthly, input.rates.sss);
  const philhealth = philhealthEmployeeShare(monthly, input.rates.philhealth);
  const pagibig = pagibigEmployeeShare(monthly, input.rates.pagibig);
  const tax = withholdingTax(
    grossPay.minus(sss).minus(philhealth).minus(pagibig),
    input.rates.withholdingTax,
  );
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
    monthlyEquivalent: monthly,
    otMinutes,
    nightDiffMinutes: ndMinutes,
    lateUndertimeMinutes: lateUtMinutes,
  };
}
