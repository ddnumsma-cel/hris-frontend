// Attendance from the backend: each person's daily time records and the device punches behind them, shaped like
// the in-browser timekeeping days (DayRow) so the Attendance logs page and the reports work unchanged. The day is
// worked out here from the real punches (./compute), then the backend's own figures (worked, late, undertime, night,
// approved overtime) replace the local ones, since payroll uses the backend's.

import { api } from "./client";
import { backendIdOf, backendPeople, employeeNoOf } from "./people";
import { addDays, computeDay, longRuns } from "../timekeeping/compute";
import { schedulingRules } from "../timekeeping/store";
import { holidayOn, isDoubleHoliday } from "../holidays";
import type { DayRow, RosterCell, RosterRow, TkPerson } from "../timekeeping/api";
import type { DayKind, Punch, PunchSource, ShiftTemplate } from "../timekeeping/types";

interface BackendShift {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  workDays: number[];
  breakStart?: string | null;
  flexible?: boolean;
  requiredMinutes?: number | null;
  saturdayEnd?: string | null;
  active?: boolean;
}

interface BackendDay {
  employeeId: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  workedMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  otMinutes: number;
  nightDiffMinutes: number;
  status: "PRESENT" | "ABSENT" | "LEAVE" | "RESTDAY" | "HOLIDAY";
  remarks: string | null;
  punches: { id: string; punchedAt: string; verifyMode: string; deviceSerial: string }[];
}

interface DaysResponse {
  employees: { id: string; shift: BackendShift }[];
  days: BackendDay[];
}

/** The backend allows 62 days per call. */
const WINDOW_DAYS = 62;

/** A backend shift as a Timekeeping shift template (lunch at noon when the backend has no lunch start). */
export function shiftTemplateOf(s: BackendShift): ShiftTemplate {
  return {
    id: s.id,
    name: s.name,
    start: s.startTime,
    end: s.endTime,
    breakMinutes: s.breakMinutes,
    breakStart: s.breakStart ?? "12:00",
    graceMinutes: s.graceMinutes,
    restDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => !s.workDays.includes(d)),
    ...(s.flexible ? { flexible: true, requiredHours: (s.requiredMinutes ?? 480) / 60 } : {}),
    ...(s.saturdayEnd ? { saturdayEnd: s.saturdayEnd } : {}),
    active: s.active ?? true,
  };
}

/**
 * The Schedules roster for a week from the backend: each person on their usual shift, working its work days and
 * resting on the others (holidays from the company calendar). Day-by-day changes aren't on the backend yet.
 */
export async function backendRoster(weekStart: string): Promise<RosterRow[]> {
  const [people, shifts] = await Promise.all([backendPeople(), api<BackendShift[]>("/org/shifts")]);
  const byId = new Map(shifts.map((s) => [s.id, s]));
  const span = (from: string, to: string) => {
    const out: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
    return out;
  };
  const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
  const week = span(weekStart, addDays(weekStart, 6));
  const context = span(addDays(weekStart, -6), addDays(weekStart, 13));
  return people.map((p) => {
    const s = p.usualShiftId ? byId.get(p.usualShiftId) : undefined;
    const works = (date: string) => Boolean(s?.workDays.includes(weekday(date)));
    const cells = week.map((date): RosterCell => {
      if (!s) return { date, kind: "unscheduled", label: "No shift", changed: false };
      const holiday = holidayOn(date, p.branch);
      if (holiday && works(date)) return { date, kind: "holiday", shiftId: s.id, label: holiday.name, changed: false };
      return works(date) ? { date, kind: "work", shiftId: s.id, label: s.name, changed: false } : { date, kind: "rest", label: "Rest day", changed: false };
    });
    const run = longRuns(context.map((date) => ({ date, working: works(date) }))).find((r) => r.to >= weekStart && r.from <= addDays(weekStart, 6));
    return { person: p, cells, longRun: run };
  });
}

/** Add or edit a shift on the backend (Attendance › Shifts). */
export async function backendSaveShift(input: Omit<ShiftTemplate, "id" | "active"> & { id?: string }): Promise<ShiftTemplate> {
  const body = {
    name: input.name.trim(),
    startTime: input.start,
    endTime: input.end,
    breakMinutes: input.breakMinutes,
    breakStart: input.breakStart || null,
    graceMinutes: input.graceMinutes,
    workDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => !input.restDays.includes(d)),
    flexible: Boolean(input.flexible),
    requiredMinutes: input.flexible ? Math.round((input.requiredHours ?? 8) * 60) : null,
    saturdayEnd: input.saturdayEnd || null,
  };
  const saved = input.id
    ? await api<BackendShift>(`/org/shifts/${encodeURIComponent(input.id)}`, { method: "PUT", body })
    : await api<BackendShift>("/org/shifts", { method: "POST", body });
  return shiftTemplateOf(saved);
}

/** Put people (employee numbers) on a usual shift from today. */
export async function backendSetUsualShift(employeeNos: string[], shiftId: string | null): Promise<void> {
  if (!shiftId) throw new Error("Everyone needs a usual shift on the HR server: pick another shift instead.");
  const employeeIds = (await Promise.all(employeeNos.map((no) => backendIdOf(no)))).filter((x): x is string => Boolean(x));
  await api("/org/usual-shift", { method: "PUT", body: { employeeIds, shiftId } });
}

