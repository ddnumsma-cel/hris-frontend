import { createContext, useContext, useState, type ReactNode } from "react";
import { currentAdmin, currentEmployee, currentManager } from "@/lib/mockData";
import type { Role } from "@/lib/types";

export interface AuthUser {
  role: Role;
  name: string;
  initials: string;
  title: string;
}

const STORAGE_KEY = "msma-hris-role";

const roleKeys: Role[] = ["employee", "manager", "admin"];

// Built on demand (not once at import) so profile edits — e.g. the Partner
// updating their name in Settings — show up in the top bar.
function userFor(role: Role): AuthUser {
  switch (role) {
    case "employee":
      return { role, name: currentEmployee.name, initials: currentEmployee.initials, title: currentEmployee.position };
    case "manager":
      return { role, name: currentManager.name, initials: currentManager.initials, title: currentManager.title };
    case "admin":
      return { role, name: currentAdmin.name, initials: currentAdmin.initials, title: currentAdmin.title };
  }
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (role: Role) => void;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && roleKeys.includes(stored as Role) ? userFor(stored as Role) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);

  function login(role: Role) {
    localStorage.setItem(STORAGE_KEY, role);
    setUser(userFor(role));
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

  function refreshUser() {
    setUser((current) => (current ? userFor(current.role) : null));
  }

  return <AuthContext.Provider value={{ user, login, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
