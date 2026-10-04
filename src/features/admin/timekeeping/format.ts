import type { DayResult } from "@/lib/timekeeping/types";

export const tkKeys = {
  days: (from: string, to: string) => ["timekeeping", "days", from, to] as const,
  day: (id: string, date: string) => ["timekeeping", "day", id, date] as const,
  shifts: ["timekeeping", "shifts"] as const,
  people: ["timekeeping", "people"] as const,
  roster: (week: string) => ["timekeeping", "roster", week] as const,
  requests: ["timekeeping", "requests"] as const,
};

/** "8:07 AM" */
export const clock = (v: number | string) => new Date(v).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
/** "08:00" → "8:00 AM" */
export const hhmm = (t: string) => clock(`2000-01-01T${t}:00`);
/** "Fri, Oct 2" */
export const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });

/** "1 h 20 min", "45 min" */
export function duration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Period presets for the log pages. */
export const PERIODS = [
  { value: "1", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 2 weeks" },
  { value: "30", label: "Last 30 days" },
];

/** Status of a person's day in plain words. */
export function dayStatus(d: DayResult): { tone: "good" | "warn" | "crit" | "info" | "neutral"; label: string } {
  if (d.status === "leave") return { tone: "info", label: "On leave" };
  if (d.status === "rest" && !d.timeIn) return { tone: "neutral", label: "Rest day" };
  if (d.status === "holiday" && !d.timeIn) return { tone: "neutral", label: "Holiday" };
  if (d.status === "upcoming") return { tone: "neutral", label: "Not started" };
  if (d.status === "not-in") return { tone: "crit", label: "Not in yet" };
  if (d.status === "absent") return { tone: "crit", label: "Absent" };
  if (d.issues.some((i) => i.kind === "missing-out")) return { tone: "crit", label: "No time-out" };
  if (d.lateMinutes > 0) return { tone: "warn", label: `Late ${duration(d.lateMinutes)}` };
  if (d.undertimeMinutes > 0) return { tone: "warn", label: `Left ${duration(d.undertimeMinutes)} early` };
  if (d.status === "working") return { tone: "good", label: "Working" };
  return { tone: "good", label: "On time" };
}
