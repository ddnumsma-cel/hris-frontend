import type { Role } from "./types";

/** The four built-in demo logins, one per role. */
export type DemoKey = "superadmin" | "admin" | "hr" | "employee";

export interface DemoCredential {
  key: DemoKey;
  username: string;
  password: string;
  /** The workspace it signs into. */
  role: Role;
  label: string;
}

// Demo-only fixed accounts — this prototype has no real backend/user store,
// so each built-in role is reachable with one username/password pair.
const defaultCredentials: DemoCredential[] = [
  { key: "superadmin", username: "superadmin", password: "superadmin", role: "admin", label: "Super Admin" },
  { key: "admin", username: "admin", password: "admin", role: "admin", label: "Admin" },
  { key: "hr", username: "admin1", password: "admin1", role: "admin", label: "HR" },
  { key: "employee", username: "admin2", password: "admin2", role: "employee", label: "Employee" },
];

const CREDENTIALS_KEY = "msma-hris-credentials-v2";
const OLD_KEY = "msma-hris-credentials";

type CredentialOverrides = Partial<Record<DemoKey, { username: string; password: string }>>;

// Changes made in Settings are kept in localStorage so a new username or
// password still works after a reload.
function loadOverrides(): CredentialOverrides {
  try {
    const stored = localStorage.getItem(CREDENTIALS_KEY);
    if (stored) return JSON.parse(stored) as CredentialOverrides;
    // Earlier versions saved changes per workspace; carry over HR and Employee.
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const o = JSON.parse(old) as Partial<Record<"admin" | "employee", { username: string; password: string }>>;
      return { ...(o.admin ? { hr: o.admin } : {}), ...(o.employee ? { employee: o.employee } : {}) };
    }
  } catch {
    // Storage blocked or corrupt — fall back to the seed accounts.
  }
  return {};
}

export function getCredentials(): DemoCredential[] {
  const overrides = loadOverrides();
  return defaultCredentials.map((c) => ({ ...c, ...overrides[c.key] }));
}

export function getCredential(key: DemoKey): DemoCredential {
  return getCredentials().find((c) => c.key === key)!;
}

export function setCredential(key: DemoKey, username: string, password: string) {
  const overrides = { ...loadOverrides(), [key]: { username, password } };
  try {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(overrides));
  } catch {
    // Non-fatal in the prototype: nothing else to persist to.
  }
}

export function findCredential(username: string, password: string): DemoCredential | undefined {
  const normalized = username.trim().toLowerCase();
  return getCredentials().find((c) => c.username === normalized && c.password === password);
}
