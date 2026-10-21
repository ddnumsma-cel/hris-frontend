// Bell notifications for requests, decisions and changes, like the alerts in everyday apps:
// a filed request tells whoever is assigned to decide it (the approval workflow, or the roles the
// access matrix assigns), a decision tells the employee, and HR changes to someone's records tell that person. Each topic links every role to
// the page where they deal with it. The account that acted is never told about its own action
// (see `notify`). Called by the mock API only.
// TODO(backend): send these from the server when the record changes, with push/email per settings.

import { notify, type NotificationKind } from "./notifications";
import { nameOf } from "./outbox";
import { approversFor, rolesThatCan } from "./admin/approvers";
import type { RequestKind } from "./admin/store";
import type { Action, Feature, RoleKey } from "./permissions";
import { fmtDay, fmtDayShort } from "./preferences";

export type Topic =
  | "leave"
  | "overtime"
  | "undertime"
  | "adjustment"
  | "claim"
  | "payslip"
  | "attendance"
  | "documents"
  | "loan"
  | "policy"
  | "schedule"
  | "separation"
  | "account"
  | "orgchart"
  | "subscription"
  | "certificate"
  | "support"
  | "newhire";

const ADMIN = (path: string): Partial<Record<RoleKey, string>> => ({ super_admin: path, hr: path, accounting: path, system_admin: path });

const LINKS: Record<Topic, Partial<Record<RoleKey, string>>> = {
  leave: { ...ADMIN("/admin/maintenance/leave/requests"), approver: "/manager/approvals?tab=leave", employee: "/employee/leave" },
  overtime: { ...ADMIN("/admin/reports/overtime"), approver: "/manager/approvals?tab=overtime", employee: "/employee/attendance" },
  undertime: { ...ADMIN("/admin/reports/undertime"), approver: "/manager/approvals?tab=undertime", employee: "/employee/attendance" },
  adjustment: { ...ADMIN("/admin/reports/time-adjustments"), approver: "/manager/approvals?tab=adjustments", employee: "/employee/attendance" },
  claim: { ...ADMIN("/admin/requests/reimbursement"), approver: "/manager/approvals?tab=claims", employee: "/employee/reimbursements" },
  payslip: { ...ADMIN("/admin/payroll/runs"), employee: "/employee/payslips" },
  attendance: { ...ADMIN("/admin/reports/attendance-logs"), approver: "/manager/attendance", employee: "/employee/attendance" },
  documents: { ...ADMIN("/admin/maintenance/documents"), employee: "/employee/201-file" },
  loan: { ...ADMIN("/admin/payroll/loans"), employee: "/employee/payslips" },
  policy: { ...ADMIN("/admin/maintenance/rules"), employee: "/employee/policies" },
  schedule: { ...ADMIN("/admin/timekeeping/schedules"), approver: "/manager/attendance", employee: "/employee/attendance" },
  separation: { ...ADMIN("/admin/maintenance/people"), accounting: "/admin/payroll/final-pay" },
  account: ADMIN("/admin/administration/users"),
  newhire: ADMIN("/admin/maintenance/people"),
  orgchart: { ...ADMIN("/admin/maintenance/org-chart"), approver: "/manager/workforce" },
  certificate: { ...ADMIN("/admin/requests/certificates"), employee: "/employee/certificates" },
  support: { ...ADMIN("/admin/administration/support"), employee: "/employee/support" },
  subscription: { super_admin: "/admin/settings/subscription", hr: "/admin/settings/subscription", system_admin: "/admin/administration/subscription" },
};

/** "Oct 14" or "Oct 14 – Oct 16" for a notification. */
export const dates = (start: string, end?: string) => (end && end !== start ? `${fmtDayShort(start)} – ${fmtDayShort(end)}` : fmtDay(start));

/** The employee's name for a notification ("Katrina Enriquez"). */
export const who = (employeeId: string) => nameOf(employeeId);

const WORKFLOW: Partial<Record<Topic, RequestKind>> = { leave: "leave", overtime: "overtime", undertime: "undertime", adjustment: "correction" };

/**
 * A request (or news about one) for whoever is assigned to decide it in Administration › Workflows:
 * the supervisor, the department head or a role, for every step that applies (`days` for steps that
 * only count on long leave). Requests without a workflow (claims) go to the supervisor.
 */
export function tellApprover(employeeId: string, topic: Topic, kind: NotificationKind, title: string, body: string, days = 0) {
  const { employees, roles } = approversFor(WORKFLOW[topic] ?? null, employeeId, days);
  notify({ kind, title, body, employees, roles, links: LINKS[topic] });
}

/** News for the roles assigned an action in the access matrix (e.g. final approval of claims → Accounting). */
export function tellAssigned(action: Action, feature: Feature, topic: Topic, kind: NotificationKind, title: string, body: string) {
  notify({ kind, title, body, roles: rolesThatCan(action, feature), links: LINKS[topic] });
}

/** News for the people the record belongs to (a decision, a change HR made). */
export function tellEmployees(employeeIds: string | (string | undefined)[], topic: Topic, kind: NotificationKind, title: string, body: string) {
  notify({ kind, title, body, employees: Array.isArray(employeeIds) ? employeeIds : [employeeIds], links: LINKS[topic] });
}

/** News for everyone holding these roles (the next step's team, or the whole company). */
export function tellRoles(roles: RoleKey[], topic: Topic, kind: NotificationKind, title: string, body: string) {
  notify({ kind, title, body, roles, links: LINKS[topic] });
}

/** Everyone in the company. */
export const EVERYONE: RoleKey[] = ["super_admin", "hr", "approver", "accounting", "employee"];
