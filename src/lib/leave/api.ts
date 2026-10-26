// Leave mock API. Each call stands in for an HTTP request.

import { fullName, initialsOf, newId, state as core } from "../corehr/store";
import { api, serverMode } from "../http";
import { previewOf, type FileInput, type Preview } from "./rules";
import { addDays, CREDITS_ADJUSTMENT, creditsFor, isoToday, leave, leaveData, LEAVE_CREDITS_PER_YEAR, leavePolicy, refreshLeave, saveLeave, type Credits } from "./store";
import type { Adjustment, LeaveRequest, LeaveType } from "./types";
import { can, canFor, visible } from "../permissions";
import { deny, forbidden, sessionWho } from "../session";
import { managerOf, nameOf, notifyEmployee } from "../outbox";
import { dates, tellApprover, tellEmployees, who as nameFor } from "../requestNotices";
import { backendOn } from "../backend/client";
import { BACKEND_LEAVE_TYPES, backendDecide, backendLeaveRows } from "../backend/requests";

const DELAY = 250;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));

export type { FileInput, Preview };

// With the API server, reads first pull the latest leave data (reused for a couple of seconds)
// and writes go to the server, which applies the same rules (./rules) and access table and saves.
const fresh = () => refreshLeave(2000);
async function remote<T>(call: Promise<T>): Promise<T> {
  const out = await call;
  await refreshLeave();
  return out;
}

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

export async function listTypes() {
  if (backendOn()) return respond(BACKEND_LEAVE_TYPES);
  if (serverMode) await fresh();
  return respond(leave.types);
}

export async function saveType(input: Omit<LeaveType, "id" | "active"> & { id?: string }): Promise<LeaveType> {
  const denied = deny("leaveTypes", input.id ? "edit" : "create");
  if (denied) return denied;
  if (serverMode) return remote(api<LeaveType>("POST", "/leave/types", input));
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
  if (serverMode) return remote(api<void>("PUT", `/leave/types/${encodeURIComponent(id)}/active`, { active }));
  saveLeave({ ...leave, types: leave.types.map((t) => (t.id === id ? { ...t, active } : t)) });
  return respond(undefined);
}

// ---- Requests ----

export interface RequestRow extends LeaveRequest {
  person: LeavePerson;
  type: LeaveType;
}

