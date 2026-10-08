// What's waiting for the signed-in person's decision right now: their team's claims, overtime,
// undertime and time adjustments (approver), or claims waiting for the final approval
// (accounting). Built from the same guarded APIs the approval pages use.

import { fullName, initialsOf, state as core } from "./corehr/store";
import { canFor, LIMITS } from "./permissions";
import { listClaims } from "./reimbursements/api";
import { sessionWho } from "./session";
import { listFixes, listRequests } from "./timekeeping/api";

export interface ApprovalItem {
  id: string;
  employeeName: string;
  employeeInitials: string;
  employeeRole: string;
  type: string;
  detail: string;
  /** When it was filed (ISO). */
  requestedOn: string;
  /** The page where it's decided. */
  href: string;
}

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

function person(employeeId: string) {
  const e = core.employees.find((x) => x.id === employeeId);
  const name = e ? fullName(e.personal) : employeeId;
  return { employeeName: name, employeeInitials: e ? initialsOf(e.personal) : "?", employeeRole: core.positions.find((p) => p.id === e?.job.positionId)?.title ?? "" };
}

/** A section someone can't see simply contributes nothing. */
const orNone = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);

/** Oldest first. */
export async function listMyApprovals(): Promise<ApprovalItem[]> {
  const who = sessionWho();
  // Approvers decide in the Partner workspace; everyone else on the HR pages.
  const partner = !!who.role && LIMITS.workspace[who.role] === "manager";
  const [claims, requests, fixes] = await Promise.all([orNone(listClaims()), orNone(listRequests()), orNone(listFixes())]);
  const items: ApprovalItem[] = [
    ...claims
      .filter((c) => (c.status === "pending" && canFor(who, "approve", "claims", c.employeeId)) || (c.status === "endorsed" && canFor(who, "final", "claims", c.employeeId)))
      .map((c) => ({ id: c.id, ...person(c.employeeId), type: "Reimbursement", detail: `${c.merchant} · ${peso(c.amount)}`, requestedOn: c.filedAt, href: partner ? "/manager/approvals" : "/admin/requests/reimbursement" })),
    ...requests
      .filter((r) => r.status === "pending" && canFor(who, "approve", "attendanceRecords", r.employeeId))
      .map((r) => ({ id: r.id, ...person(r.employeeId), type: r.type === "overtime" ? "Overtime" : "Undertime", detail: `${r.date} · ${r.minutes} min`, requestedOn: r.filedAt, href: partner ? `/manager/attendance-approvals?tab=${r.type}` : `/admin/reports/${r.type}` })),
    ...fixes
      .filter((f) => f.status === "pending" && canFor(who, "approve", "attendanceRecords", f.employeeId))
      .map((f) => ({ id: f.id, ...person(f.employeeId), type: "Time adjustment", detail: `${f.workDate} · time-${f.kind} ${f.time}`, requestedOn: f.filedAt, href: partner ? "/manager/attendance-approvals?tab=adjustments" : "/admin/reports/time-adjustments" })),
  ];
  return items.sort((a, b) => a.requestedOn.localeCompare(b.requestedOn));
}
