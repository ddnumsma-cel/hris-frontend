// More of the employee's own view: loans, BIR 2316, bank account, everything they've filed,
// work-from-home days, who's out in their department, and the notifications bell.

import { certificateRequests } from "../mockData";
import { fullName, state as core } from "../corehr/store";
import { leave } from "../leave/store";
import { allLoans } from "../pay/loanStore";
import { approvedRuns, loanPaid } from "../pay/runs";
import { form2316 } from "../pay/yearend";
import { policiesFor } from "../policies";
import { fmtDay, fmtTime } from "../preferences";
import { claims, claimType } from "../reimbursements/store";
import { departmentOf, tk, todayIso } from "../timekeeping/store";
import { myId } from "./api";
import { approversFor, supervisorOf } from "../admin/approvers";
import type { RequestKind } from "../admin/store";
import { ROLE_LABEL } from "../permissions";

const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), 150));
const me = () => core.employees.find((e) => e.id === myId());
const round2 = (n: number) => Math.round(n * 100) / 100;

// ---- Loans ----

export interface MyLoan {
  id: string;
  kind: string;
  reference: string;
  principal: number;
  installment: number;
  paid: number;
  balance: number;
  status: string;
}

export function myLoans(): Promise<MyLoan[]> {
  const id = myId();
  return respond(
    allLoans()
      .filter((l) => l.employeeId === id)
      .map((l) => {
        const paid = round2(loanPaid(l.id));
        const balance = l.status === "active" ? round2(Math.max(0, l.principal - paid)) : 0;
        return { id: l.id, kind: l.kind, reference: l.reference, principal: l.principal, installment: l.installment, paid, balance, status: balance > 0 ? "Running" : l.status === "active" ? "Paid" : l.status === "settled" ? "Settled in final pay" : "Stopped" };
      }),
  );
}

// ---- BIR 2316 and bank ----

export const my2316 = (year: number) => respond(form2316(myId(), year));

/** Where take-home pay goes. Read-only here; HR changes it on the 201 File. */
export const myBank = () => respond(me()?.bank ?? null);

// ---- Everything they've filed ----

export interface MyRequest {
  id: string;
  kind: "Leave" | "Overtime" | "Undertime" | "Time adjustment" | "Reimbursement" | "Certificate";
  detail: string;
  filedAt: string;
  status: string;
  tone: "good" | "warn" | "crit" | "neutral";
  /** The page where it's filed and followed up. */
  href: string;
}

