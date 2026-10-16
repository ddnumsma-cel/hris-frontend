// Maintenance of the organization's building blocks: departments and locations (offices).
// They are org units ("department" under a "branch"); employees sit in a department or one of its teams.
// With the API server, changes are saved to the database (org_units) and the tree is reloaded.

import { api, serverMode } from "../http";
import { can } from "../permissions";
import { deny, forbidden, sessionWho } from "../session";
import { commit, fullName, newId, refreshCoreHr, state } from "./store";
import type { OrgUnit } from "./types";

const DELAY_MS = 250;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY_MS));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY_MS));

/** Every unit under (and including) this one. */
function subtree(id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const u of state.units) if (u.parentId && out.has(u.parentId) && !out.has(u.id)) (out.add(u.id), (grew = true));
  }
  return out;
}
const headcountOf = (unitId: string) => {
  const ids = subtree(unitId);
  return state.employees.filter((e) => e.job.status !== "Separated" && ids.has(e.job.unitId)).length;
};
const nameOf = (employeeId?: string) => {
  const e = state.employees.find((x) => x.id === employeeId);
  return e ? fullName(e.personal) : undefined;
};
const company = () => state.units.find((u) => u.type === "company");
const clean = (s: string) => s.trim().replace(/\s+/g, " ");

// ---- Locations (offices) ----

export interface LocationRow {
  id: string;
  name: string;
  code: string;
  address: string;
  contactName: string;
  contactPhone: string;
  managerId?: string;
  managerName?: string;
  active: boolean;
  headcount: number;
  departments: number;
}

const locationRow = (u: OrgUnit): LocationRow => ({
  id: u.id,
  name: u.name,
  code: u.code,
  address: u.address ?? "",
  contactName: u.contactName ?? "",
  contactPhone: u.contactPhone ?? "",
  managerId: u.headEmployeeId,
  managerName: nameOf(u.headEmployeeId),
  active: u.active,
  headcount: headcountOf(u.id),
  departments: state.units.filter((d) => d.type === "department" && d.parentId === u.id).length,
});
/** PH mobile or landline, e.g. 0917 123 4567 or (032) 234 5678. */
const phoneOk = (v: string) => /^(\+?63|0)\d{7,10}$/.test(v.replace(/[\s()-]/g, ""));

