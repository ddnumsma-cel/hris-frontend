// Pure timekeeping math: no storage, no React. Payroll can reuse every function here.

import type { DayIssue, DayKind, DayResult, DayStatus, DayType, Holiday, PremiumRate, Punch, ShiftTemplate } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Philippine premiums (Labor Code / DOLE handbook). Verify before real payroll. */
export const PREMIUM_RATES: PremiumRate[] = [
  { dayType: "ordinary", firstEightHours: 1, overtime: 1.25, effectiveFrom: "1989-01-01", source: "Labor Code Art. 87", lastVerified: "2026-09" },
  { dayType: "rest", firstEightHours: 1.3, overtime: 1.69, effectiveFrom: "1989-01-01", source: "Labor Code Art. 93", lastVerified: "2026-09" },
  { dayType: "special", firstEightHours: 1.3, overtime: 1.69, effectiveFrom: "1989-01-01", source: "DOLE Handbook on Statutory Benefits", lastVerified: "2026-09" },
  { dayType: "regular", firstEightHours: 2, overtime: 2.6, effectiveFrom: "1989-01-01", source: "Labor Code Art. 94", lastVerified: "2026-09" },
];
/** Extra share of the hourly rate for work between 10 PM and 6 AM (Labor Code Art. 86). */
export const NIGHT_DIFFERENTIAL = 0.1;
/** Working days a year for a 5-day week. Company policy; confirm with the accountant. */
export const WORKING_DAYS_PER_YEAR = 261;

/** "2026-10-02" + "08:00" → epoch ms (local time). */
export function at(date: string, hhmm: string) {
  return new Date(`${date}T${hhmm}:00`).getTime();
}

export function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

export function weekday(date: string) {
  return new Date(`${date}T12:00:00`).getDay();
}

export const isOvernight = (s: Pick<ShiftTemplate, "start" | "end">) => s.end <= s.start;

