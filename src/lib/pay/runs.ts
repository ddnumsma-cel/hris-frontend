// Payroll runs: one per cutoff. A draft is recomputed from attendance until the
// CEO approves it; then its numbers are locked and payslips are released from it.
// Corrections after that go into a later run as adjustments. Saved to localStorage.

import { logAdmin } from "../admin/store";
import { newId } from "../corehr/store";
import { payroll, periodsFor, type PayLine, type Period } from "../reports/api";
import { tk, todayIso } from "../timekeeping/store";
import type { Adjustment } from "./engine";

export interface PayrollRun {
  id: string;
  label: string;
  from: string;
  to: string;
  status: "draft" | "approved";
  lines: PayLine[];
  /** Per employee. */
  adjustments: Record<string, Adjustment[]>;
  createdBy: string;
  createdAt: string;
  computedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

const KEY = "heyhr-payroll-runs-v1";
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
const sync = () => (runs = load());

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

async function compute(run: Pick<PayrollRun, "label" | "from" | "to" | "adjustments">) {
  const period: Period = { id: run.from, label: run.label, from: run.from, to: run.to };
  return payroll(period, "All offices", (id) => run.adjustments[id] ?? []);
}

export function listRuns() {
  sync();
  return respond([...runs].sort((a, b) => b.from.localeCompare(a.from)));
}

export function getRun(id: string) {
  const r = find(id);
  return r ? respond(r) : fail("That payroll run no longer exists");
}

/** Cutoffs a new run can be made for: the recent ones without a run yet. */
export function openCutoffs(): Promise<Period[]> {
  sync();
  return respond(periodsFor("cutoff").filter((p) => !runs.some((r) => r.from === p.from && r.to === p.to)));
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
  sync();
  if (runs.some((r) => r.from === period.from && r.to === period.to)) return fail("There's already a payroll run for this cutoff");
  const now = new Date().toISOString();
  const draft = { label: period.label, from: period.from, to: period.to, adjustments: {} };
  const run: PayrollRun = { id: newId("pr"), ...draft, status: "draft", lines: await compute(draft), createdBy: actor, createdAt: now, computedAt: now };
  save([run, ...runs]);
  logAdmin({ actor, module: "Payroll", action: "Started payroll run", target: run.label, detail: `${run.lines.length} employees` });
  return respond(run);
}

/** Recomputes a draft from the latest attendance. */
export async function refreshRun(id: string): Promise<PayrollRun> {
  const r = find(id);
  if (!r) return fail("That payroll run no longer exists");
  if (r.status !== "draft") return fail("This run is approved and locked");
  const next = { ...r, lines: await compute(r), computedAt: new Date().toISOString() };
  replace(next);
  return respond(next);
}

export async function addAdjustment(id: string, employeeId: string, input: Omit<Adjustment, "id">, actor: string): Promise<PayrollRun> {
  const r = find(id);
  if (!r) return fail("That payroll run no longer exists");
  if (r.status !== "draft") return fail("This run is approved and locked. Add the correction to the next run.");
  if (!input.label.trim()) return fail("Name the adjustment, for example \"Rice allowance\" or \"Salary loan\"");
  if (!Number.isFinite(input.amount) || input.amount === 0) return fail("Enter an amount: positive adds to pay, negative takes away");
  if (!input.reason.trim()) return fail("Give the reason");
  const adj: Adjustment = { id: newId("adj"), label: input.label.trim(), amount: Math.round(input.amount * 100) / 100, taxable: input.taxable, reason: input.reason.trim() };
  const adjustments = { ...r.adjustments, [employeeId]: [...(r.adjustments[employeeId] ?? []), adj] };
  const next = { ...r, adjustments, lines: await compute({ ...r, adjustments }), computedAt: new Date().toISOString() };
  replace(next);
  const name = next.lines.find((l) => l.person.id === employeeId)?.person.name ?? employeeId;
  logAdmin({ actor, module: "Payroll", action: "Added pay adjustment", target: name, detail: `${r.label}: ${adj.label} ₱${adj.amount.toLocaleString("en-PH")} (${adj.taxable ? "taxable" : "non-taxable"}) · ${adj.reason}` });
  return respond(next);
}

export async function removeAdjustment(id: string, employeeId: string, adjustmentId: string): Promise<PayrollRun> {
  const r = find(id);
  if (!r) return fail("That payroll run no longer exists");
  if (r.status !== "draft") return fail("This run is approved and locked");
  const adjustments = { ...r.adjustments, [employeeId]: (r.adjustments[employeeId] ?? []).filter((a) => a.id !== adjustmentId) };
  const next = { ...r, adjustments, lines: await compute({ ...r, adjustments }), computedAt: new Date().toISOString() };
  replace(next);
  return respond(next);
}

/** Locks the run with the numbers as they are now, and releases the payslips. */
export async function approveRun(id: string, actor: string): Promise<PayrollRun> {
  const r = find(id);
  if (!r) return fail("That payroll run no longer exists");
  if (r.status !== "draft") return fail("This run is already approved");
  // Approve exactly what is computed now, not a stale preview.
  const lines = await compute(r);
  const now = new Date().toISOString();
  const next: PayrollRun = { ...r, lines, computedAt: now, status: "approved", approvedBy: actor, approvedAt: now };
  replace(next);
  const total = lines.reduce((n, l) => n + l.net, 0);
  logAdmin({ actor, module: "Payroll", action: "Approved payroll run", target: r.label, detail: `${lines.length} employees · take-home ₱${total.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` });
  return respond(next);
}

export async function deleteRun(id: string, actor: string): Promise<void> {
  const r = find(id);
  if (!r) return fail("That payroll run no longer exists");
  if (r.status !== "draft") return fail("Approved runs stay on record");
  save(runs.filter((x) => x.id !== id));
  logAdmin({ actor, module: "Payroll", action: "Deleted draft payroll run", target: r.label, detail: "" });
  return respond(undefined);
}

/** Released pay for one employee: their line from every approved run, newest first. */
export function approvedLinesFor(employeeId: string) {
  sync();
  return runs
    .filter((r) => r.status === "approved")
    .sort((a, b) => b.from.localeCompare(a.from))
    .flatMap((r) => {
      const line = r.lines.find((l) => l.person.id === employeeId);
      return line ? [{ run: r, line }] : [];
    });
}
