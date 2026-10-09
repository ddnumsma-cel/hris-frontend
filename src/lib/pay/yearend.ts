// Year-to-date pay per employee, for BIR 2316, the alphalist (1604-C) and final pay.
// Cutoffs with an approved payroll run use its locked numbers; the others are estimated from the
// salary on file (full pay, that cutoff's contributions and withholding). Each result says how
// many cutoffs were estimated, so nobody mistakes a projection for a filed figure.

import { fullName, state as core } from "../corehr/store";
import { pagibig, philhealth, round2, sss, THIRTEENTH_MONTH_EXEMPT, withholding } from "../reports/statutory";
import { deny } from "../session";
import { approvedRuns } from "./runs";

const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), 250));
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
const dayMs = 86_400_000;
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / dayMs) + 1;

/** The 24 semi-monthly cutoffs of a year. */
export function cutoffsOf(year: number) {
  return Array.from({ length: 12 }, (_, i) => i + 1).flatMap((m) => [
    { from: `${year}-${pad(m)}-01`, to: `${year}-${pad(m)}-15` },
    { from: `${year}-${pad(m)}-16`, to: `${year}-${pad(m)}-${pad(lastDay(year, m))}` },
  ]);
}

/** Tax for a whole year: the BIR monthly table × 12 (the TRAIN tables are the annual one ÷ 12). */
export const annualTax = (taxable: number, on?: string) => round2(withholding(taxable / 12, "monthly", on) * 12);

export interface YearToDate {
  /** Basic pay actually earned (after absences), the base for 13th month. */
  basic: number;
  /** Regular taxable compensation: basic, overtime, premiums, taxable allowances. */
  gross: number;
  /** Employee share of SSS, PhilHealth and Pag-IBIG. */
  contributions: number;
  withheld: number;
  cutoffs: number;
  estimated: number;
}

/** Pay from the start of the year (or hire) through a date, cutoff by cutoff. */
export function yearToDate(employeeId: string, year: number, through: string): YearToDate {
  const e = core.employees.find((x) => x.id === employeeId);
  const out: YearToDate = { basic: 0, gross: 0, contributions: 0, withheld: 0, cutoffs: 0, estimated: 0 };
  if (!e || e.job.monthlySalary <= 0) return out;
  const start = e.job.dateHired;
  const end = [e.job.separationDate, through].filter(Boolean).sort()[0]!;
  const runs = approvedRuns();
  for (const c of cutoffsOf(year)) {
    if (c.from > end || c.to < start) continue;
    const line = runs.find((r) => r.from === c.from && r.to === c.to)?.lines.find((l) => l.person.id === employeeId);
    if (line) {
      out.basic += line.basic - line.deductions;
      out.gross += line.gross;
      out.contributions += line.sssEe + line.phEe + line.piEe;
      out.withheld += line.tax;
    } else {
      // Not run (yet): the salary on file, prorated when hired or leaving inside the cutoff.
      const from = start > c.from ? start : c.from;
      const to = end < c.to ? end : c.to;
      const share = Math.min(1, days(from, to) / days(c.from, c.to));
      const salary = e.job.monthlySalary;
      const basic = (salary / 2) * share;
      const contributions = (sss(salary, c.to).ee + philhealth(salary, c.to).ee + pagibig(salary, c.to).ee) / 2;
      out.basic += basic;
      out.gross += basic;
      out.contributions += contributions;
      out.withheld += withholding(Math.max(0, basic - contributions), "semi-monthly", c.to);
      out.estimated++;
    }
    out.cutoffs++;
  }
  return { ...out, basic: round2(out.basic), gross: round2(out.gross), contributions: round2(out.contributions), withheld: round2(out.withheld) };
}

// ---- BIR 2316 and the alphalist ----

export interface Form2316 {
  employeeId: string;
  name: string;
  tin: string;
  position: string;
  address: string;
  from: string;
  to: string;
  regular: number;
  thirteenth: number;
  thirteenthExempt: number;
  contributions: number;
  /** Gross compensation: regular pay plus 13th month. */
  gross: number;
  nonTaxable: number;
  taxable: number;
  taxDue: number;
  withheld: number;
  /** Withheld − due: positive is a refund to the employee, negative is still to collect. */
  adjustment: number;
  estimated: number;
  cutoffs: number;
}

export function form2316(employeeId: string, year: number): Form2316 | null {
  const e = core.employees.find((x) => x.id === employeeId);
  if (!e || e.job.monthlySalary <= 0) return null;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  if (e.job.dateHired > yearEnd || (e.job.separationDate && e.job.separationDate < yearStart)) return null;
  const y = yearToDate(employeeId, year, yearEnd);
  const thirteenth = round2(y.basic / 12);
  const thirteenthExempt = Math.min(thirteenth, THIRTEENTH_MONTH_EXEMPT);
  const taxable = round2(Math.max(0, y.gross - y.contributions + thirteenth - thirteenthExempt));
  const taxDue = annualTax(taxable, yearEnd);
  const c = e.contact;
  return {
    employeeId,
    name: fullName(e.personal),
    tin: e.government.tin,
    position: core.positions.find((p) => p.id === e.job.positionId)?.title ?? "",
    address: [c.address, c.city, c.province].filter(Boolean).join(", "),
    from: e.job.dateHired > yearStart ? e.job.dateHired : yearStart,
    to: e.job.separationDate && e.job.separationDate < yearEnd ? e.job.separationDate : yearEnd,
    regular: y.gross,
    thirteenth,
    thirteenthExempt: round2(thirteenthExempt),
    contributions: y.contributions,
    gross: round2(y.gross + thirteenth),
    nonTaxable: round2(thirteenthExempt + y.contributions),
    taxable,
    taxDue,
    withheld: y.withheld,
    adjustment: round2(y.withheld - taxDue),
    estimated: y.estimated,
    cutoffs: y.cutoffs,
  };
}

/** Every employee with pay in the year: the rows of the alphalist and the list of 2316s. */
export function listYearEnd(year: number): Promise<Form2316[]> {
  const denied = deny("payrollRuns", "view");
  if (denied) return denied;
  return respond(
    core.employees
      .map((e) => form2316(e.id, year))
      .filter((f): f is Form2316 => !!f)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}
