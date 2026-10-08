// Administration & Security mock API. Each call stands in for an HTTP request.

import { fullName, state as core } from "../corehr/store";
import { leave } from "../leave/store";
import { tk } from "../timekeeping/store";
import { admin, logAdmin, saveAdmin, type Access, type ModuleKey, type RequestKind, type Settings, type SystemRole, type UserAccount, type Workflow } from "./store";
import { LIMITS, type RoleKey } from "../permissions";
import { deny, employeeOfAccount, forbidden, sessionWho } from "../session";

const DELAY = 250;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));

const ACCESS_LABEL: Record<Access, string> = { none: "No access", view: "View only", edit: "View and edit", approve: "Edit and approve" };
export { ACCESS_LABEL };

// ---- Accounts ----

export interface AccountRow extends Omit<UserAccount, "password"> {
  roleName: string;
  employeeName?: string;
  locked: boolean;
}

function rows(): AccountRow[] {
  const now = new Date().toISOString();
  return admin.accounts
    .map(({ password: _password, ...a }) => {
      const e = core.employees.find((x) => x.id === a.employeeId);
      return { ...a, roleName: admin.roles.find((r) => r.id === a.roleId)?.name ?? "No role", employeeName: e ? fullName(e.personal) : undefined, locked: !!a.lockedUntil && a.lockedUntil > now };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A System Admin sees only Super Admin accounts (no client staff); Super Admins see everyone. */
export const listAccounts = () => deny("roleAssignment", "view") ?? respond(rows().filter((a) => sessionWho().role !== "system_admin" || roleKeyOf(a.roleId) === "super_admin"));

export function employeesWithoutAccount() {
  // System Admins don't see client staff.
  if (sessionWho().role === "system_admin") return [];
  const taken = new Set(admin.accounts.map((a) => a.employeeId));
  return core.employees
    .filter((e) => e.job.status !== "Separated" && !taken.has(e.id))
    .map((e) => ({ id: e.id, name: fullName(e.personal), email: e.contact.workEmail }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A readable temporary password that meets the length rule. */
function tempPassword() {
  const words = ["Mango", "Cebu", "Lapu", "Sinulog", "Taal", "Bohol", "Malunggay", "Sampaguita"];
  const w = words[Math.floor(Math.random() * words.length)]!;
  let p = `${w}-${Math.floor(1000 + Math.random() * 9000)}`;
  while (p.length < admin.settings.minPasswordLength) p += Math.floor(Math.random() * 10);
  return p;
}

const roleKeyOf = (roleId: string | undefined): RoleKey | undefined => admin.roles.find((r) => r.id === roleId)?.key;
/** May the signed-in person give (or change accounts holding) this role? */
const mayAssign = (key: RoleKey | undefined) => !!key && LIMITS.assignableRoles[sessionWho().role ?? "employee"].includes(key);

const superAdmins = (accounts: UserAccount[], roles = admin.roles) => accounts.filter((a) => a.status === "active" && roles.find((r) => r.id === a.roleId)?.superAdmin);

export async function createAccount(input: { name: string; username: string; roleId: string; employeeId?: string }, actor: string, _actorAccountId?: string) {
  const denied = deny("roleAssignment", "create");
  if (denied) return denied;
  const giving = admin.roles.find((r) => r.id === input.roleId)?.key;
  if (!giving || !mayAssign(giving)) return forbidden("You can't give that role.");
  // One person, one account.
  const holder = input.employeeId ? admin.accounts.find((a) => employeeOfAccount(a) === input.employeeId) : undefined;
  if (holder) return fail(`This person already has an account (username ${holder.username}).`);
  const name = input.name.trim();
  const username = input.username.trim().toLowerCase();
  if (!name) return fail("Enter the person's name");
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return fail("Username: 3 to 30 letters, numbers, dots or dashes, no spaces");
  if (admin.accounts.some((a) => a.username === username) || ["admin", "admin1", "admin2"].includes(username)) return fail("That username is taken");
  const role = admin.roles.find((r) => r.id === input.roleId);
  if (!role) return fail("Choose a role");
  const password = tempPassword();
  const account: UserAccount = { id: `ua-${Date.now().toString(36)}`, name, username, password, employeeId: input.employeeId || undefined, roleId: role.id, status: "active", mustChangePassword: true, failedAttempts: 0, createdAt: new Date().toISOString() };
  saveAdmin({ ...admin, accounts: [...admin.accounts, account] });
  logAdmin({ actor, module: "Administration", action: "Added user", target: username, detail: `${name} as ${role.name}` });
  return respond({ username, password });
}

function guard(id: string, actorAccountId: string | undefined, next: UserAccount[]) {
  if (id === actorAccountId) return "You can't change your own access. Ask another administrator.";
  if (superAdmins(next).length === 0) return "There must always be at least one active Super Admin.";
  return null;
}

export async function setAccountRole(id: string, roleId: string, actor: string, actorAccountId?: string) {
  const denied = deny("roleAssignment", "edit");
  if (denied) return denied;
  const current = admin.accounts.find((x) => x.id === id);
  const giving = admin.roles.find((r) => r.id === roleId)?.key;
  if (!current || !giving || !mayAssign(giving) || !mayAssign(roleKeyOf(current.roleId))) return forbidden("You can't give or change that role.");
  const a = admin.accounts.find((x) => x.id === id);
  const role = admin.roles.find((r) => r.id === roleId);
  if (!a || !role) return fail("Choose a role");
  const next = admin.accounts.map((x) => (x.id === id ? { ...x, roleId } : x));
  const problem = guard(id, actorAccountId, next);
  if (problem) return fail(problem);
  saveAdmin({ ...admin, accounts: next });
  logAdmin({ actor, module: "Administration", action: "Changed role", target: a.username, detail: `${admin.roles.find((r) => r.id === a.roleId)?.name ?? "None"} → ${role.name}` });
  return respond(undefined);
}

export async function setAccountStatus(id: string, status: UserAccount["status"], actor: string, actorAccountId?: string) {
  const denied = deny("roleAssignment", "edit") ?? (mayAssign(roleKeyOf(admin.accounts.find((x) => x.id === id)?.roleId)) ? null : forbidden());
  if (denied) return denied;
  const a = admin.accounts.find((x) => x.id === id);
  if (!a) return fail("That account no longer exists");
  const next = admin.accounts.map((x) => (x.id === id ? { ...x, status } : x));
  const problem = guard(id, actorAccountId, next);
  if (problem) return fail(problem);
  saveAdmin({ ...admin, accounts: next });
  logAdmin({ actor, module: "Administration", action: status === "active" ? "Turned on account" : "Turned off account", target: a.username, detail: a.name });
  return respond(undefined);
}

export async function unlockAccount(id: string, actor: string, _actorAccountId?: string) {
  const denied = deny("roleAssignment", "edit") ?? (mayAssign(roleKeyOf(admin.accounts.find((x) => x.id === id)?.roleId)) ? null : forbidden());
  if (denied) return denied;
  const a = admin.accounts.find((x) => x.id === id);
  if (!a) return fail("That account no longer exists");
  saveAdmin({ ...admin, accounts: admin.accounts.map((x) => (x.id === id ? { ...x, lockedUntil: undefined, failedAttempts: 0 } : x)) });
  logAdmin({ actor, module: "Administration", action: "Unlocked account", target: a.username, detail: a.name });
  return respond(undefined);
}

export async function resetPassword(id: string, actor: string, _actorAccountId?: string) {
  const denied = deny("roleAssignment", "edit") ?? (mayAssign(roleKeyOf(admin.accounts.find((x) => x.id === id)?.roleId)) ? null : forbidden());
  if (denied) return denied;
  const a = admin.accounts.find((x) => x.id === id);
  if (!a) return fail("That account no longer exists");
  if (a.demo) return fail("This is a demo login. Its password is set on the sign-in screen's demo list.");
  const password = tempPassword();
  saveAdmin({ ...admin, accounts: admin.accounts.map((x) => (x.id === id ? { ...x, password, mustChangePassword: true, lockedUntil: undefined, failedAttempts: 0 } : x)) });
  logAdmin({ actor, module: "Administration", action: "Reset password", target: a.username, detail: a.name });
  return respond({ username: a.username, password });
}

// ---- Roles ----

export interface RoleRow extends SystemRole {
  users: number;
}

export const listRoles = () => respond(admin.roles.map((r) => ({ ...r, users: admin.accounts.filter((a) => a.roleId === r.id).length })));

/** The six roles are fixed: what they can do is the access matrix in lib/permissions.ts. */
export async function saveRole(_input: { id?: string; name: string; description: string; access: Record<ModuleKey, Access> }, _actor: string, _actorAccountId?: string): Promise<SystemRole> {
  return fail("Roles are fixed. Their access is set in the access matrix, not here.");
}

export async function deleteRole(_id: string, _actor: string, _actorAccountId?: string): Promise<void> {
  return fail("Roles are fixed and can't be deleted.");
}

// ---- Workflows ----

export const WORKFLOW_LABEL: Record<RequestKind, { name: string; description: string }> = {
  leave: { name: "Leave", description: "Vacation, sick and every other leave type" },
  overtime: { name: "Overtime", description: "Work past the end of the shift" },
  undertime: { name: "Undertime", description: "Leaving before the shift ends" },
  correction: { name: "Time correction", description: "A missing or wrong time-in / time-out" },
  profile: { name: "Profile change", description: "Employee updates to their own 201 file" },
};

export const listWorkflows = () => deny("rules", "view") ?? respond(admin.workflows);

export async function saveWorkflow(input: Workflow, actor: string) {
  const denied = deny("rules", "edit");
  if (denied) return denied;
  if (input.steps.length === 0) return fail("Add at least one approval step");
  if (input.steps.length > 3) return fail("Keep it to 3 steps or fewer so requests don't get stuck");
  if (input.steps.some((s) => s.approver === "role" && !admin.roles.some((r) => r.id === s.roleId))) return fail("Choose the role for each 'Anyone with a role' step");
  if (input.steps.some((s) => s.overDays !== undefined && (!Number.isFinite(s.overDays) || s.overDays < 1))) return fail("The 'only when longer than' days must be 1 or more");
  if (!Number.isFinite(input.remindAfterDays) || input.remindAfterDays < 0) return fail("Reminder days must be 0 or more");
  saveAdmin({ ...admin, workflows: admin.workflows.map((w) => (w.kind === input.kind ? input : w)) });
  logAdmin({ actor, module: "Administration", action: "Changed approval workflow", target: WORKFLOW_LABEL[input.kind].name, detail: describeSteps(input) });
  return respond(input);
}

function approverName(step: Workflow["steps"][number]) {
  if (step.approver === "supervisor") return "Their supervisor";
  if (step.approver === "department-head") return "Department head";
  return admin.roles.find((r) => r.id === step.roleId)?.name ?? "A role";
}

export function describeSteps(w: Workflow) {
  return w.steps.map((s) => `${approverName(s)}${s.overDays ? ` (if over ${s.overDays} days)` : ""}`).join(" → ");
}

const LEVEL_RANK: Record<string, number> = { Executive: 3, Manager: 2, Supervisor: 1 };

/** Who actually approves a request from this employee, step by step. */
export function approvalPath(kind: RequestKind, employeeId: string, days = 0): { step: string; who: string }[] {
  const w = admin.workflows.find((x) => x.kind === kind);
  const e = core.employees.find((x) => x.id === employeeId);
  if (!w || !e) return [];
  return w.steps
    .filter((s) => !s.overDays || days > s.overDays)
    .map((s) => {
      if (s.approver === "supervisor") {
        const sup = core.employees.find((x) => x.id === e.job.supervisorId);
        return { step: "Supervisor", who: sup ? fullName(sup.personal) : "No supervisor set: goes to HR" };
      }
      if (s.approver === "department-head") {
        const unitOf = (id: string) => core.units.find((u) => u.id === id);
        const deptId = (unitId: string) => {
          let u = unitOf(unitId);
          while (u && u.type !== "department") u = u.parentId ? unitOf(u.parentId) : undefined;
          return u?.id;
        };
        const dept = deptId(e.job.unitId);
        const head = core.employees
          .filter((x) => x.id !== e.id && x.job.status !== "Separated" && deptId(x.job.unitId) === dept)
          .map((x) => ({ x, rank: LEVEL_RANK[core.positions.find((p) => p.id === x.job.positionId)?.level ?? ""] ?? 0 }))
          .sort((a, b) => b.rank - a.rank)[0];
        return { step: "Department head", who: head && head.rank > 0 ? fullName(head.x.personal) : "No department head: goes to HR" };
      }
      const role = admin.roles.find((r) => r.id === s.roleId);
      const people = admin.accounts.filter((a) => a.roleId === s.roleId && a.status === "active").map((a) => a.name);
      return { step: role?.name ?? "Role", who: people.length ? people.join(", ") : "No one has this role yet" };
    });
}

export function sampleEmployees() {
  return core.employees
    .filter((e) => e.job.status !== "Separated")
    .map((e) => ({ id: e.id, name: fullName(e.personal) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Settings ----

export const getSettings = () => respond(admin.settings);

export async function saveSettings(input: Settings, actor: string, _actorAccountId?: string) {
  const denied = deny("systemSettings", "edit");
  if (denied) return denied;
  if (!input.companyName.trim()) return fail("Enter the company name");
  if (input.tin && !/^\d{3}-\d{3}-\d{3}(-\d{3,5})?$/.test(input.tin.trim())) return fail("TIN looks like 000-000-000-00000");
  if (input.contactEmail && !/^\S+@\S+\.\S+$/.test(input.contactEmail.trim())) return fail("Enter a valid HR email");
  if (!(input.minPasswordLength >= 8 && input.minPasswordLength <= 64)) return fail("Passwords should be at least 8 characters (up to 64)");
  if (!(input.lockAfterFailed >= 3 && input.lockAfterFailed <= 10)) return fail("Lock after 3 to 10 wrong passwords");
  if (!(input.lockMinutes >= 5 && input.lockMinutes <= 1440)) return fail("Lock for 5 minutes to 24 hours");
  if (!(input.idleMinutes >= 5 && input.idleMinutes <= 480)) return fail("Sign out after 5 minutes to 8 hours without activity");
  if (!input.workWeek.length) return fail("Pick at least one working day");
  if (!(input.workStart < input.workEnd)) return fail("Working hours must end after they start");
  if (!(input.fiscalYearStartMonth >= 1 && input.fiscalYearStartMonth <= 12)) return fail("Pick the month the fiscal year starts");
  if (!(input.retentionMonths >= 0 && input.retentionMonths <= 240)) return fail("Keep records for 0 to 240 months");
  const before = admin.settings;
  const next = { ...input, companyName: input.companyName.trim(), tin: input.tin.trim(), address: input.address.trim(), contactEmail: input.contactEmail.trim() };
  saveAdmin({ ...admin, settings: next });
  const labels: Record<keyof Settings, string> = { companyName: "Company name", tin: "TIN", address: "Address", contactEmail: "HR email", minPasswordLength: "Minimum password length", lockAfterFailed: "Lock after wrong passwords", lockMinutes: "Lock minutes", idleMinutes: "Idle sign-out minutes", logo: "Logo", defaultTimezone: "Default timezone", currency: "Currency", workWeek: "Work week", workStart: "Work starts", workEnd: "Work ends", fiscalYearStartMonth: "Fiscal year start", retentionMonths: "Keep records (months)" };
  const show = (k: keyof Settings, v: Settings[keyof Settings]) => (k === "logo" ? (v ? "set" : "none") : Array.isArray(v) ? v.join(",") : String(v || "—"));
  const changed = (Object.keys(labels) as (keyof Settings)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(next[k])).map((k) => `${labels[k]}: ${show(k, before[k])} → ${show(k, next[k])}`);
  if (changed.length) logAdmin({ actor, module: "Administration", action: "Changed system settings", target: "Settings", detail: changed.join("; ") });
  return respond(next);
}

// ---- Audit trail ----

export type AuditModule = "People" | "Timekeeping" | "Leave" | "Payroll" | "Administration" | "Sign-in" | "Settings";

export interface AuditRow {
  id: string;
  at: string;
  actor: string;
  module: AuditModule;
  action: string;
  target: string;
  detail: string;
}

/** Everything recorded across the system, newest first. Read-only: there is no edit or delete. */
export function listAudit(): Promise<AuditRow[]> {
  const denied = deny("audit", "view");
  if (denied) return denied;
  // Each role sees its own areas of the trail (lib/permissions.ts LIMITS.auditAreas).
  const areas = LIMITS.auditAreas[sessionWho().role ?? "employee"];
  const name = (id: string) => {
    const e = core.employees.find((x) => x.id === id);
    return e ? fullName(e.personal) : id;
  };
  const typeName = (id: string) => leave.types.find((t) => t.id === id)?.name ?? "Leave";
  const range = (a: string, b: string) => (a === b ? a : `${a} to ${b}`);
  const rows: AuditRow[] = [
    ...admin.log.map((l) => ({ ...l })),
    ...core.audit.map((a) => ({ id: `c-${a.id}`, at: a.at, actor: a.actor, module: "People" as const, action: `${a.action} ${a.section.toLowerCase()}`, target: name(a.employeeId), detail: a.summary })),
    ...tk.audit.map((a) => ({ id: `t-${a.id}`, at: a.at, actor: a.actor, module: "Timekeeping" as const, action: a.action, target: name(a.employeeId), detail: `${a.workDate}: ${a.detail}` })),
    ...tk.requests.flatMap((r) => [
      { id: `tr-${r.id}`, at: r.filedAt, actor: r.filedBy, module: "Timekeeping" as const, action: `Filed ${r.type}`, target: name(r.employeeId), detail: `${r.date}, ${r.minutes} min` },
      ...(r.decidedAt ? [{ id: `td-${r.id}`, at: r.decidedAt, actor: r.decidedBy ?? "", module: "Timekeeping" as const, action: `${r.status === "approved" ? "Approved" : "Declined"} ${r.type}`, target: name(r.employeeId), detail: r.note ?? `${r.date}` }] : []),
    ]),
    ...leave.requests.flatMap((r) => [
      { id: `lf-${r.id}`, at: r.filedAt, actor: r.filedBy, module: "Leave" as const, action: "Filed leave", target: name(r.employeeId), detail: `${typeName(r.typeId)}, ${range(r.start, r.end)} (${r.days} days)` },
      ...(r.decidedAt ? [{ id: `ld-${r.id}`, at: r.decidedAt, actor: r.decidedBy ?? "", module: "Leave" as const, action: r.status === "approved" ? "Approved leave" : r.status === "rejected" ? "Rejected leave" : "Cancelled leave", target: name(r.employeeId), detail: `${typeName(r.typeId)}, ${range(r.start, r.end)}${r.note ? `: ${r.note}` : ""}` }] : []),
    ]),
    ...leave.adjustments.map((a) => ({ id: `la-${a.id}`, at: a.at, actor: a.by, module: "Leave" as const, action: "Changed leave balance", target: name(a.employeeId), detail: `${a.days > 0 ? "+" : ""}${a.days} ${typeName(a.typeId)}: ${a.reason}` })),
  ];
  return respond(rows.filter((r) => r.at && (areas === "all" || areas.includes(r.module))).sort((a, b) => b.at.localeCompare(a.at)));
}
