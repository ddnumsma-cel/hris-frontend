// Administration & Security data: user accounts, roles and their access,
// approval workflows, system settings and the admin log. Saved to localStorage.

import type { DemoKey } from "../credentials";
import type { Role } from "../types";

export type ModuleKey = "people" | "company" | "documents" | "timekeeping" | "leave" | "reimbursements" | "reports" | "payroll" | "administration";
export type Access = "none" | "view" | "edit" | "approve";

export const MODULES: { key: ModuleKey; label: string; approvable?: boolean }[] = [
  { key: "people", label: "People" },
  { key: "company", label: "Org chart" },
  { key: "documents", label: "Documents" },
  { key: "timekeeping", label: "Timekeeping & Attendance", approvable: true },
  { key: "leave", label: "Leave Management", approvable: true },
  { key: "reimbursements", label: "Reimbursements", approvable: true },
  { key: "reports", label: "Reports & Analytics" },
  { key: "payroll", label: "Payroll & contributions" },
  { key: "administration", label: "Administration & Security" },
];

export interface SystemRole {
  id: string;
  name: string;
  description: string;
  /** Which workspace the role signs into. */
  workspace: Role;
  builtIn: boolean;
  /** Can manage roles, system settings and other Super Admins. */
  superAdmin?: boolean;
  /** Access per HR-workspace module. Ignored for the Employee and Partner workspaces. */
  access: Record<ModuleKey, Access>;
}

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  /** Demo accounts sign in with the credentials in Settings; others with this. */
  password?: string;
  /** Set for the three built-in demo logins. */
  demo?: DemoKey;
  employeeId?: string;
  roleId: string;
  status: "active" | "disabled";
  mustChangePassword?: boolean;
  lastSignIn?: string;
  failedAttempts: number;
  lockedUntil?: string;
  createdAt: string;
}

export type RequestKind = "leave" | "overtime" | "undertime" | "correction" | "profile";
export type ApproverKind = "supervisor" | "department-head" | "role";

export interface WorkflowStep {
  approver: ApproverKind;
  /** For approver = "role". */
  roleId?: string;
  /** Only add this step for leave longer than this many days. */
  overDays?: number;
}

export interface Workflow {
  kind: RequestKind;
  steps: WorkflowStep[];
  /** Remind the approver after this many days without action (0 = never). */
  remindAfterDays: number;
  active: boolean;
}

export interface Settings {
  companyName: string;
  tin: string;
  address: string;
  contactEmail: string;
  minPasswordLength: number;
  lockAfterFailed: number;
  lockMinutes: number;
  idleMinutes: number;
}

export interface AdminLog {
  id: string;
  at: string;
  actor: string;
  module: "Administration" | "Sign-in" | "Payroll";
  action: string;
  target: string;
  detail: string;
}

export interface AdminState {
  roles: SystemRole[];
  accounts: UserAccount[];
  workflows: Workflow[];
  settings: Settings;
  log: AdminLog[];
}

const KEY = "heyhr-admin-v3";

const all = (a: Access): Record<ModuleKey, Access> => ({ people: a, company: a, documents: a, timekeeping: a, leave: a, reimbursements: a, reports: a, payroll: a, administration: a });

export const DEFAULT_ROLES: SystemRole[] = [
  { id: "super-admin", name: "Super Admin", description: "Runs the system and payroll: users, roles, approval workflows, audit trail, settings, payroll and government contributions.", workspace: "admin", builtIn: true, superAdmin: true, access: { ...all("none"), payroll: "edit", administration: "edit" } },
  { id: "admin", name: "Admin", description: "Runs HR: every HR module, company setup and approvals.", workspace: "admin", builtIn: true, access: { ...all("edit"), timekeeping: "approve", leave: "approve", reimbursements: "approve", administration: "none", payroll: "none" } },
  { id: "hr", name: "HR", description: "Day-to-day HR: employee records, attendance, leave and reports. Approves leave, overtime and undertime.", workspace: "admin", builtIn: true, access: { people: "edit", company: "view", documents: "edit", timekeeping: "approve", leave: "approve", reimbursements: "approve", reports: "view", payroll: "view", administration: "none" } },
  { id: "employee", name: "Employee", description: "Self-service: own leave, time, payslips and 201 file.", workspace: "employee", builtIn: true, access: all("none") },
];

