// Payroll runs: one per cutoff. A draft is recomputed from attendance until the
// CEO approves it; then its numbers are locked and payslips are released from it.
// Corrections after that go into a later run as adjustments. Saved to localStorage.

import { logAdmin } from "../admin/store";
import { api, serverMode } from "../http";
import { newId } from "../corehr/store";
import { payroll, periodsFor, type PayLine, type Period } from "../reports/api";
import { tk, todayIso } from "../timekeeping/store";
import type { Adjustment } from "./engine";
import { can, canFor, scopeFor } from "../permissions";
import { claims, refreshClaims, saveClaims } from "../reimbursements/store";
import { allLoans, loanAdjustmentId, refreshLoans, serverLoanPaid } from "./loanStore";
import { cutoffOf, recentCutoffs, refreshPaySettings } from "./settings";
import { deny, forbidden, sessionWho } from "../session";
import { notifyEmployee } from "../outbox";
import { tellAssigned, tellEmployees } from "../requestNotices";

export interface PayrollRun {
  id: string;
  label: string;
  from: string;
  to: string;
  status: "draft" | "approved";
  lines: PayLine[];
  /** Per employee: added by hand on the run. */
  adjustments: Record<string, Adjustment[]>;
  /** Per employee: added automatically (loan installments, approved reimbursements). Kept so balances and exports can read them. */
  auto?: Record<string, Adjustment[]>;
  createdBy: string;
  createdAt: string;
  computedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  /** "Reviewed by" on the workbook's Summary sheet. */
  reviewedBy?: string;
  reviewedAt?: string;
}

// v2: cleared with the rest of the sample data.
const KEY = "heyhr-payroll-runs-v2";
const DELAY = 250;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));

function load(): PayrollRun[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as PayrollRun[];
  } catch {
    // Blocked or corrupt storage: start empty.
  }
  return [];
}

let runs: PayrollRun[] = load();

/** Re-read what is saved, so a run approved in another tab or by another account here is seen right away. */
const sync = () => {
  if (!serverMode) runs = load();
};

// With the API server, pay is still computed here (from the attendance, leave and salary
// already loaded) and the server stores each run, checks its lines and locks it on approval.
async function refreshRuns() {
  runs = await api<PayrollRun[]>("GET", "/payroll/runs");
}

/** With the API server: loads the runs (for final pay and year-end figures, which read approvedRuns). */
export async function loadRunsFromServer() {
  if (serverMode) await refreshRuns();
}
/** The computed pay the server stores: the lines, and the loan installments and reimbursements they include. */
const computed = (c: { lines: PayLine[]; auto: Record<string, Adjustment[]> }) => ({ lines: c.lines, auto: c.auto });

function save(next: PayrollRun[]) {
  runs = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not kept across reloads; fine in the prototype.
  }
}

const find = (id: string) => (sync(), runs.find((r) => r.id === id));
const replace = (run: PayrollRun) => save(runs.map((r) => (r.id === run.id ? run : r)));

/** What approved runs (other than this one) have already taken for a loan. */
export function loanPaid(loanId: string, exceptRunId?: string) {
  // With the API server, the database adds up the approved runs (as of the last refreshLoans).
  if (serverMode) return serverLoanPaid(loanId);
  sync();
  const id = loanAdjustmentId(loanId);
  return runs
    .filter((r) => r.status === "approved" && r.id !== exceptRunId)
    .flatMap((r) => Object.values(r.auto ?? {}).flat())
    .filter((a) => a.id === id)
    .reduce((n, a) => n + Math.abs(a.amount), 0);
}

/** Every approved run, oldest first (for year-end forms, exports and final pay). */
export function approvedRuns(): PayrollRun[] {
  sync();
  return runs.filter((r) => r.status === "approved").sort((a, b) => a.from.localeCompare(b.from));
}

/** Loan installments due this cutoff and approved reimbursements not paid out yet, per employee. */
function autoAdjustments(run: { id?: string; from: string; to: string }): Record<string, Adjustment[]> {
  const out: Record<string, Adjustment[]> = {};
  const add = (employeeId: string, a: Adjustment) => (out[employeeId] = [...(out[employeeId] ?? []), a]);
  const money = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  for (const l of allLoans()) {
    if (l.status !== "active" || l.startDate > run.to) continue;
    const balance = Math.round((l.principal - loanPaid(l.id, run.id)) * 100) / 100;
    if (balance <= 0) continue;
    const amount = Math.min(l.installment, balance);
    add(l.employeeId, { id: loanAdjustmentId(l.id), label: l.kind, amount: -amount, taxable: false, reason: `${l.reference} · balance ${money(balance - amount)} after this` });
  }
  // Reimbursements aren't paid through payroll: Accounting releases them directly (lib/reimbursements/api.ts).
  return out;
}

