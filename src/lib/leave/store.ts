// Leave data: leave types, requests and balance adjustments, seeded once and
// saved to localStorage. Balances are always computed, never stored.

import { fullName, state as core } from "../corehr/store";
import { HOLIDAYS } from "../holidays";
import type { Adjustment, Balance, LeaveRequest, LeaveType } from "./types";

export interface LeaveState {
  types: LeaveType[];
  requests: LeaveRequest[];
  adjustments: Adjustment[];
  /** Unused days brought over from last year, by "employeeId|typeId". */
  carryOver: Record<string, number>;
}

const KEY = "heyhr-leave-v1";

export const DEFAULT_TYPES: LeaveType[] = [
  { id: "vl", name: "Vacation leave", code: "VL", daysPerYear: 15, earning: { kind: "monthly", perMonth: 1.25 }, paid: true, carryOverMax: 5, countBy: "workdays", eligibility: "everyone", attachmentOver: null, confidential: false, basis: "Company policy (covers the 5-day Service Incentive Leave)", active: true },
  { id: "sl", name: "Sick leave", code: "SL", daysPerYear: 15, earning: { kind: "monthly", perMonth: 1.25 }, paid: true, carryOverMax: 5, countBy: "workdays", eligibility: "everyone", attachmentOver: 2, confidential: false, basis: "Company policy", active: true },
  { id: "el", name: "Emergency leave", code: "EL", daysPerYear: 3, earning: { kind: "yearly" }, paid: true, carryOverMax: 0, countBy: "workdays", eligibility: "everyone", attachmentOver: null, confidential: false, basis: "Company policy", active: true },
  { id: "bl", name: "Bereavement leave", code: "BL", daysPerYear: 3, earning: { kind: "yearly" }, paid: true, carryOverMax: 0, countBy: "workdays", eligibility: "everyone", attachmentOver: 0, confidential: false, basis: "Company policy", active: true },
  { id: "ml", name: "Maternity leave", code: "ML", daysPerYear: 105, earning: { kind: "per-event" }, paid: true, carryOverMax: 0, countBy: "calendar", eligibility: "female", attachmentOver: 0, confidential: false, basis: "RA 11210 (105 days, +15 for solo parents)", active: true },
  { id: "pl", name: "Paternity leave", code: "PL", daysPerYear: 7, earning: { kind: "per-event" }, paid: true, carryOverMax: 0, countBy: "workdays", eligibility: "male-married", attachmentOver: 0, confidential: false, basis: "RA 8187 (married male, first 4 deliveries)", active: true },
  { id: "sp", name: "Solo parent leave", code: "SPL", daysPerYear: 7, earning: { kind: "yearly" }, paid: true, carryOverMax: 0, countBy: "workdays", eligibility: "solo-parent", attachmentOver: 0, confidential: false, basis: "RA 11861 (after 6 months, with Solo Parent ID)", active: true },
  { id: "vawc", name: "VAWC leave", code: "VAWC", daysPerYear: 10, earning: { kind: "per-event" }, paid: true, carryOverMax: 0, countBy: "workdays", eligibility: "female", attachmentOver: 0, confidential: true, basis: "RA 9262 (up to 10 days; details confidential)", active: true },
  { id: "slw", name: "Special leave for women", code: "SLW", daysPerYear: 60, earning: { kind: "per-event" }, paid: true, carryOverMax: 0, countBy: "workdays", eligibility: "female", attachmentOver: 0, confidential: false, basis: "RA 9710 (up to 2 months after gynecological surgery)", active: true },
  { id: "lwop", name: "Leave without pay", code: "LWOP", daysPerYear: 0, earning: { kind: "unlimited" }, paid: false, carryOverMax: 0, countBy: "workdays", eligibility: "everyone", attachmentOver: null, confidential: false, basis: "Company policy", active: true },
];

// ---- Dates ----

export function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const weekday = (date: string) => new Date(`${date}T12:00:00`).getDay();
const isHoliday = (date: string) => HOLIDAYS.some((h) => h.date === date);

