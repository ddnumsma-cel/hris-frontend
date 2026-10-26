// Personal settings (preferences) for each signed-in account, kept in this browser like the
// other stores. With the API server they're kept with the account in the database
// (/api/me/preferences) and this is a cache loaded after sign-in; the theme stays on each device.

import { admin } from "../admin/store";
import { api, serverMode } from "../http";
import { getThemePreference } from "../theme";

export type ThemePreference = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";
export type DateFormat = "MMM d, yyyy" | "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
export type Digest = "off" | "daily" | "weekly";
/** 0 = Sunday, 1 = Monday, 6 = Saturday. */
export type WeekStart = 0 | 1 | 6;

export const NOTIFICATION_EVENTS = [
  { key: "leaveSubmitted", label: "Leave request submitted" },
  { key: "leaveDecided", label: "Leave approved or rejected" },
  { key: "shiftChanged", label: "Shift changes" },
  { key: "schedulePublished", label: "Schedule published" },
  { key: "documentUploaded", label: "Document uploaded" },
  { key: "announcement", label: "Announcements" },
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number]["key"];
export type Channel = "inApp" | "email";

export interface AccountPrefs {
  displayName: string;
  language: "en";
  timezone: string;
  dateFormat: DateFormat;
  weekStart: WeekStart;
}

export interface NotificationPrefs {
  /** Master switch (also in the gear menu): off hides the bell's alerts. */
  enabled: boolean;
  matrix: Record<NotificationEvent, Record<Channel, boolean>>;
  quietHours: { enabled: boolean; from: string; to: string };
  digest: Digest;
}

export interface AppearancePrefs {
  theme: ThemePreference;
  density: Density;
  reduceMotion: boolean;
  /** Path opened after signing in ("" = the workspace Home). */
  landing: string;
}

export interface SecurityPrefs {
  /** TODO(backend): real two-factor enrolment. Stored only, not enforced at sign-in yet. */
  twoFactor: boolean;
}

export interface UserSettings {
  account: AccountPrefs;
  notifications: NotificationPrefs;
  appearance: AppearancePrefs;
  security: SecurityPrefs;
  updatedAt?: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  account: { displayName: "", language: "en", timezone: "Asia/Manila", dateFormat: "MMM d, yyyy", weekStart: 0 },
  notifications: {
    enabled: true,
    matrix: Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e.key, { inApp: true, email: e.key !== "announcement" }])) as NotificationPrefs["matrix"],
    quietHours: { enabled: false, from: "20:00", to: "07:00" },
    digest: "off",
  },
  appearance: { theme: "system", density: "comfortable", reduceMotion: false, landing: "" },
  security: { twoFactor: false },
};

const KEY = "heyhr-settings-v1";

function load(): Record<string, UserSettings> {
  if (serverMode) return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, UserSettings>) : {};
  } catch {
    return {};
  }
}

let all = load();

/** Saved settings for a person, filled in with defaults for anything never saved. */
export function settingsFor(key: string): UserSettings {
  const saved = all[key];
  return {
    // Timezone: their own choice, else the company default (Settings > Organization).
    account: { ...DEFAULT_SETTINGS.account, timezone: admin.settings.defaultTimezone || DEFAULT_SETTINGS.account.timezone, ...(saved?.account as Partial<AccountPrefs> | undefined) },
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...saved?.notifications,
      matrix: { ...DEFAULT_SETTINGS.notifications.matrix, ...saved?.notifications?.matrix },
      quietHours: { ...DEFAULT_SETTINGS.notifications.quietHours, ...saved?.notifications?.quietHours },
    },
    appearance: { ...DEFAULT_SETTINGS.appearance, ...saved?.appearance, ...(serverMode ? { theme: deviceTheme() } : {}) },
    security: { ...DEFAULT_SETTINGS.security, ...saved?.security },
    updatedAt: saved?.updatedAt,
  };
}

export function saveSettingsFor(key: string, next: UserSettings) {
  all = { ...all, [key]: { ...next, updatedAt: new Date().toISOString() } };
  if (serverMode) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Not remembered after reload; still applies now.
  }
}

/** With the API server the theme isn't stored with the account: it's this device's (moon toggle). */
function deviceTheme(): ThemePreference {
  try {
    return getThemePreference();
  } catch {
    return DEFAULT_SETTINGS.appearance.theme;
  }
}

/** With the API server: the signed-in account's settings, from the database, into this cache. */
export async function refreshMySettings(accountId: string | undefined): Promise<UserSettings | undefined> {
  if (!serverMode || !accountId) return undefined;
  const saved = await api<Partial<UserSettings>>("GET", "/me/preferences");
  all = { ...all, [accountId]: saved as UserSettings };
  return settingsFor(accountId);
}

/** With the API server: saves one section for the signed-in account; returns everything as saved. */
export async function saveMySettingsRemote<K extends keyof Omit<UserSettings, "updatedAt">>(accountId: string, section: K, value: UserSettings[K]): Promise<UserSettings> {
  const saved = await api<Partial<UserSettings>>("PUT", `/me/preferences/${section}`, value);
  all = { ...all, [accountId]: saved as UserSettings };
  const next = settingsFor(accountId);
  // The theme chosen in this section applies to this device (the caller applies it).
  return section === "appearance" ? { ...next, appearance: { ...next.appearance, theme: (value as AppearancePrefs).theme } } : next;
}

/** The key settings are stored under: the account, or the workspace for older sessions. */
export const settingsKeyFor = (user: { accountId?: string; role: string }) => user.accountId ?? `role:${user.role}`;
