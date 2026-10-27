// Payroll → Loans & deductions: SSS and Pag-IBIG loans, cash advances and company loans,
// deducted from every payroll run (see runs.ts) until paid. Accounting manages them.

import { logAdmin } from "../admin/store";
import { fullName, newId, state as core } from "../corehr/store";
import { remoteApi, remoteOn } from "../remote";
import { backendOn } from "../backend/client";
import { backendPayrollPeople } from "../backend/payroll";
import { deny } from "../session";
import { tellEmployees } from "../requestNotices";
import { allLoans, LOAN_KINDS, refreshLoans, saveLoans, type Loan, type LoanKind } from "./loanStore";
import { loanPaid } from "./runs";

const DELAY = 200;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface LoanRow extends Loan {
  employeeName: string;
  paid: number;
  balance: number;
  /** Cutoffs still to go at the current installment. */
  cutoffsLeft: number;
}

/** On the backend: the people loans can be for (loaded with the loans), since the in-browser records are demo data. */
let backendPeople: { id: string; name: string; status: string }[] = [];
async function refreshPeople() {
  if (backendOn()) backendPeople = (await backendPayrollPeople()).map((p) => ({ id: p.id, name: p.name, status: p.status }));
}
function personOf(id: string) {
  if (backendOn()) return backendPeople.find((p) => p.id === id);
  const e = core.employees.find((x) => x.id === id);
  return e ? { id: e.id, name: fullName(e.personal), status: e.job.status } : undefined;
}

function toRow(l: Loan): LoanRow {
  const e = personOf(l.employeeId);
  const paid = round2(loanPaid(l.id));
  const balance = l.status === "active" ? round2(Math.max(0, l.principal - paid)) : 0;
  return { ...l, employeeName: e ? e.name : l.employeeId, paid, balance, cutoffsLeft: balance > 0 ? Math.ceil(balance / l.installment) : 0 };
}

export function listLoans(): Promise<LoanRow[]> {
  const denied = deny("payrollRuns", "view");
  if (denied) return denied;
  return (remoteOn() ? Promise.all([refreshLoans(), refreshPeople()]) : Promise.resolve()).then(() => respond(
    allLoans()
      .map(toRow)
      // Running ones first, then by name.
      .sort((a, b) => Number(b.balance > 0) - Number(a.balance > 0) || a.employeeName.localeCompare(b.employeeName)),
  ));
}

/** What someone still owes on loans that are running, for final pay. */
export function outstandingLoans(employeeId: string): LoanRow[] {
  return allLoans()
    .filter((l) => l.employeeId === employeeId && l.status === "active")
    .map(toRow)
    .filter((l) => l.balance > 0);
}

export interface LoanInput {
  id?: string;
  employeeId: string;
  kind: LoanKind | "";
  reference: string;
  principal: number;
  installment: number;
  startDate: string;
  note: string;
}

