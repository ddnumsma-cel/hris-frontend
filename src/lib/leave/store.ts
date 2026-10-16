// Leave data: leave types, requests and balance adjustments. Balances are always
// computed, never stored. The rules themselves live in ./rules (shared with the
// API server); this file holds the data and binds the rules to it.
//
// Without the API server the data is saved to localStorage. With it, the
// database is the source and this store is a cache loaded after sign-in.

import { state as core } from "../corehr/store";
import { api, serverMode } from "../http";
import { admin } from "../admin/store";
import { balanceOf, countDays as countDaysIn, creditsOf, DEFAULT_LEAVE_POLICY, policyOf, type LeaveData, type LeavePolicy } from "./rules";
import type { Balance, LeaveType } from "./types";

export { addDays, CREDITS_ADJUSTMENT, DEFAULT_TYPES, isoToday, leaveYearOf, LEAVE_CREDITS_PER_YEAR, type Credits } from "./rules";
export { DEFAULT_LEAVE_POLICY, type LeavePolicy };
import { DEFAULT_TYPES } from "./rules";

export type LeaveState = LeaveData;

const KEY = "heyhr-leave-v2";

// ---- Seed ----

function seed(): LeaveState {
  return { types: DEFAULT_TYPES, requests: [], adjustments: [], carryOver: {} };
}

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
const workWeek = () => admin.settings.workWeek ?? [1, 2, 3, 4, 5];

/** Settings > Time off & leave. */
export const leavePolicy = (): LeavePolicy => policyOf(leave);

/** Days a request covers: working days (the company's work week, not holidays) or every calendar day. */
export function countDays(start: string, end: string, countBy: LeaveType["countBy"], halfDay?: "am" | "pm") {
  return countDaysIn(start, end, countBy, halfDay, workWeek());
}

/** The leave data plus the settings the rules read, for the shared rules in ./rules. */
export const leaveData = (): LeaveData => ({ ...leave, workWeek: workWeek() });
