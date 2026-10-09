// Timekeeping mock API. Each call stands in for an HTTP request.

import { fullName, initialsOf, newId, state as core } from "../corehr/store";
import { addDays, computeDay, longRuns, weekday } from "./compute";
import { HISTORY_DAYS, HOLIDAYS, branchOf, departmentOf, isOnLeave, leaveSpans, punchesFor, remoteDayFor, save, schedulingRules, shiftFor, tardinessRule, tk, todayIso, type LeaveSpan } from "./store";
import type { AttendanceNotice, DayResult, RemoteDay, FixCause, FixRequest, Punch, ShiftTemplate, TardinessRule, TimeRequest } from "./types";
import { awolDates } from "../pay/engine";
import { can, canFor, visible } from "../permissions";
import { deny, forbidden, sessionWho } from "../session";

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
        usualShiftId: tk.usualShift[e.id] ?? "sh-day",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** People whose attendance the signed-in person may see. */
const seen = () => visible(sessionWho(), "attendanceRecords", people(), (p) => p.id);

export function listPeople() {
  // Attendance setup (HR) sees everyone; otherwise whoever's attendance they may see.
  const who = sessionWho();
  if (can(who, "view", "attendanceSettings")) return respond(people());
  if (!can(who, "view", "attendanceRecords") && !can(who, "view", "remoteDays")) return forbidden();
  return respond(visible(who, can(who, "view", "attendanceRecords") ? "attendanceRecords" : "remoteDays", people(), (p) => p.id));
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
      overtimeThresholdMinutes: schedulingRules().overtimeThresholdMinutes,
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
  if (!can(sessionWho(), "view", "attendanceRecords")) return forbidden();
  ensureRequests();
  const ps = seen();
  return respond(dates(from, to).reverse().flatMap((d) => ps.map((p) => day(p, d))));
}

export function getDay(employeeId: string, date: string): Promise<DayRow | null> {
  const denied = deny("attendanceRecords", "view", employeeId);
  if (denied) return denied;
  const p = people().find((x) => x.id === employeeId);
  return respond(p ? day(p, date) : null);
}

export const earliestDate = () => addDays(todayIso(), -HISTORY_DAYS);

/** Who is on leave on a date, and until when. */
export function listLeave(date: string): Promise<(LeaveSpan & { person: TkPerson })[]> {
  if (!can(sessionWho(), "view", "attendanceRecords")) return forbidden();
  const ps = seen();
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
  const denied = deny("attendanceRecords", "view", employeeId);
  if (denied) return denied;
  return respond(tk.audit.filter((a) => a.employeeId === employeeId && (!workDate || a.workDate === workDate)));
}

/** Add a missing time-in / time-out (HR, or an approved time adjustment). */
export async function addCorrection(input: Parameters<typeof addCorrectionUnchecked>[0], actor: string): Promise<Punch> {
  const denied = deny("attendanceRecords", "edit", input.employeeId);
  if (denied) return denied;
  return addCorrectionUnchecked(input, actor);
}

async function addCorrectionUnchecked(input: { employeeId: string; workDate: string; kind: "in" | "out"; time: string; nextDay?: boolean; reason: string }, actor: string): Promise<Punch> {
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
  const denied = deny("attendanceRecords", "edit", punch.employeeId);
  if (denied) return denied;
  return setPunchAsideUnchecked(punch, reason, actor);
}

async function setPunchAsideUnchecked(punch: Punch, reason: string, actor: string): Promise<void> {
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
  const denied = deny("attendanceRecords", "edit", punch.employeeId);
  if (denied) return denied;
  save({
    ...tk,
    confirmed: { ...tk.confirmed, [punch.id]: { by: actor, at: new Date().toISOString() } },
    audit: [audit(punch.employeeId, punch.workDate, actor, "Kept flagged punch", `Time-${punch.kind} ${punch.at.slice(11)} (${punch.device}${punch.match !== undefined ? `, ${punch.match}% match` : ""})`), ...tk.audit],
  });
  return respond(undefined);
}

export async function restorePunch(punch: Punch, actor: string): Promise<void> {
  const denied = deny("attendanceRecords", "edit", punch.employeeId);
  if (denied) return denied;
  const rest = { ...tk.voided };
  delete rest[punch.id];
  save({ ...tk, voided: rest, audit: [audit(punch.employeeId, punch.workDate, actor, "Restored punch", `Time-${punch.kind} ${punch.at.slice(11)}`), ...tk.audit] });
  return respond(undefined);
}