export async function saveLoan(input: LoanInput, actor: string): Promise<Loan> {
  const denied = deny("payrollRuns", input.id ? "edit" : "create");
  if (denied) return denied;
  const e = personOf(input.employeeId);
  if (!e || e.status === "Separated") return fail("Choose a current employee");
  if (!input.kind || !LOAN_KINDS.includes(input.kind)) return fail("Choose the kind of loan or deduction");
  if (!input.reference.trim()) return fail(input.kind === "Other deduction" ? "Say what the deduction is for" : "Enter the loan or reference number");
  if (!(input.principal > 0)) return fail("Enter the total amount to deduct");
  if (!(input.installment > 0)) return fail("Enter how much to deduct each cutoff");
  if (input.installment > input.principal) return fail("The amount per cutoff can't be more than the total");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) return fail("Choose the first cutoff to deduct from");
  const list = allLoans();
  const old = list.find((l) => l.id === input.id);
  if (old && old.status !== "active") return fail("This loan is closed");
  if (old && input.principal < loanPaid(old.id)) return fail(`₱${loanPaid(old.id).toLocaleString("en-PH")} is already paid, so the total can't be less than that`);
  if (remoteOn()) {
    const body = { employeeId: input.employeeId, kind: input.kind, reference: input.reference, principal: input.principal, installment: input.installment, startDate: input.startDate, note: input.note };
    const saved = await remoteApi<Loan & { paid?: number }>(old ? "PUT" : "POST", old ? `/payroll/loans/${encodeURIComponent(old.id)}` : "/payroll/loans", body);
    await refreshLoans();
    const { paid: _paid, ...loan } = saved;
    void _paid;
    return loan;
  }
  const loan: Loan = {
    ...(old ?? { id: newId("ln"), status: "active" as const, createdBy: actor, createdAt: new Date().toISOString() }),
    employeeId: input.employeeId,
    kind: input.kind,
    reference: input.reference.trim(),
    principal: round2(input.principal),
    installment: round2(input.installment),
    startDate: input.startDate,
    note: input.note.trim() || undefined,
  };
  saveLoans(old ? list.map((l) => (l.id === loan.id ? loan : l)) : [loan, ...list]);
  tellEmployees(loan.employeeId, "loan", "update", old ? `Your ${loan.kind} deduction changed` : `New ${loan.kind} deduction`, `₱${loan.installment.toLocaleString("en-PH")} per cutoff from ${loan.startDate}, ₱${loan.principal.toLocaleString("en-PH")} in all (${loan.reference}).`);
  logAdmin({ actor, module: "Payroll", action: old ? "Changed loan" : "Added loan", target: e.name, detail: `${loan.kind} ${loan.reference}: ₱${loan.principal.toLocaleString("en-PH")}, ₱${loan.installment.toLocaleString("en-PH")} per cutoff from ${loan.startDate}` });
  return respond(loan);
}

/** Stops deductions, e.g. when the balance was paid outside payroll. */
export async function stopLoan(id: string, reason: string, actor: string): Promise<void> {
  const denied = deny("payrollRuns", "edit");
  if (denied) return denied;
  const list = allLoans();
  const l = list.find((x) => x.id === id);
  if (!l) return fail("That loan no longer exists");
  if (l.status !== "active") return fail("This loan is already closed");
  if (!reason.trim()) return fail("Say why the deductions stop");
  if (remoteOn()) {
    await remoteApi("POST", `/payroll/loans/${encodeURIComponent(id)}/stop`, { reason: reason.trim() });
    await refreshLoans();
    return;
  }
  const now = new Date().toISOString();
  saveLoans(list.map((x) => (x.id === id ? { ...x, status: "stopped" as const, closedBy: actor, closedAt: now, note: reason.trim() } : x)));
  const e = core.employees.find((x) => x.id === l.employeeId);
  tellEmployees(l.employeeId, "loan", "update", `Your ${l.kind} deductions stopped`, `${l.reference}: “${reason.trim()}”`);
  logAdmin({ actor, module: "Payroll", action: "Stopped loan deductions", target: e ? fullName(e.personal) : l.employeeId, detail: `${l.kind} ${l.reference}: ${reason.trim()}` });
  return respond(undefined);
}

/** Final pay closes what's left of someone's loans (the balance is deducted there). */
export function settleLoans(employeeId: string, actor: string) {
  // With the API server, releasing final pay settles them there.
  if (remoteOn()) return;
  const now = new Date().toISOString();
  saveLoans(allLoans().map((l) => (l.employeeId === employeeId && l.status === "active" ? { ...l, status: "settled" as const, closedBy: actor, closedAt: now, note: "Balance deducted from final pay" } : l)));
}

/** Current employees, for choosing who a loan is for. */
export function loanPeople() {
  if (backendOn()) return backendPeople.filter((p) => p.status !== "Separated").map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name));
  return core.employees
    .filter((e) => e.job.status !== "Separated")
    .map((e) => ({ id: e.id, name: fullName(e.personal) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