async function compute(run: Pick<PayrollRun, "label" | "from" | "to" | "adjustments"> & { id?: string }) {
  const period: Period = { id: run.from, label: run.label, from: run.from, to: run.to };
  // With the API server, the latest loans and claims first: the server only takes pay worked out with them.
  if (serverMode) await Promise.all([refreshLoans(), refreshClaims()]);
  const auto = autoAdjustments(run);
  const lines = await payroll(period, "All offices", (id) => [...(auto[id] ?? []), ...(run.adjustments[id] ?? [])]);
  // Only people on this run's payroll actually receive their automatic items.
  const onRun = new Set(lines.map((l) => l.person.id));
  return { lines, auto: Object.fromEntries(Object.entries(auto).filter(([id]) => onRun.has(id))) };
}

export async function listRuns() {
  // Whole runs are for those who work on payroll (Accounting, Super Admin); employees get their payslips.
  if (scopeFor(sessionWho(), "view", "payrollRuns") !== "all") return forbidden();
  if (serverMode) await refreshRuns();
  sync();
  return respond([...runs].sort((a, b) => b.from.localeCompare(a.from)));
}

export async function getRun(id: string) {
  if (scopeFor(sessionWho(), "view", "payrollRuns") !== "all") return forbidden();
  if (serverMode) return api<PayrollRun>("GET", `/payroll/runs/${encodeURIComponent(id)}`);
  const r = find(id);
  return r ? respond(r) : fail("That payroll run no longer exists");
}

const overlaps = (a: { from: string; to: string }, b: { from: string; to: string }) => a.from <= b.to && b.from <= a.to;

/** Cutoffs a new run can be made for: the recent ones without a run yet. */
export async function openCutoffs(): Promise<Period[]> {
  const denied = deny("payrollRuns", "create");
  if (denied) return denied;
  if (serverMode) await Promise.all([refreshRuns(), refreshPaySettings(2000)]);
  sync();
  // A cut-off that shares days with an existing run (e.g. one made before the paydays changed) is left out, so no day is paid twice.
  return respond(cutoffChoices().filter((p) => !runs.some((r) => overlaps(r, p))));
}

/** The cut-offs offered for a new run: the three most recent. While testing (npm run dev only, never in a
 *  build), also the next one and the past year's, so a run can still be made once the recent ones have runs. */
function cutoffChoices(): Period[] {
  if (!import.meta.env?.DEV) return periodsFor("cutoff");
  const today = todayIso();
  const current = cutoffOf(today);
  const after = new Date(`${current.to}T12:00:00`);
  after.setDate(after.getDate() + 1);
  return [cutoffOf(after.toISOString().slice(0, 10)), ...recentCutoffs(today, 24)];
}

/** What should be settled before approving: requests still waiting, and a cutoff that hasn't ended. */
export function runWarnings(run: Pick<PayrollRun, "from" | "to">) {
  const inPeriod = (d: string) => d >= run.from && d <= run.to;
  const fixes = tk.fixRequests.filter((r) => r.status === "pending" && inPeriod(r.workDate)).length;
  const time = tk.requests.filter((r) => r.status === "pending" && inPeriod(r.date)).length;
  const out: string[] = [];
  if (run.to >= todayIso()) out.push("This cutoff hasn't ended yet, so the rest of its days aren't counted.");
  if (fixes) out.push(`${fixes} time adjustment ${fixes === 1 ? "request is" : "requests are"} still waiting for approval.`);
  if (time) out.push(`${time} overtime or undertime ${time === 1 ? "request is" : "requests are"} still waiting for approval.`);
  return out;
}

export async function createRun(period: Period, actor: string): Promise<PayrollRun> {
  const denied = deny("payrollRuns", "create");
  if (denied) return denied;
  if (serverMode) {
    const draft = { label: period.label, from: period.from, to: period.to, adjustments: {} };
    return api<PayrollRun>("POST", "/payroll/runs", { ...draft, ...computed(await compute(draft)) });
  }
  sync();
  if (runs.some((r) => r.from === period.from && r.to === period.to)) return fail("There's already a payroll run for this cutoff");
  const clash = runs.find((r) => overlaps(r, period));
  if (clash) return fail(`These dates overlap the ${clash.label} run, so some days would be paid twice`);
  const now = new Date().toISOString();
  const draft = { label: period.label, from: period.from, to: period.to, adjustments: {} };
  const run: PayrollRun = { id: newId("pr"), ...draft, status: "draft", ...(await compute(draft)), createdBy: actor, createdAt: now, computedAt: now };
  save([run, ...runs]);
  logAdmin({ actor, module: "Payroll", action: "Started payroll run", target: run.label, detail: `${run.lines.length} employees` });
  return respond(run);
}

