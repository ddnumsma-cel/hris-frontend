// Maintenance › Locations and Departments from the backend, shaped like the in-browser rows (corehr/maintenance.ts)
// so the pages work unchanged. People are keyed by employee number on the website and by id on the backend.

import type { DepartmentRow, LocationRow } from "../corehr/maintenance";
import { api } from "./client";
import { backendIdOf, backendListEmployees, employeeNoOf } from "./people";

interface Ref {
  id: string;
  name: string;
}
interface BackendLocation {
  id: string;
  name: string;
  code: string;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  manager: Ref | null;
  active: boolean;
  headcount: number;
  departments: number;
}
interface BackendDepartment {
  id: string;
  departmentId: string;
  name: string;
  code: string;
  officeId: string;
  office: string;
  head: Ref | null;
  active: boolean;
  headcount: number;
}

/** Current employees as head / manager choices; filled whenever the lists load (the pages read it right after). */
let choices: { id: string; name: string }[] = [];
export const backendHeadChoices = () => choices;

/** Load the people list (it also maps employee numbers to backend ids) and keep it as the head / manager choices. */
async function loadPeople() {
  const people = await backendListEmployees();
  choices = people.filter((p) => p.status !== "Separated").map((p) => ({ id: p.id, name: p.name }));
}

const toEmployeeNo = (r: Ref | null) => (r ? (employeeNoOf(r.id) ?? r.id) : undefined);
const toBackendId = async (employeeNo?: string) => (employeeNo ? ((await backendIdOf(employeeNo)) ?? undefined) : undefined);

const locationRow = (l: BackendLocation): LocationRow => ({
  id: l.id,
  name: l.name,
  code: l.code,
  address: l.address ?? "",
  contactName: l.contactName ?? "",
  contactPhone: l.contactPhone ?? "",
  managerId: toEmployeeNo(l.manager),
  managerName: l.manager?.name,
  active: l.active,
  headcount: l.headcount,
  departments: l.departments,
});

export async function backendLocations(): Promise<LocationRow[]> {
  const [list] = await Promise.all([api<BackendLocation[]>("/org/locations"), loadPeople()]);
  return list.map(locationRow).sort((a, b) => a.name.localeCompare(b.name));
}

export async function backendSaveLocation(input: { id?: string; name: string; code: string; address: string; contactName: string; contactPhone: string; managerId?: string }): Promise<LocationRow> {
  const body = { name: input.name, code: input.code, address: input.address, contactName: input.contactName, contactPhone: input.contactPhone, managerId: (await toBackendId(input.managerId)) ?? null };
  const saved = input.id
    ? await api<BackendLocation>(`/org/locations/${encodeURIComponent(input.id)}`, { method: "PUT", body })
    : await api<BackendLocation>("/org/locations", { method: "POST", body });
  return locationRow(saved);
}

export async function backendSetLocationActive(id: string, active: boolean): Promise<void> {
  await api(`/org/locations/${encodeURIComponent(id)}/active`, { method: "PATCH", body: { active } });
}

export async function backendDepartments(): Promise<DepartmentRow[]> {
  const [list] = await Promise.all([api<BackendDepartment[]>("/org/departments"), loadPeople()]);
  return list.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    officeId: d.officeId,
    office: d.office,
    headEmployeeId: toEmployeeNo(d.head),
    headName: d.head?.name,
    active: d.active,
    headcount: d.headcount,
    // The backend has no teams inside departments.
    teams: 0,
  }));
}

export async function backendSaveDepartment(input: { id?: string; name: string; code: string; officeId: string; headEmployeeId?: string }): Promise<void> {
  const body = { name: input.name, code: input.code, officeId: input.officeId, headEmployeeId: (await toBackendId(input.headEmployeeId)) ?? null };
  if (input.id) await api(`/org/departments/${encodeURIComponent(input.id)}`, { method: "PUT", body });
  else await api("/org/departments", { method: "POST", body });
}

export async function backendSetDepartmentActive(id: string, active: boolean): Promise<void> {
  await api(`/org/departments/${encodeURIComponent(id)}/active`, { method: "PATCH", body: { active } });
}
