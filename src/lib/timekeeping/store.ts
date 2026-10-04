// Timekeeping data. Device punches are generated deterministically from the
// employee and date, so "today" fills in as the clock moves and nothing large
// sits in localStorage. What HR changes (shifts, schedules, corrections,
// set-aside punches, requests, audit) is saved.

import { state as core } from "../corehr/store";
import { addDays, at, isOvernight, toIsoDate, weekday } from "./compute";
import type { Holiday, Punch, ShiftTemplate, TimeAudit, TimeRequest } from "./types";

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
  audit: TimeAudit[];
  seededRequests: boolean;
}

const KEY = "heyhr-timekeeping-v1";
/** How far back device logs go. */
export const HISTORY_DAYS = 40;

export const HOLIDAYS: Holiday[] = [
  { date: "2026-08-21", name: "Ninoy Aquino Day", type: "special", source: "Proclamation (2026 holidays)" },
  { date: "2026-08-31", name: "National Heroes Day", type: "regular", source: "Proclamation (2026 holidays)" },
  { date: "2026-11-01", name: "All Saints' Day", type: "special", source: "Proclamation (2026 holidays)" },
  { date: "2026-11-30", name: "Bonifacio Day", type: "regular", source: "Proclamation (2026 holidays)" },
  { date: "2026-12-08", name: "Feast of the Immaculate Conception", type: "special", source: "Proclamation (2026 holidays)" },
  { date: "2026-12-24", name: "Christmas Eve", type: "special", source: "Proclamation (2026 holidays)" },
  { date: "2026-12-25", name: "Christmas Day", type: "regular", source: "Proclamation (2026 holidays)" },
];

const SHIFTS: ShiftTemplate[] = [
  { id: "sh-day", name: "Day shift", start: "08:00", end: "17:00", breakMinutes: 60, graceMinutes: 10, restDays: [0, 6], active: true },
  { id: "sh-mid", name: "Mid shift", start: "09:00", end: "18:00", breakMinutes: 60, graceMinutes: 10, restDays: [0, 6], active: true },
  { id: "sh-night", name: "Night IT support", start: "22:00", end: "06:00", breakMinutes: 60, graceMinutes: 10, restDays: [5, 6], active: true },
  { id: "sh-weekend", name: "Weekend front desk", start: "08:00", end: "17:00", breakMinutes: 60, graceMinutes: 10, restDays: [1, 2], active: true },
];

const DEVICES: Record<string, { biometric: string; face: string }> = {
  "Cebu HQ": { biometric: "Cebu HQ lobby, 8F", face: "Cebu HQ face kiosk" },
  Manila: { biometric: "Manila 21F entrance", face: "Manila face kiosk" },
  Davao: { biometric: "Davao 3F entrance", face: "Davao face kiosk" },
};

const today = () => toIsoDate(new Date());

function seed(): TimekeepingState {
  const usualShift: Record<string, string | null> = {};
  for (const e of core.employees) {
    const branch = branchOf(e.job.unitId);
    usualShift[e.id] = e.id === "MSMA-00812" ? "sh-night" : e.id === "MSMA-00845" ? "sh-weekend" : branch === "Manila" ? "sh-mid" : "sh-day";
  }
  // Ferdz covers an extra Monday this week: six days in a row, which the roster should flag.
  const monday = addDays(today(), -((weekday(today()) + 6) % 7));
  return { shifts: SHIFTS, usualShift, overrides: { [`MSMA-00845|${monday}`]: "sh-weekend" }, corrections: [], voided: {}, confirmed: {}, requests: [], audit: [], seededRequests: false };
}

function load(): TimekeepingState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as TimekeepingState;
      if (Array.isArray(s.shifts) && s.usualShift) return { ...s, confirmed: s.confirmed ?? {} };
    }
  } catch {
    // Blocked or corrupt storage: start from the seed.
  }
  return seed();
}

export let tk: TimekeepingState = load();

export function save(next: TimekeepingState) {
  tk = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(tk));
  } catch {
    // Storage full or blocked: the change still applies for this session.
  }
}

// ---- Who's where ----

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

export function shiftFor(employeeId: string, date: string): { kind: "work" | "rest" | "unscheduled"; shift?: ShiftTemplate; override: boolean } {
  const o = tk.overrides[`${employeeId}|${date}`];
  if (o === "rest") return { kind: "rest", override: true };
  if (o) {
    const s = tk.shifts.find((x) => x.id === o);
    if (s) return { kind: "work", shift: s, override: true };
  }
  const usual = tk.shifts.find((x) => x.id === tk.usualShift[employeeId]);
  if (!usual) return { kind: "unscheduled", override: false };
  return usual.restDays.includes(weekday(date)) ? { kind: "rest", shift: usual, override: false } : { kind: "work", shift: usual, override: false };
}

export interface LeaveSpan {
  employeeId: string;
  type: string;
  from: string;
  to: string;
}

