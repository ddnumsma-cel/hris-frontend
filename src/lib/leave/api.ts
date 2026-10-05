// Leave mock API. Each call stands in for an HTTP request.

import { fullName, initialsOf, newId, state as core } from "../corehr/store";
import { HOLIDAYS } from "../holidays";
import { addDays, balanceFor, countDays, isoToday, leave, saveLeave } from "./store";
import type { Balance, LeaveRequest, LeaveType } from "./types";

const DELAY = 250;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));

export interface LeavePerson {
  id: string;
  name: string;
  initials: string;
  departmentName: string;
  branch: string;
}

function unitUp(unitId: string, type: string) {
  let u = core.units.find((x) => x.id === unitId);
  while (u && u.type !== type) u = core.units.find((x) => x.id === u!.parentId);
  return u?.name ?? "";
}

export function people(): LeavePerson[] {
  return core.employees
    .filter((e) => e.job.status !== "Separated")
    .map((e) => ({ id: e.id, name: fullName(e.personal), initials: initialsOf(e.personal), departmentName: unitUp(e.job.unitId, "department"), branch: unitUp(e.job.unitId, "branch") }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Leave types ----

export function listTypes() {
  return respond(leave.types);
}

export async function saveType(input: Omit<LeaveType, "id" | "active"> & { id?: string }): Promise<LeaveType> {
  const name = input.name.trim();
  if (!name) return fail("Name the leave type");
  if (!input.code.trim()) return fail("Give it a short code, e.g. VL");
  if (input.earning.kind !== "unlimited" && (!Number.isFinite(input.daysPerYear) || input.daysPerYear <= 0)) return fail("Enter how many days a year");
  if (input.earning.kind === "monthly" && (!Number.isFinite(input.earning.perMonth) || input.earning.perMonth <= 0)) return fail("Enter how many days are earned each month");
  if (leave.types.some((t) => t.id !== input.id && t.name.toLowerCase() === name.toLowerCase())) return fail("There's already a leave type with that name");
  const existing = leave.types.find((t) => t.id === input.id);
  const type: LeaveType = { active: true, ...existing, ...input, name, code: input.code.trim().toUpperCase(), id: existing?.id ?? newId("lt") };
  saveLeave({ ...leave, types: existing ? leave.types.map((t) => (t.id === type.id ? type : t)) : [...leave.types, type] });
  return respond(type);
}

export async function setTypeActive(id: string, active: boolean): Promise<void> {
  saveLeave({ ...leave, types: leave.types.map((t) => (t.id === id ? { ...t, active } : t)) });
  return respond(undefined);
}

// ---- Requests ----

export interface RequestRow extends LeaveRequest {
  person: LeavePerson;
  type: LeaveType;
}

export function listRequests(): Promise<RequestRow[]> {
  const ps = people();
  return respond(
    leave.requests
      .flatMap((r) => {
        const person = ps.find((p) => p.id === r.employeeId);
        const type = leave.types.find((t) => t.id === r.typeId);
        return person && type ? [{ ...r, person, type }] : [];
      })
      .sort((a, b) => b.filedAt.localeCompare(a.filedAt)),
  );
}

export interface FileInput {
  employeeId: string;
  typeId: string;
  start: string;
  end: string;
  halfDay?: "am" | "pm";
  reason: string;
  attachment?: string;
}

export interface Preview {
  days: number;
  balance?: Balance;
  /** Problems that stop the request from being filed. */
  errors: string[];
  /** Things HR should know but that don't block filing. */
  notes: string[];
}

/** Live check for the File leave form: days, balance after, and anything wrong. */
export function previewRequest(input: FileInput, ignoreId?: string): Preview {
  const type = leave.types.find((t) => t.id === input.typeId);
  const errors: string[] = [];
  const notes: string[] = [];
  if (!input.employeeId) errors.push("Choose the employee");
  if (!type) return { days: 0, errors: [...errors, "Choose the leave type"], notes };
  if (!input.start || !input.end) return { days: 0, errors: [...errors, "Pick the start and end dates"], notes };
  if (input.end < input.start) return { days: 0, errors: [...errors, "The end date is before the start date"], notes };
  const days = countDays(input.start, input.end, type.countBy, input.start === input.end ? input.halfDay : undefined);
  if (days === 0) errors.push("Those dates are all weekends or holidays, so no leave is needed");
  const holidays = HOLIDAYS.filter((h) => h.date >= input.start && h.date <= input.end);
  if (holidays.length && type.countBy === "workdays") notes.push(`${holidays.map((h) => h.name).join(", ")} ${holidays.length === 1 ? "is a holiday" : "are holidays"}, not counted.`);
  if (!input.employeeId) return { days, errors, notes };
  const balance = balanceFor(input.employeeId, type);
  if (!balance.eligible) errors.push(balance.eligibilityNote ?? "This employee can't use this leave type");
  else if (balance.eligibilityNote) notes.push(balance.eligibilityNote);
  if (!balance.unlimited && days > balance.available) errors.push(`Only ${fmtDays(balance.available)} available. File the rest as Leave without pay.`);
  if (type.attachmentOver !== null && days > type.attachmentOver && !input.attachment) errors.push(type.attachmentOver === 0 ? `${type.name} needs a supporting document` : `${type.name} over ${type.attachmentOver} days needs a supporting document (e.g. medical certificate)`);
  const overlap = leave.requests.find((r) => r.id !== ignoreId && r.employeeId === input.employeeId && (r.status === "pending" || r.status === "approved") && r.start <= input.end && r.end >= input.start);
  if (overlap) errors.push(`Overlaps another ${overlap.status} request (${overlap.start === overlap.end ? overlap.start : `${overlap.start} to ${overlap.end}`})`);
  if (type.countBy === "calendar") notes.push("Counted in calendar days, weekends included.");
  return { days, balance, errors, notes };
}

export const fmtDays = (n: number) => (n === Infinity ? "No limit" : `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, "")} ${n === 1 ? "day" : "days"}`);

export async function fileLeave(input: FileInput, actor: string, approveNow = false): Promise<LeaveRequest> {
  if (!input.reason.trim()) return fail("Give a short reason");
  const p = previewRequest(input);
  if (p.errors.length) return fail(p.errors[0]!);
  const now = new Date().toISOString();
  const req: LeaveRequest = {
    id: newId("lr"),
    employeeId: input.employeeId,
    typeId: input.typeId,
    start: input.start,
    end: input.end,
    halfDay: input.start === input.end ? input.halfDay : undefined,
    days: p.days,
    reason: input.reason.trim(),
    attachment: input.attachment,
    status: approveNow ? "approved" : "pending",
    filedBy: actor,
    filedAt: now,
    ...(approveNow ? { decidedBy: actor, decidedAt: now } : {}),
  };
  saveLeave({ ...leave, requests: [req, ...leave.requests] });
  return respond(req);
}

export async function decideRequest(id: string, approve: boolean, note: string, actor: string): Promise<LeaveRequest> {
  const r = leave.requests.find((x) => x.id === id);
  if (!r) return fail("That request no longer exists");
  if (r.status !== "pending") return fail("This request was already decided");
  if (!approve && !note.trim()) return fail("Say why, so the employee knows");
  if (approve) {
    const type = leave.types.find((t) => t.id === r.typeId)!;
    const b = balanceFor(r.employeeId, type);
    // Pending already includes this request, so compare against what's left before it.
    if (!b.unlimited && r.days > b.available + r.days) return fail(`Only ${fmtDays(b.available + r.days)} left. Ask them to file the rest as Leave without pay.`);
  }
  const next: LeaveRequest = { ...r, status: approve ? "approved" : "rejected", decidedBy: actor, decidedAt: new Date().toISOString(), note: note.trim() || undefined };
  saveLeave({ ...leave, requests: leave.requests.map((x) => (x.id === id ? next : x)) });
  return respond(next);
}

/** Withdraw an approved leave that hasn't started yet; the days go back to the balance. */
export async function cancelRequest(id: string, note: string, actor: string): Promise<LeaveRequest> {
  const r = leave.requests.find((x) => x.id === id);
  if (!r) return fail("That request no longer exists");
  if (r.status === "approved" && r.start <= isoToday()) return fail("This leave has already started and can't be cancelled");
  if (!note.trim()) return fail("Say why it's being cancelled");
  const next: LeaveRequest = { ...r, status: "cancelled", decidedBy: actor, decidedAt: new Date().toISOString(), note: note.trim() };
  saveLeave({ ...leave, requests: leave.requests.map((x) => (x.id === id ? next : x)) });
  return respond(next);
}

// ---- Balances ----

export interface BalanceRow {
  person: LeavePerson;
  balances: Balance[];
}

export function listBalances(): Promise<BalanceRow[]> {
  const types = leave.types.filter((t) => t.active);
  return respond(people().map((person) => ({ person, balances: types.map((t) => balanceFor(person.id, t)) })));
}

export function listAdjustments(employeeId: string) {
  return respond(leave.adjustments.filter((a) => a.employeeId === employeeId).sort((a, b) => b.at.localeCompare(a.at)));
}

export async function adjustBalance(input: { employeeId: string; typeId: string; days: number; reason: string }, actor: string) {
  if (!Number.isFinite(input.days) || input.days === 0) return fail("Enter the days to add (e.g. 1) or remove (e.g. -1)");
  if (Math.abs(input.days) > 30) return fail("That's a big change; enter 30 days or fewer at a time");
  if (!input.reason.trim()) return fail("Say why the balance is changing");
  const type = leave.types.find((t) => t.id === input.typeId);
  if (!type) return fail("Choose the leave type");
  if (type.earning.kind === "unlimited") return fail("Leave without pay has no balance to adjust");
  const b = balanceFor(input.employeeId, type);
  if (b.remaining + input.days < 0) return fail(`They only have ${fmtDays(b.remaining)} left`);
  const adj = { id: newId("la"), employeeId: input.employeeId, typeId: input.typeId, days: input.days, reason: input.reason.trim(), by: actor, at: new Date().toISOString() };
  saveLeave({ ...leave, adjustments: [adj, ...leave.adjustments] });
  return respond(adj);
}

// ---- Calendar ----

export interface AwayEntry {
  person: LeavePerson;
  type: LeaveType;
  request: LeaveRequest;
}

/** Everyone away (approved or pending) between two dates. */
export function listAway(from: string, to: string): Promise<AwayEntry[]> {
  const ps = people();
  return respond(
    leave.requests
      .filter((r) => (r.status === "approved" || r.status === "pending") && r.start <= to && r.end >= from)
      .flatMap((r) => {
        const person = ps.find((p) => p.id === r.employeeId);
        const type = leave.types.find((t) => t.id === r.typeId);
        return person && type ? [{ person, type, request: r }] : [];
      })
      .sort((a, b) => a.request.start.localeCompare(b.request.start)),
  );
}

export { addDays, isoToday };