/** Days a request covers: working days (Mon–Fri, not holidays) or every calendar day. */
export function countDays(start: string, end: string, countBy: LeaveType["countBy"], halfDay?: "am" | "pm") {
  if (!start || !end || end < start) return 0;
  if (halfDay && start === end) return countBy === "calendar" || (weekday(start) !== 0 && weekday(start) !== 6 && !isHoliday(start)) ? 0.5 : 0;
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (countBy === "calendar" || (weekday(d) !== 0 && weekday(d) !== 6 && !isHoliday(d))) n++;
  }
  return n;
}

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
      ...(status === "approved" || status === "rejected" ? { decidedBy: "Dinah Marquez", decidedAt: `${earlier(addDays(start, -5), addDays(isoToday(), -1))}T10:00:00` } : {}),
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
  try {
    localStorage.setItem(KEY, JSON.stringify(leave));
  } catch {
    // Storage full or blocked: the change still applies for this session.
  }
}

// ---- Balances ----

/** Months credited so far this year: 1.25 days land on the 1st of each month, from the month after hire. */
function monthsEarned(hireDate: string, today: string) {
  const year = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const hiredYear = Number(hireDate.slice(0, 4));
  const firstMonth = hiredYear < year ? 1 : hiredYear === year ? Number(hireDate.slice(5, 7)) + 1 : 13;
  return Math.max(0, thisMonth - firstMonth + 1);
}

function eligibility(employeeId: string, type: LeaveType): { eligible: boolean; note?: string } {
  const e = core.employees.find((x) => x.id === employeeId);
  if (!e) return { eligible: false, note: "Employee not found" };
  const sex = e.personal.sex;
  const months = (Date.now() - new Date(`${e.job.dateHired}T00:00:00`).getTime()) / (30.44 * 86_400_000);
  switch (type.eligibility) {
    case "female":
      return sex === "Male" ? { eligible: false, note: "For female employees" } : { eligible: true, note: sex ? undefined : "Sex not recorded in the 201 file" };
    case "male-married":
      if (sex === "Female") return { eligible: false, note: "For married male employees" };
      return e.personal.civilStatus && e.personal.civilStatus !== "Married" ? { eligible: false, note: "For married male employees" } : { eligible: true, note: sex && e.personal.civilStatus ? undefined : "Check sex and civil status in the 201 file" };
    case "solo-parent":
      return months < 6 ? { eligible: false, note: "After 6 months of service" } : { eligible: true, note: "Needs a valid Solo Parent ID" };
    case "after-1-year":
      return months < 12 ? { eligible: false, note: "After 1 year of service" } : { eligible: true };
    case "after-6-months":
      return months < 6 ? { eligible: false, note: "After 6 months of service" } : { eligible: true };
    default:
      return { eligible: true };
  }
}

export function balanceFor(employeeId: string, type: LeaveType, today = isoToday()): Balance {
  const year = today.slice(0, 4);
  const e = core.employees.find((x) => x.id === employeeId);
  const mine = leave.requests.filter((r) => r.employeeId === employeeId && r.typeId === type.id && r.start.slice(0, 4) === year);
  const used = mine.filter((r) => r.status === "approved").reduce((n, r) => n + r.days, 0);
  const pending = mine.filter((r) => r.status === "pending").reduce((n, r) => n + r.days, 0);
  const adjusted = leave.adjustments.filter((a) => a.employeeId === employeeId && a.typeId === type.id && a.at.slice(0, 4) === year).reduce((n, a) => n + a.days, 0);
  const carriedOver = type.carryOverMax ? Math.min(type.carryOverMax, leave.carryOver[`${employeeId}|${type.id}`] ?? 0) : 0;
  const elig = eligibility(employeeId, type);
  const unlimited = type.earning.kind === "unlimited";
  const earned =
    type.earning.kind === "monthly" ? Math.min(type.daysPerYear, monthsEarned(e?.job.dateHired ?? `${year}-01-01`, today) * type.earning.perMonth) : unlimited ? 0 : type.daysPerYear;
  const remaining = unlimited ? Infinity : Math.max(0, earned + carriedOver + adjusted - used);
  return {
    typeId: type.id,
    earned,
    yearTotal: type.daysPerYear,
    carriedOver,
    adjusted,
    used,
    pending,
    remaining,
    available: unlimited ? Infinity : Math.max(0, remaining - pending),
    unlimited,
    eligible: elig.eligible,
    eligibilityNote: elig.note,
  };
}

/** Approved leave spans, for Timekeeping. */
export function approvedLeaveSpans() {
  return leave.requests
    .filter((r) => r.status === "approved")
    .map((r) => ({ employeeId: r.employeeId, type: leave.types.find((t) => t.id === r.typeId)?.name ?? "Leave", from: r.start, to: r.end }));
}
