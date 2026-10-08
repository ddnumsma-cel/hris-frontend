import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { currentAdmin, currentEmployee, currentManager } from "@/lib/mockData";
import { accountById, IDLE_FLAG, idleMinutes, markSignedIn, recordSignOut, sessionValid } from "@/lib/admin/auth";
import { roleOf, type UserAccount } from "@/lib/admin/store";
import type { Role } from "@/lib/types";

export interface AuthUser {
  role: Role;
  name: string;
  initials: string;
  title: string;
  /** The user account signed in (Administration & Security). */
  accountId?: string;
}

const STORAGE_KEY = "msma-hris-role";
const ACCOUNT_KEY = "msma-hris-account";

const roleKeys: Role[] = ["employee", "manager", "admin"];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

// Built on demand (not once at import) so profile edits show up in the top bar.
// The HR and Employee demo logins keep their profiles; every other account shows its own name.
function userFor(role: Role, account?: UserAccount): AuthUser {
  const accountId = account?.id;
  if (account?.demo === "employee" || (!account && role === "employee")) return { role, name: currentEmployee.name, initials: currentEmployee.initials, title: currentEmployee.position, accountId };
  if (account?.demo === "hr" || (!account && role === "admin")) return { role, name: currentAdmin.name, initials: currentAdmin.initials, title: currentAdmin.title, accountId };
  if (account?.demo === "approver") return { role, name: currentManager.name, initials: currentManager.initials, title: currentManager.title, accountId };
  if (account) return { role, name: account.name, initials: initials(account.name), title: roleOf(account)?.name ?? "", accountId };
  return { role, name: currentManager.name, initials: currentManager.initials, title: currentManager.title };
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (role: Role, account?: UserAccount) => void;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const accountId = localStorage.getItem(ACCOUNT_KEY) ?? undefined;
    if (!stored || !roleKeys.includes(stored as Role) || !sessionValid(accountId)) return null;
    return userFor(stored as Role, accountById(accountId));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);

  function login(role: Role, account?: UserAccount) {
    try {
      localStorage.setItem(STORAGE_KEY, role);
      if (account) localStorage.setItem(ACCOUNT_KEY, account.id);
      else localStorage.removeItem(ACCOUNT_KEY);
      sessionStorage.removeItem(IDLE_FLAG);
      markSignedIn();
    } catch {
      // Storage blocked: the session still works until the tab closes.
    }
    setUser(userFor(role, account));
  }

  function logout() {
    recordSignOut(user?.accountId, "manual");
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ACCOUNT_KEY);
    } catch {
      // Nothing to clear.
    }
    setUser(null);
  }

  function refreshUser() {
    setUser((current) => (current ? userFor(current.role, accountById(current.accountId)) : null));
  }

  // Sign out after the idle time in System settings.
  const signedIn = !!user;
  const accountId = user?.accountId;
  useEffect(() => {
    if (!signedIn) return;
    let timer = 0;
    const expire = () => {
      recordSignOut(accountId, "idle");
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(ACCOUNT_KEY);
        sessionStorage.setItem(IDLE_FLAG, "1");
      } catch {
        // Nothing to clear.
      }
      setUser(null);
    };
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(expire, idleMinutes() * 60_000);
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [signedIn, accountId]);

  return <AuthContext.Provider value={{ user, login, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