/** "2026-10-26T06:40:03.000Z" → Manila wall clock "2026-10-26T14:40". */
const manilaLocal = (iso: string) => new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(0, 16);

const SOURCE: Record<string, PunchSource> = { FACE: "face", SELFIE: "face" };

const KIND: Partial<Record<BackendDay["status"], DayKind>> = { RESTDAY: "rest", LEAVE: "leave", HOLIDAY: "holiday" };

async function fetchDays(from: string, to: string, employeeId?: string): Promise<DaysResponse> {
  const out: DaysResponse = { employees: [], days: [] };
  for (let start = from; start <= to; start = addDays(start, WINDOW_DAYS)) {
    const end = addDays(start, WINDOW_DAYS - 1) < to ? addDays(start, WINDOW_DAYS - 1) : to;
    const r = await api<DaysResponse>("/attendance/days", { query: { from: start, to: end, ...(employeeId ? { employeeId } : {}) } });
    if (!out.employees.length) out.employees = r.employees;
    out.days.push(...r.days);
  }
  return out;
}

/** Device names and offices; payroll accounts can't list devices, so their punches show the serial. */
async function deviceNames(): Promise<Map<string, { name: string; siteName: string }>> {
  try {
    const list = await api<{ serial: string; name: string; siteName: string }[]>("/devices");
    return new Map(list.map((d) => [d.serial, { name: d.name, siteName: d.siteName }]));
  } catch {
    return new Map();
  }
}

function toDayRow(person: TkPerson, date: string, shift: ShiftTemplate | undefined, workDays: number[], day: BackendDay | undefined, devices: Map<string, { name: string; siteName: string }>): DayRow {
  const punches: Punch[] = (day?.punches ?? []).map((p, i) => {
    const device = p.deviceSerial === "MOBILE-APP" ? { name: "Phone app", siteName: undefined } : devices.get(p.deviceSerial);
    return {
      id: p.id,
      employeeId: person.id,
      workDate: date,
      at: manilaLocal(p.punchedAt),
      // The backend counts the first punch of the day as time-in and the last as time-out.
      kind: i === 0 ? "in" : "out",
      source: SOURCE[p.verifyMode] ?? "biometric",
      device: device?.name ?? p.deviceSerial,
      deviceBranch: device?.siteName,
      deviceRegistered: true,
    };
  });
  const weekdayWorks = workDays.includes(new Date(`${date}T00:00:00Z`).getUTCDay());
  const kind: DayKind = (day && KIND[day.status]) ?? (shift ? (weekdayWorks ? "work" : "rest") : "unscheduled");
  const result = computeDay({
    employeeId: person.id,
    date,
    kind,
    shift,
    holiday: holidayOn(date, person.branch),
    punches,
    employeeBranch: person.branch,
    now: Date.now(),
    approvedOvertimeMinutes: day?.otMinutes ?? 0,
    undertimeExcused: Boolean(day?.remarks?.includes("UNDERTIME_APPROVED")),
    overtimeThresholdMinutes: schedulingRules().overtimeThresholdMinutes,
  });
  const fromBackend = day
    ? { workedMinutes: day.workedMinutes, lateMinutes: day.lateMinutes, undertimeMinutes: day.undertimeMinutes, nightMinutes: day.nightDiffMinutes }
    : {};
  return { ...result, ...fromBackend, person, doubleHoliday: isDoubleHoliday(date, person.branch) };
}

/** Every person's day for each date in [from, to], newest first (like the local listDays). */
export async function backendDays(from: string, to: string): Promise<DayRow[]> {
  const [people, data, devices] = await Promise.all([backendPeople(), fetchDays(from, to), deviceNames()]);
  const shiftOf = new Map(data.employees.map((e) => [employeeNoOf(e.id) ?? e.id, e.shift]));
  const dayOf = new Map(data.days.map((d) => [`${employeeNoOf(d.employeeId) ?? d.employeeId}|${d.date}`, d]));
  const dates: string[] = [];
  for (let d = to; d >= from; d = addDays(d, -1)) dates.push(d);
  return dates.flatMap((date) =>
    people.map((p) => {
      const s = shiftOf.get(p.id);
      return toDayRow(p, date, s ? shiftTemplateOf(s) : undefined, s?.workDays ?? [], dayOf.get(`${p.id}|${date}`), devices);
    }),
  );
}

/** The backend's shifts, for the Add employee form and attendance settings. Turned-off shifts nobody is on are left out. */
export async function backendShifts(): Promise<ShiftTemplate[]> {
  const shifts = await api<(BackendShift & { people?: number })[]>("/org/shifts");
  return shifts.filter((s) => s.active !== false || (s.people ?? 0) > 0).map(shiftTemplateOf);
}

/** One person's day (employee number + date). */
export async function backendDay(employeeNo: string, date: string): Promise<DayRow | null> {
  const [people, id, devices] = await Promise.all([backendPeople(), backendIdOf(employeeNo), deviceNames()]);
  const person = people.find((p) => p.id === employeeNo);
  if (!person || !id) return null;
  const data = await fetchDays(date, date, id);
  const s = data.employees[0]?.shift;
  return toDayRow(person, date, s ? shiftTemplateOf(s) : undefined, s?.workDays ?? [], data.days.find((d) => d.date === date), devices);
}
