// Timekeeping mock API. Each call stands in for an HTTP request.

import { fullName, initialsOf, newId, state as core } from "../corehr/store";
import { addDays, computeDay, longRuns, weekday } from "./compute";
import { HISTORY_DAYS, HOLIDAYS, branchOf, departmentOf, isOnLeave, leaveSpans, punchesFor, save, shiftFor, tk, todayIso, type LeaveSpan } from "./store";
import type { DayResult, Punch, ShiftTemplate, TimeRequest, FixRequest } from "./types";

const DELAY = 250;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));

export interface TkPerson {
  id: string;
  name: string;
  initials: string;
  positionTitle: string;
  departmentId: string;
  departmentName: string;
  branch: string;
  monthlySalary: number;
  usualShiftId: string | null;
}

function people(): TkPerson[] {
  return core.employees
    .filter((e) => e.job.status !== "Separated")
    .map((e) => {
      const dept = departmentOf(e.job.unitId);
      return {
        id: e.id,
        name: fullName(e.personal),
        initials: initialsOf(e.personal),
        positionTitle: core.positions.find((p) => p.id === e.job.positionId)?.title ?? "",
        departmentId: dept?.id ?? "",
        departmentName: dept?.name ?? "",
        branch: branchOf(e.job.unitId),
        monthlySalary: e.job.monthlySalary,
        usualShiftId: e.id in tk.usualShift ? tk.usualShift[e.id]! : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listPeople() {
  return respond(people());
}

export interface DayRow extends DayResult {
  person: TkPerson;
}

function day(p: TkPerson, date: string): DayRow {
  const sched = shiftFor(p.id, date);
  const holiday = HOLIDAYS.find((h) => h.date === date);
  const kind = isOnLeave(p.id, date) ? "leave" : holiday && sched.kind === "work" ? "holiday" : sched.kind;
  const req = tk.requests.filter((r) => r.employeeId === p.id && r.date === date && r.status === "approved");
  return {
    ...computeDay({
      employeeId: p.id,
      date,
      kind,
      shift: sched.shift,
      holiday,
      punches: punchesFor(p.id, date),
      employeeBranch: p.branch,
      now: Date.now(),
      approvedOvertimeMinutes: req.filter((r) => r.type === "overtime").reduce((n, r) => n + r.minutes, 0),
      undertimeExcused: req.some((r) => r.type === "undertime"),
    }),
    person: p,
  };
}

function dates(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Every person's day for each date in [from, to], newest first. */
export function listDays(from: string, to: string): Promise<DayRow[]> {
  ensureRequests();
  const ps = people();
  return respond(dates(from, to).reverse().flatMap((d) => ps.map((p) => day(p, d))));
}

export function getDay(employeeId: string, date: string): Promise<DayRow | null> {
  const p = people().find((x) => x.id === employeeId);
  return respond(p ? day(p, date) : null);
}

export const earliestDate = () => addDays(todayIso(), -HISTORY_DAYS);

/** Who is on leave on a date, and until when. */
export function listLeave(date: string): Promise<(LeaveSpan & { person: TkPerson })[]> {
  const ps = people();
  return respond(
    leaveSpans()
      .filter((s) => date >= s.from && date <= s.to)
      .flatMap((s) => {
        const person = ps.find((p) => p.id === s.employeeId);
        return person ? [{ ...s, person }] : [];
      }),
  );
}

// ---- Corrections ----

function audit(employeeId: string, workDate: string, actor: string, action: string, detail: string) {
  return { id: newId("ta"), employeeId, workDate, actor, action, detail, at: new Date().toISOString() };
}

export function listAudit(employeeId: string, workDate?: string) {
  return respond(tk.audit.filter((a) => a.employeeId === employeeId && (!workDate || a.workDate === workDate)));
}

export async function addCorrection(input: { employeeId: string; workDate: string; kind: "in" | "out"; time: string; nextDay?: boolean; reason: string }, actor: string): Promise<Punch> {
  if (!/^\d{2}:\d{2}$/.test(input.time)) return fail("Enter the time");
  if (!input.reason.trim()) return fail("Say why you're adding this punch, for example \"forgot to tap out, confirmed by supervisor\"");
  const date = input.nextDay ? addDays(input.workDate, 1) : input.workDate;
  const atText = `${date}T${input.time}`;
  if (new Date(atText).getTime() > Date.now()) return fail("That time hasn't happened yet");
  const p = people().find((x) => x.id === input.employeeId);
  const punch: Punch = {
    id: newId("pm"),
    employeeId: input.employeeId,
    workDate: input.workDate,
    at: atText,
    kind: input.kind,
    source: "manual",
    device: "Added by HR",
    deviceBranch: p?.branch,
    deviceRegistered: true,
    reason: input.reason.trim(),
    recordedBy: actor,
  };
  save({ ...tk, corrections: [...tk.corrections, punch], audit: [audit(input.employeeId, input.workDate, actor, "Added punch", `Time-${input.kind} ${input.time}${input.nextDay ? " (next day)" : ""}: ${input.reason.trim()}`), ...tk.audit] });
  return respond(punch);
}

export async function setPunchAside(punch: Punch, reason: string, actor: string): Promise<void> {
  if (!reason.trim()) return fail("Say why this punch should be ignored");
  const time = punch.at.slice(11);
  save({
    ...tk,
    voided: { ...tk.voided, [punch.id]: { reason: reason.trim(), by: actor, at: new Date().toISOString() } },
    audit: [audit(punch.employeeId, punch.workDate, actor, "Set punch aside", `Time-${punch.kind} ${time} (${punch.device}): ${reason.trim()}`), ...tk.audit],
  });
  return respond(undefined);
}

export async function confirmPunch(punch: Punch, actor: string): Promise<void> {
  save({
    ...tk,
    confirmed: { ...tk.confirmed, [punch.id]: { by: actor, at: new Date().toISOString() } },
    audit: [audit(punch.employeeId, punch.workDate, actor, "Kept flagged punch", `Time-${punch.kind} ${punch.at.slice(11)} (${punch.device}${punch.match !== undefined ? `, ${punch.match}% match` : ""})`), ...tk.audit],
  });
  return respond(undefined);
}

export async function restorePunch(punch: Punch, actor: string): Promise<void> {
  const rest = { ...tk.voided };
  delete rest[punch.id];
  save({ ...tk, voided: rest, audit: [audit(punch.employeeId, punch.workDate, actor, "Restored punch", `Time-${punch.kind} ${punch.at.slice(11)}`), ...tk.audit] });
  return respond(undefined);
}

// ---- Shifts and schedules ----

export function listShifts() {
  return respond(tk.shifts);
}

export async function saveShift(input: Omit<ShiftTemplate, "id" | "active"> & { id?: string }): Promise<ShiftTemplate> {
  const name = input.name.trim();
  if (!name) return fail("Name the shift");
  if (!/^\d{2}:\d{2}$/.test(input.start) || !/^\d{2}:\d{2}$/.test(input.end)) return fail("Enter start and end times");
  if (input.start === input.end) return fail("Start and end can't be the same time");
  if (input.breakMinutes < 0 || input.breakMinutes > 120) return fail("Break should be between 0 and 120 minutes");
  if (input.graceMinutes < 0 || input.graceMinutes > 30) return fail("Grace period should be between 0 and 30 minutes");
  if (input.restDays.length === 0) return fail("Pick at least one rest day. Everyone is entitled to a rest day each week.");
  if (tk.shifts.some((s) => s.id !== input.id && s.name.toLowerCase() === name.toLowerCase())) return fail("There's already a shift with that name");
  const existing = tk.shifts.find((s) => s.id === input.id);
  const shift: ShiftTemplate = { active: true, ...existing, ...input, name, id: existing?.id ?? newId("sh") };
  save({ ...tk, shifts: existing ? tk.shifts.map((s) => (s.id === shift.id ? shift : s)) : [...tk.shifts, shift] });
  return respond(shift);
}

export async function setUsualShift(employeeIds: string[], shiftId: string | null, actor: string): Promise<void> {
  const usualShift = { ...tk.usualShift };
  for (const id of employeeIds) usualShift[id] = shiftId;
  const name = tk.shifts.find((s) => s.id === shiftId)?.name ?? "no shift";
  save({ ...tk, usualShift, audit: [...employeeIds.map((id) => audit(id, todayIso(), actor, "Changed usual shift", `Now on ${name}`)), ...tk.audit] });
  return respond(undefined);
}

/** One day only: a different shift, a rest day, or back to the usual schedule (null). */
export async function setDayShift(employeeId: string, date: string, value: string | "rest" | null, actor: string): Promise<void> {
  const overrides = { ...tk.overrides };
  const k = `${employeeId}|${date}`;
  if (value === null) delete overrides[k];
  else overrides[k] = value;
  const label = value === null ? "back to usual schedule" : value === "rest" ? "rest day" : (tk.shifts.find((s) => s.id === value)?.name ?? value);
  save({ ...tk, overrides, audit: [audit(employeeId, date, actor, "Changed schedule", label), ...tk.audit] });
  return respond(undefined);
}

export interface RosterCell {
  date: string;
  kind: "work" | "rest" | "leave" | "holiday" | "unscheduled";
  shiftId?: string;
  label: string;
  changed: boolean;
}

export interface RosterRow {
  person: TkPerson;
  cells: RosterCell[];
  /** Six or more working days in a row around this week. */
  longRun?: { from: string; to: string; length: number };
}

export function getRoster(weekStart: string): Promise<RosterRow[]> {
  const week = dates(weekStart, addDays(weekStart, 6));
  const context = dates(addDays(weekStart, -6), addDays(weekStart, 13));
  return respond(
    people().map((p) => {
      const cells = week.map((date): RosterCell => {
        const s = shiftFor(p.id, date);
        const holiday = HOLIDAYS.find((h) => h.date === date);
        if (isOnLeave(p.id, date)) return { date, kind: "leave", label: "On leave", changed: false };
        if (holiday && s.kind === "work") return { date, kind: "holiday", shiftId: s.shift?.id, label: holiday.name, changed: s.override };
        return { date, kind: s.kind, shiftId: s.kind === "work" ? s.shift?.id : undefined, label: s.kind === "work" ? s.shift!.name : s.kind === "rest" ? "Rest day" : "No shift", changed: s.override };
      });
      const run = longRuns(context.map((date) => ({ date, working: shiftFor(p.id, date).kind === "work" && !isOnLeave(p.id, date) }))).find((r) => r.to >= weekStart && r.from <= addDays(weekStart, 6));
      return { person: p, cells, longRun: run };
    }),
  );
}

// ---- Overtime and undertime requests ----

/** First run only: a handful of realistic requests built from the generated logs. */
function ensureRequests() {
  if (tk.seededRequests) return;
  const ps = people();
  const reqs: TimeRequest[] = [];
  const t = todayIso();
  const mk = (p: TkPerson, date: string, type: TimeRequest["type"], minutes: number, reason: string, status: TimeRequest["status"]): TimeRequest => ({
    id: newId("rq"),
    employeeId: p.id,
    date,
    type,
    minutes,
    reason,
    status,
    filedBy: p.name,
    filedAt: `${date}T18:30:00`,
    ...(status !== "pending" ? { decidedBy: "Dinah Marquez", decidedAt: `${addDays(date, 1)}T09:15:00` } : {}),
  });
  const reasons = ["Client deadline: quarterly VAT filing", "Year-end audit fieldwork", "Month-end closing", "Server patching after hours", "Urgent BIR submission"];
  let i = 0;
  for (const date of dates(addDays(t, -10), addDays(t, -1)).reverse()) {
    for (const p of ps) {
      const d = day(p, date);
      if (d.kind === "work" && d.extraMinutes >= 60 && i < 7) {
        const minutes = Math.floor(d.extraMinutes / 30) * 30;
        reqs.push(mk(p, date, "overtime", minutes, reasons[i % reasons.length]!, i < 4 ? "pending" : i === 4 ? "declined" : "approved"));
        i++;
      }
    }
  }
  const rafael = ps.find((p) => p.id === "MSMA-00317");
  const sat = addDays(t, -(((weekday(t) + 1) % 7) || 7));
  if (rafael) reqs.push(mk(rafael, sat, "overtime", 240, "Year-end audit fieldwork, client on site Saturday", "approved"));
  const carla = ps.find((p) => p.id === "MSMA-00203");
  if (carla) reqs.push(mk(carla, addDays(t, -2), "undertime", 50, "Clinic appointment, medical certificate attached", "pending"));
  if (reqs[4]) reqs[4].note = "Please file before the work is done next time.";
  save({ ...tk, requests: reqs, seededRequests: true });
}

export function listRequests() {
  ensureRequests();
  return respond([...tk.requests].sort((a, b) => b.date.localeCompare(a.date)));
}

export async function decideRequest(id: string, approve: boolean, note: string, actor: string): Promise<TimeRequest> {
  const r = tk.requests.find((x) => x.id === id);
  if (!r) return fail("That request no longer exists");
  if (r.status !== "pending") return fail("This request was already decided");
  if (!approve && !note.trim()) return fail("Add a short note so the employee knows why");
  const next: TimeRequest = { ...r, status: approve ? "approved" : "declined", decidedBy: actor, decidedAt: new Date().toISOString(), note: note.trim() || undefined };
  save({
    ...tk,
    requests: tk.requests.map((x) => (x.id === id ? next : x)),
    audit: [audit(r.employeeId, r.date, actor, approve ? `Approved ${r.type}` : `Declined ${r.type}`, `${r.minutes} min${note.trim() ? `: ${note.trim()}` : ""}`), ...tk.audit],
  });
  return respond(next);
}

export async function fileRequest(input: { employeeId: string; date: string; type: TimeRequest["type"]; minutes: number; reason: string }, actor: string): Promise<TimeRequest> {
  if (!Number.isFinite(input.minutes) || input.minutes <= 0) return fail("Enter how many minutes");
  if (!input.reason.trim()) return fail("Give the reason");
  if (tk.requests.some((r) => r.employeeId === input.employeeId && r.date === input.date && r.type === input.type && r.status !== "declined")) return fail("There's already a request for that day");
  const req: TimeRequest = { id: newId("rq"), ...input, reason: input.reason.trim(), status: "pending", filedBy: actor, filedAt: new Date().toISOString() };
  save({ ...tk, requests: [req, ...tk.requests], audit: [audit(input.employeeId, input.date, actor, `Filed ${input.type}`, `${input.minutes} min: ${input.reason.trim()}`), ...tk.audit] });
  return respond(req);
}

// ---- Missed time-in / time-out requests ----

export function listFixes() {
  return respond([...tk.fixRequests].sort((a, b) => b.filedAt.localeCompare(a.filedAt)));
}

export async function fileFix(input: { employeeId: string; workDate: string; kind: "in" | "out"; time: string; nextDay?: boolean; reason: string }, actor: string): Promise<FixRequest> {
  if (!/^\d{2}:\d{2}$/.test(input.time)) return fail("Enter the time");
  if (!input.reason.trim()) return fail("Say what happened, for example \"forgot to tap out\"");
  const at = `${input.nextDay ? addDays(input.workDate, 1) : input.workDate}T${input.time}`;
  if (new Date(at).getTime() > Date.now()) return fail("That time hasn't happened yet");
  if (input.workDate < addDays(todayIso(), -30)) return fail("Requests can only go back 30 days. Talk to HR for older records.");
  if (tk.fixRequests.some((r) => r.employeeId === input.employeeId && r.workDate === input.workDate && r.kind === input.kind && r.status === "pending")) return fail(`You already asked to fix the time-${input.kind} for that day`);
  const req: FixRequest = { id: newId("fx"), ...input, reason: input.reason.trim(), status: "pending", filedBy: actor, filedAt: new Date().toISOString() };
  save({ ...tk, fixRequests: [req, ...tk.fixRequests], audit: [audit(input.employeeId, input.workDate, actor, `Asked to fix time-${input.kind}`, `${input.time}${input.nextDay ? " (next day)" : ""}: ${req.reason}`), ...tk.audit] });
  return respond(req);
}

/** Approving adds the punch to the record, exactly as if HR had added it. */
export async function decideFix(id: string, approve: boolean, note: string, actor: string): Promise<FixRequest> {
  const r = tk.fixRequests.find((x) => x.id === id);
  if (!r) return fail("That request no longer exists");
  if (r.status !== "pending") return fail("This request was already decided");
  if (!approve && !note.trim()) return fail("Add a short note so the employee knows why");
  if (approve) await addCorrection({ employeeId: r.employeeId, workDate: r.workDate, kind: r.kind, time: r.time, nextDay: r.nextDay, reason: `Employee request: ${r.reason}` }, actor);
  const next: FixRequest = { ...r, status: approve ? "approved" : "declined", decidedBy: actor, decidedAt: new Date().toISOString(), note: note.trim() || undefined };
  save({
    ...tk,
    fixRequests: tk.fixRequests.map((x) => (x.id === id ? next : x)),
    audit: approve ? tk.audit : [audit(r.employeeId, r.workDate, actor, `Declined time-${r.kind} fix`, note.trim()), ...tk.audit],
  });
  return respond(next);
}
