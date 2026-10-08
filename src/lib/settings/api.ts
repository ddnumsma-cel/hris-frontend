// Settings mock API. Each call stands in for an HTTP request (see BACKEND_HANDOFF.md):
//   GET/PUT  /me/settings            -> fetchMySettings / saveMySettings
//   GET/PUT  /me/profile             -> fetchMyProfile / saveMyProfile
//   POST     /me/password            -> changeMyPassword
//   GET      /me/sessions            -> fetchMySessions
//   POST     /me/sessions/revoke     -> signOutOtherSessions (TODO: needs real sessions)

import {
  fetchAdminProfile,
  fetchCurrentEmployee,
  fetchManagerProfile,
  fetchMyPhoto,
  updateAdminProfile,
  updateEmployeeProfile,
  updateManagerProfile,
  updateMyPhoto,
} from "@/lib/api";
import { admin, logAdmin, saveAdmin } from "@/lib/admin/store";
import { getCredential, setCredential } from "@/lib/credentials";
import type { AuthUser } from "@/features/auth/AuthContext";
import type { Employee } from "@/lib/types";
import { saveSettingsFor, settingsFor, settingsKeyFor, type UserSettings } from "./store";

const DELAY = 250;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));

// ---- Preferences ----

export function fetchMySettings(user: AuthUser) {
  return respond(settingsFor(settingsKeyFor(user)));
}

const SECTION_LABEL: Record<keyof Omit<UserSettings, "updatedAt">, string> = {
  account: "Account preferences",
  notifications: "Notifications",
  appearance: "Appearance",
  security: "Security",
};

/** Saves one section of a person's settings and notes the change in the audit trail. */
export function saveMySettings<K extends keyof Omit<UserSettings, "updatedAt">>(user: AuthUser, section: K, value: UserSettings[K]) {
  const key = settingsKeyFor(user);
  const next = { ...settingsFor(key), [section]: value };
  saveSettingsFor(key, next);
  logAdmin({ actor: user.name, module: "Settings", action: "Changed personal settings", target: user.name, detail: SECTION_LABEL[section] });
  return respond(next);
}

// ---- Profile ----

/** Who the profile belongs to decides where it's stored and what can be edited. */
type ProfileSource = "employee" | "partner" | "hr" | "account";

export interface MyProfile {
  source: ProfileSource;
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  /** Partner and HR profiles also carry these (shown so nothing they could edit before is lost). */
  office?: Employee["office"];
  emergencyContact?: string;
  about?: string;
  photo: string | null;
  /** Employees' names and titles are kept by HR. */
  canEditName: boolean;
}

export type MyProfileInput = Omit<MyProfile, "source" | "canEditName">;

const sourceFor = (user: AuthUser): ProfileSource => {
  const account = admin.accounts.find((a) => a.id === user.accountId);
  if (user.role === "employee") return "employee";
  if (user.role === "manager") return "partner";
  if (account?.demo === "hr" || !account) return "hr";
  return "account";
};

// Photos for people without a personnel record (Partner, HR, other accounts), by settings key.
const PHOTO_KEY = "heyhr-profile-photos-v1";
const loadPhotos = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(PHOTO_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
};
const savePhoto = (key: string, photo: string | null) => {
  const photos = loadPhotos();
  if (photo) photos[key] = photo;
  else delete photos[key];
  try {
    localStorage.setItem(PHOTO_KEY, JSON.stringify(photos));
  } catch {
    // Too large for this browser's storage; the rest of the profile still saves.
  }
};

export async function fetchMyProfile(user: AuthUser): Promise<MyProfile> {
  const source = sourceFor(user);
  const key = settingsKeyFor(user);
  if (source === "employee") {
    const [e, photo] = await Promise.all([fetchCurrentEmployee(), fetchMyPhoto()]);
    return { source, fullName: e.name, jobTitle: e.position, email: e.email ?? "", phone: e.phone ?? "", emergencyContact: e.emergencyContact ?? "", office: e.office, photo, canEditName: false };
  }
  if (source === "partner" || source === "hr") {
    const p = source === "partner" ? await fetchManagerProfile() : await fetchAdminProfile();
    return { source, fullName: p.name, jobTitle: p.title, email: p.email, phone: p.phone, office: p.office, emergencyContact: p.emergencyContact, about: p.about, photo: loadPhotos()[key] ?? null, canEditName: true };
  }
  const stored = loadAccountProfiles()[key];
  return { source, fullName: user.name, jobTitle: stored?.jobTitle ?? user.title, email: stored?.email ?? "", phone: stored?.phone ?? "", photo: loadPhotos()[key] ?? null, canEditName: true };
}

