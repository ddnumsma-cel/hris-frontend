// Reports & Analytics mock API. Every report is computed from the live Core HR,
// Timekeeping and Leave data, so it always matches what the other pages show.

import { fullName, state as core } from "../corehr/store";
import { leave, countDays } from "../leave/store";
import { listDays, listRequests as listTimeRequests, type DayRow } from "../timekeeping/api";
import { addDays, lateHoursCharged, lateRuns } from "../timekeeping/compute";
import { branchOf, departmentOf, todayIso } from "../timekeeping/store";
import { pagibig, philhealth, round2, sss, THIRTEENTH_MONTH_EXEMPT, withholding } from "./statutory";

// ---- Periods ----

export type PeriodKind = "none" | "cutoff" | "month" | "recent" | "year";

export interface Period {
  id: string;
  label: string;
  from: string;
  to: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const monthPeriod = (y: number, m: number): Period => ({ id: `${y}-${pad(m + 1)}`, label: `${MONTHS[m]} ${y}`, from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(lastDay(y, m))}` });

/** The periods a report can be run for, newest first. */
export function periodsFor(kind: PeriodKind): Period[] {
  const today = todayIso();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  const prev = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
  if (kind === "cutoff") {
    const short = (mm: number) => MONTHS[mm]!.slice(0, 3);
    const cut = (yy: number, mm: number, second: boolean): Period => ({
      id: `${yy}-${pad(mm + 1)}-${second ? "b" : "a"}`,
      label: second ? `${short(mm)} 16–${lastDay(yy, mm)}, ${yy}` : `${short(mm)} 1–15, ${yy}`,
      from: `${yy}-${pad(mm + 1)}-${second ? "16" : "01"}`,
      to: `${yy}-${pad(mm + 1)}-${second ? pad(lastDay(yy, mm)) : "15"}`,
    });
    const list = Number(today.slice(8)) > 15 ? [cut(y, m, true), cut(y, m, false), cut(prev.y, prev.m, true)] : [cut(y, m, false), cut(prev.y, prev.m, true), cut(prev.y, prev.m, false)];
    return list;
  }
  if (kind === "month") return [monthPeriod(y, m), monthPeriod(prev.y, prev.m)];
  if (kind === "recent") return [{ id: "14", label: "Last 2 weeks", from: addDays(today, -13), to: today }, monthPeriod(y, m), monthPeriod(prev.y, prev.m)];
  if (kind === "year") return [{ id: "year", label: `This year (${y})`, from: `${y}-01-01`, to: `${y}-12-31` }, monthPeriod(y, m), monthPeriod(prev.y, prev.m)];
  return [{ id: "now", label: "As of today", from: today, to: today }];
}

// ---- People ----

interface Person {
  id: string;
  name: string;
  position: string;
  department: string;
  branch: string;
  type: string;
  status: string;
  hired: string;
  separated?: string;
  salary: number;
  sex: string;
  sssNo: string;
  philhealthNo: string;
  pagibigNo: string;
  tin: string;
}

function everyone(office: string): Person[] {
  return core.employees
    .map((e) => ({
      id: e.id,
      name: fullName(e.personal),
      position: core.positions.find((p) => p.id === e.job.positionId)?.title ?? "",
      department: departmentOf(e.job.unitId)?.name ?? "No department",
      branch: branchOf(e.job.unitId),
      type: e.job.employmentType,
      status: e.job.status,
      hired: e.job.dateHired,
      separated: e.job.separationDate,
      salary: e.job.monthlySalary,
      sex: e.personal.sex,
      sssNo: e.government.sss,
      philhealthNo: e.government.philhealth,
      pagibigNo: e.government.pagibig,
      tin: e.government.tin,
    }))
    .filter((p) => office === "All offices" || p.branch === office)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Employed at some point between from and to. */
const employedIn = (p: Person, from: string, to: string) => p.hired <= to && (!p.separated || p.separated >= from);
const current = (office: string) => everyone(office).filter((p) => p.status !== "Separated");

function mask(v: string) {
  const digits = v.replace(/\D/g, "");
  return digits ? `•••• ${digits.slice(-4)}` : "Missing";
}

function monthsBetween(from: string, to: string) {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7));
}

function tenure(hired: string) {
  const months = monthsBetween(hired, todayIso()) - (Number(todayIso().slice(8)) < Number(hired.slice(8)) ? 1 : 0);
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y ? `${y} yr${y > 1 ? "s" : ""}${m ? ` ${m} mo` : ""}` : `${Math.max(0, m)} mo`;
}

const groupBy = <T,>(items: T[], key: (t: T) => string) => {
  const map = new Map<string, T[]>();
  for (const i of items) map.set(key(i), [...(map.get(key(i)) ?? []), i]);
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
};
const sum = <T,>(items: T[], f: (t: T) => number) => round2(items.reduce((n, i) => n + f(i), 0));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// ---- Attendance ----

interface AttendanceTotals {
  scheduled: number;
  present: number;
  absent: number;
  leave: number;
  lateTimes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  workedMinutes: number;
  /** Unpaid lunch taken out of worked time (recorded automatically from the shift). */
  lunchMinutes: number;
  days: DayRow[];
}

async function attendance(from: string, to: string) {
  const end = to > todayIso() ? todayIso() : to;
  const days = end < from ? [] : await listDays(from, end);
  const by = new Map<string, AttendanceTotals>();
  for (const d of days) {
    const t = by.get(d.person.id) ?? { scheduled: 0, present: 0, absent: 0, leave: 0, lateTimes: 0, lateMinutes: 0, undertimeMinutes: 0, overtimeMinutes: 0, nightMinutes: 0, workedMinutes: 0, lunchMinutes: 0, days: [] };
    t.days.push(d);
    if (d.status === "done" || d.status === "working") t.present++;
    if (d.status === "absent") t.absent++;
    if (d.status === "leave") t.leave++;
    if (["done", "working", "absent", "not-in", "leave"].includes(d.status)) t.scheduled++;
    if (d.lateMinutes > 0) t.lateTimes++;
    t.lateMinutes += d.lateMinutes;
    if (!d.undertimeExcused) t.undertimeMinutes += d.undertimeMinutes;
    t.overtimeMinutes += d.approvedOvertimeMinutes;
    t.nightMinutes += d.nightMinutes;
    t.workedMinutes += d.workedMinutes;
    t.lunchMinutes += d.lunchMinutes;
    by.set(d.person.id, t);
  }
  return by;
}

// ---- Payroll ----

/** Rates used for one cut-off. Simplified: see the notes on the Payroll register. */
const WORK_DAYS_PER_YEAR = 261;
const OT_RATE: Record<string, number> = { ordinary: 1.25, rest: 1.69, special: 1.69, regular: 2.6 };
const WORKED_PREMIUM: Record<string, number> = { ordinary: 0, rest: 0.3, special: 0.3, regular: 1 };

export interface PayLine {
  person: Person;
  basic: number;
  deductions: number;
  overtime: number;
  premiums: number;
  gross: number;
  sssEe: number;
  sssEr: number;
  ec: number;
  phEe: number;
  phEr: number;
  piEe: number;
  piEr: number;
  taxable: number;
  tax: number;
  net: number;
  /** The attendance this cut-off's pay is based on. */
  time: { present: number; absent: number; workedMinutes: number; lunchMinutes: number; lunchBreaks: number; lateMinutes: number; undertimeMinutes: number; overtimeMinutes: number };
}

function unpaidLeaveDays(employeeId: string, from: string, to: string) {
  return leave.requests
    .filter((r) => r.employeeId === employeeId && r.status === "approved" && r.start <= to && r.end >= from && leave.types.find((t) => t.id === r.typeId)?.paid === false)
    .reduce((n, r) => n + (r.halfDay ? r.days : countDays(r.start < from ? from : r.start, r.end > to ? to : r.end, "workdays")), 0);
}

export async function payroll(period: Period, office: string): Promise<PayLine[]> {
  const att = await attendance(period.from, period.to);
  // Two weeks before the cut-off too, so a late run that started in the last cut-off is seen.
  const end = period.to > todayIso() ? todayIso() : period.to;
  const history = new Map<string, DayRow[]>();
  for (const d of end < period.from ? [] : await listDays(addDays(period.from, -14), end)) history.set(d.person.id, [...(history.get(d.person.id) ?? []), d]);
  return everyone(office)
    .filter((p) => employedIn(p, period.from, period.to) && p.salary > 0)
    .map((p) => {
      const a = att.get(p.id);
      const daily = (p.salary * 12) / WORK_DAYS_PER_YEAR;
      const hourly = daily / 8;
      const basic = p.salary / 2;
      const lwop = unpaidLeaveDays(p.id, period.from, period.to);
      // Company late rule: late days are charged by the hour; 3+ late days in a row are charged as full days (absent, then AWOL).
      const runs = lateRuns(history.get(p.id) ?? []);
      let lateHours = 0;
      let lateRunDays = 0;
      for (const d of a?.days ?? []) {
        if (runs.has(d.date)) lateRunDays++;
        else lateHours += lateHoursCharged(d);
      }
      const deductions = round2((a ? (a.absent + lateRunDays) * daily + (lateHours + a.undertimeMinutes / 60) * hourly : 0) + lwop * daily);
      let overtime = 0;
      let premiums = 0;
      for (const d of a?.days ?? []) {
        overtime += (d.approvedOvertimeMinutes / 60) * hourly * (OT_RATE[d.dayType] ?? 1.25);
        if (d.workedMinutes > 0) premiums += daily * (WORKED_PREMIUM[d.dayType] ?? 0);
        premiums += (d.nightMinutes / 60) * hourly * 0.1;
      }
      const gross = round2(Math.max(0, basic - deductions) + overtime + premiums);
      const s = sss(p.salary);
      const ph = philhealth(p.salary);
      const pi = pagibig(p.salary);
      const half = (n: number) => round2(n / 2);
      const ee = half(s.ee) + half(ph.ee) + half(pi.ee);
      const taxable = round2(Math.max(0, gross - ee));
      const tax = withholding(taxable, "semi-monthly");
      return {
        person: p,
        basic: round2(basic),
        deductions,
        overtime: round2(overtime),
        premiums: round2(premiums),
        gross,
        sssEe: half(s.ee),
        sssEr: half(s.er),
        ec: half(s.ec),
        phEe: half(ph.ee),
        phEr: half(ph.er),
        piEe: half(pi.ee),
        piEr: half(pi.er),
        taxable,
        tax,
        net: round2(gross - ee - tax),
        time: {
          present: a?.present ?? 0,
          absent: a?.absent ?? 0,
          workedMinutes: a?.workedMinutes ?? 0,
          lunchMinutes: a?.lunchMinutes ?? 0,
          lunchBreaks: a?.days.filter((d) => d.lunchMinutes > 0).length ?? 0,
          lateMinutes: a?.lateMinutes ?? 0,
          undertimeMinutes: a?.undertimeMinutes ?? 0,
          overtimeMinutes: a?.overtimeMinutes ?? 0,
        },
      };
    });
}

/** Both cut-offs of a month, for monthly statutory remittances. */
async function monthPayroll(period: Period, office: string) {
  const mid = period.from.slice(0, 8);
  const [a, b] = await Promise.all([payroll({ ...period, to: `${mid}15` }, office), payroll({ ...period, from: `${mid}16` }, office)]);
  return a.map((x) => {
    const y = b.find((z) => z.person.id === x.person.id);
    return { person: x.person, gross: round2(x.gross + (y?.gross ?? 0)), taxable: round2(x.taxable + (y?.taxable ?? 0)), tax: round2(x.tax + (y?.tax ?? 0)) };
  });
}

// ---- Report definitions ----

export type Category = "hr" | "attendance" | "payroll" | "statutory" | "management";
export type ColumnKind = "text" | "number" | "money" | "percent";

export interface ReportColumn {
  key: string;
  label: string;
  kind?: ColumnKind;
  /** "screen": shown on the page only; "file": in the CSV and print only. */
  only?: "screen" | "file";
}

export type ReportRow = Record<string, string | number>;

export interface ReportResult {
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Totals for money / number columns, shown above the table. */
  summary: { label: string; value: string | number; kind?: ColumnKind }[];
  note?: string;
}

export interface ReportDef {
  id: string;
  category: Category;
  name: string;
  description: string;
  period: PeriodKind;
  run: (period: Period, office: string) => Promise<ReportResult>;
}

const col = (key: string, label: string, kind: ColumnKind = "text"): ReportColumn => ({ key, label, kind });

export const REPORTS: ReportDef[] = [
  // ---- HR ----
  {
    id: "masterlist",
    category: "hr",
    name: "Employee masterlist",
    description: "Everyone currently employed, with position, department and tenure.",
    period: "none",
    run: async (_, office) => {
      const ps = current(office);
      return {
        columns: [col("Employee", "Employee"), col("Position", "Position"), col("Department", "Department"), col("Branch", "Branch"), col("Type", "Type"), col("Status", "Status"), col("Date hired", "Date hired"), col("Tenure", "Tenure")],
        rows: ps.map((p) => ({ Employee: p.name, Position: p.position, Department: p.department, Branch: p.branch, Type: p.type, Status: p.status, "Date hired": p.hired, Tenure: tenure(p.hired) })),
        summary: [
          { label: "Employees", value: ps.length },
          { label: "Regular", value: ps.filter((p) => p.type === "Regular").length },
          { label: "Probationary", value: ps.filter((p) => p.type === "Probationary").length },
        ],
      };
    },
  },
  {
    id: "headcount",
    category: "hr",
    name: "Headcount by department",
    description: "How many people each department has, by employment type.",
    period: "none",
    run: async (_, office) => {
      const ps = current(office);
      const rows = groupBy(ps, (p) => p.department).map(([dept, list]) => ({
        Department: dept,
        Regular: list.filter((p) => p.type === "Regular").length,
        Probationary: list.filter((p) => p.type === "Probationary").length,
        Others: list.filter((p) => p.type !== "Regular" && p.type !== "Probationary").length,
        Women: list.filter((p) => p.sex === "Female").length,
        Men: list.filter((p) => p.sex === "Male").length,
        Total: list.length,
      }));
      return {
        columns: [col("Department", "Department"), col("Regular", "Regular", "number"), col("Probationary", "Probationary", "number"), col("Others", "Project / fixed-term", "number"), ...(ps.some((p) => p.sex) ? [col("Women", "Women", "number"), col("Men", "Men", "number")] : []), col("Total", "Total", "number")],
        rows,
        summary: [
          { label: "Employees", value: ps.length },
          { label: "Departments", value: rows.length },
        ],
      };
    },
  },
  {
    id: "movements",
    category: "hr",
    name: "New hires and separations",
    description: "Who joined and who left in the period.",
    period: "year",
    run: async (period, office) => {
      const ps = everyone(office);
      const rows = [
        ...ps.filter((p) => p.hired >= period.from && p.hired <= period.to).map((p) => ({ Employee: p.name, Movement: "Hired", Date: p.hired, Position: p.position, Department: p.department })),
        ...ps.filter((p) => p.separated && p.separated >= period.from && p.separated <= period.to).map((p) => ({ Employee: p.name, Movement: "Separated", Date: p.separated!, Position: p.position, Department: p.department })),
      ].sort((a, b) => b.Date.localeCompare(a.Date));
      return {
        columns: [col("Employee", "Employee"), col("Movement", "Movement"), col("Date", "Date"), col("Position", "Position"), col("Department", "Department")],
        rows,
        summary: [
          { label: "Hired", value: rows.filter((r) => r.Movement === "Hired").length },
          { label: "Separated", value: rows.filter((r) => r.Movement === "Separated").length },
        ],
      };
    },
  },
  {
    id: "leave-taken",
    category: "hr",
    name: "Leave taken",
    description: "Approved leave days per employee, by leave type.",
    period: "year",
    run: async (period, office) => {
      const ps = current(office);
      const types = leave.types.filter((t) => t.active);
      const daysOf = (empId: string, typeId: string) =>
        leave.requests
          .filter((r) => r.employeeId === empId && r.typeId === typeId && r.status === "approved" && r.start <= period.to && r.end >= period.from)
          .reduce((n, r) => {
            const t = types.find((x) => x.id === r.typeId)!;
            return n + (r.halfDay ? r.days : countDays(r.start < period.from ? period.from : r.start, r.end > period.to ? period.to : r.end, t.countBy));
          }, 0);
      const used = types.filter((t) => ps.some((p) => daysOf(p.id, t.id) > 0));
      const rows = ps.map((p) => {
        const row: ReportRow = { Employee: p.name, Department: p.department };
        for (const t of used) row[t.code] = daysOf(p.id, t.id);
        row.Total = used.reduce((n, t) => n + (row[t.code] as number), 0);
        return row;
      });
      return {
        columns: [col("Employee", "Employee"), col("Department", "Department"), ...used.map((t) => col(t.code, t.name.replace(" leave", ""), "number")), col("Total", "Total days", "number")],
        rows,
        summary: [{ label: "Days taken", value: sum(rows, (r) => r.Total as number) }, ...used.slice(0, 3).map((t) => ({ label: t.name, value: sum(rows, (r) => r[t.code] as number) }))],
      };
    },
  },

  // ---- Attendance ----
  {
    id: "attendance-summary",
    category: "attendance",
    name: "Attendance summary",
    description: "Days present, absent and on leave, with lates, undertime and approved overtime.",
    period: "recent",
    run: async (period, office) => {
      const att = await attendance(period.from, period.to);
      const ps = current(office).filter((p) => att.has(p.id));
      const rows = ps.map((p) => {
        const a = att.get(p.id)!;
        return { Employee: p.name, Department: p.department, Scheduled: a.scheduled, Present: a.present, Absent: a.absent, "On leave": a.leave, Lates: a.lateTimes, "Late (min)": a.lateMinutes, "Undertime (min)": a.undertimeMinutes, "OT (hrs)": round2(a.overtimeMinutes / 60), Rate: pct(a.present, a.scheduled - a.leave) };
      });
      return {
        columns: [col("Employee", "Employee"), { ...col("Department", "Department"), only: "file" }, col("Scheduled", "Workdays", "number"), col("Present", "Present", "number"), col("Absent", "Absent", "number"), col("On leave", "On leave", "number"), col("Lates", "Times late", "number"), col("Late (min)", "Late (min)", "number"), col("Undertime (min)", "Undertime (min)", "number"), col("OT (hrs)", "Approved OT (hrs)", "number"), col("Rate", "Attendance", "percent")],
        rows,
        summary: [
          { label: "Attendance rate", value: pct(sum(rows, (r) => r.Present as number), sum(rows, (r) => (r.Scheduled as number) - (r["On leave"] as number))), kind: "percent" },
          { label: "Absences", value: sum(rows, (r) => r.Absent as number) },
          { label: "Times late", value: sum(rows, (r) => r.Lates as number) },
          { label: "Approved OT (hrs)", value: sum(rows, (r) => r["OT (hrs)"] as number) },
        ],
        note: "Attendance rate leaves out days on approved leave. Days that haven't happened yet aren't counted.",
      };
    },
  },
  {
    id: "tardiness",
    category: "attendance",
    name: "Tardiness",
    description: "Every late arrival past the grace period.",
    period: "recent",
    run: async (period, office) => {
      const att = await attendance(period.from, period.to);
      const ids = new Set(current(office).map((p) => p.id));
      const rows = [...att.values()]
        .flatMap((a) => a.days)
        .filter((d) => d.lateMinutes > 0 && ids.has(d.person.id))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((d) => ({ Employee: d.person.name, Department: d.person.departmentName, Date: d.date, "Shift start": d.shift?.start ?? "", "Time in": d.timeIn ? new Date(d.timeIn.at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) : "", "Minutes late": d.lateMinutes }));
      return {
        columns: [col("Employee", "Employee"), col("Department", "Department"), col("Date", "Date"), col("Shift start", "Shift start"), col("Time in", "Time in"), col("Minutes late", "Minutes late", "number")],
        rows,
        summary: [
          { label: "Late arrivals", value: rows.length },
          { label: "Minutes late", value: sum(rows, (r) => r["Minutes late"] as number) },
          { label: "People", value: new Set(rows.map((r) => r.Employee)).size },
        ],
      };
    },
  },
  {
    id: "overtime",
    category: "attendance",
    name: "Overtime",
    description: "Overtime approved in the period, with the rate it's paid at.",
    period: "recent",
    run: async (period, office) => {
      const att = await attendance(period.from, period.to);
      const ids = new Set(current(office).map((p) => p.id));
      const kind: Record<string, string> = { ordinary: "Ordinary day (125%)", rest: "Rest day (169%)", special: "Special day (169%)", regular: "Regular holiday (260%)" };
      const rows = [...att.values()]
        .flatMap((a) => a.days)
        .filter((d) => d.approvedOvertimeMinutes > 0 && ids.has(d.person.id))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((d) => ({ Employee: d.person.name, Department: d.person.departmentName, Date: d.date, "Day type": kind[d.dayType] ?? d.dayType, Hours: round2(d.approvedOvertimeMinutes / 60) }));
      const pending = (await listTimeRequests()).filter((r) => r.type === "overtime" && r.status === "pending" && r.date >= period.from && r.date <= period.to && ids.has(r.employeeId)).length;
      return {
        columns: [col("Employee", "Employee"), col("Department", "Department"), col("Date", "Date"), col("Day type", "Day type"), col("Hours", "Hours", "number")],
        rows,
        summary: [
          { label: "Approved hours", value: sum(rows, (r) => r.Hours as number) },
          { label: "People", value: new Set(rows.map((r) => r.Employee)).size },
          { label: "Still waiting for approval", value: pending },
        ],
      };
    },
  },

  // ---- Payroll ----
  {
    id: "register",
    category: "payroll",
    name: "Payroll register",
    description: "Pay for each employee in the cut-off: earnings, deductions and take-home pay.",
    period: "cutoff",
    run: async (period, office) => {
      const lines = await payroll(period, office);
      return {
        columns: [col("Employee", "Employee"), col("Basic", "Basic pay", "money"), col("Deductions", "Absences & lates", "money"), col("Overtime", "Overtime", "money"), col("Premiums", "Holiday / night", "money"), col("Gross", "Gross pay", "money"), { ...col("SSS", "SSS", "money"), only: "file" }, { ...col("PhilHealth", "PhilHealth", "money"), only: "file" }, { ...col("Pag-IBIG", "Pag-IBIG", "money"), only: "file" }, { ...col("Gov", "Gov't deductions", "money"), only: "screen" }, col("Tax", "Tax", "money"), col("Net", "Take-home pay", "money")],
        rows: lines.map((l) => ({ Employee: l.person.name, Basic: l.basic, Deductions: l.deductions, Overtime: l.overtime, Premiums: l.premiums, Gross: l.gross, SSS: l.sssEe, PhilHealth: l.phEe, "Pag-IBIG": l.piEe, Gov: round2(l.sssEe + l.phEe + l.piEe), Tax: l.tax, Net: l.net })),
        summary: [
          { label: "Gross pay", value: sum(lines, (l) => l.gross), kind: "money" },
          { label: "Government deductions", value: sum(lines, (l) => l.sssEe + l.phEe + l.piEe), kind: "money" },
          { label: "Tax withheld", value: sum(lines, (l) => l.tax), kind: "money" },
          { label: "Take-home pay", value: sum(lines, (l) => l.net), kind: "money" },
        ],
        note: "A preview computed from salaries and attendance. Monthly government contributions are split across the two cut-offs. Allowances and loans aren't included yet.",
      };
    },
  },
  {
    id: "payroll-cost",
    category: "payroll",
    name: "Payroll cost by department",
    description: "What each department costs in the cut-off, including the company's share of contributions.",
    period: "cutoff",
    run: async (period, office) => {
      const lines = await payroll(period, office);
      const rows = groupBy(lines, (l) => l.person.department).map(([dept, ls]) => {
        const er = sum(ls, (l) => l.sssEr + l.ec + l.phEr + l.piEr);
        const gross = sum(ls, (l) => l.gross);
        return { Department: dept, People: ls.length, Gross: gross, Overtime: sum(ls, (l) => l.overtime), "Employer share": er, Total: round2(gross + er) };
      });
      return {
        columns: [col("Department", "Department"), col("People", "People", "number"), col("Gross", "Gross pay", "money"), col("Overtime", "of which overtime", "money"), col("Employer share", "Company contributions", "money"), col("Total", "Total cost", "money")],
        rows,
        summary: [
          { label: "Total cost", value: sum(rows, (r) => r.Total as number), kind: "money" },
          { label: "Gross pay", value: sum(rows, (r) => r.Gross as number), kind: "money" },
          { label: "Company contributions", value: sum(rows, (r) => r["Employer share"] as number), kind: "money" },
        ],
      };
    },
  },

  // ---- Statutory ----
  {
    id: "sss",
    category: "statutory",
    name: "SSS contributions",
    description: "Monthly SSS remittance: employee share, company share and EC.",
    period: "month",
    run: async (period, office) => {
      const ps = everyone(office).filter((p) => employedIn(p, period.from, period.to) && p.salary > 0);
      const rows = ps.map((p) => {
        const s = sss(p.salary);
        return { Employee: p.name, "SSS no.": mask(p.sssNo), MSC: s.msc, Employee_: s.ee, Employer: s.er, EC: s.ec, Total: round2(s.ee + s.er + s.ec) };
      });
      return {
        columns: [col("Employee", "Employee"), col("SSS no.", "SSS no."), col("MSC", "Salary credit", "money"), col("Employee_", "Employee share", "money"), col("Employer", "Company share", "money"), col("EC", "EC", "money"), col("Total", "Total", "money")],
        rows,
        summary: [
          { label: "Total to remit", value: sum(rows, (r) => r.Total as number), kind: "money" },
          { label: "Employee share", value: sum(rows, (r) => r.Employee_ as number), kind: "money" },
          { label: "Company share + EC", value: sum(rows, (r) => (r.Employer as number) + (r.EC as number)), kind: "money" },
        ],
        note: `Employee 5%, company 10% of the salary credit (₱5,000–₱35,000). EC is ₱10 below ₱15,000, otherwise ₱30.`,
      };
    },
  },
  {
    id: "philhealth",
    category: "statutory",
    name: "PhilHealth contributions",
    description: "Monthly PhilHealth premium, shared equally.",
    period: "month",
    run: async (period, office) => {
      const ps = everyone(office).filter((p) => employedIn(p, period.from, period.to) && p.salary > 0);
      const rows = ps.map((p) => {
        const h = philhealth(p.salary);
        return { Employee: p.name, "PhilHealth no.": mask(p.philhealthNo), Salary: p.salary, Employee_: h.ee, Employer: h.er, Total: round2(h.ee + h.er) };
      });
      return {
        columns: [col("Employee", "Employee"), col("PhilHealth no.", "PhilHealth no."), col("Salary", "Monthly basic", "money"), col("Employee_", "Employee share", "money"), col("Employer", "Company share", "money"), col("Total", "Total", "money")],
        rows,
        summary: [
          { label: "Total to remit", value: sum(rows, (r) => r.Total as number), kind: "money" },
          { label: "Employee share", value: sum(rows, (r) => r.Employee_ as number), kind: "money" },
          { label: "Company share", value: sum(rows, (r) => r.Employer as number), kind: "money" },
        ],
        note: "5% of monthly basic pay (₱10,000 floor, ₱100,000 ceiling), split 50/50.",
      };
    },
  },
  {
    id: "pagibig",
    category: "statutory",
    name: "Pag-IBIG contributions",
    description: "Monthly Pag-IBIG savings: employee and company share.",
    period: "month",
    run: async (period, office) => {
      const ps = everyone(office).filter((p) => employedIn(p, period.from, period.to) && p.salary > 0);
      const rows = ps.map((p) => {
        const g = pagibig(p.salary);
        return { Employee: p.name, "Pag-IBIG no.": mask(p.pagibigNo), Employee_: g.ee, Employer: g.er, Total: round2(g.ee + g.er) };
      });
      return {
        columns: [col("Employee", "Employee"), col("Pag-IBIG no.", "Pag-IBIG no."), col("Employee_", "Employee share", "money"), col("Employer", "Company share", "money"), col("Total", "Total", "money")],
        rows,
        summary: [
          { label: "Total to remit", value: sum(rows, (r) => r.Total as number), kind: "money" },
          { label: "Employee share", value: sum(rows, (r) => r.Employee_ as number), kind: "money" },
          { label: "Company share", value: sum(rows, (r) => r.Employer as number), kind: "money" },
        ],
        note: "2% each on pay up to ₱10,000, so at most ₱200 each.",
      };
    },
  },
  {
    id: "tax",
    category: "statutory",
    name: "Withholding tax (BIR 1601-C)",
    description: "Tax withheld from pay in the month, for the monthly BIR remittance.",
    period: "month",
    run: async (period, office) => {
      const lines = await monthPayroll(period, office);
      const rows = lines.map((l) => ({ Employee: l.person.name, TIN: mask(l.person.tin), Gross: l.gross, Taxable: l.taxable, Tax: l.tax }));
      return {
        columns: [col("Employee", "Employee"), col("TIN", "TIN"), col("Gross", "Gross pay", "money"), col("Taxable", "Taxable pay", "money"), col("Tax", "Tax withheld", "money")],
        rows,
        summary: [
          { label: "Tax to remit", value: sum(rows, (r) => r.Tax as number), kind: "money" },
          { label: "Taxable pay", value: sum(rows, (r) => r.Taxable as number), kind: "money" },
          { label: "Employees taxed", value: rows.filter((r) => (r.Tax as number) > 0).length },
        ],
        note: "Both cut-offs of the month, using the BIR table from 2023 (TRAIN). Days not yet worked count as full pay.",
      };
    },
  },
  {
    id: "thirteenth",
    category: "statutory",
    name: "13th month pay",
    description: "13th month earned so far this year: 1/12 of basic pay. Due on or before December 24.",
    period: "none",
    run: async (_, office) => {
      const today = todayIso();
      const yearStart = `${today.slice(0, 4)}-01-01`;
      const monthEnd = `${today.slice(0, 7)}-01`;
      const rows = current(office)
        .filter((p) => p.salary > 0)
        .map((p) => {
          const start = p.hired > yearStart ? p.hired : yearStart;
          // Whole months worked up to the end of last month, the hiring month prorated.
          const firstMonthDays = lastDay(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1);
          const months = start >= monthEnd ? 0 : Math.max(0, monthsBetween(start, monthEnd) - 1 + (firstMonthDays - Number(start.slice(8)) + 1) / firstMonthDays);
          const basic = round2(p.salary * months);
          return { Employee: p.name, "Date hired": p.hired, Months: round2(months), Basic: basic, Thirteenth: round2(basic / 12), Projected: round2((p.salary * (months + 12 - Number(today.slice(5, 7)) + 1)) / 12) };
        });
      return {
        columns: [col("Employee", "Employee"), col("Date hired", "Date hired"), col("Months", "Months this year", "number"), col("Basic", "Basic pay earned", "money"), col("Thirteenth", "13th month so far", "money"), col("Projected", "Projected for the year", "money")],
        rows,
        summary: [
          { label: "Earned so far", value: sum(rows, (r) => r.Thirteenth as number), kind: "money" },
          { label: "Projected for the year", value: sum(rows, (r) => r.Projected as number), kind: "money" },
        ],
        note: `Counted to the end of last month. Up to ₱${THIRTEENTH_MONTH_EXEMPT.toLocaleString()} of 13th month and other benefits is tax-free.`,
      };
    },
  },

  // ---- Management ----
  {
    id: "turnover",
    category: "management",
    name: "Turnover by department",
    description: "Hires, separations and the turnover rate this year.",
    period: "year",
    run: async (period, office) => {
      const ps = everyone(office);
      const rows = groupBy(ps, (p) => p.department).map(([dept, list]) => {
        const start = list.filter((p) => p.hired < period.from && (!p.separated || p.separated >= period.from)).length;
        const hires = list.filter((p) => p.hired >= period.from && p.hired <= period.to).length;
        const seps = list.filter((p) => p.separated && p.separated >= period.from && p.separated <= period.to).length;
        const end = start + hires - seps;
        return { Department: dept, Start: start, Hired: hires, Separated: seps, End: end, Turnover: pct(seps, (start + end) / 2) };
      });
      return {
        columns: [col("Department", "Department"), col("Start", "At the start", "number"), col("Hired", "Hired", "number"), col("Separated", "Separated", "number"), col("End", "Now", "number"), col("Turnover", "Turnover", "percent")],
        rows,
        summary: [
          { label: "Hired", value: sum(rows, (r) => r.Hired as number) },
          { label: "Separated", value: sum(rows, (r) => r.Separated as number) },
          { label: "Turnover", value: pct(sum(rows, (r) => r.Separated as number), (sum(rows, (r) => r.Start as number) + sum(rows, (r) => r.End as number)) / 2), kind: "percent" },
        ],
        note: "Turnover = people who left ÷ average headcount.",
      };
    },
  },
  {
    id: "department-attendance",
    category: "management",
    name: "Attendance by department",
    description: "Which departments have the most absences, lates and overtime.",
    period: "recent",
    run: async (period, office) => {
      const att = await attendance(period.from, period.to);
      const ps = current(office).filter((p) => att.has(p.id));
      const rows = groupBy(ps, (p) => p.department).map(([dept, list]) => {
        const as = list.map((p) => att.get(p.id)!);
        return { Department: dept, People: list.length, Rate: pct(sum(as, (a) => a.present), sum(as, (a) => a.scheduled - a.leave)), Absences: sum(as, (a) => a.absent), Lates: sum(as, (a) => a.lateTimes), "Late (min)": sum(as, (a) => a.lateMinutes), "OT (hrs)": round2(sum(as, (a) => a.overtimeMinutes) / 60) };
      });
      return {
        columns: [col("Department", "Department"), col("People", "People", "number"), col("Rate", "Attendance", "percent"), col("Absences", "Absences", "number"), col("Lates", "Times late", "number"), col("Late (min)", "Late (min)", "number"), col("OT (hrs)", "Approved OT (hrs)", "number")],
        rows,
        summary: [
          { label: "Absences", value: sum(rows, (r) => r.Absences as number) },
          { label: "Times late", value: sum(rows, (r) => r.Lates as number) },
          { label: "Approved OT (hrs)", value: sum(rows, (r) => r["OT (hrs)"] as number) },
        ],
      };
    },
  },
  {
    id: "workforce-cost",
    category: "management",
    name: "Workforce cost",
    description: "Monthly salaries and company contributions by department.",
    period: "none",
    run: async (_, office) => {
      const ps = current(office).filter((p) => p.salary > 0);
      const rows = groupBy(ps, (p) => p.department).map(([dept, list]) => {
        const salaries = sum(list, (p) => p.salary);
        const er = sum(list, (p) => {
          const s = sss(p.salary);
          return s.er + s.ec + philhealth(p.salary).er + pagibig(p.salary).er;
        });
        return { Department: dept, People: list.length, Salaries: salaries, Average: round2(salaries / list.length), Contributions: er, Total: round2(salaries + er) };
      });
      return {
        columns: [col("Department", "Department"), col("People", "People", "number"), col("Salaries", "Monthly salaries", "money"), col("Average", "Average salary", "money"), col("Contributions", "Company contributions", "money"), col("Total", "Monthly cost", "money")],
        rows,
        summary: [
          { label: "Monthly cost", value: sum(rows, (r) => r.Total as number), kind: "money" },
          { label: "Yearly (with 13th month)", value: round2(sum(rows, (r) => r.Total as number) * 12 + sum(rows, (r) => r.Salaries as number)), kind: "money" },
        ],
      };
    },
  },
];
