// Pay details: the part of each employee's record payroll needs (salary, employment status,
// government numbers), without the rest of the 201 file. For Accounting, who don't see People.

import { fullName, state } from "../corehr/store";
import { deny } from "../session";
import { payProfileOf, refreshPaySettings, type PayProfile } from "./settings";
import { backendOn } from "../backend/client";
import { backendPayrollPeople } from "../backend/payroll";

export interface PayDetail {
  id: string;
  name: string;
  position: string;
  department: string;
  office: string;
  employmentType: string;
  status: string;
  dateHired: string;
  separationDate?: string;
  monthlySalary: number;
  tin: string;
  sss: string;
  philhealth: string;
  pagibig: string;
  bank?: { bank: string; accountName: string; accountNumber: string };
  /** Work week, allowances and tax-free pay (Payroll settings). */
  profile: PayProfile;
  /** Government numbers payroll can't remit or withhold without. */
  missing: string[];
}

const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), 200));

/** The department (or the unit itself) and the office a unit sits under. */
function placeOf(unitId: string) {
  const byId = (id?: string | null) => state.units.find((u) => u.id === id);
  let u = byId(unitId);
  let department = "";
  while (u) {
    if (u.type === "department" && !department) department = u.name;
    if (u.type === "branch") return { department, office: u.name };
    u = byId(u.parentId);
  }
  return { department, office: "" };
}

/** Current employees, plus anyone who left this year (they still get final pay and a 2316). */
export async function listPayDetails(): Promise<PayDetail[]> {
  const denied = deny("payrollRuns", "view");
  if (denied) return denied;
  await refreshPaySettings();
  const year = String(new Date().getFullYear());
  const missingOf = (g: { tin: string; sss: string; philhealth: string; pagibig: string }) => ([["TIN", g.tin], ["SSS", g.sss], ["PhilHealth", g.philhealth], ["Pag-IBIG", g.pagibig]] as const).filter(([, v]) => !v.trim()).map(([k]) => k);
  if (backendOn()) {
    // On the backend: its employees, salaries and government numbers.
    return (await backendPayrollPeople())
      .filter((p) => p.status !== "Separated" || (p.separated ?? "").startsWith(year))
      .map((p) => ({ id: p.id, name: p.name, position: p.position, department: p.department, office: p.branch, employmentType: p.type, status: p.status, dateHired: p.hired, separationDate: p.separated, monthlySalary: p.salary, tin: p.tin, sss: p.sssNo, philhealth: p.philhealthNo, pagibig: p.pagibigNo, bank: p.bank, profile: payProfileOf(p.id), missing: missingOf({ tin: p.tin, sss: p.sssNo, philhealth: p.philhealthNo, pagibig: p.pagibigNo }) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return respond(
    state.employees
      .filter((e) => e.job.status !== "Separated" || (e.job.separationDate ?? "").startsWith(year))
      .map((e) => {
        const g = e.government;
        const missing = ([["TIN", g.tin], ["SSS", g.sss], ["PhilHealth", g.philhealth], ["Pag-IBIG", g.pagibig]] as const).filter(([, v]) => !v.trim()).map(([k]) => k);
        return {
          id: e.id,
          name: fullName(e.personal),
          position: state.positions.find((p) => p.id === e.job.positionId)?.title ?? "",
          ...placeOf(e.job.unitId),
          employmentType: e.job.employmentType,
          status: e.job.status,
          dateHired: e.job.dateHired,
          separationDate: e.job.separationDate,
          monthlySalary: e.job.monthlySalary,
          tin: g.tin,
          sss: g.sss,
          philhealth: g.philhealth,
          pagibig: g.pagibig,
          bank: e.bank,
          profile: payProfileOf(e.id),
          missing,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}
