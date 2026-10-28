// Leave, overtime, undertime and time-adjustment requests on the backend: the employee's own
// (/me/...) and the approval inbox (/approvals). The backend describes each request in one line
// ("Vacation · 21–22 Oct 2026 · 2 days · Family event"), built by its approvals service; parseDetail
// reads it back into the fields the app's pages use.

import type { MyLeave, MyAttendance } from "../ess/api";
import type { MyRequest } from "../ess/more";
import type { LeavePerson, RequestRow } from "../leave/api";
import type { LeaveRequest, LeaveType, RequestStatus } from "../leave/types";
import type { DayRow, TkPerson } from "../timekeeping/api";
import type { DayStatus, FixRequest, Punch, TimeRequest } from "../timekeeping/types";
import { backendUser } from "./auth";
import { api } from "./client";
import { balanceFor, creditsFor, leave, refreshLeave } from "../leave/store";

type BackendType = "LEAVE" | "OT" | "UNDERTIME" | "DTR_FIX";
type BackendStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

interface BackendRequest {
  id: string;
  type: BackendType;
  status: BackendStatus;
  detail: string;
  createdAt: string;
  decidedAt: string | null;
  decidedBy?: string | null;
  reason: string | null;
  employee?: { id: string; fullName: string; employeeNo: string; siteName: string };
}

