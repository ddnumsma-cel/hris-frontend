// Timekeeping data. No attendance device is connected yet, so punches come only
// from remote clock-ins and HR's corrections. What HR changes (shifts, schedules, corrections,
// set-aside punches, requests, audit) is saved: to localStorage, or with the API server to the
// database, in which case this store is a cache loaded after sign-in.

import { state as core } from "../corehr/store";
import { defaultBreakStart, toIsoDate, weekday } from "./compute";
import { HOLIDAYS } from "../holidays";
import { api, serverMode } from "../http";
import { approvedLeaveSpans } from "../leave/store";
import { DEFAULT_SHIFT_ID, DEFAULT_SHIFTS, DEFAULT_TARDINESS_RULE } from "./rules";
import type { AttendanceNotice, Punch, RemoteDay, ShiftTemplate, TardinessRule, TimeAudit, FixRequest, TimeRequest } from "./types";

export interface TimekeepingState {
  shifts: ShiftTemplate[];
  /** Each employee's usual shift; null = none assigned. */
  usualShift: Record<string, string | null>;
  /** One-day changes, keyed "employeeId|date": a shift id, or "rest". */
  overrides: Record<string, string>;
  /** Manual punches HR added. */
  corrections: Punch[];
  /** Device punches HR set aside, by punch id. */
  voided: Record<string, NonNullable<Punch["voided"]>>;
  confirmed: Record<string, NonNullable<Punch["confirmed"]>>;
  requests: TimeRequest[];
  /** Missed time-in/out that employees asked HR to add. */
  fixRequests: FixRequest[];
  audit: TimeAudit[];
  seededRequests: boolean;
  /** Shifts moved to the 8:30 AM start with a 5-minute grace (Peak and Busy season). */
  seasonShifts?: boolean;
  /** Missing until HR changes it; read through tardinessRule(). */
  tardinessRule?: TardinessRule;
  /** Memos HR sent about lateness or AWOL. */
  notices?: AttendanceNotice[];
  /** Work-from-home days HR declared (typhoons, emergencies). */
  remoteDays?: RemoteDay[];
  /** Time-ins and time-outs people recorded themselves from home with a face scan. */
  remotePunches?: Punch[];
  /** Days someone chose to work from home themselves (from their Home page), one per person per day. */
  wfh?: { id: string; employeeId: string; date: string; declaredAt: string }[];
  /** Company-wide rules from Settings > Scheduling. */
  rules?: Partial<SchedulingRules>;
}

export interface SchedulingRules {
  /** Extra time after a shift shorter than this isn't counted as overtime. */
  overtimeThresholdMinutes: number;
  /** Lunch break pre-filled for new shifts. */
  defaultBreakMinutes: number;
  /** TODO: there's no schedule publishing step yet; stored for when there is. */
  publishLeadDays: number;
}

export const DEFAULT_SCHEDULING_RULES: SchedulingRules = { overtimeThresholdMinutes: 0, defaultBreakMinutes: 60, publishLeadDays: 7 };
export const schedulingRules = (): SchedulingRules => ({ ...DEFAULT_SCHEDULING_RULES, ...tk.rules });

/**
 * The remote work day covering this person on this date, if any: one HR declared for their
 * office, or a day they chose to work from home (offices empty, reason "Working from home").
 */
export function remoteDayFor(employeeId: string, date: string): RemoteDay | undefined {
  const e = core.employees.find((x) => x.id === employeeId);
  const branch = e ? branchOf(e.job.unitId) : undefined;
  const declared = (tk.remoteDays ?? []).find((d) => d.from <= date && d.to >= date && (!d.offices.length || (branch !== undefined && d.offices.includes(branch))));
  if (declared) return declared;
  const own = (tk.wfh ?? []).find((w) => w.employeeId === employeeId && w.date === date);
  return own && { id: own.id, from: date, to: date, offices: [], reason: "Working from home", declaredBy: "self", declaredAt: own.declaredAt };
}

