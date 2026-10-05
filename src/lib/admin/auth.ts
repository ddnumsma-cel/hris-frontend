// Sign-in checks and access rights. Kept apart from the admin API so the
// sign-in screen doesn't load every module's data.

import { findCredential, getCredentials } from "../credentials";
import type { Role } from "../types";
import { admin, logAdmin, roleOf, saveAdmin, type Access, type ModuleKey, type UserAccount } from "./store";

export type SignInResult = { ok: true; workspace: Role; account: UserAccount } | { ok: false; error: string };

const update = (id: string, patch: Partial<UserAccount>) => saveAdmin({ ...admin, accounts: admin.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) });

/** The account a username belongs to, whether a demo login or one HR created. */
function accountFor(username: string) {
  const u = username.trim().toLowerCase();
  const demo = getCredentials().find((c) => c.username === u);
  return demo ? admin.accounts.find((a) => a.demo === demo.key) : admin.accounts.find((a) => a.username === u && !a.demo);
}

export function signIn(username: string, password: string): SignInResult {
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
  if (account.status === "disabled") return fail("This account has been turned off. Please contact HR.", "Account turned off");
  const role = roleOf(account);
  if (!role) return fail("This account has no role yet. Please contact HR.", "No role");
  update(account.id, { failedAttempts: 0, lockedUntil: undefined, lastSignIn: now.toISOString() });
  logAdmin({ actor: account.name, module: "Sign-in", action: "Signed in", target: account.username, detail: role.name });
  return { ok: true, workspace: role.workspace, account: admin.accounts.find((a) => a.id === account.id)! };
}

export function recordSignOut(accountId: string | undefined, reason: "manual" | "idle") {
  const a = admin.accounts.find((x) => x.id === accountId);
  if (a) logAdmin({ actor: a.name, module: "Sign-in", action: reason === "idle" ? "Signed out (inactive)" : "Signed out", target: a.username, detail: reason === "idle" ? `No activity for ${admin.settings.idleMinutes} minutes` : "" });
}

export const accountById = (id: string | undefined) => admin.accounts.find((a) => a.id === id);

const FULL: Record<ModuleKey, Access> = { people: "edit", company: "edit", documents: "edit", timekeeping: "approve", leave: "approve", reports: "edit", administration: "edit" };

/** What the signed-in account can open in the HR workspace. Older sessions with no account get full access. */
export function accessFor(accountId: string | undefined): Record<ModuleKey, Access> {
  const account = accountById(accountId);
  if (!account) return FULL;
  return roleOf(account)?.access ?? FULL;
}

/** Still allowed to be signed in? (turned off or role removed while signed in) */
export function sessionValid(accountId: string | undefined) {
  if (!accountId) return true;
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

/** True when the account can open at least one HR module (not just Administration). */
export function hasHrAccess(accountId: string | undefined) {
  const access = accessFor(accountId);
  return (Object.keys(access) as ModuleKey[]).some((k) => k !== "administration" && access[k] !== "none");
}
