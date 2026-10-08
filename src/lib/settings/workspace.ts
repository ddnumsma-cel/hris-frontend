// Workspace settings mock API (HR administrators). Each call stands in for an HTTP request
// (see BACKEND_HANDOFF.md). Organization fields reuse the existing getSettings/saveSettings.
//   GET/PUT  /settings/leave-policy        -> getLeavePolicy / saveLeavePolicy
//   GET/POST/DELETE /settings/holidays     -> getCustomHolidays / addCustomHoliday / removeCustomHoliday
//   GET/PUT  /settings/scheduling          -> getSchedulingRules / saveSchedulingRules
//   GET      /exports/{dataset}.csv        -> exportDataset

import { admin, logAdmin, roleOf } from "@/lib/admin/store";
import { fullName, state as core } from "@/lib/corehr/store";
import { toCsv } from "@/lib/download";
import { customHolidays, setCustomHolidays, type Holiday } from "@/lib/holidays";
import { leave, leavePolicy, saveLeave, type LeavePolicy } from "@/lib/leave/store";
import { save as saveTk, schedulingRules, tk, type SchedulingRules } from "@/lib/timekeeping/store";
import { deny } from "@/lib/session";

const DELAY = 250;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));
const log = (actor: string, action: string, detail: string) => logAdmin({ actor, module: "Settings", action, target: "Workspace", detail });

// ---- Time off & leave ----

export const getLeavePolicy = () => deny("rules", "view") ?? respond(leavePolicy());

export function saveLeavePolicy(input: LeavePolicy, actor: string) {
  const denied = deny("rules", "edit");
  if (denied) return denied;
  if (!(Number.isInteger(input.defaultCarryOver) && input.defaultCarryOver >= 0 && input.defaultCarryOver <= 365)) return fail("Carry-over is 0 to 365 days.");
  saveLeave({ ...leave, policy: input });
  log(actor, "Changed leave policy", `Half days ${input.allowHalfDays ? "on" : "off"}; negative balance ${input.allowNegative ? "on" : "off"}; carry-over ${input.defaultCarryOver}; accrual ${input.accrual}`);
  return respond(leavePolicy());
}

export const getCustomHolidays = () => respond(customHolidays());

export function addCustomHoliday(input: { date: string; name: string; type: Holiday["type"] }, actor: string) {
  const denied = deny("rules", "edit");
  if (denied) return denied;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return fail("Pick the holiday's date.");
  if (!input.name.trim()) return fail("Name the holiday.");
  if (customHolidays().some((h) => h.date === input.date)) return fail("There's already a company holiday on that date.");
  const next = [...customHolidays(), { date: input.date, name: input.name.trim(), type: input.type, source: "Company" }];
  setCustomHolidays(next);
  log(actor, "Added a holiday", `${input.name.trim()} (${input.date})`);
  return respond(customHolidays());
}

export function removeCustomHoliday(date: string, actor: string) {
  const denied = deny("rules", "edit");
  if (denied) return denied;
  const gone = customHolidays().find((h) => h.date === date);
  setCustomHolidays(customHolidays().filter((h) => h.date !== date));
  if (gone) log(actor, "Removed a holiday", `${gone.name} (${gone.date})`);
  return respond(customHolidays());
}

/** Who approves leave today, in words (the Leave approval workflow). */
export function getLeaveApprovalSummary() {
  const w = admin.workflows.find((x) => x.kind === "leave");
  if (!w || !w.active || !w.steps.length) return respond("Leave doesn't need approval.");
  const step = (s: (typeof w.steps)[number]) =>
    s.approver === "supervisor" ? "their supervisor" : s.approver === "department-head" ? "the department head" : (admin.roles.find((r) => r.id === s.roleId)?.name ?? "a role");
  return respond(`Approved by ${w.steps.map(step).join(", then ")}.`);
}

// ---- Scheduling ----

export const getSchedulingRules = () => deny("rules", "view") ?? respond(schedulingRules());

export function saveSchedulingRules(input: SchedulingRules, actor: string) {
  const denied = deny("rules", "edit");
  if (denied) return denied;
  if (!(input.overtimeThresholdMinutes >= 0 && input.overtimeThresholdMinutes <= 240)) return fail("Overtime threshold is 0 to 240 minutes.");
  if (!(input.defaultBreakMinutes >= 0 && input.defaultBreakMinutes <= 120)) return fail("Default break is 0 to 120 minutes.");
  if (!(input.publishLeadDays >= 0 && input.publishLeadDays <= 60)) return fail("Publish 0 to 60 days ahead.");
  saveTk({ ...tk, rules: input });
  log(actor, "Changed scheduling rules", `Overtime after ${input.overtimeThresholdMinutes} min; default break ${input.defaultBreakMinutes} min; publish ${input.publishLeadDays} days ahead`);
  return respond(schedulingRules());
}

// ---- Data & privacy ----

export const DATASETS = [
  { key: "employees", label: "Employees", description: "Everyone in Core HR with their job details." },
  { key: "leave", label: "Leave requests", description: "Every leave filed, with dates, days and status." },
  { key: "accounts", label: "User accounts", description: "Who can sign in and with what role (no passwords)." },
  { key: "audit", label: "Audit trail", description: "Sign-ins and changes, with who did them and when." },
] as const;
export type Dataset = (typeof DATASETS)[number]["key"];

function rowsFor(dataset: Dataset): Record<string, string | number>[] {
  if (dataset === "employees") {
    return core.employees.map((e) => ({
      "Employee ID": e.id,
      Name: fullName(e.personal),
      Position: core.positions.find((p) => p.id === e.job.positionId)?.title ?? "",
      Unit: core.units.find((u) => u.id === e.job.unitId)?.name ?? "",
      Status: e.job.status,
      "Date hired": e.job.dateHired,
      Email: e.contact.workEmail ?? "",
    }));
  }
  if (dataset === "leave") {
    const name = (id: string) => {
      const e = core.employees.find((x) => x.id === id);
      return e ? fullName(e.personal) : id;
    };
    return leave.requests.map((r) => ({
      "Request ID": r.id,
      Employee: name(r.employeeId),
      Type: leave.types.find((t) => t.id === r.typeId)?.name ?? r.typeId,
      Start: r.start,
      End: r.end,
      Days: r.days,
      Status: r.status,
      "Filed at": r.filedAt,
    }));
  }
  if (dataset === "accounts") {
    return admin.accounts.map((a) => ({ Username: a.username, Name: a.name, Role: roleOf(a)?.name ?? "", Status: a.status, "Last sign-in": a.lastSignIn ?? "" }));
  }
  return admin.log.map((l) => ({ When: l.at, Who: l.actor, Area: l.module, Action: l.action, Target: l.target, Detail: l.detail }));
}

/** CSV text for one dataset (the caller saves it as a file). */
export function exportDataset(dataset: Dataset, actor: string) {
  const denied = deny("systemSettings", "edit");
  if (denied) return denied;
  const csv = toCsv(rowsFor(dataset));
  log(actor, "Exported data", DATASETS.find((d) => d.key === dataset)!.label);
  return respond(csv);
}
