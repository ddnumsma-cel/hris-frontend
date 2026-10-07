import { pagibig as pagibigShare, philhealth as philhealthShare, sss as sssShare, withholding } from "./reports/statutory";
import type { PayrollEntry } from "./types";

/**
 * Semi-monthly payroll computation for one employee's cutoff.
 *
 * Simplified Philippine rules — good enough for the prototype, but the real
 * figures should come from the payroll backend:
 * - SSS, PhilHealth, Pag-IBIG and the BIR semi-monthly tax table: the rates in
 *   force today, maintained on the Government contributions page (reports/statutory.ts)
 * - Overtime: 125% of the hourly rate (22 working days × 8 hours)
 * - Allowances are treated as non-taxable de minimis.
 * Monthly contributions are split evenly across both cutoffs.
 */

const WORKING_HOURS_PER_MONTH = 22 * 8;
const OVERTIME_MULTIPLIER = 1.25;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const semiMonthlyWithholdingTax = (taxable: number) => withholding(taxable, "semi-monthly");

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

  // Employee shares from the Government contributions page, split across both cutoffs.
  const sss = sssShare(monthly).ee / 2;
  const philHealth = philhealthShare(monthly).ee / 2;
  const pagIbig = pagibigShare(monthly).ee / 2;
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
