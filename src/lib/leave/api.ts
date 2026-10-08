// Leave mock API. Each call stands in for an HTTP request.

import { fullName, initialsOf, newId, state as core } from "../corehr/store";
import { HOLIDAYS } from "../holidays";
import { addDays, balanceFor, countDays, CREDITS_ADJUSTMENT, creditsFor, isoToday, leave, LEAVE_CREDITS_PER_YEAR, leavePolicy, saveLeave, type Credits } from "./store";
import type { Balance, LeaveRequest, LeaveType } from "./types";
import { can, canFor, visible } from "../permissions";
import { deny, forbidden, sessionWho } from "../session";

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
  const denied = deny("leaveTypes", input.id ? "edit" : "create");
  if (denied) return denied;
  const name = input.name.trim();
  if (!name) return fail("Name the leave type");
  if (!input.code.trim()) return fail("Give it a short code, e.g. VL");
  if (leave.types.some((t) => t.id !== input.id && t.name.toLowerCase() === name.toLowerCase())) return fail("There's already a leave type with that name");
  const existing = leave.types.find((t) => t.id === input.id);
  const type: LeaveType = { active: true, ...existing, ...input, name, code: input.code.trim().toUpperCase(), id: existing?.id ?? newId("lt") };
  saveLeave({ ...leave, types: existing ? leave.types.map((t) => (t.id === type.id ? type : t)) : [...leave.types, type] });
  return respond(type);
}

export async function setTypeActive(id: string, active: boolean): Promise<void> {
  const denied = deny("leaveTypes", "edit");
  if (denied) return denied;
  saveLeave({ ...leave, types: leave.types.map((t) => (t.id === id ? { ...t, active } : t)) });
  return respond(undefined);
}

// ---- Requests ----

export interface RequestRow extends LeaveRequest {
  person: LeavePerson;
  type: LeaveType;
}

