// Leave data: leave types, requests and balance adjustments. Balances are always
// computed, never stored. The rules themselves live in ./rules (shared with the
// API server); this file holds the data and binds the rules to it.
//
// Without the API server the data is saved to localStorage. With it, the
// database is the source and this store is a cache loaded after sign-in.

import { state as core, fullName } from "../corehr/store";
import { api, serverMode } from "../http";
import { admin } from "../admin/store";
import { addDays, balanceOf, countDays as countDaysIn, creditsOf, DEFAULT_LEAVE_POLICY, isoToday, policyOf, type LeaveData, type LeavePolicy } from "./rules";
import type { Balance, LeaveType, LeaveRequest } from "./types";

export { addDays, CREDITS_ADJUSTMENT, DEFAULT_TYPES, isoToday, leaveYearOf, LEAVE_CREDITS_PER_YEAR, type Credits } from "./rules";
export { DEFAULT_LEAVE_POLICY, type LeavePolicy };
import { DEFAULT_TYPES } from "./rules";

export type LeaveState = LeaveData;

const KEY = "heyhr-leave-v1";

// ---- Seed ----

function seed(): LeaveState {
  const t = isoToday();
  const ids = core.employees.filter((e) => e.job.status !== "Separated").map((e) => e.id);
  const mk = (employeeId: string, typeId: string, start: string, end: string, status: LeaveRequest["status"], reason: string, extra: Partial<LeaveRequest> = {}): LeaveRequest => {
    const type = DEFAULT_TYPES.find((x) => x.id === typeId)!;
    // Dates are relative to today; slide a request that lands only on a weekend back to a workday.
    for (let i = 0; i < 3 && countDays(start, end, type.countBy, extra.halfDay) === 0; i++) [start, end] = [addDays(start, -1), addDays(end, -1)];
    const e = core.employees.find((x) => x.id === employeeId);
    return {
      id: `lr-${employeeId}-${start}-${typeId}`,
      employeeId,
      typeId,
      start,
      end,
      days: countDays(start, end, type.countBy, extra.halfDay),
      reason,
      status,
      filedBy: e ? fullName(e.personal) : "Employee",
      // Sample requests were filed a week ahead, but never later than a couple of days ago.
      filedAt: `${earlier(addDays(start, -7), addDays(isoToday(), -2))}T09:00:00`,
      ...(status === "approved" || status === "rejected" ? { decidedBy: "Wendy Lacson", decidedAt: `${earlier(addDays(start, -5), addDays(isoToday(), -1))}T10:00:00` } : {}),
      ...extra,
    };
  };
  const requests: LeaveRequest[] = [
    // On leave now (Timekeeping reads these).
    mk("MSMA-00560", "vl", addDays(t, -4), addDays(t, 1), "approved", "Family trip to Bohol"),
    mk("MSMA-00341", "sl", addDays(t, -2), addDays(t, 3), "approved", "Dengue, confined; medical certificate attached", { attachment: "med-cert-dlim.pdf" }),
    mk("MSMA-00398", "vl", addDays(t, -3), addDays(t, 5), "approved", "Wedding of sibling in Iloilo"),
    // Earlier this year.
    mk("MSMA-00482", "vl", addDays(t, -12), addDays(t, -12), "approved", "Personal errand"),
    mk("MSMA-00482", "sl", "2026-03-09", "2026-03-10", "approved", "Flu"),
    mk("MSMA-00317", "vl", "2026-05-18", "2026-05-22", "approved", "Holy Week extension"),
    mk("MSMA-00203", "el", "2026-07-14", "2026-07-14", "approved", "House flooded after typhoon"),
    mk("MSMA-00276", "vl", "2026-06-15", "2026-06-17", "approved", "Out of town"),
    mk("MSMA-00098", "sl", "2026-08-03", "2026-08-04", "approved", "Fever", { attachment: "medcert.jpg" }),
    mk("MSMA-00611", "vl", "2026-09-07", "2026-09-11", "approved", "Bar review break"),
    mk("MSMA-00701", "bl", "2026-09-21", "2026-09-23", "approved", "Death of father", { attachment: "death-cert.pdf" }),
    mk("MSMA-00623", "vl", "2026-04-27", "2026-04-28", "rejected", "Concert in Manila", { note: "Overlaps the quarterly VAT filing deadline." }),
    // Coming up.
    mk("MSMA-00733", "vl", addDays(t, 9), addDays(t, 11), "approved", "Anniversary trip"),
    mk("MSMA-00845", "vl", addDays(t, 16), addDays(t, 16), "approved", "Barangay ID renewal"),
    // Waiting for HR.
    mk("MSMA-00482", "vl", addDays(t, 3), addDays(t, 4), "pending", "Sister's graduation in Dumaguete"),
    mk("MSMA-00812", "sl", addDays(t, -1), addDays(t, -1), "pending", "Migraine", {}),
    mk("MSMA-00317", "pl", addDays(t, 21), addDays(t, 29), "pending", "Wife due to give birth", { attachment: "ob-certificate.pdf" }),
    mk("MSMA-00203", "vl", addDays(t, 24), addDays(t, 28), "pending", "Christmas shopping trip to Hong Kong"),
    mk("MSMA-00623", "el", addDays(t, 1), addDays(t, 1), "pending", "Child's school emergency", { halfDay: "pm" }),
  ].filter((r) => ids.includes(r.employeeId));
  const carryOver: Record<string, number> = {};
  ids.forEach((id, i) => {
    carryOver[`${id}|vl`] = [0, 2, 5, 3, 1, 4][i % 6]!;
    carryOver[`${id}|sl`] = [1, 0, 3, 5, 2, 0][i % 6]!;
  });
  return { types: DEFAULT_TYPES, requests, adjustments: [], carryOver };
}

