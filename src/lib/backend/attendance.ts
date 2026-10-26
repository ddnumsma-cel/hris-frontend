// Attendance from the backend: each person's daily time records and the device punches behind them, shaped like
// the in-browser timekeeping days (DayRow) so the Attendance logs page and the reports work unchanged. The day is
// worked out here from the real punches (./compute), then the backend's own figures (worked, late, undertime, night,
// approved overtime) replace the local ones, since payroll uses the backend's.

import { api } from "./client";
import { backendIdOf, backendPeople, employeeNoOf } from "./people";
import { addDays, computeDay } from "../timekeeping/compute";
import { schedulingRules } from "../timekeeping/store";
import { holidayOn, isDoubleHoliday } from "../holidays";
import type { DayRow, TkPerson } from "../timekeeping/api";
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

/** A backend shift as a Timekeeping shift template (lunch at noon, the website's default). */
export function shiftTemplateOf(s: BackendShift): ShiftTemplate {
  return {
    id: s.id,
    name: s.name,
    start: s.startTime,
    end: s.endTime,
    breakMinutes: s.breakMinutes,
    breakStart: "12:00",
    graceMinutes: s.graceMinutes,
    restDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => !s.workDays.includes(d)),
    active: true,
  };
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

/** The backend's shifts, for the Add employee form and attendance settings. */
export async function backendShifts(): Promise<ShiftTemplate[]> {
  const f = await api<{ shifts: BackendShift[] }>("/employees/filters");
  return f.shifts.map(shiftTemplateOf);
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
