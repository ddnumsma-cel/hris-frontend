// Sign-in checks and access rights. Kept apart from the admin API so the
// sign-in screen doesn't load every module's data.

import { findCredential, getCredentials } from "../credentials";
import type { Role } from "../types";
import { clearCoreHr, fullName, refreshCoreHr, setSignedInEmployee, state as core } from "../corehr/store";
import { api, ApiError, serverMode } from "../http";
import { syncAdminCache } from "./api";
import { clearLeave, refreshLeave } from "../leave/store";
import { clearTimekeeping, refreshTimekeeping } from "../timekeeping/store";
import { refreshRates } from "../reports/statutory";
import { refreshHolidays } from "../holidays";
import { refreshMySettings } from "../settings/store";
import { clearPaySettings, refreshPaySettings } from "../pay/settings";
import { can } from "../permissions";
import { employeeOfAccount, whoFor } from "../session";
import { admin, logAdmin, roleOf, saveAdmin, type UserAccount } from "./store";

export type SignInResult = { ok: true; workspace: Role; account: UserAccount } | { ok: false; error: string };

const update = (id: string, patch: Partial<UserAccount>) => saveAdmin({ ...admin, accounts: admin.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) });

/** The account a username belongs to, whether a demo login or one HR created. */
function accountFor(username: string) {
  const u = username.trim().toLowerCase();
  const demo = getCredentials().find((c) => c.username === u);
  return demo ? admin.accounts.find((a) => a.demo === demo.key) : admin.accounts.find((a) => a.username === u && !a.demo);
}

/** With the API server this checks the database (and resolves after a moment); otherwise the browser's accounts. */
export function signIn(username: string, password: string): SignInResult | Promise<SignInResult> {
  if (serverMode) return signInRemote(username, password);
  const account = accountFor(username);
  const now = new Date();
  const fail = (error: string, detail: string): SignInResult => {
    logAdmin({ actor: account?.name ?? username.trim(), module: "Sign-in", action: "Failed sign-in", target: username.trim() || "(blank)", detail });
    return { ok: false, error };
  };
  if (!account) return fail("Incorrect username or password.", "Unknown username");
  if (account.lockedUntil && account.lockedUntil > now.toISOString()) {
    const mins = Math.ceil((new Date(account.lockedUntil).getTime() - now.getTime()) / 60000);
    return fail(`Too many wrong passwords. Try again in ${mins} minute${mins === 1 ? "" : "s"}, or ask HR to unlock your account.`, "Account locked");
  }
  const good = account.demo ? findCredential(username, password)?.key === account.demo : account.password === password;
  if (!good) {
    const failed = account.failedAttempts + 1;
    const lock = failed >= admin.settings.lockAfterFailed;
    update(account.id, { failedAttempts: lock ? 0 : failed, lockedUntil: lock ? new Date(now.getTime() + admin.settings.lockMinutes * 60000).toISOString() : account.lockedUntil });
    return fail(lock ? `Too many wrong passwords. Your account is locked for ${admin.settings.lockMinutes} minutes.` : "Incorrect username or password.", lock ? `Wrong password; locked after ${failed} tries` : `Wrong password (${failed} of ${admin.settings.lockAfterFailed})`);
  }
  return admit(account, fail, "");
}

/** The checks after the person is known (password or Google): turned off, employment ended, no role. */
function admit(account: UserAccount, fail: (error: string, detail: string) => SignInResult, via: string): SignInResult {
  const now = new Date();
  if (account.status === "disabled") return fail("This account has been turned off. Please contact HR.", "Account turned off");
  // Someone whose last day has passed can't sign in, even if their account wasn't turned off yet.
  const who = account.employeeId ?? employeeOfAccount(account) ?? core.employees.find((e) => fullName(e.personal).toLowerCase() === account.name.trim().toLowerCase())?.id;
  const gone = core.employees.find((e) => e.id === who && e.job.separationDate && e.job.separationDate < now.toISOString().slice(0, 10));
  if (gone) return fail(`Your employment ended on ${gone.job.separationDate}, so this account is closed.`, "Employment ended");
  const role = roleOf(account);
  if (!role) return fail("This account has no role yet. Please contact HR.", "No role");
  update(account.id, { failedAttempts: 0, lockedUntil: undefined, lastSignIn: now.toISOString() });
  logAdmin({ actor: account.name, module: "Sign-in", action: "Signed in", target: account.username, detail: via ? `${role.name} · ${via}` : role.name });
  return { ok: true, workspace: role.workspace, account: admin.accounts.find((a) => a.id === account.id)! };
}

/** Signs in whoever registered (or was given an account) with this Google email; Google has already verified it. */
export function signInWithGoogleEmail(email: string): SignInResult {
  const u = email.trim().toLowerCase();
  const account = admin.accounts.find((a) => !a.demo && a.username.toLowerCase() === u);
  const fail = (error: string, detail: string): SignInResult => {
    logAdmin({ actor: account?.name ?? u, module: "Sign-in", action: "Failed sign-in", target: u || "(blank)", detail: `${detail} · Google` });
    return { ok: false, error };
  };
  if (!account) return fail(`No account uses ${u}. Register first, or sign in with your username and password.`, "Unknown Google email");
  return admit(account, fail, "Google");
}

