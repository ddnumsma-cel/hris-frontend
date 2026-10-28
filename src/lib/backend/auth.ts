// Signing in through the backend. The backend checks the email and password and returns a token
// and the person's role; the app then keeps a matching account in its own account list (so the
// sidebars, access checks and pages work unchanged) and sends the token with every backend call.

import { refreshRates } from "../reports/statutory";
import { admin, logAdmin, saveAdmin, type UserAccount } from "../admin/store";
import type { SignInResult } from "../admin/auth";
import type { RoleKey } from "../permissions";
import { api, backendOn, setToken } from "./client";
import { setCurrentEmployee, setCurrentManager } from "../mockData";
import type { Employee } from "../types";
import { backendMyProfile } from "./people";

export type BackendRole = "EMPLOYEE" | "MANAGER" | "HR_ADMIN" | "PAYROLL_ADMIN" | "SYSTEM_ADMIN" | "PLATFORM_ADMIN";

export interface BackendUser {
  id: string;
  email: string;
  role: BackendRole;
  displayName: string;
  /** The backend's employee id (for /employees/:id), when the account belongs to an employee. */
  employeeId: string | null;
  employeeNo: string | null;
  site: { id: string; name: string } | null;
  /** A new or reset login: they choose their own password first (SetPasswordPage). */
  mustChangePassword?: boolean;
  /** Approvers: the employee numbers the backend lets them see (their team), saved at sign-in. */
  team?: string[];
}

/**
 * Backend roles → this app's roles. The backend's SYSTEM_ADMIN sees HR data, so it's this app's
 * Super Admin; PLATFORM_ADMIN (the IT team's shared account) is this app's System Admin, maintenance only.
 */
export const ROLE_FROM_BACKEND: Record<BackendRole, RoleKey> = {
  EMPLOYEE: "employee",
  MANAGER: "approver",
  HR_ADMIN: "hr",
  PAYROLL_ADMIN: "accounting",
  SYSTEM_ADMIN: "super_admin",
  PLATFORM_ADMIN: "system_admin",
};

/** Opened on the developer's own PC (not through a shared link on the office network). */
const onThisPc = typeof window !== "undefined" && ["localhost", "127.0.0.1", "[::1]"].includes(window.location?.hostname);

/**
 * The backend's seeded demo logins (synthetic data), shown on the sign-in page while it's connected: only in the
 * development copy opened on the developer's own PC, so neither a live build nor the shared office link shows working
 * passwords. Real people's logins are never listed here.
 */
export const BACKEND_DEMO_ACCOUNTS = !import.meta.env?.DEV || !onThisPc ? [] : [
  { label: "Super Admin (Partner)", username: "partner@msma.test", password: "Demo@2026" },
  { label: "HR", username: "hr@msma.test", password: "Demo@2026" },
  { label: "Payroll", username: "payroll@msma.test", password: "Demo@2026" },
  { label: "Employee", username: "employee@msma.test", password: "Demo@2026" },
];

export type DemoAccount = { label: string; username: string; password: string };

/**
 * The real logins for checking each role, from dev-accounts.local on this PC (git-ignored; served only to this PC by
 * vite.config.ts). Null when there is no such file or the page isn't opened on this PC: the seeded list applies then.
 */
