// Employee Self-Service: the signed-in employee's own view of the same data HR
// works with. Leave they file shows up in HR's Leave requests, time requests in
// Timekeeping, and payslips use the same payroll engine as the Payroll register.

import { fullName, state as core } from "../corehr/store";
import { cancelRequest, fileLeave, type FileInput } from "../leave/api";
import { balanceFor, creditsFor, leave, type Credits } from "../leave/store";
import { currentEmployee } from "../mockData";
import { sessionWho } from "../session";
import { fileClaim, listMyClaims, type ClaimInput } from "../reimbursements/api";
import { approvedLinesFor } from "../pay/runs";
import type { PayLine, Period } from "../reports/api";
import { addDays } from "../timekeeping/compute";
import { acknowledgeNotice, fileFix, fileRequest, listDays, listNotices, type DayRow } from "../timekeeping/api";
import { tk, todayIso } from "../timekeeping/store";
import type { FixCause, FixRequest, TimeRequest } from "../timekeeping/types";
import { updateEmployeeSection } from "../corehr/api";
import type { CoreEmployee } from "../corehr/types";
import type { Balance, LeaveRequest, LeaveType } from "../leave/types";

const DELAY = 200;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));

/** The signed-in employee: their linked record (the demo login is Angela's). */
export const myId = () => sessionWho().employeeId ?? currentEmployee.id;
const me = () => core.employees.find((e) => e.id === myId());
export const myName = () => {
  const e = me();
  return e ? fullName(e.personal) : currentEmployee.name;
};

// ---- Leave ----

export interface MyLeave {
  types: LeaveType[];
  credits: Credits;
  balances: (Balance & { type: LeaveType })[];
  requests: (LeaveRequest & { type: LeaveType })[];
}

export function myLeave(): Promise<MyLeave> {
  const types = leave.types.filter((t) => t.active);
  const balances = types.map((t) => ({ ...balanceFor(myId(), t), type: t })).filter((b) => b.eligible || b.used > 0 || b.pending > 0);
  const requests = leave.requests
    .filter((r) => r.employeeId === myId())
    .flatMap((r) => {
      const type = leave.types.find((t) => t.id === r.typeId);
      return type ? [{ ...r, type }] : [];
    })
    .sort((a, b) => b.filedAt.localeCompare(a.filedAt));
  return respond({ types, credits: creditsFor(myId()), balances, requests });
}

export const fileMyLeave = (input: Omit<FileInput, "employeeId">) => fileLeave({ ...input, employeeId: myId() }, myName());
export const withdrawMyLeave = (id: string) => cancelRequest(id, "Withdrawn by the employee", myName());

// ---- Attendance ----

export interface MyAttendance {
  days: DayRow[];
  requests: TimeRequest[];
  fixes: FixRequest[];
}

export async function myAttendance(): Promise<MyAttendance> {
  const today = todayIso();
  const days = (await listDays(addDays(today, -13), today)).filter((d) => d.person.id === myId()).sort((a, b) => b.date.localeCompare(a.date));
  return respond({
    days,
    requests: tk.requests.filter((r) => r.employeeId === myId()).sort((a, b) => b.filedAt.localeCompare(a.filedAt)),
    fixes: tk.fixRequests.filter((r) => r.employeeId === myId()),
  });
}

export const fileMyTimeRequest = (input: { date: string; type: TimeRequest["type"]; minutes: number; reason: string }) => fileRequest({ ...input, employeeId: myId() }, myName());

export const fileMyFix = (input: { workDate: string; kind: "in" | "out"; time: string; nextDay?: boolean; cause: FixCause; reason: string }) => fileFix({ ...input, employeeId: myId() }, myName());

/** Memos HR sent me about lateness or AWOL, newest first. */
export const myNotices = () => listNotices(myId());
export const acknowledgeMyNotice = (id: string) => acknowledgeNotice(id, myId());

// ---- Payslips ----

export interface MyPayslip {
  period: Period;
  line: PayLine;
  /** The cut-off has ended and pay is released. */
  released: boolean;
}

/** Payslips come only from payroll runs the CEO approved, so they never change after payday. */
export async function myPayslips(): Promise<MyPayslip[]> {
  return respond(approvedLinesFor(myId()).map(({ run, line }) => ({ period: { id: run.id, label: run.label, from: run.from, to: run.to }, line, released: true })));
}

// ---- Profile ----

export const myContact = () => respond(me()?.contact ?? null);

/** Employees can update how to reach them; the change is logged in their record. */
export async function updateMyContact(patch: Pick<CoreEmployee["contact"], "mobile" | "personalEmail" | "address" | "city" | "province" | "emergencyName" | "emergencyRelationship" | "emergencyPhone">) {
  const e = me();
  if (!e) throw new Error("Your employee record wasn't found. Please contact HR.");
  return updateEmployeeSection(myId(), "contact", { ...e.contact, ...patch }, `${myName()} (self-service)`);
}

// ---- Reimbursements ----

export const myClaims = () => listMyClaims(myId());
export const fileMyClaim = (input: Omit<ClaimInput, "employeeId">) => fileClaim({ ...input, employeeId: myId() });