/** True when the remote day is one the person chose themselves (they can switch back before clocking in). */
export const isOwnWfh = (d: RemoteDay | undefined) => d?.declaredBy === "self";

export { DEFAULT_TARDINESS_RULE };
export const tardinessRule = () => tk.tardinessRule ?? DEFAULT_TARDINESS_RULE;

const KEY = "heyhr-timekeeping-v2";
/** How far back device logs go. */
export const HISTORY_DAYS = 40;

export { HOLIDAYS };

const SHIFTS: ShiftTemplate[] = DEFAULT_SHIFTS;

/** Shifts that were retired; people on them move to the shift given here. */
const RETIRED: Record<string, string> = { "sh-night": "sh-flex", "sh-weekend": "sh-day" };

/** Brings saved data up to the current set of shifts: Busy season, Peak season, Mid and Flexible time. */
function normalizeShifts(s: TimekeepingState): TimekeepingState {
  const shifts = [...s.shifts.filter((x) => !RETIRED[x.id]), ...SHIFTS.filter((x) => !s.shifts.some((y) => y.id === x.id))].map((x) => ({ ...x, breakStart: x.breakStart ?? defaultBreakStart(x) }))
    // Flexible time now opens at 8:30 AM like the other shifts (it used to be 7:00 AM).
    .map((x) => (x.id === "sh-flex" && x.start === "07:00" ? { ...x, start: "08:30" } : x));
  const usualShift = Object.fromEntries(Object.entries(s.usualShift).map(([id, sh]) => [id, sh && RETIRED[sh] ? RETIRED[sh] : (sh ?? "sh-day")]));
  const overrides = Object.fromEntries(Object.entries(s.overrides).filter(([, v]) => !RETIRED[v]));
  return { ...s, shifts: s.seasonShifts ? shifts : toSeasonShifts(shifts), seasonShifts: true, usualShift, overrides };
}

/** Saved shifts from before the 8:30 start: move the untouched 8:00 ones to 8:30 and use the 5-minute grace. */
function toSeasonShifts(shifts: ShiftTemplate[]): ShiftTemplate[] {
  return shifts.map((x) => {
    const base = SHIFTS.find((d) => d.id === x.id);
    const untouched = base && x.start === "08:00";
    return { ...x, ...(untouched ? { name: base.name, start: base.start, end: base.end } : {}), graceMinutes: x.flexible ? 0 : 5 };
  });
}

const today = () => toIsoDate(new Date());

function seed(): TimekeepingState {
  const usualShift: Record<string, string | null> = {};
  for (const e of core.employees) {
    const branch = branchOf(e.job.unitId);
    usualShift[e.id] = branch === "Manila" ? "sh-mid" : "sh-day";
  }
  return { shifts: SHIFTS, usualShift, overrides: {}, corrections: [], voided: {}, confirmed: {}, requests: [], fixRequests: [], audit: [], seededRequests: true, seasonShifts: true };
}

const empty = (): TimekeepingState => ({ shifts: [], usualShift: {}, overrides: {}, corrections: [], voided: {}, confirmed: {}, requests: [], fixRequests: [], audit: [], seededRequests: true, seasonShifts: true });

function load(): TimekeepingState {
  // With the API server, the records come from the database (see refreshTimekeeping).
  if (serverMode) return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as TimekeepingState;
      if (Array.isArray(s.shifts) && s.usualShift) return normalizeShifts({ ...s, confirmed: s.confirmed ?? {}, fixRequests: s.fixRequests ?? [] });
    }
  } catch {
    // Blocked or corrupt storage: start from the seed.
  }
  return seed();
}

export let tk: TimekeepingState = load();

export function save(next: TimekeepingState) {
  tk = next;
  if (serverMode) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(tk));
  } catch {
    // Storage full or blocked: the change still applies for this session.
  }
}

// ---- Who's where ----

/** The office an employee works in, for office-only holidays. */
export const branchOfEmployee = (employeeId: string) => {
  const e = core.employees.find((x) => x.id === employeeId);
  return e ? branchOf(e.job.unitId) : undefined;
};