/** Scheduled hours, net of break. */
export function shiftHours(s: ShiftTemplate) {
  const [sh, sm] = s.start.split(":").map(Number);
  const [eh, em] = s.end.split(":").map(Number);
  let minutes = eh! * 60 + em! - (sh! * 60 + sm!);
  if (minutes <= 0) minutes += 24 * 60;
  return (minutes - s.breakMinutes) / 60;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Minutes of [start, end] that fall between 10 PM and 6 AM. */
export function nightMinutesBetween(start: number, end: number) {
  let total = 0;
  const first = new Date(start);
  first.setHours(0, 0, 0, 0);
  for (let day = first.getTime() - 24 * HOUR; day <= end; day += 24 * HOUR) {
    total += overlap(start, end, day + 22 * HOUR, day + 30 * HOUR);
  }
  return Math.round(total / MINUTE);
}

export interface DayInput {
  employeeId: string;
  date: string;
  kind: DayKind;
  shift?: ShiftTemplate;
  holiday?: Holiday;
  punches: Punch[];
  employeeBranch: string;
  now: number;
  approvedOvertimeMinutes: number;
  undertimeExcused: boolean;
}

/** Minimum face-recognition match to trust a punch without a second look. */
export const FACE_MATCH_THRESHOLD = 85;
/** Two punches of the same kind this close together count as a double punch. */
const DOUBLE_PUNCH_WINDOW = 10 * MINUTE;
/** How long after a shift ends we wait for a time-out before calling it missing. */
const OUT_WAIT = 2 * HOUR;

export function computeDay(input: DayInput): DayResult {
  const { shift, kind, now } = input;
  const punches = [...input.punches].sort((a, b) => a.at.localeCompare(b.at));
  const live = punches.filter((p) => !p.voided);
  const ins = live.filter((p) => p.kind === "in");
  const outs = live.filter((p) => p.kind === "out");
  const timeIn = ins[0];
  const timeOut = outs.length && timeIn ? outs.filter((o) => o.at > timeIn.at).pop() : undefined;
  const tIn = timeIn ? new Date(timeIn.at).getTime() : undefined;
  const tOut = timeOut ? new Date(timeOut.at).getTime() : undefined;
  const dayType: DayType = input.holiday ? input.holiday.type : kind === "rest" ? "rest" : "ordinary";

  const issues: DayIssue[] = [];
  for (const group of [ins, outs]) {
    for (let i = 1; i < group.length; i++) {
      if (new Date(group[i]!.at).getTime() - new Date(group[i - 1]!.at).getTime() < DOUBLE_PUNCH_WINDOW) {
        issues.push({ kind: "double-punch", punchId: group[i]!.id, text: `Time-${group[i]!.kind} recorded twice` });
      }
    }
  }
  for (const p of live.filter((x) => !x.confirmed)) {
    if (p.source === "face" && p.match !== undefined && p.match < FACE_MATCH_THRESHOLD) issues.push({ kind: "low-match", punchId: p.id, text: `Face match only ${p.match}%` });
    if (!p.deviceRegistered) issues.push({ kind: "unknown-device", punchId: p.id, text: `Punch from an unregistered device` });
    else if (p.source !== "manual" && p.deviceBranch && p.deviceBranch !== input.employeeBranch) issues.push({ kind: "outside-branch", punchId: p.id, text: `Punched in at ${p.deviceBranch}, not ${input.employeeBranch}` });
  }
  if (!timeIn && outs.length) issues.push({ kind: "missing-in", text: "Time-out but no time-in" });

  let shiftStart: number | undefined;
  let shiftEnd: number | undefined;
  if (shift) {
    shiftStart = at(input.date, shift.start);
    shiftEnd = at(input.date, shift.end);
    if (shiftEnd <= shiftStart) shiftEnd += 24 * HOUR;
  }

  let status: DayStatus;
  let lateRaw = 0;
  let late = 0;
  let undertime = 0;
  let extra = 0;
  let worked = 0;
  let night = 0;

  if (tIn !== undefined && tOut !== undefined) {
    const span = tOut - tIn;
    const breakMs = shift && span >= 5 * HOUR ? shift.breakMinutes * MINUTE : 0;
    worked = Math.max(0, Math.round((span - breakMs) / MINUTE));
    night = nightMinutesBetween(tIn, tOut);
  }

  if (kind === "work" && shift && shiftStart !== undefined && shiftEnd !== undefined) {
    if (tIn !== undefined) {
      lateRaw = Math.max(0, Math.round((tIn - shiftStart) / MINUTE));
      late = Math.max(0, lateRaw - shift.graceMinutes);
    }
    if (tOut !== undefined) {
      undertime = Math.max(0, Math.round((shiftEnd - tOut) / MINUTE));
      extra = Math.max(0, Math.round((tOut - shiftEnd) / MINUTE));
    }
    if (tIn === undefined) status = now < shiftStart ? "upcoming" : now < shiftEnd ? "not-in" : "absent";
    else if (tOut === undefined) {
      if (now < shiftEnd + OUT_WAIT) status = "working";
      else {
        status = "done";
        issues.push({ kind: "missing-out", text: "No time-out recorded" });
      }
    } else status = "done";
  } else if (tIn !== undefined) {
    // Work on a rest day, holiday or unscheduled day: all of it is extra time.
    extra = worked;
    status = tOut === undefined ? (now < tIn + 12 * HOUR ? "working" : "done") : "done";
    if (tOut === undefined && status === "done") issues.push({ kind: "missing-out", text: "No time-out recorded" });
  } else {
    status = kind === "work" ? "unscheduled" : kind;
  }

  return {
    employeeId: input.employeeId,
    date: input.date,
    kind,
    dayType,
    status,
    shift,
    holiday: input.holiday,
    shiftStart,
    shiftEnd,
    timeIn,
    timeOut,
    punches,
    workedMinutes: worked,
    lateMinutes: late,
    lateRawMinutes: lateRaw,
    undertimeMinutes: undertime,
    extraMinutes: extra,
    approvedOvertimeMinutes: Math.min(extra, input.approvedOvertimeMinutes),
    undertimeExcused: input.undertimeExcused,
    nightMinutes: night,
    issues,
  };
}

export function premiumFor(dayType: DayType, onDate: string): PremiumRate {
  return PREMIUM_RATES.filter((r) => r.dayType === dayType && r.effectiveFrom <= onDate).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]!;
}