export async function localDemoAccounts(): Promise<DemoAccount[] | null> {
  if (!import.meta.env?.DEV || !onThisPc) return null;
  try {
    const res = await fetch("/__dev/accounts", { cache: "no-store" });
    if (!res.ok) return null;
    const list = (await res.json()) as DemoAccount[];
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

const USER_KEY = "heyhr-api-user";
/** The signed-in person's own record, kept so a reload shows the right name before the backend answers. */
const ME_KEY = "heyhr-api-me";

/** "Me" for a login without an employee record (e.g. a partner's or IT's account). */
function noRecord(name: string): Employee {
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return { id: "", name, initials, position: "No employee record linked", department: "", office: "" as Employee["office"], cluster: "" as Employee["cluster"], status: "Active" };
}

/**
 * Makes the employee pages show the signed-in person instead of the built-in demo profile: their own record from the
 * backend (GET /me/profile), or a placeholder when the login has no employee record. Skipped while a temporary
 * password is still in use (the backend opens nothing else until it is replaced).
 */
export async function loadMe() {
  const user = backendUser();
  if (!user || user.mustChangePassword) return;
  // The company's settings (idle sign-out, password length, work week…) as saved on the backend.
  void api<typeof admin.settings>("/settings").then((settings) => saveAdmin({ ...admin, settings })).catch(() => undefined);
  // The saved government contribution rates the pay figures use (the built-in ones until then).
  void refreshRates().catch(() => undefined);
  const me = user.employeeNo ? await backendMyProfile() : null;
  const next = me ?? noRecord(user.displayName);
  setCurrentEmployee(next);
  // An approver's own "manager profile" (account settings, who filed a case) is the same person.
  if (me) setCurrentManager({ name: me.name, initials: me.initials, title: me.position, email: me.email ?? "", phone: me.phone ?? "", office: me.office, emergencyContact: me.emergencyContact ?? "", about: "" });
  try {
    localStorage.setItem(ME_KEY, JSON.stringify(next));
  } catch {
    // Kept for this page only.
  }
}

// A reload: show the last known "me" at once, then refresh it from the backend.
if (backendOn()) {
  try {
    const cached = localStorage.getItem(ME_KEY);
    if (cached && localStorage.getItem(USER_KEY)) setCurrentEmployee(JSON.parse(cached) as Employee);
  } catch {
    // Nothing cached.
  }
  if (typeof window !== "undefined") queueMicrotask(() => void loadMe());
}

/** The signed-in backend user (role, employee id), or null when signed out or not connected. */
export function backendUser(): BackendUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as BackendUser) : null;
  } catch {
    return null;
  }
}

export async function backendSignIn(email: string, password: string): Promise<SignInResult> {
  let result: { accessToken: string; user: BackendUser };
  try {
    result = await api("/auth/login", { body: { email: email.trim(), password } });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't sign in." };
  }
  const key = ROLE_FROM_BACKEND[result.user.role];
  const role = admin.roles.find((r) => r.key === key);
  if (!role) return { ok: false, error: "This account's role isn't set up in the app yet. Please contact HR." };
  setToken(result.accessToken);
  // Team-scoped checks (lib/permissions.ts) need the team; with a temporary password it loads once that is replaced.
  if (key === "approver" && !result.user.mustChangePassword) result.user.team = await loadTeam(result.user);
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
  } catch {
    // Kept for this page only.
  }
  // The app-side twin of the backend account: same name and role, no password (the backend checks it).
  const account: UserAccount = {
    id: `be-${result.user.id}`,
    name: result.user.displayName,
    username: result.user.email,
    employeeId: result.user.employeeNo ?? undefined,
    roleId: role.id,
    status: "active",
    mustChangePassword: !!result.user.mustChangePassword,
    failedAttempts: 0,
    lastSignIn: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: "HR server",
  };
  saveAdmin({ ...admin, accounts: [...admin.accounts.filter((a) => a.id !== account.id), account] });
  await loadMe();
  logAdmin({ actor: account.name, module: "Sign-in", action: "Signed in", target: account.username, detail: `${role.name} · HR server` });
  return { ok: true, workspace: role.workspace, account };
}

/** An approver's team, for the team-scoped checks (lib/permissions.ts): the people the backend lets them handle. */
async function loadTeam(user: BackendUser) {
  const res = await api<{ items: { employeeNo: string }[] }>("/employees", { query: { pageSize: 200 } }).catch(() => ({ items: [] }));
  return res.items.map((e) => e.employeeNo).filter((no) => no !== user.employeeNo);
}

/** After choosing their own password: keep the fresh session token and load what a temporary password held back. */
export async function backendPasswordChanged(accessToken?: string) {
  if (accessToken) setToken(accessToken);
  const user = backendUser();
  if (!user) return;
  user.mustChangePassword = false;
  if (ROLE_FROM_BACKEND[user.role] === "approver") user.team = await loadTeam(user);
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Kept for this page only.
  }
  await loadMe();
}

/** Forget the backend sign-in (the token and who it was). */
export function backendSignOut() {
  setToken(null);
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ME_KEY);
  } catch {
    // Nothing to clear.
  }
}