export function listRequests(): Promise<RequestRow[]> {
  const who = sessionWho();
  if (!can(who, "view", "leave")) return forbidden();
  const ps = people();
  return respond(
    visible(who, "leave", leave.requests, (r) => r.employeeId)
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
  /** The employee's yearly credit pool; absent for leave without pay, which uses none. */
  credits?: Credits;
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
  // Half days only when Settings > Time off & leave allows them.
  const halfDay = input.start === input.end && leavePolicy().allowHalfDays ? input.halfDay : undefined;
  const days = countDays(input.start, input.end, type.countBy, halfDay);
  if (days === 0) errors.push("Those dates are all weekends or holidays, so no leave is needed");
  const holidays = HOLIDAYS.filter((h) => h.date >= input.start && h.date <= input.end);
  if (holidays.length && type.countBy === "workdays") notes.push(`${holidays.map((h) => h.name).join(", ")} ${holidays.length === 1 ? "is a holiday" : "are holidays"}, not counted.`);
  if (!input.employeeId) return { days, errors, notes };
  const balance = balanceFor(input.employeeId, type);
  if (!balance.eligible) errors.push(balance.eligibilityNote ?? "This employee can't use this leave type");
  else if (balance.eligibilityNote) notes.push(balance.eligibilityNote);
  const credits = balance.unlimited ? undefined : creditsFor(input.employeeId);
  if (credits && credits.available < 1 && !leavePolicy().allowNegative) errors.push(`All ${credits.total} leaves for this year are used up. File it as Leave without pay.`);
  if (type.attachmentOver !== null && days > type.attachmentOver && !input.attachment) errors.push(type.attachmentOver === 0 ? `${type.name} needs a supporting document` : `${type.name} over ${type.attachmentOver} days needs a supporting document (e.g. medical certificate)`);
  const overlap = leave.requests.find((r) => r.id !== ignoreId && r.employeeId === input.employeeId && (r.status === "pending" || r.status === "approved") && r.start <= input.end && r.end >= input.start);
  if (overlap) errors.push(`Overlaps another ${overlap.status} request (${overlap.start === overlap.end ? overlap.start : `${overlap.start} to ${overlap.end}`})`);
  if (type.countBy === "calendar") notes.push("Counted in calendar days, weekends included.");
  return { days, balance, credits, errors, notes };
}

export const fmtCredits = (n: number) => `${n} ${n === 1 ? "leave" : "leaves"}`;

export const fmtDays = (n: number) => (n === Infinity ? "No limit" : `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, "")} ${n === 1 ? "day" : "days"}`);

export async function fileLeave(input: FileInput, actor: string, approveNow = false): Promise<LeaveRequest> {
  // Employees file their own leave; filing already-approved leave counts as approving it.
  const denied = deny("leave", "create", input.employeeId) ?? (approveNow ? deny("leave", "approve", input.employeeId) : null);
  if (denied) return denied;
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
    halfDay: input.start === input.end && leavePolicy().allowHalfDays ? input.halfDay : undefined,
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
  const target = leave.requests.find((x) => x.id === id);
  const denied = deny("leave", "approve", target?.employeeId);
  if (denied) return denied;
  const r = leave.requests.find((x) => x.id === id);
  if (!r) return fail("That request no longer exists");
  if (r.status !== "pending") return fail("This request was already decided");
  if (!approve && !note.trim()) return fail("Say why, so the employee knows");
  if (approve) {
    const type = leave.types.find((t) => t.id === r.typeId)!;
    // Pending already includes this request, so compare against what's left before it.
    const c = creditsFor(r.employeeId);
    if (type.earning.kind !== "unlimited" && c.used >= c.total) return fail(`All ${c.total} leaves for this year are used up. Ask them to file it as Leave without pay.`);
  }
  const next: LeaveRequest = { ...r, status: approve ? "approved" : "rejected", decidedBy: actor, decidedAt: new Date().toISOString(), note: note.trim() || undefined };
  saveLeave({ ...leave, requests: leave.requests.map((x) => (x.id === id ? next : x)) });
  return respond(next);
}

/** Withdraw an approved leave that hasn't started yet; the days go back to the balance. */
export async function cancelRequest(id: string, note: string, actor: string): Promise<LeaveRequest> {
  // Approvers (HR) can cancel; an employee can withdraw their own.
  const target = leave.requests.find((x) => x.id === id);
  const who = sessionWho();
  if (!canFor(who, "approve", "leave", target?.employeeId) && !(target && target.employeeId === who.employeeId && canFor(who, "create", "leave", target.employeeId))) return forbidden();
  const r = leave.requests.find((x) => x.id === id);
  if (!r) return fail("That request no longer exists");
  if (r.status === "approved" && r.start <= isoToday()) return fail("This leave has already started and can't be cancelled");
  if (!note.trim()) return fail("Say why it's being cancelled");
  const next: LeaveRequest = { ...r, status: "cancelled", decidedBy: actor, decidedAt: new Date().toISOString(), note: note.trim() };
  saveLeave({ ...leave, requests: leave.requests.map((x) => (x.id === id ? next : x)) });
  return respond(next);
}

// ---- Leave credits (6 a year, shared by every paid leave type) ----

export interface CreditRow {
  person: LeavePerson;
  credits: Credits;
  /** This year's paid leave that used a credit (approved or waiting), newest first. */
  leaves: (LeaveRequest & { type: LeaveType })[];
}

export function listCredits(): Promise<CreditRow[]> {
  const who = sessionWho();
  if (!can(who, "view", "leaveBalances")) return forbidden();
  const year = isoToday().slice(0, 4);
  return respond(
    visible(who, "leaveBalances", people(), (p) => p.id).map((person) => ({
      person,
      credits: creditsFor(person.id),
      leaves: leave.requests
        .filter((r) => r.employeeId === person.id && r.start.slice(0, 4) === year && (r.status === "approved" || r.status === "pending"))
        .flatMap((r) => {
          const type = leave.types.find((t) => t.id === r.typeId);
          return type && type.earning.kind !== "unlimited" ? [{ ...r, type }] : [];
        })
        .sort((a, b) => b.start.localeCompare(a.start)),
    })),
  );
}

/** HR adds or takes away whole leaves from someone's yearly 6. */
export async function adjustCredits(input: { employeeId: string; leaves: number; reason: string }, actor: string) {
  const denied = deny("leaveBalances", "edit", input.employeeId);
  if (denied) return denied;
  if (!Number.isInteger(input.leaves) || input.leaves === 0) return fail("Enter the leaves to add (e.g. 1) or remove (e.g. -1)");
  if (Math.abs(input.leaves) > LEAVE_CREDITS_PER_YEAR) return fail(`Change at most ${LEAVE_CREDITS_PER_YEAR} leaves at a time`);
  if (!input.reason.trim()) return fail("Say why the leaves are changing");
  const c = creditsFor(input.employeeId);
  if (c.available + input.leaves < 0) return fail(`They only have ${fmtCredits(c.available)} left`);
  const adj = { id: newId("la"), employeeId: input.employeeId, typeId: CREDITS_ADJUSTMENT, days: input.leaves, reason: input.reason.trim(), by: actor, at: new Date().toISOString() };
  saveLeave({ ...leave, adjustments: [adj, ...leave.adjustments] });
  return respond(adj);
}

// ---- Adjustments ----

export function listAdjustments(employeeId: string) {
  const denied = deny("leaveBalances", "view", employeeId);
  if (denied) return denied;
  return respond(leave.adjustments.filter((a) => a.employeeId === employeeId).sort((a, b) => b.at.localeCompare(a.at)));
}

// ---- Calendar ----

export interface AwayEntry {
  person: LeavePerson;
  type: LeaveType;
  request: LeaveRequest;
}

/** Everyone away (approved or pending) between two dates. */
export function listAway(from: string, to: string): Promise<AwayEntry[]> {
  const who = sessionWho();
  if (!can(who, "view", "leave")) return forbidden();
  const ps = people();
  return respond(
    visible(who, "leave", leave.requests, (r) => r.employeeId)
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