// ---- Shifts and schedules ----

export function listShifts() {
  // Shift names are shown with attendance records and picked when adding people.
  const who = sessionWho();
  if (!can(who, "view", "attendanceSettings") && !can(who, "view", "attendanceRecords") && !can(who, "create", "people")) return forbidden();
  return respond(tk.shifts);
}

export async function saveShift(input: Omit<ShiftTemplate, "id" | "active"> & { id?: string }): Promise<ShiftTemplate> {
  const denied = deny("attendanceSettings", input.id ? "edit" : "create");
  if (denied) return denied;
  const name = input.name.trim();
  if (!name) return fail("Name the shift");
  if (!/^\d{2}:\d{2}$/.test(input.start) || !/^\d{2}:\d{2}$/.test(input.end)) return fail("Enter start and end times");
  if (input.start === input.end) return fail("Start and end can't be the same time");
  if (input.breakMinutes < 0 || input.breakMinutes > 120) return fail("Break should be between 0 and 120 minutes");
  if (input.breakMinutes > 0) {
    if (!/^d{2}:d{2}$/.test(input.breakStart)) return fail("Enter when lunch starts");
    const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    const len = (mins(input.end) - mins(input.start) + 1440) % 1440 || 1440;
    const into = (mins(input.breakStart) - mins(input.start) + 1440) % 1440;
    if (into === 0 || into + input.breakMinutes >= len) return fail("Lunch has to start and end within the shift");
  }
  if (input.graceMinutes < 0 || input.graceMinutes > 30) return fail("Grace period should be between 0 and 30 minutes");
  if (input.restDays.length === 0) return fail("Pick at least one rest day. Everyone is entitled to a rest day each week.");
  if (tk.shifts.some((s) => s.id !== input.id && s.name.toLowerCase() === name.toLowerCase())) return fail("There's already a shift with that name");
  const existing = tk.shifts.find((s) => s.id === input.id);
  const shift: ShiftTemplate = { active: true, ...existing, ...input, name, id: existing?.id ?? newId("sh") };
  save({ ...tk, shifts: existing ? tk.shifts.map((s) => (s.id === shift.id ? shift : s)) : [...tk.shifts, shift] });
  return respond(shift);
}

export async function setUsualShift(employeeIds: string[], shiftId: string | null, actor: string): Promise<void> {
  const denied = deny("attendanceSettings", "edit");
  if (denied) return denied;
  const usualShift = { ...tk.usualShift };
  for (const id of employeeIds) usualShift[id] = shiftId;
  const name = tk.shifts.find((s) => s.id === shiftId)?.name ?? "no shift";
  save({ ...tk, usualShift, audit: [...employeeIds.map((id) => audit(id, todayIso(), actor, "Changed usual shift", `Now on ${name}`)), ...tk.audit] });
  return respond(undefined);
}

/** One day only: a different shift, a rest day, or back to the usual schedule (null). */
export async function setDayShift(employeeId: string, date: string, value: string | "rest" | null, actor: string): Promise<void> {
  const denied = deny("attendanceSettings", "edit");
  if (denied) return denied;
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
  const denied = deny("attendanceSettings", "view");
  if (denied) return denied;
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
  const who = sessionWho();
  if (!can(who, "view", "attendanceRecords")) return forbidden();
  ensureRequests();
  return respond(visible(who, "attendanceRecords", [...tk.requests], (r) => r.employeeId).sort((a, b) => b.date.localeCompare(a.date)));
}

export async function decideRequest(id: string, approve: boolean, note: string, actor: string): Promise<TimeRequest> {
  const target = tk.requests.find((x) => x.id === id);
  const denied = deny("attendanceRecords", "approve", target?.employeeId);
  if (denied) return denied;
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
  const denied = deny("attendanceRecords", "create", input.employeeId);
  if (denied) return denied;
  if (!Number.isFinite(input.minutes) || input.minutes <= 0) return fail("Enter how many minutes");
  if (!input.reason.trim()) return fail("Give the reason");
  if (tk.requests.some((r) => r.employeeId === input.employeeId && r.date === input.date && r.type === input.type && r.status !== "declined")) return fail("There's already a request for that day");
  const req: TimeRequest = { id: newId("rq"), ...input, reason: input.reason.trim(), status: "pending", filedBy: actor, filedAt: new Date().toISOString() };
  save({ ...tk, requests: [req, ...tk.requests], audit: [audit(input.employeeId, input.date, actor, `Filed ${input.type}`, `${input.minutes} min: ${input.reason.trim()}`), ...tk.audit] });
  return respond(req);
}

