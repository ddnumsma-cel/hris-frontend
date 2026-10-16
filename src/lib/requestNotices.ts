// Bell notifications for requests, decisions and changes, like the alerts in everyday apps:
// a filed request tells whoever is assigned to decide it (the approval workflow, or the roles the
// access matrix assigns), a decision tells the employee, and HR changes to someone's records tell that person. Each topic links every role to
// the page where they deal with it. The account that acted is never told about its own action
// (see `notify`). Called by the mock API only.
// With the API server these are sent by the server instead (server/src/notify.ts, same LINKS and
// wording), inside the change that causes them; the mock API calls here only run without it.

import { notify, type NotificationKind } from "./notifications";
import { nameOf } from "./outbox";
import { approversFor } from "./admin/approvers";
import { EVERYONE, LINKS, rolesThatCan, type Topic } from "./noticeLinks";
import type { RequestKind } from "./admin/store";
import type { Action, Feature, RoleKey } from "./permissions";
import { fmtDay, fmtDayShort } from "./preferences";

export type { Topic } from "./noticeLinks";

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

export { EVERYONE };