/** Monthly salary → hourly rate, with the formula shown to HR. */
export function hourlyRate(monthlySalary: number) {
  return (monthlySalary * 12) / WORKING_DAYS_PER_YEAR / 8;
}

export interface OvertimePay {
  hours: number;
  rate: number;
  amount: number;
  nightAmount: number;
  formula: string;
}

/**
 * Pay for approved overtime. On a rest day or holiday the first 8 hours carry
 * that day's premium and only the excess is overtime.
 */
export function overtimePay(minutes: number, dayType: DayType, date: string, monthlySalary: number, nightMinutes = 0): OvertimePay {
  const rate = premiumFor(dayType, date);
  const hourly = hourlyRate(monthlySalary);
  const hours = minutes / 60;
  const scheduled = dayType === "ordinary" ? 0 : Math.min(8, hours);
  const ot = hours - scheduled;
  const amount = scheduled * hourly * rate.firstEightHours + ot * hourly * rate.overtime;
  const nightAmount = (nightMinutes / 60) * hourly * NIGHT_DIFFERENTIAL;
  const peso = (n: number) => `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
  const formula =
    dayType === "ordinary"
      ? `${hours.toFixed(2)} h × ${peso(hourly)}/h × ${Math.round(rate.overtime * 100)}%`
      : `${scheduled.toFixed(2)} h × ${peso(hourly)}/h × ${Math.round(rate.firstEightHours * 100)}%${ot > 0 ? ` + ${ot.toFixed(2)} h × ${Math.round(rate.overtime * 100)}%` : ""}`;
  return { hours, rate: dayType === "ordinary" ? rate.overtime : rate.firstEightHours, amount, nightAmount, formula };
}

/** Late deduction: minutes past grace at the hourly rate. */
export function tardinessDeduction(lateMinutes: number, monthlySalary: number) {
  return (lateMinutes / 60) * hourlyRate(monthlySalary);
}

/** Runs of working days with no rest in between, longer than `limit`. */
export function longRuns(days: { date: string; working: boolean }[], limit = 6) {
  const runs: { from: string; to: string; length: number }[] = [];
  let start = -1;
  days.forEach((d, i) => {
    if (d.working && start < 0) start = i;
    if ((!d.working || i === days.length - 1) && start >= 0) {
      const end = d.working ? i : i - 1;
      if (end - start + 1 >= limit) runs.push({ from: days[start]!.date, to: days[end]!.date, length: end - start + 1 });
      start = -1;
    }
  });
  return runs;
}

/** Plain-language summary of a day, used as the day strip's text alternative. */
export function describeDay(d: DayResult) {
  const t = (ms?: number) => (ms === undefined ? "" : new Date(ms).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }));
  const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);
  if (d.status === "rest" && !d.timeIn) return "Rest day";
  if (d.status === "leave") return "On leave";
  if (d.status === "holiday" && !d.timeIn) return `Holiday: ${d.holiday?.name}`;
  if (d.status === "unscheduled") return "No shift assigned";
  const parts: string[] = [];
  if (d.shiftStart !== undefined) parts.push(`Scheduled ${t(d.shiftStart)} to ${t(d.shiftEnd)}`);
  if (d.timeIn) parts.push(`in ${t(new Date(d.timeIn.at).getTime())}${d.lateMinutes ? ` (${dur(d.lateMinutes)} late)` : ""}`);
  else parts.push(d.status === "upcoming" ? "not started yet" : "no time-in");
  if (d.timeOut) parts.push(`out ${t(new Date(d.timeOut.at).getTime())}${d.undertimeMinutes ? ` (${dur(d.undertimeMinutes)} early)` : d.extraMinutes ? ` (${dur(d.extraMinutes)} extra)` : ""}`);
  else if (d.timeIn) parts.push(d.status === "working" ? "still working" : "no time-out");
  return parts.join(", ");
}