// ---- Habitual tardiness ----

export function getTardinessRule() {
  const denied = deny("attendanceRecords", "view");
  if (denied) return denied;
  return respond(tardinessRule());
}

export async function saveTardinessRule(rule: TardinessRule): Promise<TardinessRule> {
  const denied = deny("rules", "edit");
  if (denied) return denied;
  if (!Number.isInteger(rule.consecutive) || rule.consecutive < 0 || rule.consecutive === 1 || rule.consecutive > 10) return fail("Days in a row should be 2 to 10, or 0 to turn it off");
  if (!Number.isInteger(rule.perMonth) || rule.perMonth < 0 || rule.perMonth === 1 || rule.perMonth > 31) return fail("Times a month should be 2 to 31, or 0 to turn it off");
  save({ ...tk, tardinessRule: { consecutive: rule.consecutive, perMonth: rule.perMonth } });
  return respond(tardinessRule());
}

export interface TardinessFlag {
  person: TkPerson;
  /** Runs of late work days in a row that met the rule, newest first. */
  streaks: { from: string; to: string; days: number }[];
  /** Times late this month, when it met the rule. */
  thisMonth?: number;
  /** Every late day looked at, newest first. */
  lateDates: string[];
}

/**
 * People whose lateness meets the rule: streaks over the last 30 days, and the
 * count for the current month. Only scheduled work days count; a day off, leave
 * or holiday in between doesn't break a streak, an on-time or absent day does.
 */
export function listTardinessFlags(): Promise<TardinessFlag[]> {
  if (!can(sessionWho(), "view", "attendanceRecords")) return forbidden();
  ensureRequests();
  const rule = tardinessRule();
  const today = todayIso();
  const month = today.slice(0, 7);
  const from = [`${month}-01`, addDays(today, -29)].sort()[0]!;
  const span = dates(from, today);
  const flags: TardinessFlag[] = [];
  for (const p of seen()) {
    const work = span.map((d) => day(p, d)).filter((d) => d.kind === "work" && d.status !== "upcoming" && d.status !== "not-in");
    const streaks: TardinessFlag["streaks"] = [];
    let run: string[] = [];
    const close = () => {
      if (rule.consecutive && run.length >= rule.consecutive) streaks.push({ from: run[0]!, to: run[run.length - 1]!, days: run.length });
      run = [];
    };
    for (const d of work) {
      if (d.lateMinutes > 0) run.push(d.date);
      else close();
    }
    close();
    const late = work.filter((d) => d.lateMinutes > 0).map((d) => d.date);
    const monthCount = late.filter((d) => d.startsWith(month)).length;
    const thisMonth = rule.perMonth && monthCount >= rule.perMonth ? monthCount : undefined;
    if (streaks.length || thisMonth) flags.push({ person: p, streaks: streaks.reverse(), thisMonth, lateDates: late.reverse() });
  }
  return respond(flags.sort((a, b) => b.lateDates.length - a.lateDates.length));
}

export interface AwolFlag {
  person: TkPerson;
  /** Days counted as AWOL in the last 30 days: the 3rd straight absent workday on. */
  dates: string[];
}

/** People absent 3 or more workdays in a row in the last 30 days. */
export function listAwolFlags(): Promise<AwolFlag[]> {
  if (!can(sessionWho(), "view", "attendanceRecords")) return forbidden();
  ensureRequests();
  const today = todayIso();
  const span = dates(addDays(today, -29), today);
  const flags: AwolFlag[] = [];
  for (const p of seen()) {
    const awol = [...awolDates(span.map((d) => day(p, d)))].sort().reverse();
    if (awol.length) flags.push({ person: p, dates: awol });
  }
  return respond(flags.sort((a, b) => b.dates.length - a.dates.length));
}

// ---- Remote work days (typhoons, emergencies) ----

export function listRemoteDays() {
  const denied = deny("remoteDays", "view");
  if (denied) return denied;
  return respond([...(tk.remoteDays ?? [])].sort((a, b) => b.from.localeCompare(a.from)));
}