const earlier = (a: string, b: string) => (a < b ? a : b);

/** Sample data saved before dates were capped could say a request was filed in the future. */
function notInFuture(s: LeaveState): LeaveState {
  const now = new Date().toISOString();
  const cap = (at?: string) => (at && at > now ? now : at);
  return { ...s, requests: s.requests.map((r) => ({ ...r, filedAt: cap(r.filedAt)!, decidedAt: cap(r.decidedAt) })) };
}

function load(): LeaveState {
  // With the API server, the records come from the database (see refreshLeave).
  if (serverMode) return { types: [], requests: [], adjustments: [], carryOver: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as LeaveState;
      if (Array.isArray(s.types) && Array.isArray(s.requests)) return notInFuture(s);
    }
  } catch {
    // Blocked or corrupt storage: start from the seed.
  }
  return seed();
}

export let leave: LeaveState = load();

export function saveLeave(next: LeaveState) {
  leave = next;
  if (serverMode) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(leave));
  } catch {
    // Storage full or blocked: the change still applies for this session.
  }
}

// ---- Balances ----

const personFacts = (employeeId: string) => core.employees.find((x) => x.id === employeeId);

export function balanceFor(employeeId: string, type: LeaveType, today?: string): Balance {
  return balanceOf(leave, employeeId, personFacts(employeeId), type, today);
}

/** The VL/SL days for the leave year (sheet SIL). Leave without pay doesn't use them. */
export function creditsFor(employeeId: string, today?: string) {
  return creditsOf(leave, employeeId, today, personFacts(employeeId)?.job.dateHired);
}

/** Approved leave spans, for Timekeeping. */
export function approvedLeaveSpans() {
  return leave.requests
    .filter((r) => r.status === "approved")
    .map((r) => ({ employeeId: r.employeeId, type: leave.types.find((t) => t.id === r.typeId)?.name ?? "Leave", from: r.start, to: r.end }));
}

// ---- With the API server ----

let loading: Promise<void> | null = null;
let loadedAt = 0;

/** Loads leave from the API server. Reads within a moment of the last load reuse it. */
export function refreshLeave(maxAgeMs = 0): Promise<void> {
  if (!serverMode) return Promise.resolve();
  if (loading) return loading;
  if (maxAgeMs && Date.now() - loadedAt < maxAgeMs) return Promise.resolve();
  loading = api<LeaveState>("GET", "/leave/state")
    .then((next) => {
      leave = next;
      loadedAt = Date.now();
    })
    .finally(() => (loading = null));
  return loading;
}

export function clearLeave() {
  if (!serverMode) return;
  loadedAt = 0;
  leave = load();
}

// ---- Company settings that change how leave counts ----

/** Settings > Organization: the working days (Monday–Friday unless changed). */
// A function, so the sample leave (built while this module loads) can already use it.
function workWeek() {
  return admin.settings.workWeek ?? [1, 2, 3, 4, 5];
}

/** Settings > Time off & leave. */
export const leavePolicy = (): LeavePolicy => policyOf(leave);

/** Days a request covers: working days (the company's work week, not holidays) or every calendar day. */
export function countDays(start: string, end: string, countBy: LeaveType["countBy"], halfDay?: "am" | "pm") {
  return countDaysIn(start, end, countBy, halfDay, workWeek());
}

/** The leave data plus the settings the rules read, for the shared rules in ./rules. */
export const leaveData = (): LeaveData => ({ ...leave, workWeek: workWeek() });
