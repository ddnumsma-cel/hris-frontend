import type { PayrollEntry } from "./types";

/**
 * Semi-monthly payroll computation for one employee's cutoff.
 *
 * Simplified Philippine rules — good enough for the prototype, but the real
 * figures should come from the payroll backend:
 * - SSS: 5% employee share of the monthly salary credit (₱5,000–₱35,000)
 * - PhilHealth: 2.5% employee share of basic pay (floor ₱10,000, cap ₱100,000)
 * - Pag-IBIG: 2% of basic pay, capped at ₱200/month
 * - Withholding tax: BIR semi-monthly table (TRAIN, 2023 onward)
 * - Overtime: 125% of the hourly rate (22 working days × 8 hours)
 * - Allowances are treated as non-taxable de minimis.
 * Monthly contributions are split evenly across both cutoffs.
 */

const WORKING_HOURS_PER_MONTH = 22 * 8;
const OVERTIME_MULTIPLIER = 1.25;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

const semiMonthlyTaxBrackets = [
  { over: 333_333, base: 91_770.7, rate: 0.35 },
  { over: 83_333, base: 16_770.7, rate: 0.3 },
  { over: 33_333, base: 4_270.7, rate: 0.25 },
  { over: 16_667, base: 937.5, rate: 0.2 },
  { over: 10_417, base: 0, rate: 0.15 },
];

function semiMonthlyWithholdingTax(taxable: number) {
  const bracket = semiMonthlyTaxBrackets.find((b) => taxable > b.over);
  return bracket ? bracket.base + (taxable - bracket.over) * bracket.rate : 0;
}

export interface PayrollComputation {
  basicPay: number;
  overtimePay: number;
  allowance: number;
  gross: number;
  sss: number;
  philHealth: number;
  pagIbig: number;
  withholdingTax: number;
  otherDeductions: number;
  totalDeductions: number;
  net: number;
}

export function computePayroll(entry: Pick<PayrollEntry, "monthlyBasic" | "allowance" | "overtimeHours" | "otherDeductions">): PayrollComputation {
  const monthly = Math.max(0, entry.monthlyBasic);
  const basicPay = monthly / 2;
  const overtimePay = (monthly / WORKING_HOURS_PER_MONTH) * OVERTIME_MULTIPLIER * Math.max(0, entry.overtimeHours);
  const allowance = Math.max(0, entry.allowance);
  const gross = basicPay + overtimePay + allowance;

  const sss = monthly > 0 ? (clamp(monthly, 5_000, 35_000) * 0.05) / 2 : 0;
  const philHealth = monthly > 0 ? (clamp(monthly, 10_000, 100_000) * 0.025) / 2 : 0;
  const pagIbig = (Math.min(monthly * 0.02, 200)) / 2;
  const statutory = sss + philHealth + pagIbig;

  const withholdingTax = semiMonthlyWithholdingTax(Math.max(0, basicPay + overtimePay - statutory));
  const otherDeductions = Math.max(0, entry.otherDeductions);
  const totalDeductions = statutory + withholdingTax + otherDeductions;

  return {
    basicPay: round2(basicPay),
    overtimePay: round2(overtimePay),
    allowance: round2(allowance),
    gross: round2(gross),
    sss: round2(sss),
    philHealth: round2(philHealth),
    pagIbig: round2(pagIbig),
    withholdingTax: round2(withholdingTax),
    otherDeductions: round2(otherDeductions),
    totalDeductions: round2(totalDeductions),
    net: round2(gross - totalDeductions),
  };
}
