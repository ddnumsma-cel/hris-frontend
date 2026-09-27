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

const roleDirectory: Record<Role, AuthUser> = {
  employee: {
    role: "employee",
    name: currentEmployee.name,
    initials: currentEmployee.initials,
    title: currentEmployee.position,
  },
  manager: {
    role: "manager",
    name: currentManager.name,
    initials: currentManager.initials,
    title: currentManager.title,
  },
  admin: {
    role: "admin",
    name: currentAdmin.name,
    initials: currentAdmin.initials,
    title: currentAdmin.title,
  },
};

interface AuthContextValue {
  user: AuthUser | null;
  login: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && stored in roleDirectory ? roleDirectory[stored as Role] : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);

  function login(role: Role) {
    localStorage.setItem(STORAGE_KEY, role);
    setUser(roleDirectory[role]);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
