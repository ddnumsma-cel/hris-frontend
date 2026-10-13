// Payroll settings, following MSMA's payroll workbook: the two paydays that close each cut-off
// (10th and 25th unless changed), and each employee's pay settings (work week, transport
// allowance, OT meal rate, tax-free pay). Saved to localStorage; the engine reads them.

import { logAdmin } from "../admin/store";
import { deny } from "../session";

// ---- Cut-offs ----

export interface PayRules {
  /** The two days of the month a cut-off closes (and is paid), e.g. [10, 25]. 31 means month end. */
  cutoffDays: [number, number];
}

export interface Cutoff {
  id: string;
  label: string;
  from: string;
  to: string;
}

const RULES_KEY = "heyhr-pay-rules-v1";
const DEFAULT_RULES: PayRules = { cutoffDays: [10, 25] };

function loadRules(): PayRules {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (raw) {
      const r = JSON.parse(raw) as Partial<PayRules>;
      if (Array.isArray(r.cutoffDays) && r.cutoffDays.length === 2) return { cutoffDays: r.cutoffDays as [number, number] };
    }
  } catch {
    // Blocked or corrupt storage: the default paydays.
  }
  return DEFAULT_RULES;
}

let rules = loadRules();

export const payRules = (): PayRules => rules;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
/** Days in a month, m = 0–11. */
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parts = (date: string) => ({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1, d: Number(date.slice(8, 10)) });

function label(from: string, to: string) {
  const a = parts(from);
  const b = parts(to);
  if (a.y === b.y && a.m === b.m) return `${MONTHS[b.m]} ${a.d}–${b.d}, ${b.y}`;
  if (a.y === b.y) return `${MONTHS[a.m]} ${a.d} – ${MONTHS[b.m]} ${b.d}, ${b.y}`;
  return `${MONTHS[a.m]} ${a.d}, ${a.y} – ${MONTHS[b.m]} ${b.d}, ${b.y}`;
}

/** The cut-off that closes on a payday of month m (0–11): which = 0 for the first payday, 1 for the second. */
function cutoffEnding(y: number, m: number, which: 0 | 1, days = rules.cutoffDays): Cutoff {
  const [first, second] = [...days].sort((p, q) => p - q) as [number, number];
  const endDay = Math.min(which === 0 ? first : second, lastDay(y, m));
  let start: string;
  if (which === 1) start = iso(y, m, Math.min(first, lastDay(y, m)) + 1);
  else {
    const py = m === 0 ? y - 1 : y;
    const pm = m === 0 ? 11 : m - 1;
    const prevEnd = Math.min(second, lastDay(py, pm));
    start = prevEnd === lastDay(py, pm) ? iso(y, m, 1) : iso(py, pm, prevEnd + 1);
  }
  const to = iso(y, m, endDay);
  return { id: to, label: label(start, to), from: start, to };
}

/** The cut-off a date falls in. */
export function cutoffOf(date: string): Cutoff {
  const { y, m } = parts(date);
  for (const c of [cutoffEnding(y, m, 0), cutoffEnding(y, m, 1)]) if (date >= c.from && date <= c.to) return c;
  // After the second payday: the first cut-off of next month.
  return m === 11 ? cutoffEnding(y + 1, 0, 0) : cutoffEnding(y, m + 1, 0);
}