export function branchOf(unitId: string) {
  let u = core.units.find((x) => x.id === unitId);
  while (u && u.type !== "branch") u = core.units.find((x) => x.id === u!.parentId);
  return u?.name ?? "";
}

export function departmentOf(unitId: string) {
  let u = core.units.find((x) => x.id === unitId);
  while (u && u.type !== "department") u = core.units.find((x) => x.id === u!.parentId);
  return u;
}

// ---- Schedule for a day ----

/** The shift as worked on a date: a six-day shift's Saturday ends early, with no lunch break. */
function onDate(s: ShiftTemplate, date: string): ShiftTemplate {
  return s.saturdayEnd && weekday(date) === 6 ? { ...s, end: s.saturdayEnd, breakMinutes: 0 } : s;
}

export function shiftFor(employeeId: string, date: string): { kind: "work" | "rest" | "unscheduled"; shift?: ShiftTemplate; override: boolean } {
  const o = tk.overrides[`${employeeId}|${date}`];
  if (o === "rest") return { kind: "rest", override: true };
  if (o) {
    const s = tk.shifts.find((x) => x.id === o);
    if (s) return { kind: "work", shift: onDate(s, date), override: true };
  }
  // Anyone without a usual shift yet (e.g. newly added) works the Day shift.
  const usual = tk.shifts.find((x) => x.id === (tk.usualShift[employeeId] ?? DEFAULT_SHIFT_ID));
  if (!usual) return { kind: "unscheduled", override: false };
  return usual.restDays.includes(weekday(date)) ? { kind: "rest", shift: usual, override: false } : { kind: "work", shift: onDate(usual, date), override: false };
}

export interface LeaveSpan {
  employeeId: string;
  type: string;
  from: string;
  to: string;
}

/** Approved leave, from Leave Management. */
export function leaveSpans(): LeaveSpan[] {
  return approvedLeaveSpans();
}

export function isOnLeave(employeeId: string, date: string) {
  return leaveSpans().some((s) => s.employeeId === employeeId && date >= s.from && date <= s.to);
}

// ---- Device punches ----

// No scanner or face kiosk is connected yet, so there are no device punches;
// a real device feed plugs in here.
function devicePunchesFor(_employeeId: string, _date: string): Punch[] {
  return [];
}

/** Every punch for a person's day: device punches plus HR's corrections, with HR's decisions applied. */
export function punchesFor(employeeId: string, date: string): Punch[] {
  const mark = (p: Punch): Punch => ({ ...p, ...(tk.voided[p.id] ? { voided: tk.voided[p.id] } : {}), ...(tk.confirmed[p.id] ? { confirmed: tk.confirmed[p.id] } : {}) });
  // On a remote work day nobody is at the office, so the scanners have nothing; only remote clock-ins count.
  const device = remoteDayFor(employeeId, date) ? [] : devicePunchesFor(employeeId, date).map(mark);
  const manual = tk.corrections.filter((p) => p.employeeId === employeeId && p.workDate === date).map(mark);
  const remote = (tk.remotePunches ?? []).filter((p) => p.employeeId === employeeId && p.workDate === date).map(mark);
  return [...device, ...manual, ...remote];
}

export const todayIso = today;

// ---- With the API server ----

let loading: Promise<void> | null = null;
let loadedAt = 0;

/** Loads timekeeping from the API server. Reads within a moment of the last load reuse it. */
export function refreshTimekeeping(maxAgeMs = 0): Promise<void> {
  if (!serverMode) return Promise.resolve();
  if (loading) return loading;
  if (maxAgeMs && Date.now() - loadedAt < maxAgeMs) return Promise.resolve();
  loading = api<TimekeepingState>("GET", "/timekeeping/state")
    .then((next) => {
      tk = next;
      loadedAt = Date.now();
    })
    .finally(() => (loading = null));
  return loading;
}

export function clearTimekeeping() {
  if (!serverMode) return;
  loadedAt = 0;
  tk = empty();
}
