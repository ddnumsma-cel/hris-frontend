// Who is signed in, using the website's own sign-in code (@/lib/admin/auth, @/lib/backend/auth), so roles,
// workspaces and access are decided exactly as on the website (@/lib/permissions via @/lib/session).
// Data comes from the HR server (the MSMA HRIS backend); parts it doesn't cover use the website's own data on this
// phone, as on the website.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { accountById, IDLE_FLAG, markSignedIn, recordSignOut, sessionValid } from '@/lib/admin/auth';
import { roleOf, type UserAccount } from '@/lib/admin/store';
import { backendSignIn, backendSignOut } from '@/lib/backend/auth';
import { setBackendBase, whenSignedOut } from '@/lib/backend/client';
import { markSignInTime, sessionWho } from '@/lib/session';
import type { RoleKey } from '@/lib/permissions';
import type { Role } from '@/lib/types';
import { API_URL, setUnauthorizedHandler } from '~/lib/api';

/** Same keys as the website's AuthContext, so @/lib/session reads the signed-in account. */
const WORKSPACE_KEY = 'msma-hris-role';
const ACCOUNT_KEY = 'msma-hris-account';

export interface SessionUser {
  account: UserAccount;
  /** Which workspace the role signs into: employee, manager (approver) or admin (HR and the admin roles). */
  workspace: Role;
  role: RoleKey;
  roleName: string;
  name: string;
  initials: string;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

function userFor(account: UserAccount | undefined, workspace: Role): SessionUser | null {
  const role = roleOf(account);
  if (!account || !role) return null;
  return { account, workspace, role: role.key, roleName: role.name, name: account.name, initials: initialsOf(account.name) };
}


function readStored(): SessionUser | null {
  try {
    const workspace = localStorage.getItem(WORKSPACE_KEY) as Role | null;
    const accountId = localStorage.getItem(ACCOUNT_KEY) ?? undefined;
    // Only HR server sign-ins (their accounts start "be-"); an older demo sign-in on this phone is dropped.
    if (!workspace || !accountId?.startsWith('be-') || !sessionValid(accountId)) return null;
    return userFor(accountById(accountId), workspace);
  } catch {
    return null;
  }
}

interface SessionValue {
  user: SessionUser | null;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

// Before anything reads data: the website's data layer talks to the HR server (through the dev server).
setBackendBase(API_URL);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(readStored);

  // The HR server said the sign-in expired: back to the sign-in screen.
  useEffect(() => {
    const expired = () => {
      backendSignOut();
      localStorage.removeItem(WORKSPACE_KEY);
      localStorage.removeItem(ACCOUNT_KEY);
      setUser(null);
    };
    whenSignedOut(expired);
    // The employee screens' typed client (~/lib/api) too.
    setUnauthorizedHandler(expired);
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      async signIn(username, password) {
        const result = await backendSignIn(username, password);
        if (!result.ok) return result.error;
        localStorage.setItem(WORKSPACE_KEY, result.workspace);
        localStorage.setItem(ACCOUNT_KEY, result.account.id);
        sessionStorage.removeItem(IDLE_FLAG);
        markSignedIn();
        markSignInTime();
        setUser(userFor(result.account, result.workspace));
        return null;
      },
      signOut() {
        recordSignOut(user?.account.id, 'manual');
        backendSignOut();
        localStorage.removeItem(WORKSPACE_KEY);
        localStorage.removeItem(ACCOUNT_KEY);
        setUser(null);
      },
    }),
    [user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}

/** The signed-in person as the website's permission checks see them. */
export const useWho = () => {
  useSession(); // re-read after sign-in changes
  return sessionWho();
};
