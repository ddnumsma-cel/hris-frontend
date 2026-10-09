// Final pay ("back pay") for someone leaving: last salary, unused leave converted to cash,
// prorated 13th month, unpaid reimbursements, less loan balances, and the year's tax trued up.
// Accounting opens a case with the last day; releasing it locks the figures, closes the loans and
// marks the reimbursements paid. HR still records the separation itself on the 201 file.

import { logAdmin } from "../admin/store";
import { fullName, newId, state as core } from "../corehr/store";
import { creditsFor } from "../leave/store";
import { payroll, type Period } from "../reports/api";
import { round2, THIRTEENTH_MONTH_EXEMPT } from "../reports/statutory";
import { claims, claimType, saveClaims } from "../reimbursements/store";
import { deny } from "../session";
import { outstandingLoans, settleLoans } from "./loans";
import { approvedRuns } from "./runs";
import { annualTax, cutoffsOf, yearToDate } from "./yearend";

const DELAY = 250;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));
const money = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Monetized unused leave up to this many days is a non-taxable de minimis benefit. */
const DE_MINIMIS_LEAVE_DAYS = 10;
const WORKING_DAYS_PER_YEAR = 261;

export interface FinalPayItem {
  label: string;
  detail: string;
  amount: number;
}

export interface FinalPayCase {
  id: string;
  employeeId: string;
  lastDay: string;
  reason: string;
  openedBy: string;
  openedAt: string;
  /** Set when released: the figures are frozen as they were then. */
  released?: { at: string; by: string; reference: string; items: FinalPayItem[]; total: number };
}

const KEY = "heyhr-final-pay-v1";

function load(): FinalPayCase[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as FinalPayCase[];
  } catch {
    // Blocked or corrupt storage: start empty.
  }
  return [];
}
function save(next: FinalPayCase[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not kept after a reload.
  }
}

const person = (id: string) => core.employees.find((e) => e.id === id);

/** The computation, item by item. */
export async function computeFinalPay(employeeId: string, lastDay: string): Promise<{ items: FinalPayItem[]; total: number; notes: string[] }> {
  const e = person(employeeId);
  if (!e) throw new Error("That employee no longer exists");
  const salary = e.job.monthlySalary;
  const daily = (salary * 12) / WORKING_DAYS_PER_YEAR;
  const year = Number(lastDay.slice(0, 4));
  const cutoff = cutoffsOf(year).find((c) => c.from <= lastDay && c.to >= lastDay)!;
  const notes: string[] = [];
  const items: FinalPayItem[] = [];

  // 1. Pay for the last cutoff, up to the last day, unless a payroll run already paid it.
  const paidRun = approvedRuns().find((r) => r.from === cutoff.from && r.lines.some((l) => l.person.id === employeeId));
  let lastGross = 0;
  let lastContributions = 0;
  let lastBasic = 0;
  if (paidRun) {
    notes.push(`The last cutoff (${paidRun.label}) was already paid in its payroll run.`);
  } else {
    const period: Period = { id: cutoff.from, label: "Final pay", from: cutoff.from, to: lastDay };
    const line = (await payroll(period, "All offices")).find((l) => l.person.id === employeeId);
    if (line) {
      lastGross = line.gross;
      lastContributions = round2(line.sssEe + line.phEe + line.piEe);
      lastBasic = line.basic - line.deductions;
      items.push({ label: "Salary for the last cutoff", detail: `${cutoff.from} to ${lastDay}, from attendance`, amount: lastGross });
      items.push({ label: "SSS, PhilHealth and Pag-IBIG", detail: "Employee share for that cutoff", amount: -lastContributions });
    }
  }

  // 2. Unused leave credits, converted at the daily rate.
  const leaveDays = creditsFor(employeeId, lastDay).available;
  const leavePay = round2(leaveDays * daily);
  if (leavePay > 0) items.push({ label: "Unused leave converted to cash", detail: `${leaveDays} ${leaveDays === 1 ? "day" : "days"} × ${money(daily)} daily rate`, amount: leavePay });
  const leaveTaxable = round2(Math.max(0, leaveDays - DE_MINIMIS_LEAVE_DAYS) * daily);

  // 3. 13th month for the part of the year worked (1/12 of basic pay earned).
  const before = yearToDate(employeeId, year, new Date(Date.parse(`${cutoff.from}T12:00:00`) - 86_400_000).toISOString().slice(0, 10));
  const thirteenth = round2((before.basic + lastBasic) / 12);
  if (thirteenth > 0) items.push({ label: "13th month pay (prorated)", detail: `1/12 of ${money(before.basic + lastBasic)} basic pay earned in ${year}`, amount: thirteenth });
  if (before.estimated) notes.push(`${before.estimated} earlier ${before.estimated === 1 ? "cutoff has" : "cutoffs have"} no approved payroll run; their pay and tax are estimated from the salary on file.`);

  // 4. Approved reimbursements not paid out yet.
  for (const c of claims.filter((x) => x.employeeId === employeeId && x.status === "approved" && !x.paidAt)) {
    items.push({ label: `Reimbursement: ${claimType(c)}`, detail: `${c.merchant} · ${c.purchaseDate}`, amount: c.amount });
  }

  // 5. Loan balances, deducted in full.
  for (const l of outstandingLoans(employeeId)) items.push({ label: `${l.kind} balance`, detail: l.reference, amount: -l.balance });

  // 6. The year's tax: what's due on the whole year's taxable pay, less what was withheld.
  const thirteenthTaxable = Math.max(0, thirteenth - THIRTEENTH_MONTH_EXEMPT);
  const taxable = round2(Math.max(0, before.gross - before.contributions + lastGross - lastContributions + leaveTaxable + thirteenthTaxable));
  const due = annualTax(taxable, lastDay);
  const adjustment = round2(before.withheld - due);
  if (adjustment !== 0) items.push({ label: adjustment > 0 ? "Tax refund" : "Tax still due", detail: `${money(before.withheld)} withheld this year, ${money(due)} due on ${money(taxable)} taxable pay`, amount: adjustment });

  const total = round2(items.reduce((n, i) => n + i.amount, 0));
  if (total < 0) notes.push("The deductions are more than what's owed: the employee owes the difference.");
  return { items, total, notes };
}