export async function listLocations(): Promise<LocationRow[]> {
  // Departments' office picker needs the list too.
  const who = sessionWho();
  if (!can(who, "view", "locations") && !can(who, "view", "departments")) return forbidden();
  if (serverMode) await refreshCoreHr(2000);
  return respond(
    state.units
      .filter((u) => u.type === "branch")
      .map(locationRow)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

export async function saveLocation(input: { id?: string; name: string; code: string; address: string; contactName: string; contactPhone: string; managerId?: string }): Promise<LocationRow> {
  const denied = deny("locations", input.id ? "edit" : "create");
  if (denied) return denied;
  const name = clean(input.name);
  const code = clean(input.code).toUpperCase();
  if (!name) return fail("Name the office, for example \"Iloilo\"");
  if (!/^[A-Z0-9]{2,5}$/.test(code)) return fail("Use a short code of 2 to 5 letters or numbers, for example \"ILO\"");
  if (!clean(input.address)) return fail("Enter the office address");
  const contactName = clean(input.contactName);
  const contactPhone = clean(input.contactPhone);
  const managerId = input.managerId || undefined;
  if (!contactName) return fail("Enter the contact person at this office");
  if (!phoneOk(contactPhone)) return fail("Enter the contact person's phone, e.g. 0917 123 4567 or (032) 234 5678");
  if (managerId && !state.employees.some((e) => e.id === managerId && e.job.status !== "Separated")) return fail("Choose a current employee as manager");
  const existing = state.units.find((u) => u.id === input.id);
  if (existing && existing.name !== name) return fail("An office's name can't be changed here: it is used across attendance, holidays and payroll. Change the code or address, or add a new office.");
  const branches = state.units.filter((u) => u.type === "branch" && u.id !== input.id);
  if (branches.some((b) => b.name.toLowerCase() === name.toLowerCase())) return fail("There's already an office with that name");
  if (branches.some((b) => b.code === code)) return fail("Another office already uses that code");
  if (serverMode) {
    const body = { name, code, address: clean(input.address), contactName, contactPhone, managerId };
    const { id } = await (existing ? api<{ id: string }>("PUT", `/corehr/locations/${encodeURIComponent(existing.id)}`, body) : api<{ id: string }>("POST", "/corehr/locations", body));
    await refreshCoreHr();
    const u = state.units.find((x) => x.id === id);
    return locationRow(u ?? { id, type: "branch", name, code, parentId: null, address: body.address, contactName, contactPhone, headEmployeeId: managerId, active: true });
  }
  const fields = { code, address: clean(input.address), contactName, contactPhone, headEmployeeId: managerId };
  const unit: OrgUnit = existing ? { ...existing, ...fields } : { id: newId("br"), type: "branch", name, parentId: company()?.id ?? null, active: true, ...fields };
  commit({ ...state, units: existing ? state.units.map((u) => (u.id === unit.id ? unit : u)) : [...state.units, unit] });
  return respond(locationRow(unit));
}

export async function setLocationActive(id: string, active: boolean): Promise<void> {
  const denied = deny("locations", "edit");
  if (denied) return denied;
  const u = state.units.find((x) => x.id === id && x.type === "branch");
  if (!u) return fail("That office no longer exists");
  if (!active && headcountOf(id) > 0) return fail(`${headcountOf(id)} people still work in ${u.name}. Move them to another office first.`);
  if (serverMode) {
    await api("PUT", `/corehr/locations/${encodeURIComponent(id)}/active`, { active });
    return refreshCoreHr();
  }
  commit({ ...state, units: state.units.map((x) => (x.id === id ? { ...x, active } : x)) });
  return respond(undefined);
}

// ---- Departments ----

export interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  officeId: string;
  office: string;
  headEmployeeId?: string;
  headName?: string;
  active: boolean;
  headcount: number;
  teams: number;
}

export async function listDepartments(): Promise<DepartmentRow[]> {
  const denied = deny("departments", "view");
  if (denied) return denied;
  if (serverMode) await refreshCoreHr(2000);
  return respond(
    state.units
      .filter((u) => u.type === "department")
      .map((u) => ({
        id: u.id,
        name: u.name,
        code: u.code,
        officeId: u.parentId ?? "",
        office: state.units.find((b) => b.id === u.parentId)?.name ?? "",
        headEmployeeId: u.headEmployeeId,
        headName: nameOf(u.headEmployeeId),
        active: u.active,
        headcount: headcountOf(u.id),
        teams: state.units.filter((t) => t.type === "team" && t.parentId === u.id).length,
      }))
      .sort((a, b) => a.office.localeCompare(b.office) || a.name.localeCompare(b.name)),
  );
}

export async function saveDepartment(input: { id?: string; name: string; code: string; officeId: string; headEmployeeId?: string }): Promise<void> {
  const denied = deny("departments", input.id ? "edit" : "create");
  if (denied) return denied;
  const name = clean(input.name);
  const code = clean(input.code).toUpperCase();
  if (!name) return fail("Name the department");
  if (!/^[A-Z0-9]{2,6}$/.test(code)) return fail("Use a short code of 2 to 6 letters or numbers, for example \"TAX\"");
  const office = state.units.find((u) => u.id === input.officeId && u.type === "branch" && u.active);
  if (!office) return fail("Choose the office");
  if (state.units.some((u) => u.type === "department" && u.id !== input.id && u.parentId === office.id && u.name.toLowerCase() === name.toLowerCase())) return fail(`${office.name} already has a department with that name`);
  if (input.headEmployeeId && !state.employees.some((e) => e.id === input.headEmployeeId && e.job.status !== "Separated")) return fail("Choose a current employee as head");
  const existing = state.units.find((u) => u.id === input.id && u.type === "department");
  if (serverMode) {
    const body = { name, code, officeId: office.id, headEmployeeId: input.headEmployeeId || undefined };
    await (existing ? api("PUT", `/corehr/departments/${encodeURIComponent(existing.id)}`, body) : api("POST", "/corehr/departments", body));
    return refreshCoreHr();
  }
  const unit: OrgUnit = existing
    ? { ...existing, name, code, parentId: office.id, headEmployeeId: input.headEmployeeId || undefined }
    : { id: newId("dp"), type: "department", name, code, parentId: office.id, headEmployeeId: input.headEmployeeId || undefined, active: true };
  commit({ ...state, units: existing ? state.units.map((u) => (u.id === unit.id ? unit : u)) : [...state.units, unit] });
  return respond(undefined);
}

export async function setDepartmentActive(id: string, active: boolean): Promise<void> {
  const denied = deny("departments", "edit");
  if (denied) return denied;
  const u = state.units.find((x) => x.id === id && x.type === "department");
  if (!u) return fail("That department no longer exists");
  if (!active && headcountOf(id) > 0) return fail(`${headcountOf(id)} people are still in ${u.name}. Move them to another department first.`);
  if (serverMode) {
    await api("PUT", `/corehr/departments/${encodeURIComponent(id)}/active`, { active });
    return refreshCoreHr();
  }
  commit({ ...state, units: state.units.map((x) => (x.id === id ? { ...x, active } : x)) });
  return respond(undefined);
}

/** Current employees, for choosing a department head. */
export function headChoices() {
  return state.employees
    .filter((e) => e.job.status !== "Separated")
    .map((e) => ({ id: e.id, name: fullName(e.personal) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
