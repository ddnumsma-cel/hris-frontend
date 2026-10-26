// Who decides a request, from the approval workflow set in Administration › Workflows (and, for
// steps by role, the roles assigned there). Shared by the workflow preview and by notifications,
// so whoever is assigned is the one who's told.

import { state as core } from "../corehr/store";
import type { CoreEmployee } from "../corehr/types";
import type { RoleKey } from "../permissions";
import { admin, type RequestKind, type WorkflowStep } from "./store";

export const LEVEL_RANK: Record<string, number> = { Executive: 3, Manager: 2, Supervisor: 1 };

/** The steps that apply to a request (steps for long leave only count past their day limit). */
export function stepsFor(kind: RequestKind | null, days = 0): WorkflowStep[] {
  const w = kind ? admin.workflows.find((x) => x.kind === kind && x.active) : undefined;
  const steps = w?.steps.filter((s) => !s.overDays || days > s.overDays) ?? [];
  return steps.length ? steps : [{ approver: "supervisor" }];
}

/** The employee's supervisor, and whether they can decide (an active Approver login). */
export function supervisorOf(employeeId: string) {
  const e = core.employees.find((x) => x.id === employeeId);
  const sup = core.employees.find((x) => x.id === e?.job.supervisorId);
  const canApprove = !!sup && admin.accounts.some((a) => a.employeeId === sup.id && a.roleId === "approver" && a.status === "active");
  return { sup, canApprove };
}

/** The most senior other person in the employee's department (Executive, Manager, then Supervisor). */
export function departmentHeadOf(employeeId: string): CoreEmployee | undefined {
  const e = core.employees.find((x) => x.id === employeeId);
  if (!e) return undefined;
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
  return head && head.rank > 0 ? head.x : undefined;
}

/**
 * Who is told about a new request: every workflow step that applies, as people (a supervisor or
 * department head) and roles (a step by role; Super Admins when a supervisor can't decide; HR when
 * there's no department head). Requests without a workflow (claims) go to the supervisor.
 */
export function approversFor(kind: RequestKind | null, employeeId: string, days = 0): { employees: string[]; roles: RoleKey[] } {
  const employees = new Set<string>();
  const roles = new Set<RoleKey>();
  for (const s of stepsFor(kind, days)) {
    if (s.approver === "supervisor") {
      const { sup, canApprove } = supervisorOf(employeeId);
      if (sup && canApprove) employees.add(sup.id);
      else roles.add("super_admin");
    } else if (s.approver === "department-head") {
      const head = departmentHeadOf(employeeId);
      if (head) employees.add(head.id);
      else roles.add("hr");
    } else {
      const key = admin.roles.find((r) => r.id === s.roleId)?.key as RoleKey | undefined;
      if (key) roles.add(key);
    }
  }
  return { employees: [...employees], roles: [...roles] };
}

// Shared with the API server (pure), so it lives in noticeLinks.ts.
export { rolesThatCan } from "../noticeLinks";