// ---- With the API server ----

/** Keeps the browser's copy of an account in step with the server, so access checks here keep working. */
function remember(account: UserAccount) {
  setSignedInEmployee({ employeeId: account.employeeId, name: account.name });
  saveAdmin({ ...admin, accounts: [...admin.accounts.filter((a) => a.id !== account.id && a.username !== account.username), account] });
}

/** After sign-in: what the account may open, the system settings, then the records it can see. */
async function loadForAccount(account: UserAccount) {
  remember(account);
  await syncAdminCache();
  await refreshCoreHr();
  // The holiday calendar and personal settings never block sign-in: without them the built-in
  // holidays and the default settings apply until the next load.
  const optional = (p: Promise<unknown>) => p.catch((e) => console.warn(e));
  await Promise.all([refreshLeave(), refreshTimekeeping(), refreshRates(), optional(refreshHolidays()), optional(refreshMySettings(account.id)), optional(refreshPaySettings())]);
}

/** Signs in against the server. With a temporary password, nothing else loads until it's changed. */
export async function signInRemote(username: string, password: string): Promise<SignInResult> {
  try {
    const r = await api<{ workspace: Role; account: UserAccount } | { mfaRequired: true }>("POST", "/auth/login", { username, password });
    // Two-factor sign-in: the password was right; the code from the authenticator app comes next (verifyMfaCode).
    if ("mfaRequired" in r) return { ok: false, error: MFA_NEEDED };
    await loadForAccount(r.account);
    return { ok: true, workspace: r.workspace, account: r.account };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't sign in. Try again." };
  }
}

/** What signInRemote says when the account needs its two-factor code next. */
export const MFA_NEEDED = "Enter the 6-digit code from your authenticator app to finish signing in.";

/** The second sign-in step: the 6-digit code from the authenticator app, or a backup code. */
export async function verifyMfaCode(code: string): Promise<SignInResult> {
  try {
    const r = await api<{ workspace: Role; account: UserAccount }>("POST", "/auth/mfa", { code });
    await loadForAccount(r.account);
    return { ok: true, workspace: r.workspace, account: r.account };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't check the code. Try again." };
  }
}

/** On app start: is the server session still good? Loads its records if so. */
export async function restoreSession(): Promise<{ workspace: Role; account: UserAccount } | null> {
  if (!serverMode) return null;
  try {
    const r = await api<{ workspace: Role; account: UserAccount }>("GET", "/auth/me");
    await loadForAccount(r.account);
    return r;
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) console.error(e);
    return null;
  }
}

/** Sets a new password (required after a temporary one), then loads what the account can see. */
export async function changePasswordRemote(currentPassword: string, newPassword: string): Promise<UserAccount> {
  const r = await api<{ workspace: Role; account: UserAccount }>("POST", "/auth/change-password", { currentPassword, newPassword });
  await loadForAccount(r.account);
  return r.account;
}

export function signOutRemote(reason: "manual" | "idle") {
  clearCoreHr();
  clearLeave();
  clearTimekeeping();
  clearPaySettings();
  return api("POST", "/auth/logout", { reason }).catch(() => undefined);
}

export function recordSignOut(accountId: string | undefined, reason: "manual" | "idle") {
  if (serverMode) return void signOutRemote(reason);
  const a = admin.accounts.find((x) => x.id === accountId);
  if (a) logAdmin({ actor: a.name, module: "Sign-in", action: reason === "idle" ? "Signed out (inactive)" : "Signed out", target: a.username, detail: reason === "idle" ? `No activity for ${admin.settings.idleMinutes} minutes` : "" });
}

export const accountById = (id: string | undefined) => admin.accounts.find((a) => a.id === id);


/** Still allowed to be signed in? (turned off or role removed while signed in; sign-ins without an account are no longer accepted) */
export function sessionValid(accountId: string | undefined) {
  if (!accountId) return false;
  const a = accountById(accountId);
  return !!a && a.status === "active" && !!roleOf(a);
}

export const idleMinutes = () => admin.settings.idleMinutes;

/** Set when the session ended for inactivity, so the sign-in page can say why. */
export const IDLE_FLAG = "msma-hris-idle";

export function endedForInactivity() {
  try {
    return sessionStorage.getItem(IDLE_FLAG) === "1";
  } catch {
    return false;
  }
}

/** True when the account may see employee records (the employee search, office filter, assistant). */
export function hasHrAccess(accountId: string | undefined) {
  return can(whoFor(accountId), "view", "people");
}

const SIGNED_IN_FLAG = "heyhr-just-signed-in";

/** Marks a fresh sign-in so the welcome message shows once. */
export function markSignedIn() {
  try {
    sessionStorage.setItem(SIGNED_IN_FLAG, "1");
  } catch {
    // No message this time; nothing else depends on it.
  }
}

/** True once, right after signing in. */
export function consumeSignInFlag() {
  try {
    const set = sessionStorage.getItem(SIGNED_IN_FLAG) === "1";
    sessionStorage.removeItem(SIGNED_IN_FLAG);
    return set;
  } catch {
    return false;
  }
}