export interface FinalPayRow {
  employeeId: string;
  name: string;
  position: string;
  salary: number;
  lastDay: string;
  reason: string;
  caseId?: string;
  released?: FinalPayCase["released"];
}

/** Open and released cases, plus anyone HR has marked separated this year without a case yet. */
export function listFinalPay(): Promise<FinalPayRow[]> {
  const denied = deny("payrollRuns", "view");
  if (denied) return denied;
  const cases = load();
  const year = String(new Date().getFullYear());
  const rows: FinalPayRow[] = cases.map((c) => {
    const e = person(c.employeeId);
    return { employeeId: c.employeeId, name: e ? fullName(e.personal) : c.employeeId, position: core.positions.find((p) => p.id === e?.job.positionId)?.title ?? "", salary: e?.job.monthlySalary ?? 0, lastDay: c.lastDay, reason: c.reason, caseId: c.id, released: c.released };
  });
  for (const e of core.employees) {
    if (e.job.status !== "Separated" || !(e.job.separationDate ?? "").startsWith(year) || cases.some((c) => c.employeeId === e.id)) continue;
    rows.push({ employeeId: e.id, name: fullName(e.personal), position: core.positions.find((p) => p.id === e.job.positionId)?.title ?? "", salary: e.job.monthlySalary, lastDay: e.job.separationDate!, reason: "Separated" });
  }
  return respond(rows.sort((a, b) => Number(!!a.released) - Number(!!b.released) || b.lastDay.localeCompare(a.lastDay)));
}

export async function openFinalPay(input: { employeeId: string; lastDay: string; reason: string }, actor: string): Promise<FinalPayCase> {
  const denied = deny("payrollRuns", "create");
  if (denied) return denied;
  const e = person(input.employeeId);
  if (!e) return fail("Choose the employee who is leaving");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.lastDay)) return fail("Enter their last day");
  if (input.lastDay < e.job.dateHired) return fail("The last day can't be before they were hired");
  if (!input.reason) return fail("Choose why they're leaving");
  const cases = load();
  if (cases.some((c) => c.employeeId === input.employeeId)) return fail(`${fullName(e.personal)} already has a final pay case`);
  const c: FinalPayCase = { id: newId("fp"), employeeId: input.employeeId, lastDay: input.lastDay, reason: input.reason, openedBy: actor, openedAt: new Date().toISOString() };
  save([c, ...cases]);
  logAdmin({ actor, module: "Payroll", action: "Opened final pay", target: fullName(e.personal), detail: `Last day ${input.lastDay} · ${input.reason}` });
  return respond(c);
}

export async function removeFinalPay(caseId: string): Promise<void> {
  const denied = deny("payrollRuns", "delete");
  if (denied) return denied;
  const cases = load();
  const c = cases.find((x) => x.id === caseId);
  if (!c) return fail("That case no longer exists");
  if (c.released) return fail("Released final pay stays on record");
  save(cases.filter((x) => x.id !== caseId));
  return respond(undefined);
}

/** Locks the figures, closes the loans and marks the reimbursements paid. */
export async function releaseFinalPay(row: Pick<FinalPayRow, "employeeId" | "lastDay" | "reason" | "caseId">, reference: string, actor: string): Promise<FinalPayCase> {
  const denied = deny("payrollRuns", "final");
  if (denied) return denied;
  if (!reference.trim()) return fail("Enter the check or transfer reference");
  const e = person(row.employeeId);
  if (!e) return fail("That employee no longer exists");
  const cases = load();
  const existing = cases.find((c) => c.id === row.caseId || c.employeeId === row.employeeId);
  if (existing?.released) return fail("This final pay was already released");
  const { items, total } = await computeFinalPay(row.employeeId, row.lastDay);
  const now = new Date().toISOString();
  const c: FinalPayCase = { ...(existing ?? { id: newId("fp"), employeeId: row.employeeId, lastDay: row.lastDay, reason: row.reason, openedBy: actor, openedAt: now }), released: { at: now, by: actor, reference: reference.trim(), items, total } };
  save(existing ? cases.map((x) => (x.id === c.id ? c : x)) : [c, ...cases]);
  settleLoans(row.employeeId, actor);
  saveClaims(claims.map((x) => (x.employeeId === row.employeeId && x.status === "approved" && !x.paidAt ? { ...x, paidAt: now, paidBy: actor, payoutMethod: "final pay" as const, payoutRef: "Final pay" } : x)));
  logAdmin({ actor, module: "Payroll", action: "Released final pay", target: fullName(e.personal), detail: `${money(total)} · ${reference.trim()}` });
  return respond(c);
}

/** Current employees, for opening a case. */
export function finalPayPeople() {
  return core.employees
    .filter((e) => e.job.status !== "Separated")
    .map((e) => ({ id: e.id, name: fullName(e.personal) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