export async function declareRemoteDay(input: Pick<RemoteDay, "from" | "to" | "offices" | "reason">, actor: string): Promise<RemoteDay> {
  const denied = deny("remoteDays", "create");
  if (denied) return denied;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || !/^\d{4}-\d{2}-\d{2}$/.test(input.to)) return fail("Choose the dates");
  if (input.to < input.from) return fail("The last day can't be before the first");
  if (input.to < todayIso()) return fail("Those days have passed. Fix past attendance with time adjustments instead.");
  if (!input.reason.trim()) return fail("Give the reason, for example \"Typhoon Kristine, Signal No. 3\"");
  const covers = (d: RemoteDay) => !d.offices.length || !input.offices.length || d.offices.some((o) => input.offices.includes(o));
  if ((tk.remoteDays ?? []).some((d) => d.from <= input.to && d.to >= input.from && covers(d))) return fail("Some of those days are already remote work days for these offices");
  const day: RemoteDay = { id: newId("rd"), from: input.from, to: input.to, offices: input.offices, reason: input.reason.trim(), declaredBy: actor, declaredAt: new Date().toISOString() };
  save({ ...tk, remoteDays: [day, ...(tk.remoteDays ?? [])] });
  return respond(day);
}

export async function cancelRemoteDay(id: string): Promise<void> {
  const denied = deny("remoteDays", "delete");
  if (denied) return denied;
  const d = (tk.remoteDays ?? []).find((x) => x.id === id);
  if (!d) return fail("That remote work day no longer exists");
  if (d.from <= todayIso() && (tk.remotePunches ?? []).some((p) => p.workDate >= d.from && p.workDate <= d.to)) {
    return fail("People already clocked in from home on these days, so they stay on record. You can only cancel days that haven't started.");
  }
  save({ ...tk, remoteDays: (tk.remoteDays ?? []).filter((x) => x.id !== id) });
  return respond(undefined);
}

export interface ClockState {
  /** Today's first time-in and last time-out from the office devices (or HR's corrections). */
  office?: { in?: Punch; out?: Punch };
  /** Today's remote work day for this person, if any: only then can they clock in from home. */
  remoteDay?: RemoteDay;
  /** Their remote time-in today, if they clocked in. */
  inAt?: string;
  outAt?: string;
}

export function clockState(employeeId: string): Promise<ClockState> {
  // Anyone may see and record their own clock-ins; anyone else's needs attendance access.
  const who = sessionWho();
  if (employeeId !== who.employeeId && !canFor(who, "view", "attendanceRecords", employeeId)) return forbidden();
  const date = todayIso();
  const mine = (tk.remotePunches ?? []).filter((p) => p.employeeId === employeeId && p.workDate === date && !tk.voided[p.id]);
  const remoteDay = remoteDayFor(employeeId, date);
  // What the office devices (or HR's corrections) recorded today; not the clock-ins from home.
  const fromHome = new Set((tk.remotePunches ?? []).map((p) => p.id));
  const officePunches = punchesFor(employeeId, date).filter((p) => !p.voided && !fromHome.has(p.id));
  const office = { in: officePunches.find((p) => p.kind === "in"), out: officePunches.filter((p) => p.kind === "out").pop() };
  return respond({ remoteDay, office, inAt: mine.find((p) => p.kind === "in")?.at, outAt: mine.filter((p) => p.kind === "out").pop()?.at });
}

/** Records a time-in or time-out from home after a face scan. Only on a remote work day. */
/**
 * Work from home today, or back to an office day. Switching back sets today's face-scan times
 * aside (kept on record, not counted), so the office scanner's times count again.
 * HR-declared remote days can't be undone here.
 */
export async function setWorkFromHome(employeeId: string, on: boolean, actor = "Employee"): Promise<void> {
  const who = sessionWho();
  if (employeeId !== who.employeeId) return forbidden();
  const date = todayIso();
  const declared = remoteDayFor(employeeId, date);
  if (declared && declared.declaredBy !== "self") return fail("Today is already a remote work day for your office");
  const today = (tk.remotePunches ?? []).filter((p) => p.employeeId === employeeId && p.workDate === date && !tk.voided[p.id]);
  const rest = (tk.wfh ?? []).filter((w) => !(w.employeeId === employeeId && w.date === date));
  const at = new Date().toISOString();
  const voided = on ? tk.voided : { ...tk.voided, ...Object.fromEntries(today.map((p) => [p.id, { reason: "Switched back to an office day", by: actor, at }])) };
  save({ ...tk, voided, wfh: on ? [...rest, { id: newId("wfh"), employeeId, date, declaredAt: at }] : rest });
  return respond(undefined);
}

