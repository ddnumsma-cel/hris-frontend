// The HR Home's numbers, worked out from the real records (Core HR, Leave, documents) instead
// of sample figures, so what the Home says always matches the rest of the app.

import { state as core } from "./corehr/store";
import { leave } from "./leave/store";
import { branchOf, departmentOf } from "./timekeeping/store";
import type { ComplianceItem } from "./types";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => iso(new Date());
const current = () => core.employees.filter((e) => e.job.status !== "Separated");

export interface HomeStats {
  totalHeadcount: number;
  newHiresThisMonth: number;
  attritionRateYtd: number;
  separationsYtd: number;
  openPositions: { total: number; byDepartment: { name: string; count: number }[] };
  onLeaveToday: number;
  /** Monthly salaries of everyone employed now (before contributions and overtime). */
  monthlySalaries: number;
}

export function homeStats(): HomeStats {
  const now = today();
  const month = now.slice(0, 7);
  const year = now.slice(0, 4);
  const people = current();
  const separations = core.employees.filter((e) => (e.job.separationDate ?? "").startsWith(year) && e.job.separationDate! < now).length;
  // Separations over the average of the year's start and today's headcount.
  const startOfYear = core.employees.filter((e) => e.job.dateHired < `${year}-01-01` && (!e.job.separationDate || e.job.separationDate >= `${year}-01-01`)).length;
  const average = (startOfYear + people.length) / 2 || 1;
  const byDept = new Map<string, number>();
  for (const p of core.positions.filter((x) => x.active)) {
    const holders = core.employees.filter((e) => e.job.positionId === p.id && e.job.status !== "Separated").length;
    const open = Math.max(0, p.slots - holders);
    if (!open) continue;
    const name = core.units.find((u) => u.id === p.departmentId)?.name ?? "Other";
    byDept.set(name, (byDept.get(name) ?? 0) + open);
  }
  const onLeave = new Set(leave.requests.filter((r) => r.status === "approved" && r.start <= now && r.end >= now).map((r) => r.employeeId));
  return {
    totalHeadcount: people.length,
    newHiresThisMonth: people.filter((e) => e.job.dateHired.startsWith(month)).length,
    attritionRateYtd: Math.round((separations / average) * 1000) / 10,
    separationsYtd: separations,
    openPositions: { total: [...byDept.values()].reduce((n, c) => n + c, 0), byDepartment: [...byDept].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) },
    onLeaveToday: people.filter((e) => onLeave.has(e.id)).length,
    monthlySalaries: people.reduce((n, e) => n + e.job.monthlySalary, 0),
  };
}

/** Headcount per office, largest first; offices with nobody are left out. */
export function headcountByOffice(): { office: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of current()) {
    const office = branchOf(e.job.unitId) || "No office";
    counts.set(office, (counts.get(office) ?? 0) + 1);
  }
  return [...counts].map(([office, count]) => ({ office, count })).sort((a, b) => b.count - a.count);
}

/** Headcount per department, largest first. */
export function headcountByDepartment(): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of current()) {
    const name = departmentOf(e.job.unitId)?.name ?? "No department";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** New people: hired in the last 90 days, how many still have 201 papers to finish, probation ending soon. */
export function newHirePipeline(): { stage: string; count: number }[] {
  const now = new Date();
  const ago = iso(new Date(now.getTime() - 90 * 86_400_000));
  const soon = iso(new Date(now.getTime() + 30 * 86_400_000));
  const people = current();
  const recent = people.filter((e) => e.job.dateHired >= ago);
  const incomplete = recent.filter((e) => core.documents.some((d) => d.employeeId === e.id && (d.status === "Missing" || d.status === "Submitted"))).length;
  // Probation is six months from hire unless they're already regular.
  const probationEnds = people.filter((e) => {
    if (e.job.employmentType !== "Probationary") return false;
    const d = new Date(`${e.job.dateHired}T12:00:00`);
    d.setMonth(d.getMonth() + 6);
    const end = iso(d);
    return end >= today() && end <= soon;
  }).length;
  return [
    { stage: "Hired in the last 90 days", count: recent.length },
    { stage: "201 file still incomplete", count: incomplete },
    { stage: "Probation ends within 30 days", count: probationEnds },
  ];
}

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * This month's government deadlines for last month's payroll, with the usual due dates. Their
 * Filed / due-soon status is tracked on the compliance calendar as before.
 */
export function defaultComplianceCalendar(now = new Date()): ComplianceItem[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const key = `${y}-${m + 1}`;
  const items: ComplianceItem[] = [
    { id: `bir-${key}`, filing: "Withholding tax remittance (1601-C)", agency: "BIR", due: `${SHORT[m]} 10`, status: "Due soon" },
    { id: `ph-${key}`, filing: "Monthly premium remittance", agency: "PhilHealth", due: `${SHORT[m]} 15`, status: "Due soon" },
    { id: `pi-${key}`, filing: "Monthly contribution remittance", agency: "Pag-IBIG", due: `${SHORT[m]} 15`, status: "Due soon" },
    { id: `sss-${key}`, filing: "Monthly contribution remittance", agency: "SSS", due: `${SHORT[m]} ${last}`, status: "Due soon" },
  ];
  // January also has the BIR 2316 certificates for every employee.
  if (m === 0) items.push({ id: `2316-${y}`, filing: "Certificate of Compensation (2316)", agency: "BIR", due: "Jan 31", status: "Due soon" });
  return items;
}
