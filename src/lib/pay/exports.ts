// Files Accounting takes out of an approved payroll run: the bank transfer list (take-home pay
// per account) and the journal entry for their accounting software.

import { state as core } from "../corehr/store";
import { round2 } from "../reports/statutory";
import { deny } from "../session";
import { allLoans } from "./loanStore";
import { approvedRuns, type PayrollRun } from "./runs";

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
export function listPayoutRuns(): Promise<RunSummary[]> {
  const denied = deny("payrollRuns", "view");
  if (denied) return denied;
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
    if (kind.startsWith("SSS")) return "SSS loans payable";
    if (kind.startsWith("Pag-IBIG")) return "Pag-IBIG loans payable";
    if (kind === "Cash advance" || kind === "Company loan") return "Advances to employees";
    return "Other payroll deductions";
  }
  return amount > 0 ? "Allowances (non-taxable)" : "Other payroll deductions";
}

export function journalEntry(run: PayrollRun): JournalLine[] {
  const sum = (f: (l: PayrollRun["lines"][number]) => number) => round2(run.lines.reduce((n, l) => n + f(l), 0));
  const debits = new Map<string, number>();
  const credits = new Map<string, number>();
  const add = (map: Map<string, number>, k: string, v: number) => v && map.set(k, round2((map.get(k) ?? 0) + v));

  add(debits, "Salaries and wages expense", sum((l) => l.gross));
  add(debits, "SSS and EC contributions expense (employer)", sum((l) => l.sssEr + l.ec));
  add(debits, "PhilHealth contributions expense (employer)", sum((l) => l.phEr));
  add(debits, "Pag-IBIG contributions expense (employer)", sum((l) => l.piEr));
  // Non-taxable items (added after tax): reimbursements and allowances in, loans and deductions out.
  for (const l of run.lines) {
    const id = l.person.id;
    for (const a of [...(run.auto?.[id] ?? []), ...(run.adjustments[id] ?? [])]) {
      if (a.taxable) continue;
      add(a.amount > 0 ? debits : credits, accountFor(a.id, a.amount, a.label), Math.abs(a.amount));
    }
  }
  add(credits, "SSS contributions payable", sum((l) => l.sssEe + l.sssEr + l.ec));
  add(credits, "PhilHealth contributions payable", sum((l) => l.phEe + l.phEr));
  add(credits, "Pag-IBIG contributions payable", sum((l) => l.piEe + l.piEr));
  add(credits, "Withholding tax payable (BIR 1601-C)", sum((l) => l.tax));
  add(credits, "Cash in bank (take-home pay)", sum((l) => l.net));

  const memo = `Payroll ${run.label}`;
  return [...[...debits].map(([account, v]) => ({ account, debit: v, credit: 0, memo })), ...[...credits].map(([account, v]) => ({ account, debit: 0, credit: v, memo }))];
}

export function journalFor(runId: string): Promise<JournalLine[]> {
  const denied = deny("payrollRuns", "view");
  if (denied) return denied;
  const run = approvedRuns().find((r) => r.id === runId);
  return respond(run ? journalEntry(run) : []);
}
