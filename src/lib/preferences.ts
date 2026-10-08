// Applies the signed-in person's preferences across the app, live:
// - appearance: theme, density and reduce-motion (attributes on <html>, styled in index.css)
// - dates: one formatter for display dates and times, following their date format and timezone
// App subscribes (usePreferencesVersion) so changing a preference re-renders every screen.

import { useSyncExternalStore } from "react";
import { setThemePreference } from "./theme";
import type { AccountPrefs, AppearancePrefs, DateFormat, WeekStart } from "./settings/store";

let dates: { dateFormat: DateFormat; timezone: string; weekStart: WeekStart } = { dateFormat: "MMM d, yyyy", timezone: "Asia/Manila", weekStart: 0 };
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

/** Re-renders the caller whenever a preference changes. */
export function usePreferencesVersion() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
}

/** `theme: false` leaves the device theme alone (it belongs to the moon toggle, not the account). */
export function applyAppearance(a: AppearancePrefs, { theme = true }: { theme?: boolean } = {}) {
  if (theme) setThemePreference(a.theme);
  const root = document.documentElement;
  root.dataset.density = a.density;
  if (a.reduceMotion) root.dataset.reduceMotion = "";
  else delete root.dataset.reduceMotion;
  emit();
}

/** Back to defaults (signed out). */
export function resetPreferences() {
  const root = document.documentElement;
  delete root.dataset.density;
  delete root.dataset.reduceMotion;
  dates = { dateFormat: "MMM d, yyyy", timezone: "Asia/Manila", weekStart: 0 };
  emit();
}

export function applyAccountPrefs(a: AccountPrefs) {
  dates = { dateFormat: a.dateFormat, timezone: a.timezone, weekStart: a.weekStart };
  emit();
}

export const weekStart = () => dates.weekStart;

// ---- Formatting ----

const validZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
};

/** Year, month and day of a moment in the chosen timezone (or as written, for date-only values). */
function ymd(d: Date, tz?: string) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day") };
}

function withFormat(d: Date, tz: string | undefined, withYear: boolean) {
  if (dates.dateFormat === "MMM d, yyyy") {
    return d.toLocaleDateString("en-PH", { timeZone: tz, month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
  }
  const { y, m, d: day } = ymd(d, tz);
  if (dates.dateFormat === "dd/MM/yyyy") return withYear ? `${day}/${m}/${y}` : `${day}/${m}`;
  if (dates.dateFormat === "MM/dd/yyyy") return withYear ? `${m}/${day}/${y}` : `${m}/${day}`;
  return withYear ? `${y}-${m}-${day}` : `${m}-${day}`;
}

/** A calendar day ("2026-10-03"): never shifted by timezone. */
const dayDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

/** "Oct 3, 2026" (or the chosen format) for a calendar day. */
export const fmtDay = (iso: string) => withFormat(dayDate(iso), undefined, true);
/** "Oct 3" (no year) for a calendar day. */
export const fmtDayShort = (iso: string) => withFormat(dayDate(iso), undefined, false);
/** "Fri, Oct 2" for a calendar day. */
export const fmtDayWithWeekday = (iso: string) => {
  const d = dayDate(iso);
  return `${d.toLocaleDateString("en-PH", { weekday: "short" })}, ${withFormat(d, undefined, false)}`;
};
/** "October 2026". */
export const fmtMonthYear = (d: Date) => d.toLocaleDateString("en-PH", { month: "long", year: "numeric" });

/** "Oct 3, 2026" (or the chosen format) for a moment, in the chosen timezone. */
export const fmtDate = (v: Date | string | number) => withFormat(new Date(v), validZone(dates.timezone), true);
/** "8:07 AM" for a moment, in the chosen timezone. */
export const fmtTime = (v: Date | string | number) => new Date(v).toLocaleTimeString("en-PH", { timeZone: validZone(dates.timezone), hour: "numeric", minute: "2-digit" });
/** "Thursday, October 8, 2026" for today, in the chosen timezone. */
export const fmtLongToday = () => new Date().toLocaleDateString("en-PH", { timeZone: validZone(dates.timezone), weekday: "long", year: "numeric", month: "long", day: "numeric" });

/** Common IANA zones offered in Settings (the browser's own is added if missing). */
export function timezoneOptions() {
  const zones = ["Asia/Manila", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Dubai", "Australia/Sydney", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "UTC"];
  const own = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return own && !zones.includes(own) ? [own, ...zones] : zones;
}
