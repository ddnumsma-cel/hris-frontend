// Signing in through the backend. The backend checks the email and password and returns a token
// and the person's role; the app then keeps a matching account in its own account list (so the
// sidebars, access checks and pages work unchanged) and sends the token with every backend call.

import { admin, logAdmin, saveAdmin, type UserAccount } from "../admin/store";
import type { SignInResult } from "../admin/auth";
import type { RoleKey } from "../permissions";
import { api, setToken } from "./client";

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
export const BACKEND_DEMO_ACCOUNTS = !import.meta.env.DEV || !onThisPc ? [] : [
  { label: "Super Admin (Partner)", username: "partner@msma.test", password: "Demo@2026" },
  { label: "HR", username: "hr@msma.test", password: "Demo@2026" },
  { label: "Payroll", username: "payroll@msma.test", password: "Demo@2026" },
  { label: "Employee", username: "employee@msma.test", password: "Demo@2026" },
];

const USER_KEY = "heyhr-api-user";

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
}

/** Forget the backend sign-in (the token and who it was). */
export function backendSignOut() {
  setToken(null);
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // Nothing to clear.
  }
}