/** Recomputes a draft from the latest attendance. */
export async function refreshRun(id: string): Promise<PayrollRun> {
  const denied = deny("payrollRuns", "edit");
  if (denied) return denied;
  if (serverMode) {
    const r = await getRun(id);
    if (r.status !== "draft") return fail("This run is approved and locked");
    return api<PayrollRun>("PUT", `/payroll/runs/${r.id}/lines`, computed(await compute(r)));
  }
  const r = find(id);
  if (!r) return fail("That payroll run no longer exists");
  if (r.status !== "draft") return fail("This run is approved and locked");
  const next = { ...r, ...(await compute(r)), computedAt: new Date().toISOString() };
  replace(next);
  return respond(next);
}

export async function addAdjustment(id: string, employeeId: string, input: Omit<Adjustment, "id">, actor: string): Promise<PayrollRun> {
  const denied = deny("payrollRuns", "edit");
  if (denied) return denied;
  if (serverMode) {
    const r = await getRun(id);
    if (r.status !== "draft") return fail("This run is approved and locked. Add the correction to the next run.");
    const adj: Adjustment = { id: "new", label: input.label.trim(), amount: Math.round(input.amount * 100) / 100, taxable: input.taxable, reason: input.reason.trim() };
    const adjustments = { ...r.adjustments, [employeeId]: [...(r.adjustments[employeeId] ?? []), adj] };
    return api<PayrollRun>("POST", `/payroll/runs/${r.id}/adjustments`, { employeeId, ...input, ...computed(await compute({ ...r, adjustments })) });
  }
  const r = find(id);
  if (!r) return fail("That payroll run no longer exists");
  if (r.status !== "draft") return fail("This run is approved and locked. Add the correction to the next run.");
  if (!input.label.trim()) return fail("Name the adjustment, for example \"Rice allowance\" or \"Salary loan\"");
  if (!Number.isFinite(input.amount) || input.amount === 0) return fail("Enter an amount: positive adds to pay, negative takes away");
  if (!input.reason.trim()) return fail("Give the reason");
  const adj: Adjustment = { id: newId("adj"), label: input.label.trim(), amount: Math.round(input.amount * 100) / 100, taxable: input.taxable, reason: input.reason.trim() };
  const adjustments = { ...r.adjustments, [employeeId]: [...(r.adjustments[employeeId] ?? []), adj] };
  const next = { ...r, adjustments, ...(await compute({ ...r, adjustments })), computedAt: new Date().toISOString() };
  replace(next);
  const name = next.lines.find((l) => l.person.id === employeeId)?.person.name ?? employeeId;
  logAdmin({ actor, module: "Payroll", action: "Added pay adjustment", target: name, detail: `${r.label}: ${adj.label} ₱${adj.amount.toLocaleString("en-PH")} (${adj.taxable ? "taxable" : "non-taxable"}) · ${adj.reason}` });
  return respond(next);
}

export async function removeAdjustment(id: string, employeeId: string, adjustmentId: string): Promise<PayrollRun> {
  const denied = deny("payrollRuns", "edit");
  if (denied) return denied;
  if (serverMode) {
    const r = await getRun(id);
    if (r.status !== "draft") return fail("This run is approved and locked");
    const adjustments = { ...r.adjustments, [employeeId]: (r.adjustments[employeeId] ?? []).filter((a) => a.id !== adjustmentId) };
    return api<PayrollRun>("POST", `/payroll/runs/${r.id}/adjustments/${encodeURIComponent(adjustmentId)}/remove`, computed(await compute({ ...r, adjustments })));
  }
  const r = find(id);
  if (!r) return fail("That payroll run no longer exists");
  if (r.status !== "draft") return fail("This run is approved and locked");
  const adjustments = { ...r.adjustments, [employeeId]: (r.adjustments[employeeId] ?? []).filter((a) => a.id !== adjustmentId) };
  const next = { ...r, adjustments, ...(await compute({ ...r, adjustments })), computedAt: new Date().toISOString() };
  replace(next);
  return respond(next);
}