export async function listRequests(): Promise<RequestRow[]> {
  if (serverMode) await fresh();
  const who = sessionWho();
  if (!can(who, "view", "leave")) return forbidden();
  if (backendOn()) return backendLeaveRows();
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

/** Live check for the File leave form: days, balance after, and anything wrong. Same rules as the server. */
export function previewRequest(input: FileInput, ignoreId?: string): Preview {
  return previewOf(leaveData(), core.employees.find((e) => e.id === input.employeeId), input, ignoreId);
}

export const fmtCredits = (n: number) => `${n} ${n === 1 ? "leave" : "leaves"}`;

export const fmtDays = (n: number) => (n === Infinity ? "No limit" : `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, "")} ${n === 1 ? "day" : "days"}`);

export async function fileLeave(input: FileInput, actor: string, approveNow = false): Promise<LeaveRequest> {
  // Employees file their own leave; filing already-approved leave counts as approving it.
  const denied = deny("leave", "create", input.employeeId) ?? (approveNow ? deny("leave", "approve", input.employeeId) : null);
  if (denied) return denied;
  if (serverMode) return remote(api<LeaveRequest>("POST", "/leave/requests", { ...input, approveNow }));
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
  const filedType = leave.types.find((t) => t.id === req.typeId)?.name ?? "Leave";
  const dayCount = `${req.days} ${req.days === 1 ? "day" : "days"}`;
  if (req.status === "pending") {
    tellApprover(req.employeeId, "leave", "request", `${nameFor(req.employeeId)} filed ${filedType}`, `${dates(req.start, req.end)} · ${dayCount}. “${req.reason}” Review it under Approvals.`, req.days);
  } else {
    tellEmployees(req.employeeId, "leave", "approved", `${filedType} filed and approved for you`, `${actor} filed ${filedType} for you, ${dates(req.start, req.end)} (${dayCount}). It's already approved.`);
  }
  if (req.status === "pending") {
    const typeName = filedType;
    notifyEmployee(managerOf(req.employeeId), "leaveSubmitted", `Leave request from ${nameOf(req.employeeId)}`, `${nameOf(req.employeeId)} filed ${typeName}, ${req.start} to ${req.end} (${req.days} ${req.days === 1 ? "day" : "days"}). Approve or decline it on heyhr under Approvals.`);
  }
  return respond(req);
}

export async function decideRequest(id: string, approve: boolean, note: string, actor: string): Promise<LeaveRequest> {
  if (backendOn()) {
    await backendDecide(id, approve, note);
    return (await backendLeaveRows()).find((r) => r.id === id)!;
  }
  const target = leave.requests.find((x) => x.id === id);
  const denied = deny("leave", "approve", target?.employeeId);
  if (denied) return denied;
  if (serverMode) return remote(api<LeaveRequest>("POST", `/leave/requests/${encodeURIComponent(id)}/decision`, { approve, note }));
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
  const typeName = leave.types.find((t) => t.id === next.typeId)?.name ?? "leave";
  const verdict = next.status === "approved" ? "approved" : "declined";
  tellEmployees(next.employeeId, "leave", approve ? "approved" : "rejected", `Your ${typeName} was ${verdict}`, `${dates(next.start, next.end)} · ${verdict} by ${actor}.${next.note ? ` “${next.note}”` : ""}`);
  notifyEmployee(next.employeeId, "leaveDecided", `Your ${typeName} was ${verdict}`, `Your ${typeName}, ${next.start} to ${next.end}, was ${verdict} by ${actor}.${next.note ? ` Note: ${next.note}` : ""}`, `heyhr: your ${typeName} (${next.start}) was ${verdict}.`);
  return respond(next);
}

/** Withdraw an approved leave that hasn't started yet; the days go back to the balance. */
export async function cancelRequest(id: string, note: string, actor: string): Promise<LeaveRequest> {
  // Approvers (HR) can cancel; an employee can withdraw their own.
  const target = leave.requests.find((x) => x.id === id);
  const who = sessionWho();
  if (!canFor(who, "approve", "leave", target?.employeeId) && !(target && target.employeeId === who.employeeId && canFor(who, "create", "leave", target.employeeId))) return forbidden();
  if (serverMode) return remote(api<LeaveRequest>("POST", `/leave/requests/${encodeURIComponent(id)}/cancel`, { note }));
  const r = leave.requests.find((x) => x.id === id);
  if (!r) return fail("That request no longer exists");
  if (r.status === "approved" && r.start <= isoToday()) return fail("This leave has already started and can't be cancelled");
  if (!note.trim()) return fail("Say why it's being cancelled");
  const next: LeaveRequest = { ...r, status: "cancelled", decidedBy: actor, decidedAt: new Date().toISOString(), note: note.trim() };
  saveLeave({ ...leave, requests: leave.requests.map((x) => (x.id === id ? next : x)) });
  const cancelledType = leave.types.find((t) => t.id === next.typeId)?.name ?? "Leave";
  if (next.employeeId === who.employeeId) tellApprover(next.employeeId, "leave", "update", `${nameFor(next.employeeId)} withdrew ${cancelledType}`, `${dates(next.start, next.end)}. “${next.note}”`, next.days);
  else tellEmployees(next.employeeId, "leave", "rejected", `Your ${cancelledType} was cancelled`, `${dates(next.start, next.end)} · cancelled by ${actor}. “${next.note}”`);
  return respond(next);
}

// ---- Leave credits (6 a year, shared by every paid leave type) ----

export interface CreditRow {
  person: LeavePerson;
  credits: Credits;
  /** This year's paid leave that used a credit (approved or waiting), newest first. */
  leaves: (LeaveRequest & { type: LeaveType })[];
}

export async function listCredits(): Promise<CreditRow[]> {
  if (serverMode) await fresh();
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

/** HR adds or takes away VL/SL days (half days allowed), e.g. last year's over/under commutation. */
export async function adjustCredits(input: { employeeId: string; leaves: number; reason: string }, actor: string): Promise<Adjustment> {
  const denied = deny("leaveBalances", "edit", input.employeeId);
  if (denied) return denied;
  if (serverMode) return remote(api<Adjustment>("POST", "/leave/credits", input));
  if (!Number.isInteger(input.leaves * 2) || input.leaves === 0) return fail("Enter the days to add (e.g. 1 or 0.5) or remove (e.g. -1)");
  if (Math.abs(input.leaves) > LEAVE_CREDITS_PER_YEAR) return fail(`Change at most ${LEAVE_CREDITS_PER_YEAR} days at a time`);
  if (!input.reason.trim()) return fail("Say why the days are changing");
  const c = creditsFor(input.employeeId);
  if (c.available + input.leaves < 0) return fail(`They only have ${fmtCredits(c.available)} left`);
  const adj = { id: newId("la"), employeeId: input.employeeId, typeId: CREDITS_ADJUSTMENT, days: input.leaves, reason: input.reason.trim(), by: actor, at: new Date().toISOString() };
  saveLeave({ ...leave, adjustments: [adj, ...leave.adjustments] });
  tellEmployees(input.employeeId, "leave", "update", input.leaves > 0 ? `${fmtCredits(input.leaves)} added to your balance` : `${fmtCredits(-input.leaves)} taken from your balance`, `${actor}: “${adj.reason}” You now have ${fmtCredits(c.available + input.leaves)} left this leave year.`);
  return respond(adj);
}

// ---- Adjustments ----

export async function listAdjustments(employeeId: string) {
  const denied = deny("leaveBalances", "view", employeeId);
  if (denied) return denied;
  if (serverMode) await fresh();
  return respond(leave.adjustments.filter((a) => a.employeeId === employeeId).sort((a, b) => b.at.localeCompare(a.at)));
}

// ---- Calendar ----

export interface AwayEntry {
  person: LeavePerson;
  type: LeaveType;
  request: LeaveRequest;
}

/** Everyone away (approved or pending) between two dates. */
export async function listAway(from: string, to: string): Promise<AwayEntry[]> {
  if (serverMode) await fresh();
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