const DEFAULT_SETTINGS: Settings = {
  companyName: "MSMA Group",
  tin: "",
  address: "Cebu City, Cebu",
  contactEmail: "hr@msma.ph",
  minPasswordLength: 8,
  lockAfterFailed: 5,
  lockMinutes: 15,
  idleMinutes: 30,
};

const DEFAULT_WORKFLOWS: Workflow[] = [
  { kind: "leave", steps: [{ approver: "role", roleId: "hr" }], remindAfterDays: 2, active: true },
  { kind: "overtime", steps: [{ approver: "role", roleId: "hr" }], remindAfterDays: 2, active: true },
  { kind: "undertime", steps: [{ approver: "role", roleId: "hr" }], remindAfterDays: 2, active: true },
  { kind: "correction", steps: [{ approver: "role", roleId: "hr" }], remindAfterDays: 1, active: true },
  { kind: "profile", steps: [{ approver: "role", roleId: "hr" }], remindAfterDays: 3, active: true },
];

function seed(): AdminState {
  const at = "2026-01-05T09:00:00";
  return {
    roles: DEFAULT_ROLES,
    accounts: [
      { id: "ua-super", name: "System Administrator", username: "superadmin", demo: "superadmin", roleId: "super-admin", status: "active", failedAttempts: 0, createdAt: at },
      { id: "ua-admin", name: "Office Administrator", username: "admin", demo: "admin", roleId: "admin", status: "active", failedAttempts: 0, createdAt: at },
      { id: "ua-hr", name: "Dinah Marquez", username: "admin1", demo: "hr", roleId: "hr", status: "active", failedAttempts: 0, createdAt: at },
      { id: "ua-employee", name: "Employee (demo)", username: "admin2", demo: "employee", roleId: "employee", status: "active", failedAttempts: 0, createdAt: at },
      { id: "ua-officer", name: "Joel Nierves", username: "hrofficer", password: "Heyhr-Officer-2026!", employeeId: "MSMA-00812", roleId: "hr", status: "active", failedAttempts: 0, createdAt: at },
    ],
    workflows: DEFAULT_WORKFLOWS,
    settings: DEFAULT_SETTINGS,
    log: [],
  };
}

function load(): AdminState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as AdminState;
      // Roles saved before a module existed get the built-in default for it (or no access).
      const roles = s.roles?.map((r) => {
        const base = DEFAULT_ROLES.find((d) => d.id === r.id)?.access ?? all("none");
        return { ...r, access: { ...base, ...r.access } };
      });
      return { ...seed(), ...s, ...(roles ? { roles } : {}), settings: { ...DEFAULT_SETTINGS, ...s.settings } };
    }
  } catch {
    // Storage blocked or corrupt: start from the seed.
  }
  return seed();
}

export let admin: AdminState = load();

export function saveAdmin(next: AdminState) {
  admin = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Non-fatal in the prototype.
  }
}

export function logAdmin(entry: Omit<AdminLog, "id" | "at">) {
  const log: AdminLog = { ...entry, id: `al-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString() };
  saveAdmin({ ...admin, log: [log, ...admin.log].slice(0, 2000) });
}

export const roleOf = (account: UserAccount | undefined) => admin.roles.find((r) => r.id === account?.roleId);

export const isSuperAdmin = (accountId: string | undefined) => !!roleOf(admin.accounts.find((a) => a.id === accountId))?.superAdmin;

/** Modules that don't open the HR workspace by themselves: system setup and payroll (the CEO runs both). */
export const NON_HR_MODULES: ModuleKey[] = ["administration", "payroll"];