export async function clockRemote(employeeId: string, kind: "in" | "out", match: number, actor: string, method: "face" | "biometric" = "face", location?: Punch["location"]): Promise<Punch> {
  const who = sessionWho();
  if (employeeId !== who.employeeId && !canFor(who, "edit", "attendanceRecords", employeeId)) return forbidden();
  const date = todayIso();
  const day = remoteDayFor(employeeId, date);
  if (!day) return fail("Remote clock-in is only open on remote work days that HR declares");
  const mine = (tk.remotePunches ?? []).filter((p) => p.employeeId === employeeId && p.workDate === date && !tk.voided[p.id]);
  if (kind === "in" && mine.some((p) => p.kind === "in")) return fail("You already clocked in today");
  if (kind === "out" && !mine.some((p) => p.kind === "in")) return fail("Clock in first");
  const now = new Date();
  const punch: Punch = {
    id: newId("pr"),
    employeeId,
    workDate: date,
    at: `${date}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    kind,
    source: method,
    device: method === "face" ? "Remote · face scan" : "Remote · fingerprint",
    deviceRegistered: true,
    ...(method === "face" ? { match } : {}),
    ...(location ? { location } : {}),
    reason: day.reason,
    recordedBy: actor,
  };
  save({ ...tk, remotePunches: [...(tk.remotePunches ?? []), punch] });
  return respond(punch);
}

/** Who covered by a remote day has clocked in from home today. */
export function remoteAttendanceToday(): Promise<{ covered: TkPerson[]; clockedIn: string[] }> {
  const denied = deny("remoteDays", "view");
  if (denied) return denied;
  const date = todayIso();
  const covered = people().filter((p) => remoteDayFor(p.id, date) && shiftFor(p.id, date).kind === "work" && !isOnLeave(p.id, date));
  const clockedIn = [...new Set((tk.remotePunches ?? []).filter((p) => p.workDate === date && p.kind === "in" && !tk.voided[p.id]).map((p) => p.employeeId))];
  return respond({ covered, clockedIn });
}

// ---- Notices to employees about lateness or AWOL ----

export function listNotices(employeeId?: string) {
  const who = sessionWho();
  if (!can(who, "view", "attendanceRecords")) return forbidden();
  return respond(visible(who, "attendanceRecords", tk.notices ?? [], (n) => n.employeeId).filter((n) => !employeeId || n.employeeId === employeeId).sort((a, b) => b.sentAt.localeCompare(a.sentAt)));
}

export async function sendNotice(input: Pick<AttendanceNotice, "employeeId" | "kind" | "subject" | "message" | "dates">, actor: string): Promise<AttendanceNotice> {
  const denied = deny("attendanceRecords", "edit", input.employeeId);
  if (denied) return denied;
  if (!input.subject.trim()) return fail("Give the notice a subject");
  if (!input.message.trim()) return fail("Write the message the employee will read");
  const notice: AttendanceNotice = { id: newId("nt"), ...input, subject: input.subject.trim(), message: input.message.trim(), sentBy: actor, sentAt: new Date().toISOString() };
  const workDate = input.dates[0] ?? todayIso();
  save({ ...tk, notices: [notice, ...(tk.notices ?? [])], audit: [audit(input.employeeId, workDate, actor, `Sent ${input.kind === "awol" ? "AWOL" : "tardiness"} notice`, notice.subject), ...tk.audit] });
  return respond(notice);
}

export async function acknowledgeNotice(id: string, employeeId: string): Promise<void> {
  const who = sessionWho();
  if (employeeId !== who.employeeId) return forbidden();
  const n = (tk.notices ?? []).find((x) => x.id === id && x.employeeId === employeeId);
  if (!n) return fail("That notice no longer exists");
  if (!n.acknowledgedAt) save({ ...tk, notices: (tk.notices ?? []).map((x) => (x.id === id ? { ...x, acknowledgedAt: new Date().toISOString() } : x)) });
  return respond(undefined);
}

// ---- Missed time-in / time-out requests ----

export function listFixes() {
  const who = sessionWho();
  if (!can(who, "view", "attendanceRecords")) return forbidden();
  return respond(visible(who, "attendanceRecords", [...tk.fixRequests], (r) => r.employeeId).sort((a, b) => b.filedAt.localeCompare(a.filedAt)));
}

/** The punches of one kind still counting on a day (not set aside). */
const livePunches = (employeeId: string, workDate: string, kind: "in" | "out") => punchesFor(employeeId, workDate).filter((p) => p.kind === kind && !p.voided);

/** The time-in (earliest) or time-out (latest) on record, "HH:MM". */
function recordedTime(employeeId: string, workDate: string, kind: "in" | "out") {
  const ats = livePunches(employeeId, workDate, kind).map((p) => p.at).sort();
  const at = kind === "in" ? ats[0] : ats[ats.length - 1];
  return at?.slice(11, 16);
}

export async function fileFix(input: { employeeId: string; workDate: string; kind: "in" | "out"; time: string; nextDay?: boolean; cause: FixCause; reason: string }, actor: string): Promise<FixRequest> {
  const denied = deny("attendanceRecords", "create", input.employeeId);
  if (denied) return denied;
  if (!/^\d{2}:\d{2}$/.test(input.time)) return fail("Enter the correct time");
  if (!input.reason.trim()) return fail("Say what happened, for example \"the scanner didn't read my finger\"");
  const at = `${input.nextDay ? addDays(input.workDate, 1) : input.workDate}T${input.time}`;
  if (new Date(at).getTime() > Date.now()) return fail("That time hasn't happened yet");
  if (input.workDate < addDays(todayIso(), -30)) return fail("Requests can only go back 30 days. Talk to HR for older records.");
  const recorded = recordedTime(input.employeeId, input.workDate, input.kind);
  if (input.cause === "wrong-time" && !recorded) return fail(`There's no time-${input.kind} on record that day. Choose "Biometrics didn't record it" instead.`);
  if (recorded === input.time && !input.nextDay) return fail(`Your time-${input.kind} is already ${input.time} on record`);
  if (tk.fixRequests.some((r) => r.employeeId === input.employeeId && r.workDate === input.workDate && r.kind === input.kind && r.status === "pending")) return fail(`You already asked to adjust the time-${input.kind} for that day`);
  const req: FixRequest = { id: newId("fx"), ...input, recorded, reason: input.reason.trim(), status: "pending", filedBy: actor, filedAt: new Date().toISOString() };
  save({ ...tk, fixRequests: [req, ...tk.fixRequests], audit: [audit(input.employeeId, input.workDate, actor, `Asked to adjust time-${input.kind}`, `${recorded ? `${recorded} → ` : ""}${input.time}${input.nextDay ? " (next day)" : ""}: ${req.reason}`), ...tk.audit] });
  return respond(req);
}

/**
 * Approving adds the punch to the record, exactly as if HR had added it. When the
 * device recorded the wrong time, its punch is set aside first so the new one counts.
 */
export async function decideFix(id: string, approve: boolean, note: string, actor: string): Promise<FixRequest> {
  const target = tk.fixRequests.find((x) => x.id === id);
  const denied = deny("attendanceRecords", "approve", target?.employeeId);
  if (denied) return denied;
  const r = tk.fixRequests.find((x) => x.id === id);
  if (!r) return fail("That request no longer exists");
  if (r.status !== "pending") return fail("This request was already decided");
  if (!approve && !note.trim()) return fail("Add a short note so the employee knows why");
  if (approve) {
    if (r.cause === "wrong-time") {
      for (const p of livePunches(r.employeeId, r.workDate, r.kind)) await setPunchAsideUnchecked(p, `Wrong time from the device, replaced by an approved adjustment: ${r.reason}`, actor);
    }
    await addCorrectionUnchecked({ employeeId: r.employeeId, workDate: r.workDate, kind: r.kind, time: r.time, nextDay: r.nextDay, reason: `Employee request: ${r.reason}` }, actor);
  }
  const next: FixRequest = { ...r, status: approve ? "approved" : "declined", decidedBy: actor, decidedAt: new Date().toISOString(), note: note.trim() || undefined };
  save({
    ...tk,
    fixRequests: tk.fixRequests.map((x) => (x.id === id ? next : x)),
    audit: approve ? tk.audit : [audit(r.employeeId, r.workDate, actor, `Declined time-${r.kind} adjustment`, note.trim()), ...tk.audit],
  });
  return respond(next);
}
