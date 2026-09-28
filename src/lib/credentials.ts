import type { Role } from "./types";

export interface DemoCredential {
  username: string;
  password: string;
  role: Role;
  label: string;
}

// Demo-only fixed accounts — this prototype has no real backend/user store,
// so each role is gated behind one username/password pair.
const defaultCredentials: DemoCredential[] = [
  { username: "admin2", password: "admin2", role: "employee", label: "Employee" },
  { username: "admin", password: "admin", role: "manager", label: "Partner" },
  { username: "admin1", password: "admin1", role: "admin", label: "HR" },
];

const CREDENTIALS_KEY = "msma-hris-credentials";

type CredentialOverrides = Partial<Record<Role, { username: string; password: string }>>;

// Changes made in Settings are kept in localStorage so a new username or
// password still works after a reload.
function loadOverrides(): CredentialOverrides {
  try {
    const stored = localStorage.getItem(CREDENTIALS_KEY);
    if (stored) return JSON.parse(stored) as CredentialOverrides;
  } catch {
    // Storage blocked or corrupt — fall back to the seed accounts.
  }
  return {};
}

export function getCredentials(): DemoCredential[] {
  const overrides = loadOverrides();
  return defaultCredentials.map((c) => ({ ...c, ...overrides[c.role] }));
}

export function getCredential(role: Role): DemoCredential {
  return getCredentials().find((c) => c.role === role)!;
}

export function setCredential(role: Role, username: string, password: string) {
  const overrides = { ...loadOverrides(), [role]: { username, password } };
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