// Contact details for accounts that aren't the demo Partner/HR profile or an employee.
const ACCOUNT_PROFILE_KEY = "heyhr-account-profiles-v1";
type AccountProfile = { jobTitle: string; email: string; phone: string };
const loadAccountProfiles = (): Record<string, AccountProfile> => {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_PROFILE_KEY) ?? "{}") as Record<string, AccountProfile>;
  } catch {
    return {};
  }
};

export async function saveMyProfile(user: AuthUser, input: MyProfileInput): Promise<MyProfile> {
  const source = sourceFor(user);
  const key = settingsKeyFor(user);
  if (!input.fullName.trim()) return fail("Enter your full name.");
  if (input.email && !/^\S+@\S+\.\S+$/.test(input.email)) return fail("Enter a valid email address.");

  if (source === "employee") {
    await updateEmployeeProfile({ email: input.email, phone: input.phone, emergencyContact: input.emergencyContact ?? "" });
    if (input.photo) await updateMyPhoto(input.photo);
    // TODO(backend): removing an employee's personnel photo needs a delete endpoint.
  } else if (source === "partner" || source === "hr") {
    const profile = { name: input.fullName.trim(), title: input.jobTitle, email: input.email, phone: input.phone, office: input.office ?? "Cebu HQ", emergencyContact: input.emergencyContact ?? "", about: input.about ?? "" };
    await (source === "partner" ? updateManagerProfile(profile) : updateAdminProfile(profile));
    savePhoto(key, input.photo);
  } else {
    const profiles = { ...loadAccountProfiles(), [key]: { jobTitle: input.jobTitle, email: input.email, phone: input.phone } };
    try {
      localStorage.setItem(ACCOUNT_PROFILE_KEY, JSON.stringify(profiles));
    } catch {
      // Not remembered after reload.
    }
    // The account's name is what the sidebar and top bar show.
    saveAdmin({ ...admin, accounts: admin.accounts.map((a) => (a.id === user.accountId ? { ...a, name: input.fullName.trim() } : a)) });
    savePhoto(key, input.photo);
  }
  logAdmin({ actor: user.name, module: "Settings", action: "Updated own profile", target: input.fullName.trim(), detail: "Account" });
  return fetchMyProfile({ ...user, name: input.fullName.trim() });
}

/** Photo for the top bar and the gear menu (personnel photo for employees). */
export async function fetchMyAvatar(user: AuthUser): Promise<string | null> {
  if (user.role === "employee") return fetchMyPhoto();
  return respond(loadPhotos()[settingsKeyFor(user)] ?? null);
}

// ---- Security ----

export const minPasswordLength = () => admin.settings.minPasswordLength;

/** 0–4: length, mixed case, digits, symbols. */
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0;
  if (pw.length >= minPasswordLength()) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length < minPasswordLength()) score = Math.min(score, 1);
  const s = score as 0 | 1 | 2 | 3 | 4;
  return { score: s, label: ["Too weak", "Weak", "Fair", "Good", "Strong"][s]! };
}

export async function changeMyPassword(user: AuthUser, current: string, next: string) {
  const account = admin.accounts.find((a) => a.id === user.accountId);
  if (!account) return fail("Sign out and back in with your username to change your password.");
  if (next.length < minPasswordLength()) return fail(`Use at least ${minPasswordLength()} characters.`);
  if (account.demo) {
    const cred = getCredential(account.demo);
    if (cred.password !== current) return fail("Your current password is incorrect.");
    setCredential(account.demo, cred.username, next);
  } else {
    if (account.password !== current) return fail("Your current password is incorrect.");
    saveAdmin({ ...admin, accounts: admin.accounts.map((a) => (a.id === account.id ? { ...a, password: next, mustChangePassword: false } : a)) });
  }
  logAdmin({ actor: user.name, module: "Settings", action: "Changed own password", target: account.username, detail: "Security" });
  return respond(true);
}

export interface SessionRow {
  id: string;
  device: string;
  signedInAt?: string;
  current: boolean;
}

/** TODO(backend): real session tracking. Only this browser's session is known today. */
export function fetchMySessions(user: AuthUser) {
  const account = admin.accounts.find((a) => a.id === user.accountId);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  const rows: SessionRow[] = [{ id: "this", device: `${browser}${os ? ` on ${os}` : ""}`, signedInAt: account?.lastSignIn, current: true }];
  return respond(rows);
}

/** TODO(backend): revoke the user's other sessions. Nothing to revoke without a session store. */
export function signOutOtherSessions(user: AuthUser) {
  logAdmin({ actor: user.name, module: "Settings", action: "Signed out other sessions", target: user.name, detail: "Security" });
  return respond(0);
}
