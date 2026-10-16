// Files Accounting takes out of an approved payroll run: the bank transfer list (take-home pay
// per account) and the journal entry for their accounting software.

import { state as core } from "../corehr/store";
import { round2 } from "../reports/statutory";
import { deny } from "../session";
import { allLoans } from "./loanStore";
import { approvedRuns, loadRunsFromServer, type PayrollRun } from "./runs";

const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), 200));

export interface RunSummary {
  id: string;
  label: string;
  from: string;
  to: string;
  approvedAt?: string;
  people: number;
  net: number;
}

/** Approved runs, newest first. */
export async function listPayoutRuns(): Promise<RunSummary[]> {
  const denied = deny("payrollRuns", "view");
  if (denied) return denied;
  // Opened straight from the menu, nothing has loaded the runs from the server yet.
  await loadRunsFromServer();
  return respond(
    approvedRuns()
      .reverse()
      .map((r) => ({ id: r.id, label: r.label, from: r.from, to: r.to, approvedAt: r.approvedAt, people: r.lines.length, net: round2(r.lines.reduce((n, l) => n + l.net, 0)) })),
  );
}

// ---- Bank transfer ----

export interface BankLine {
  employeeId: string;
  name: string;
  bank: string;
  accountName: string;
  accountNumber: string;
  amount: number;
}

export function bankFile(runId: string): Promise<BankLine[]> {
  const denied = deny("payrollRuns", "view");
  if (denied) return denied;
  const run = approvedRuns().find((r) => r.id === runId);
  if (!run) return respond([]);
  return respond(
    run.lines
      .filter((l) => l.net > 0)
      .map((l) => {
        const b = core.employees.find((e) => e.id === l.person.id)?.bank;
        return { employeeId: l.person.id, name: l.person.name, bank: b?.bank ?? "", accountName: b?.accountName ?? "", accountNumber: b?.accountNumber ?? "", amount: l.net };
      })
      .sort((a, b) => a.bank.localeCompare(b.bank) || a.name.localeCompare(b.name)),
  );
}

// ---- Journal entry ----

export interface JournalLine {
  account: string;
  debit: number;
  credit: number;
  memo: string;
}

/** Where a non-taxable adjustment goes: reimbursements and allowances are expenses; loans are payables or advances. */
function accountFor(adjId: string, amount: number, label: string) {
  if (adjId.startsWith("claim-")) return "Reimbursable expenses";
  if (adjId.startsWith("loan-")) {
    const kind = allLoans().find((l) => `loan-${l.id}` === adjId)?.kind ?? label;
    if (kind.startsWith("SSS")) return "21302 SSS Loans Payable";
    if (kind.startsWith("Pag-IBIG")) return "21301 Pag-ibig Loans Payable";
    if (kind === "Cash advance" || kind === "Company loan") return "14500 Advances to employees";
    return "Other payroll deductions";
  }
  return amount > 0 ? "Allowances (non-taxable)" : "Other payroll deductions";
}

type Line = PayrollRun["lines"][number];

/** The journal entry for a run, or for one department's share of it (the workbook's entry by class).
 * Account codes and names are the workbook's (FT_MSMA / Summary); the employer's contributions,
 * which the workbook leaves out, are kept on their own lines without a code. */
export function journalEntry(run: PayrollRun, only?: (l: Line) => boolean): JournalLine[] {
  const lines = only ? run.lines.filter(only) : run.lines;
  const sum = (f: (l: Line) => number) => round2(lines.reduce((n, l) => n + f(l), 0));
  const debits = new Map<string, number>();
  const credits = new Map<string, number>();
  const add = (map: Map<string, number>, k: string, v: number) => v && map.set(k, round2((map.get(k) ?? 0) + v));

  add(debits, "51001 Salaries", sum((l) => l.gross - (l.pay.otMeal ?? 0) - (l.pay.clientCharge ?? 0)));
  add(debits, "14002 Advances - Sphinx", sum((l) => l.pay.clientCharge ?? 0));
  add(debits, "51402 Meals", sum((l) => l.pay.otMeal ?? 0));
  add(debits, "51301 Fuel and gas (transportation allowance)", sum((l) => l.pay.transportAllowance ?? 0));
  add(debits, "SSS and EC contributions expense (employer)", sum((l) => l.sssEr + l.ec));
  add(debits, "PhilHealth contributions expense (employer)", sum((l) => l.phEr));
  add(debits, "Pag-IBIG contributions expense (employer)", sum((l) => l.piEr));
  // Non-taxable items (added after tax): reimbursements and allowances in, loans and deductions out.
  for (const l of lines) {
    const id = l.person.id;
    for (const a of [...(run.auto?.[id] ?? []), ...(run.adjustments[id] ?? [])]) {
      if (a.taxable) continue;
      add(a.amount > 0 ? debits : credits, accountFor(a.id, a.amount, a.label), Math.abs(a.amount));
    }
  }
  add(credits, "21401 WHT Payable - Compensation", sum((l) => l.tax));
  add(credits, "21202 Phil Premiums Payable", sum((l) => l.phEe));
  add(credits, "21201 Pag-ibig Premiums Payable", sum((l) => l.piEe));
  add(credits, "21203 SSS Premiums Payable", sum((l) => l.sssEe));
  add(credits, "SSS and EC payable (employer share)", sum((l) => l.sssEr + l.ec));
  add(credits, "PhilHealth payable (employer share)", sum((l) => l.phEr));
  add(credits, "Pag-IBIG payable (employer share)", sum((l) => l.piEr));
  add(credits, "11000 Cash and cash equivalents (take-home pay)", sum((l) => l.net));

  const memo = `Payroll ${run.label}`;
  return [...[...debits].map(([account, v]) => ({ account, debit: v, credit: 0, memo })), ...[...credits].map(([account, v]) => ({ account, debit: 0, credit: v, memo }))];
}

/** The run's journal split by department: one column per department, the same accounts down the side. */
export interface DepartmentJournal {
  departments: string[];
  rows: { account: string; side: "debit" | "credit"; amounts: Record<string, number>; total: number }[];
}

export function journalByDepartment(run: PayrollRun): DepartmentJournal {
  const departments = [...new Set(run.lines.map((l) => l.person.department || "No department"))].sort();
  const per = Object.fromEntries(departments.map((d) => [d, journalEntry(run, (l) => (l.person.department || "No department") === d)]));
  const whole = journalEntry(run);
  return {
    departments,
    rows: whole.map((w) => {
      const side = w.debit ? ("debit" as const) : ("credit" as const);
      const amounts = Object.fromEntries(departments.map((d) => [d, per[d]!.find((x) => x.account === w.account)?.[side] ?? 0]));
      return { account: w.account, side, amounts, total: w.debit || w.credit };
    }),
  };
}

export function journalByDepartmentFor(runId: string): Promise<DepartmentJournal> {
  const denied = deny("payrollRuns", "view");
  if (denied) return denied;
  const run = approvedRuns().find((r) => r.id === runId);
  return respond(run ? journalByDepartment(run) : { departments: [], rows: [] });
}

export function journalFor(runId: string): Promise<JournalLine[]> {
  const denied = deny("payrollRuns", "view");
  if (denied) return denied;
  const run = approvedRuns().find((r) => r.id === runId);
  return respond(run ? journalEntry(run) : []);
}