const toneOf = (s: string): MyRequest["tone"] => (/approv|paid|released|ready/i.test(s) ? "good" : /declin|reject|cancel/i.test(s) ? "crit" : /pending|waiting|review|process/i.test(s) ? "warn" : "neutral");
const nice = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function myRequests(): Promise<MyRequest[]> {
  const id = myId();
  const out: MyRequest[] = [];
  for (const r of leave.requests.filter((x) => x.employeeId === id)) {
    const type = leave.types.find((t) => t.id === r.typeId)?.name ?? "Leave";
    const status = r.status === "pending" ? "Waiting for your manager" : nice(r.status);
    out.push({ id: r.id, kind: "Leave", detail: `${type} · ${r.start === r.end ? fmtDay(r.start) : `${fmtDay(r.start)} to ${fmtDay(r.end)}`}`, filedAt: r.filedAt, status, tone: toneOf(status), href: "/employee/leave" });
  }
  for (const r of tk.requests.filter((x) => x.employeeId === id)) {
    const status = r.status === "pending" ? "Waiting for your manager" : nice(r.status);
    out.push({ id: r.id, kind: r.type === "overtime" ? "Overtime" : "Undertime", detail: `${fmtDay(r.date)} · ${r.minutes} min`, filedAt: r.filedAt, status, tone: toneOf(status), href: r.type === "overtime" ? "/employee/overtime" : "/employee/undertime" });
  }
  for (const f of tk.fixRequests.filter((x) => x.employeeId === id)) {
    const status = f.status === "pending" ? "Waiting for your manager" : nice(f.status);
    out.push({ id: f.id, kind: "Time adjustment", detail: `${fmtDay(f.workDate)} · time-${f.kind} ${f.time}`, filedAt: f.filedAt, status, tone: toneOf(status), href: "/employee/attendance" });
  }
  for (const c of claims.filter((x) => x.employeeId === id)) {
    const status = c.paidAt ? "Released" : c.status === "approved" ? "Approved · to be released" : c.status === "pending" ? "Waiting for your manager" : c.status === "endorsed" ? "Waiting for Accounting" : nice(c.status);
    out.push({ id: c.id, kind: "Reimbursement", detail: `${claimType(c)} · ₱${c.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, filedAt: c.filedAt, status, tone: toneOf(status), href: "/employee/reimbursements" });
  }
  // Certificate requests are kept for the signed-in employee in this prototype.
  for (const c of certificateRequests) out.push({ id: c.id, kind: "Certificate", detail: `${c.type} · ${c.purpose}`, filedAt: c.requestedOn, status: c.status, tone: toneOf(c.status), href: "/employee/certificates" });
  return respond(out.sort((a, b) => b.filedAt.localeCompare(a.filedAt)));
}

// ---- Work from home ----

export interface MyWfhDay {
  date: string;
  inAt?: string;
  outAt?: string;
  /** "Working from home" (their choice) or the reason HR declared the day. */
  reason: string;
  located: boolean;
}

export function myWfhDays(): Promise<MyWfhDay[]> {
  const id = myId();
  const punches = (tk.remotePunches ?? []).filter((p) => p.employeeId === id && !tk.voided[p.id]);
  const dates = [...new Set([...(tk.wfh ?? []).filter((w) => w.employeeId === id).map((w) => w.date), ...punches.map((p) => p.workDate)])];
  return respond(
    dates
      .map((date) => {
        const day = punches.filter((p) => p.workDate === date);
        const inP = day.find((p) => p.kind === "in");
        const own = (tk.wfh ?? []).some((w) => w.employeeId === id && w.date === date);
        return { date, inAt: inP?.at, outAt: day.filter((p) => p.kind === "out").pop()?.at, reason: own ? "Working from home" : (inP?.reason ?? "Remote work day"), located: !!inP?.location && "lat" in inP.location };
      })
      .sort((a, b) => b.date.localeCompare(a.date)),
  );
}

// ---- Who's out ----

/** Colleagues in the same department on approved leave today (names only; the reason stays private). */
export function whosOutToday(): Promise<{ id: string; name: string; until: string }[]> {
  const mine = me();
  const dept = mine ? departmentOf(mine.job.unitId)?.id : undefined;
  const today = todayIso();
  return respond(
    core.employees
      .filter((e) => e.id !== mine?.id && e.job.status !== "Separated" && dept && departmentOf(e.job.unitId)?.id === dept)
      .flatMap((e) => {
        const r = leave.requests.find((x) => x.employeeId === e.id && x.status === "approved" && x.start <= today && x.end >= today);
        return r ? [{ id: e.id, name: fullName(e.personal), until: r.end }] : [];
      }),
  );
}

// ---- Notifications bell ----

export interface MyNotice {
  id: string;
  title: string;
  postedOn: string;
}

/** What changed for the employee in the last two weeks, newest first. */
export async function myNotices(): Promise<MyNotice[]> {
  const id = myId();
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const when = (iso: string) => `${fmtDay(iso.slice(0, 10))}${iso.length > 10 ? ` · ${fmtTime(iso)}` : ""}`;
  const out: (MyNotice & { at: string })[] = [];
  for (const r of leave.requests.filter((x) => x.employeeId === id && x.decidedAt && x.decidedAt >= since && x.status !== "pending")) {
    const type = leave.types.find((t) => t.id === r.typeId)?.name ?? "Leave";
    out.push({ id: `lv-${r.id}`, title: `Your ${type} (${fmtDay(r.start)}) was ${r.status === "approved" ? "approved" : r.status}`, postedOn: when(r.decidedAt!), at: r.decidedAt! });
  }
  for (const r of [...tk.requests, ...tk.fixRequests].filter((x) => x.employeeId === id && x.decidedAt && x.decidedAt >= since)) {
    const what = "type" in r ? (r.type === "overtime" ? "overtime" : "undertime") : "time adjustment";
    out.push({ id: `tk-${r.id}`, title: `Your ${what} request was ${r.status}`, postedOn: when(r.decidedAt!), at: r.decidedAt! });
  }
  for (const c of claims.filter((x) => x.employeeId === id)) {
    if (c.paidAt && c.paidAt >= since) out.push({ id: `cp-${c.id}`, title: `Your ${claimType(c)} reimbursement was released to you`, postedOn: when(c.paidAt), at: c.paidAt });
    else if (c.decidedAt && c.decidedAt >= since && c.status === "rejected") out.push({ id: `cr-${c.id}`, title: `Your ${claimType(c)} claim was rejected`, postedOn: when(c.decidedAt), at: c.decidedAt });
  }
  for (const r of approvedRuns().filter((x) => x.approvedAt && x.approvedAt >= since && x.lines.some((l) => l.person.id === id))) {
    out.push({ id: `ps-${r.id}`, title: `Your payslip for ${r.label} is ready`, postedOn: when(r.approvedAt!), at: r.approvedAt! });
  }
  for (const p of (await policiesFor(id)).filter((x) => x.requireAck && !x.acknowledgedAt)) {
    out.push({ id: `po-${p.id}`, title: `Please read: ${p.title}`, postedOn: "Company policy", at: p.updatedAt });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).map(({ at: _at, ...n }) => n);
}

// ---- Who approves ----

/** Who decides a request of this kind for the employee, from the approval workflow: the same people
 *  and roles that get the notification and see it in their Approvals (lib/admin/approvers.ts). */
export function myApprovers(kind: RequestKind | null): { names: string[]; roles: string[]; isSupervisor: boolean } {
  const id = myId();
  const { employees, roles } = approversFor(kind, id);
  const sup = supervisorOf(id);
  return {
    names: employees.map((e) => { const x = core.employees.find((p) => p.id === e); return x ? fullName(x.personal) : e; }),
    roles: roles.map((r) => ROLE_LABEL[r]),
    isSupervisor: !!sup.sup && sup.canApprove && employees.includes(sup.sup.id),
  };
}