/** The cut-off just before this one. */
export function previousCutoff(c: Cutoff): Cutoff {
  const d = new Date(`${c.from}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return cutoffOf(d.toISOString().slice(0, 10));
}

/** The latest `count` cut-offs up to the one containing `today`, newest first. */
export function recentCutoffs(today: string, count = 3): Cutoff[] {
  const out = [cutoffOf(today)];
  while (out.length < count) out.push(previousCutoff(out[out.length - 1]!));
  return out;
}

/** The 24 cut-offs paid in a year (by the date they close). */
export function cutoffsOf(year: number): Cutoff[] {
  return Array.from({ length: 12 }, (_, m) => [cutoffEnding(year, m, 0), cutoffEnding(year, m, 1)]).flat();
}

/** Both cut-offs paid in a month (for monthly remittances). */
export const cutoffsInMonth = (year: number, m: number, days = rules.cutoffDays): [Cutoff, Cutoff] => [cutoffEnding(year, m, 0, days), cutoffEnding(year, m, 1, days)];

export async function savePayRules(input: PayRules, actor: string): Promise<PayRules> {
  const denied = deny("payrollRuns", "edit");
  if (denied) return denied;
  const [a, b] = input.cutoffDays.map((n) => Math.round(n));
  if (!Number.isFinite(a) || !Number.isFinite(b) || a! < 1 || b! < 1 || a! > 31 || b! > 31) throw new Error("Paydays are days of the month, 1 to 31");
  if (a === b) throw new Error("Pick two different paydays");
  if (Math.abs(a! - b!) < 7) throw new Error("Paydays should be at least a week apart");
  const next: PayRules = { cutoffDays: [Math.min(a!, b!), Math.max(a!, b!)] };
  rules = next;
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(next));
  } catch {
    // Not kept after a reload; fine in the prototype.
  }
  logAdmin({ actor, module: "Payroll", action: "Changed paydays", target: "Cut-offs", detail: `Cut-offs now close on the ${next.cutoffDays.join(" and ")} of each month` });
  return next;
}

// ---- Each employee's pay settings ----

export type WorkWeek = "5-day" | "6-day";

export interface PayProfile {
  /** 5-day: Monday–Friday, 8 hours a day. 6-day: Monday–Friday 7 hours, Saturday 5. Both 40 hours a week. */
  workWeek: WorkWeek;
  /** Transport allowance for a full cut-off; prorated by the workdays attended. Not taxed. */
  transportAllowance: number;
  /** Paid for each day with approved overtime. */
  otMealRate: number;
  /** De minimis benefits inside the basic pay each cut-off: not taxed. */
  deMinimis: number;
  /** Other non-taxable pay inside the basic pay each cut-off. */
  otherNonTaxable: number;
}

export const DEFAULT_PROFILE: PayProfile = { workWeek: "5-day", transportAllowance: 0, otMealRate: 0, deMinimis: 0, otherNonTaxable: 0 };

const PROFILES_KEY = "heyhr-pay-profiles-v1";

function loadProfiles(): Record<string, PayProfile> {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, PayProfile>;
  } catch {
    // Blocked or corrupt storage: everyone on the defaults.
  }
  return {};
}

let profiles = loadProfiles();

export const payProfileOf = (employeeId: string): PayProfile => ({ ...DEFAULT_PROFILE, ...profiles[employeeId] });

/** Scheduled hours for a weekday (0 = Sunday) on a work week: what one day's absence costs. */
export function scheduledHours(workWeek: WorkWeek, weekday: number) {
  if (weekday === 0) return 0;
  if (weekday === 6) return workWeek === "6-day" ? 5 : 0;
  return workWeek === "6-day" ? 7 : 8;
}

export async function savePayProfile(employeeId: string, input: PayProfile, actor: string, name: string): Promise<PayProfile> {
  const denied = deny("payrollRuns", "edit");
  if (denied) return denied;
  const money = [input.transportAllowance, input.otMealRate, input.deMinimis, input.otherNonTaxable];
  if (money.some((n) => !Number.isFinite(n) || n < 0)) throw new Error("Amounts can't be negative");
  const next: PayProfile = { workWeek: input.workWeek === "6-day" ? "6-day" : "5-day", transportAllowance: round(input.transportAllowance), otMealRate: round(input.otMealRate), deMinimis: round(input.deMinimis), otherNonTaxable: round(input.otherNonTaxable) };
  profiles = { ...profiles, [employeeId]: next };
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // As above.
  }
  logAdmin({ actor, module: "Payroll", action: "Changed pay settings", target: name, detail: `${next.workWeek} week · transport ₱${next.transportAllowance} · OT meal ₱${next.otMealRate} · de minimis ₱${next.deMinimis} · other non-taxable ₱${next.otherNonTaxable}` });
  return next;
}

const round = (n: number) => Math.round(n * 100) / 100;