// ---- Reading the one-line description ----

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const iso = (y: string | number, m: string, d: string | number) => `${y}-${String(MONTHS.indexOf(m) + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** "21 Oct 2026", "21–22 Oct 2026", "30 Oct – 2 Nov 2026" or "30 Dec 2026 – 2 Jan 2027" → ISO dates. */
export function parseRange(s: string): { start: string; end: string } {
  const t = s.trim();
  let m = t.match(/^(\d+) (\w{3}) (\d{4})$/);
  if (m) return { start: iso(m[3]!, m[2]!, m[1]!), end: iso(m[3]!, m[2]!, m[1]!) };
  m = t.match(/^(\d+)–(\d+) (\w{3}) (\d{4})$/);
  if (m) return { start: iso(m[4]!, m[3]!, m[1]!), end: iso(m[4]!, m[3]!, m[2]!) };
  m = t.match(/^(\d+) (\w{3}) – (\d+) (\w{3}) (\d{4})$/);
  if (m) return { start: iso(m[5]!, m[2]!, m[1]!), end: iso(m[5]!, m[4]!, m[3]!) };
  m = t.match(/^(\d+) (\w{3}) (\d{4}) – (\d+) (\w{3}) (\d{4})$/);
  if (m) return { start: iso(m[3]!, m[2]!, m[1]!), end: iso(m[6]!, m[5]!, m[4]!) };
  return { start: "", end: "" };
}

/** "45 min", "2 hrs", "1 hr 30 min" → minutes. */
export function parseMinutes(s: string): number {
  const h = s.match(/(\d+) hrs?/);
  const m = s.match(/(\d+) min/);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

export interface ParsedDetail {
  label: string;
  start: string;
  end: string;
  days?: number;
  minutes?: number;
  timeIn?: string;
  timeOut?: string;
  reason: string;
}

export function parseDetail(type: BackendType, detail: string): ParsedDetail {
  const [label = "", when = "", what = "", ...rest] = detail.split(" · ");
  const { start, end } = parseRange(when);
  const out: ParsedDetail = { label, start, end, reason: rest.join(" · ") };
  if (type === "LEAVE") out.days = Number(what.match(/^([\d.]+) day/)?.[1] ?? 0);
  if (type === "OT") out.minutes = parseMinutes(what);
  if (type === "UNDERTIME") out.minutes = parseMinutes(what.match(/\(([^)]*) early\)/)?.[1] ?? "");
  if (type === "DTR_FIX") {
    out.timeIn = what.match(/time in (\d{2}:\d{2})/)?.[1];
    out.timeOut = what.match(/time out (\d{2}:\d{2})/)?.[1];
  }
  return out;
}

// ---- Leave types ----

const LEAVE_BASE = { earning: { kind: "yearly" }, paid: true, carryOverMax: 0, countBy: "workdays", eligibility: "everyone", attachmentOver: null, confidential: false, basis: "HR server", active: true } as const;

/** The backend's leave types (its approvals service labels them Vacation, Sick, Service incentive). */
export const BACKEND_LEAVE_TYPES: LeaveType[] = [
  { ...LEAVE_BASE, id: "VL", code: "VL", name: "Vacation leave", daysPerYear: 15 },
  { ...LEAVE_BASE, id: "SL", code: "SL", name: "Sick leave", daysPerYear: 15 },
  { ...LEAVE_BASE, id: "SIL", code: "SIL", name: "Service incentive leave", daysPerYear: 5 },
];
/** Older requests name VL, SL and SIL by these labels; newer ones by the leave type's name. */
const LEGACY_LABEL: Record<string, string> = { Vacation: "VL", Sick: "SL", "Service incentive": "SIL" };

/** The leave type a request's label names, from the backend's types (loaded with the leave data). */
function typeOfLabel(label: string): LeaveType | undefined {
  const types = leave.types.length ? leave.types : BACKEND_LEAVE_TYPES;
  const code = LEGACY_LABEL[label];
  return types.find((t) => (code ? t.code === code : t.name === label));
}

const leaveStatus: Record<BackendStatus, RequestStatus> = { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected", CANCELLED: "cancelled" };
const timeStatus = (s: BackendStatus): TimeRequest["status"] => (s === "PENDING" ? "pending" : s === "APPROVED" ? "approved" : "declined");

// ---- Mapping ----

const initialsOf = (name: string) => {
  const w = name.split(" ").filter(Boolean);
  return `${w[0]?.[0] ?? ""}${w.length > 1 ? (w[w.length - 1]?.[0] ?? "") : ""}`.toUpperCase();
};

function me(): { id: string; name: string; site: string } {
  const u = backendUser();
  return { id: u?.employeeNo ?? "", name: u?.displayName ?? "", site: u?.site?.name ?? "" };
}

function personOf(r: BackendRequest): TkPerson {
  const e = r.employee;
  const m = me();
  return { id: e?.employeeNo ?? m.id, name: e?.fullName ?? m.name, initials: initialsOf(e?.fullName ?? m.name), positionTitle: "", departmentId: "", departmentName: e?.siteName ?? m.site, branch: e?.siteName ?? m.site, monthlySalary: 0, usualShiftId: null };
}

function toLeave(r: BackendRequest): (LeaveRequest & { type: LeaveType }) | null {
  const p = parseDetail("LEAVE", r.detail);
  const type = typeOfLabel(p.label);
  if (!type) return null;
  return { id: r.id, employeeId: personOf(r).id, typeId: type.id, type, start: p.start, end: p.end, days: p.days ?? 0, reason: p.reason, status: leaveStatus[r.status], filedBy: personOf(r).name, filedAt: r.createdAt, decidedBy: r.decidedBy ?? undefined, decidedAt: r.decidedAt ?? undefined, note: r.reason ?? undefined };
}

/** A time request, with who filed it (the backend has no team attendance to look them up in). */
function toTime(r: BackendRequest): TimeRequest {
  const p = parseDetail(r.type, r.detail);
  const person = personOf(r);
  return { id: r.id, employeeId: person.id, person, date: p.start, type: r.type === "OT" ? "overtime" : "undertime", minutes: p.minutes ?? 0, reason: p.reason, status: timeStatus(r.status), filedBy: person.name, filedAt: r.createdAt, decidedBy: r.decidedBy ?? undefined, decidedAt: r.decidedAt ?? undefined, note: r.reason ?? undefined };
}

function toFix(r: BackendRequest): FixRequest {
  const p = parseDetail("DTR_FIX", r.detail);
  const person = personOf(r);
  // shortcut: one request can fix both times; the app's request has one, so a two-time fix shows its time-in.
  const kind = p.timeIn ? "in" : "out";
  return { id: r.id, employeeId: person.id, workDate: p.start, kind, time: (kind === "in" ? p.timeIn : p.timeOut) ?? "", cause: "not-recorded", reason: p.reason, status: timeStatus(r.status), filedBy: person.name, filedAt: r.createdAt, decidedBy: r.decidedBy ?? undefined, decidedAt: r.decidedAt ?? undefined, note: r.reason ?? undefined };
}

// ---- Approval inbox (approvers, HR) ----

async function approvals(type: BackendType): Promise<BackendRequest[]> {
  // shortcut: the newest 200 of a type (the backend's maximum); enough for the demo data, page through when there are more.
  return (await api<{ items: BackendRequest[] }>("/approvals", { query: { type, limit: 200 } })).items;
}

export async function backendLeaveRows(): Promise<RequestRow[]> {
  await refreshLeave(2000);
  return (await approvals("LEAVE")).flatMap((r) => {
    const l = toLeave(r);
    const p = personOf(r);
    const person: LeavePerson = { id: p.id, name: p.name, initials: p.initials, departmentName: p.departmentName, branch: p.branch };
    return l ? [{ ...l, person }] : [];
  });
}

export async function backendTimeRequests(): Promise<TimeRequest[]> {
  const [ot, ut] = await Promise.all([approvals("OT"), approvals("UNDERTIME")]);
  return [...ot, ...ut].map(toTime).sort((a, b) => b.date.localeCompare(a.date));
}

export const backendFixes = async (): Promise<FixRequest[]> => (await approvals("DTR_FIX")).map(toFix);

/** Approve or decline; the backend applies it to the request and tells nobody (the app's notices stay local). */
export async function backendDecide(id: string, approve: boolean, note: string): Promise<void> {
  if (!approve && note.trim().length < 3) throw new Error("Say why, so the employee knows");
  await api(`/approvals/${id}/${approve ? "approve" : "reject"}`, { body: note.trim() ? { reason: note.trim() } : {} });
}

// ---- The signed-in employee ----

const myRequestsRaw = () => api<BackendRequest[]>("/me/requests");

export async function backendMyLeave(): Promise<MyLeave> {
  // The backend sends only the signed-in employee's leave; balances use the same rules as everywhere (leave/rules).
  await refreshLeave();
  const myId = me().id;
  const types = leave.types.filter((t) => t.active);
  const balances = types.map((t) => ({ ...balanceFor(myId, t), type: t })).filter((b) => b.eligible || b.used > 0 || b.pending > 0);
  const requests = leave.requests
    .filter((r) => r.employeeId === myId)
    .flatMap((r) => {
      const type = leave.types.find((t) => t.id === r.typeId);
      return type ? [{ ...r, type }] : [];
    })
    .sort((a, b) => b.filedAt.localeCompare(a.filedAt));
  return { types, credits: creditsFor(myId), balances, requests };
}

export async function backendFileLeave(input: { typeId: string; start: string; end: string; reason: string; halfDay?: "am" | "pm" }): Promise<LeaveRequest> {
  // The website picks a type by id; the backend files by its code.
  const code = leave.types.find((t) => t.id === input.typeId)?.code ?? input.typeId;
  const r = await api<BackendRequest>("/me/leave-requests", { body: { leaveTypeCode: code, startDate: input.start, endDate: input.end, reason: input.reason.trim(), ...(input.halfDay && input.start === input.end ? { halfDay: input.halfDay } : {}) } });
  await refreshLeave();
  return toLeave(r)!;
}

/** UTC instant → the Manila wall-clock time the app stores, "2026-10-19T07:36". */
const manila = (at: string) => new Date(new Date(at).getTime() + 8 * 3600_000).toISOString().slice(0, 16);

const DAY_STATUS: Record<string, { status: DayStatus; kind: DayRow["kind"] }> = {
  PRESENT: { status: "done", kind: "work" },
  LATE: { status: "done", kind: "work" },
  ABSENT: { status: "absent", kind: "work" },
  RESTDAY: { status: "rest", kind: "rest" },
  ON_LEAVE: { status: "leave", kind: "leave" },
  HOLIDAY: { status: "holiday", kind: "holiday" },
};

export async function backendMyAttendance(): Promise<MyAttendance> {
  const [days, raw] = await Promise.all([
    api<{ date: string; timeIn: string | null; timeOut: string | null; workedMinutes: number; lateMinutes: number; undertimeMinutes: number; otMinutes: number; nightDiffMinutes: number; status: string }[]>("/me/attendance"),
    myRequestsRaw(),
  ]);
  const m = me();
  const person: TkPerson = { id: m.id, name: m.name, initials: initialsOf(m.name), positionTitle: "", departmentId: "", departmentName: "", branch: m.site, monthlySalary: 0, usualShiftId: null };
  const punch = (date: string, kind: "in" | "out", at: string): Punch => ({ id: `${date}-${kind}`, employeeId: m.id, workDate: date, at: manila(at), kind, source: "biometric", device: "HR server", deviceRegistered: true });
  return {
    days: days.map((d) => {
      const s = DAY_STATUS[d.status] ?? { status: "unscheduled", kind: "unscheduled" };
      const timeIn = d.timeIn ? punch(d.date, "in", d.timeIn) : undefined;
      const timeOut = d.timeOut ? punch(d.date, "out", d.timeOut) : undefined;
      return {
        person,
        employeeId: m.id,
        date: d.date,
        kind: s.kind,
        dayType: s.kind === "rest" ? "rest" : "ordinary",
        status: s.status,
        timeIn,
        timeOut,
        punches: [timeIn, timeOut].filter((p): p is Punch => !!p),
        lunchMinutes: 0,
        workedMinutes: d.workedMinutes,
        lateMinutes: d.lateMinutes,
        lateRawMinutes: d.lateMinutes,
        undertimeMinutes: d.undertimeMinutes,
        extraMinutes: d.otMinutes,
        approvedOvertimeMinutes: d.otMinutes,
        undertimeExcused: false,
        nightMinutes: d.nightDiffMinutes,
        issues: timeIn && !timeOut ? [{ kind: "missing-out", text: "No time-out recorded" }] : [],
      };
    }),
    requests: raw.filter((r) => r.type === "OT" || r.type === "UNDERTIME").map(toTime),
    fixes: raw.filter((r) => r.type === "DTR_FIX").map(toFix),
  };
}

export async function backendFileTimeRequest(input: { date: string; type: TimeRequest["type"]; minutes: number; reason: string }): Promise<TimeRequest> {
  if (input.type === "overtime") return toTime(await api<BackendRequest>("/me/overtime-requests", { body: { date: input.date, minutes: input.minutes, reason: input.reason.trim() } }));
  // The backend asks when they leave; the shift's end comes from /me/today.
  const today = await api<{ shift: { endTime: string } | null }>("/me/today");
  const [h, mm] = (today.shift?.endTime ?? "17:00").split(":").map(Number);
  const leave = h! * 60 + mm! - input.minutes;
  const leaveTime = `${String(Math.floor(leave / 60)).padStart(2, "0")}:${String(leave % 60).padStart(2, "0")}`;
  return toTime(await api<BackendRequest>("/me/undertime-requests", { body: { date: input.date, leaveTime, reason: input.reason.trim() } }));
}

export async function backendFileFix(input: { workDate: string; kind: "in" | "out"; time: string; reason: string }): Promise<FixRequest> {
  return toFix(await api<BackendRequest>("/me/time-adjustments", { body: { date: input.workDate, [input.kind === "in" ? "timeIn" : "timeOut"]: input.time, reason: input.reason.trim() } }));
}

const KIND: Record<BackendType, MyRequest["kind"]> = { LEAVE: "Leave", OT: "Overtime", UNDERTIME: "Undertime", DTR_FIX: "Time adjustment" };
const HREF: Record<BackendType, string> = { LEAVE: "/employee/leave", OT: "/employee/overtime", UNDERTIME: "/employee/undertime", DTR_FIX: "/employee/attendance" };

export async function backendMyRequests(): Promise<MyRequest[]> {
  return (await myRequestsRaw()).map((r) => {
    const status = r.status === "PENDING" ? "Waiting for your manager" : r.status.charAt(0) + r.status.slice(1).toLowerCase();
    const tone = r.status === "APPROVED" ? "good" : r.status === "PENDING" ? "warn" : "crit";
    // The description without its first part (the kind, shown on its own).
    return { id: r.id, kind: KIND[r.type], detail: r.detail.split(" · ").slice(1).join(" · "), filedAt: r.createdAt, status, tone, href: HREF[r.type] };
  });
}