/** Approved leave (mock). People marked "On leave" in Core HR get a span around today. */
export function leaveSpans(): LeaveSpan[] {
  const t = today();
  const plan: Record<string, [string, number, number]> = {
    "MSMA-00560": ["Vacation leave", -4, 1],
    "MSMA-00341": ["Sick leave", -2, 3],
    "MSMA-00398": ["Vacation leave", -3, 5],
  };
  const spans: LeaveSpan[] = core.employees
    .filter((e) => e.job.status === "On leave")
    .map((e) => {
      const [type, a, b] = plan[e.id] ?? ["Vacation leave", -1, 2];
      return { employeeId: e.id, type, from: addDays(t, a), to: addDays(t, b) };
    });
  // A past one-day leave, so leave also shows in older logs.
  spans.push({ employeeId: "MSMA-00482", type: "Vacation leave", from: addDays(t, -12), to: addDays(t, -12) });
  return spans;
}

export function isOnLeave(employeeId: string, date: string) {
  return leaveSpans().some((s) => s.employeeId === employeeId && date >= s.from && date <= s.to);
}

// ---- Device punches (generated) ----

function rng(seedText: string) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const local = (ms: number) => {
  const d = new Date(ms);
  return `${toIsoDate(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** The most recent Saturday before today. */
const lastSaturday = () => addDays(today(), -(((weekday(today()) + 1) % 7) || 7));

function devicePunchesFor(employeeId: string, date: string): Punch[] {
  const e = core.employees.find((x) => x.id === employeeId);
  if (!e || e.job.status === "Separated") return [];
  const branch = branchOf(e.job.unitId);
  const dev = DEVICES[branch] ?? DEVICES["Cebu HQ"]!;
  const r = rng(`${employeeId}|${date}`);
  const daysAgo = Math.round((new Date(`${today()}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86_400_000);
  const mk = (kind: "in" | "out", ms: number, extra: Partial<Punch> = {}): Punch => {
    const face = r() < (branch === "Cebu HQ" ? 0.55 : 0.3);
    return {
      id: `p-${employeeId}-${date}-${kind}${extra.id ?? ""}`,
      employeeId,
      workDate: date,
      at: local(ms),
      kind,
      source: face ? "face" : "biometric",
      device: face ? dev.face : dev.biometric,
      deviceBranch: branch,
      deviceRegistered: true,
      ...(face ? { match: 88 + Math.floor(r() * 12) } : {}),
      ...extra,
    };
  };

  // Rafael put in rest-day overtime last Saturday.
  if (employeeId === "MSMA-00317" && date === lastSaturday()) {
    return [mk("in", at(date, "09:02"), { source: "face", device: dev.face, match: 96 }), mk("out", at(date, "14:10"), { source: "face", device: dev.face, match: 94 })];
  }

  const { kind, shift } = shiftFor(employeeId, date);
  if (kind !== "work" || !shift || isOnLeave(employeeId, date) || HOLIDAYS.some((h) => h.date === date)) return [];

  const start = at(date, shift.start);
  let end = at(date, shift.end);
  if (isOvernight(shift)) end += 86_400_000;
  const roll = r();
  const inMs = start + (roll < 0.16 ? 11 + Math.floor(r() * 25) : -15 + Math.floor(r() * 23)) * 60_000;
  const outRoll = r();
  const outMs = end + (outRoll < 0.1 ? -(20 + Math.floor(r() * 45)) : outRoll < 0.24 ? 60 + Math.floor(r() * 95) : Math.floor(r() * 22)) * 60_000;

  let punches = [mk("in", inMs), mk("out", outMs)];

  // Scenarios HR should see and fix.
  if ((employeeId === "MSMA-00276" && daysAgo === 3) || (employeeId === "MSMA-00623" && daysAgo === 9)) punches = [punches[0]!]; // missing time-out
  if (employeeId === "MSMA-00203" && daysAgo === 5) punches.splice(1, 0, mk("in", inMs + 2 * 60_000, { id: "b" })); // double punch
  if (employeeId === "MSMA-00203" && date === addDays(today(), -2)) punches[1] = mk("out", at(date, "16:10")); // left early, filed undertime
  if (employeeId === "MSMA-00733" && daysAgo === 4) punches[0] = { ...punches[0]!, source: "face", device: dev.face, match: 74 };
  if (employeeId === "MSMA-00611" && daysAgo === 7) punches[0] = { ...punches[0]!, source: "biometric", device: "Unregistered device", deviceRegistered: false, match: undefined };
  if (employeeId === "MSMA-00098" && daysAgo === 6) punches[0] = { ...punches[0]!, source: "biometric", device: DEVICES["Cebu HQ"]!.biometric, deviceBranch: "Cebu HQ", match: undefined };
  if (employeeId === "MSMA-00482" && daysAgo === 1 && weekday(date) !== 0 && weekday(date) !== 6) punches[0] = mk("in", at(date, "08:14"));

  // Only what has happened by now.
  const now = Date.now();
  return punches.filter((p) => new Date(p.at).getTime() <= now);
}

/** Every punch for a person's day: device punches plus HR's corrections, with HR's decisions applied. */
export function punchesFor(employeeId: string, date: string): Punch[] {
  const mark = (p: Punch): Punch => ({ ...p, ...(tk.voided[p.id] ? { voided: tk.voided[p.id] } : {}), ...(tk.confirmed[p.id] ? { confirmed: tk.confirmed[p.id] } : {}) });
  const device = devicePunchesFor(employeeId, date).map(mark);
  const manual = tk.corrections.filter((p) => p.employeeId === employeeId && p.workDate === date).map(mark);
  return [...device, ...manual];
}

export const todayIso = today;
