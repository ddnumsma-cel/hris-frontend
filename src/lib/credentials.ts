import type { Role } from "./types";

export interface DemoCredential {
  username: string;
  password: string;
  role: Role;
  label: string;
}

// Demo-only fixed accounts — this prototype has no real backend/user store,
// so each role is gated behind one hardcoded username/password pair.
export const demoCredentials: DemoCredential[] = [
  { username: "admin2", password: "admin2", role: "employee", label: "Employee" },
  { username: "admin", password: "admin", role: "manager", label: "Partner" },
  { username: "admin1", password: "admin1", role: "admin", label: "HR" },
];

export function findCredential(username: string, password: string): DemoCredential | undefined {
  const normalized = username.trim().toLowerCase();
  return demoCredentials.find((c) => c.username === normalized && c.password === password);
}