/** Locks the run with the numbers as they are now, and releases the payslips. */
export async function approveRun(id: string, actor: string): Promise<PayrollRun> {
  // The final approval locks the run and releases payslips (Accounting, Super Admin).
  const denied = deny("payrollRuns", "final");
  if (denied) return denied;
  if (serverMode) {
    const r = await getRun(id);
    if (r.status !== "draft") return fail("This run is already approved");
    // Approve exactly what is computed now, not a stale preview.
    const approved = await api<PayrollRun>("POST", `/payroll/runs/${r.id}/approve`, computed(await compute(r)));
    // The reimbursements it paid are now marked paid on the server.
    await refreshClaims();
    return approved;
  }
  const r = find(id);
  if (!r) return fail("That payroll run no longer exists");
  if (r.status !== "draft") return fail("This run is already approved");
  // Approve exactly what is computed now, not a stale preview.
  const { lines, auto } = await compute(r);
  const now = new Date().toISOString();
  const next: PayrollRun = { ...r, lines, auto, computedAt: now, status: "approved", approvedBy: actor, approvedAt: now };
  replace(next);
  // Reimbursements in this run are now paid, with this payroll.
  const paid = new Set(Object.values(auto).flat().filter((a) => a.id.startsWith("claim-")).map((a) => a.id.slice("claim-".length)));
  for (const l of lines) notifyEmployee(l.person.id, "payslip", `Your payslip for ${r.label} is ready`, `Your payslip for ${r.label} is released. Take-home pay: ₱${l.net.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. See it on heyhr under Payslips.`, `heyhr: your payslip for ${r.label} is ready.`);
  tellEmployees(lines.map((l) => l.person.id), "payslip", "update", `Your payslip for ${r.label} is ready`, "Open Payslips to see your take-home pay and deductions.");
  tellAssigned("final", "payrollRuns", "payslip", "approved", `Payroll for ${r.label} was approved`, `${actor} approved it and released ${lines.length} payslips.`);
  if (paid.size) saveClaims(claims.map((c) => (paid.has(c.id) ? { ...c, paidAt: now, paidBy: actor, payoutMethod: "payroll" as const, payoutRef: r.label } : c)));
  const total = lines.reduce((n, l) => n + l.net, 0);
  logAdmin({ actor, module: "Payroll", action: "Approved payroll run", target: r.label, detail: `${lines.length} employees · take-home ₱${total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` });
  return respond(next);
}

/** Signs off a draft as reviewed (Summary sheet "Reviewed by"): whoever prepares or approves payroll. */
export async function reviewRun(id: string, actor: string): Promise<PayrollRun> {
  const who = sessionWho();
  if (!can(who, "final", "payrollRuns") && !can(who, "edit", "payrollRuns")) return forbidden();
  if (serverMode) return api<PayrollRun>("POST", `/payroll/runs/${encodeURIComponent(id)}/review`);
  const r = find(id);
  if (!r) return fail("That payroll run no longer exists");
  if (r.status !== "draft") return fail("This run is already approved");
  if (r.reviewedBy) return fail(`Already reviewed by ${r.reviewedBy}`);
  const next: PayrollRun = { ...r, reviewedBy: actor, reviewedAt: new Date().toISOString() };
  replace(next);
  logAdmin({ actor, module: "Payroll", action: "Reviewed payroll run", target: r.label, detail: "" });
  return respond(next);
}

export async function deleteRun(id: string, actor: string): Promise<void> {
  const denied = deny("payrollRuns", "delete");
  if (denied) return denied;
  if (serverMode) return void (await api("DELETE", `/payroll/runs/${encodeURIComponent(id)}`));
  const r = find(id);
  if (!r) return fail("That payroll run no longer exists");
  if (r.status !== "draft") return fail("Approved runs stay on record");
  save(runs.filter((x) => x.id !== id));
  logAdmin({ actor, module: "Payroll", action: "Deleted draft payroll run", target: r.label, detail: "" });
  return respond(undefined);
}

/** Released pay for one employee: their line from every approved run, newest first. */
export function approvedLinesFor(employeeId: string) {
  // Payslips: their own (or anyone's, for those who see every run).
  if (!canFor(sessionWho(), "view", "payrollRuns", employeeId)) return [];
  sync();
  return runs
    .filter((r) => r.status === "approved")
    .sort((a, b) => b.from.localeCompare(a.from))
    .flatMap((r) => {
      const line = r.lines.find((l) => l.person.id === employeeId);
      return line ? [{ run: r, line }] : [];
    });
}
