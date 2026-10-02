// Core HR / 201 Files: the organization structure (Company → Branch → Department → Team), the
// positions people hold, each employee's assignment, and their employment history.
//
// Frontend-only for now: seeded from the employee directory, kept in this browser
// (localStorage) so changes survive a reload, and exposed through async functions shaped like
// the future API calls (see BACKEND_HANDOFF.md).

import { employeeDirectory, payrollEntries, setEmployeeDirectory } from "./mockData";
import { buildEmployeeFileRecords } from "./employmentRecords";
import { logPersonnelAccess } from "./api";
import type { AuditActor } from "./api";
import type { Employee } from "./types";

// ---- Types ----

export type OrgKind = "company" | "branch" | "department" | "team";

export interface OrgUnit {
  id: string;
  kind: OrgKind;
  name: string;
  /** Short code, e.g. "CEB" or "TAX". */
  code: string;
  parentId: string | null;
  /** Employee who heads it. */
  headId?: string;
  /** Branches only. */
  address?: string;
  active: boolean;
}

export const JOB_LEVELS = ["Rank and file", "Supervisory", "Managerial", "Executive"] as const;
export type JobLevel = (typeof JOB_LEVELS)[number];

export const EMPLOYMENT_TYPES = ["Regular", "Probationary", "Project-based", "Contractual", "Part-time"] as const;
export type CoreEmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export interface Position {
  id: string;
  title: string;
  code: string;
  /** The department it belongs to. */
  departmentId: string;
  level: JobLevel;
  employmentType: CoreEmploymentType;
  /** How many people the position is budgeted for. */
  slots: number;
  /** Position this one reports to. */
  reportsToId?: string;
  active: boolean;
}

export const EMPLOYEE_STATUSES = ["Active", "Probationary", "On leave", "Suspended", "Separated"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/** Where an employee sits and on what terms. */
export interface Assignment {
  employeeId: string;
  positionId?: string;
  /** Team, or the department when they're not in a team. */
  unitId?: string;
  employmentType: CoreEmploymentType;
  status: EmployeeStatus;
  monthlySalary?: number;
  dateHired?: string;
}

export const EVENT_TYPES = ["Hired", "Regularized", "Promoted", "Transferred", "Salary adjustment", "Status change", "Separated"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface EmploymentEvent {
  id: string;
  employeeId: string;
  type: EventType;
  /** ISO date the change takes effect. */
  effectiveDate: string;
  /** What it was, and what it became, in words ("Associate · Audit & Assurance"). */
  from?: string;
  to?: string;
  remarks?: string;
  recordedBy: string;
  /** ISO timestamp. */
  recordedAt: string;
}

// ---- Seed (from the directory, so every page agrees) ----

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const initialsCode = (s: string) =>
  s
    .split(/[^A-Za-z]+/)
    .filter((w) => w && !["and", "of"].includes(w.toLowerCase()))
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 4);

const BRANCH_INFO: Record<string, { code: string; address: string }> = {
  "Cebu HQ": { code: "CEB", address: "5th Floor, Cebu IT Tower 2, Cebu IT Park, Cebu City" },
  Manila: { code: "MNL", address: "18th Floor, Ayala Triangle Gardens Tower 2, Makati City" },
  Davao: { code: "DVO", address: "3rd Floor, Abreeza Corporate Center, J.P. Laurel Ave., Davao City" },
};
// Accounting departments run in client clusters (teams); the rest don't.
const TEAMED = new Set(["Audit & Assurance", "Tax Advisory", "Bookkeeping"]);

const COMPANY_ID = "org-msma";
const branchId = (office: string) => `br-${slug(office)}`;
const deptId = (office: string, dept: string) => `dp-${slug(office)}-${slug(dept)}`;
const teamId = (office: string, dept: string, cluster: string) => `tm-${slug(office)}-${slug(dept)}-${slug(cluster)}`;

function levelOf(title: string): JobLevel {
  if (/partner|director|chief|head of/i.test(title)) return "Executive";
  if (/manager|head\b/i.test(title)) return "Managerial";
  if (/lead|senior|supervisor/i.test(title)) return "Supervisory";
  return "Rank and file";
}

function seed() {
  const units: OrgUnit[] = [{ id: COMPANY_ID, kind: "company", name: "MSMA Group", code: "MSMA", parentId: null, active: true }];
  const add = (u: OrgUnit) => {
    if (!units.some((x) => x.id === u.id)) units.push(u);
  };
  for (const e of employeeDirectory) {
    add({ id: branchId(e.office), kind: "branch", name: e.office, code: BRANCH_INFO[e.office]?.code ?? initialsCode(e.office), parentId: COMPANY_ID, address: BRANCH_INFO[e.office]?.address, active: true });
    add({ id: deptId(e.office, e.department), kind: "department", name: e.department, code: initialsCode(e.department), parentId: branchId(e.office), active: true });
    if (TEAMED.has(e.department) && e.cluster !== "Admin & Support") {
      add({ id: teamId(e.office, e.department, e.cluster), kind: "team", name: `${e.cluster} team`, code: e.cluster, parentId: deptId(e.office, e.department), active: true });
    }
  }

  const positions: Position[] = [];
  for (const e of employeeDirectory) {
    const dept = deptId(e.office, e.department);
    if (positions.some((p) => p.title === e.position && p.departmentId === dept)) continue;
    positions.push({
      id: `ps-${slug(e.office)}-${slug(e.department)}-${slug(e.position)}`,
      title: e.position,
      code: `${initialsCode(e.department)}-${initialsCode(e.position) || "POS"}`,
      departmentId: dept,
      level: levelOf(e.position),
      employmentType: "Regular",
      slots: 0,
      active: true,
    });
  }
  const positionOf = (e: Employee) => positions.find((p) => p.title === e.position && p.departmentId === deptId(e.office, e.department));
  // Slots: everyone who holds it now, plus one opening on the larger rank-and-file positions.
  for (const p of positions) {
    const holders = employeeDirectory.filter((e) => positionOf(e)?.id === p.id).length;
    p.slots = holders + (p.level === "Rank and file" && holders >= 2 ? 1 : 0);
  }
  // Reports-to: the department's supervisory position, when there is one.
  for (const p of positions) {
    if (p.level !== "Rank and file") continue;
    const lead = positions.find((x) => x.departmentId === p.departmentId && x.level !== "Rank and file" && x.id !== p.id);
    if (lead) p.reportsToId = lead.id;
  }

  // The 201 records carry display dates ("Mar 24, 2020"); Core HR stores ISO dates.
  const iso = (s: string) => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const assignments: Assignment[] = [];
  const events: EmploymentEvent[] = [];
  for (const e of employeeDirectory) {
    const records = buildEmployeeFileRecords(e).employment;
    const team = teamId(e.office, e.department, e.cluster);
    assignments.push({
      employeeId: e.id,
      positionId: positionOf(e)?.id,
      unitId: units.some((u) => u.id === team) ? team : deptId(e.office, e.department),
      employmentType: records.employmentType,
      status: e.status === "On leave" ? "On leave" : records.employmentType === "Probationary" ? "Probationary" : "Active",
      monthlySalary: payrollEntries.find((p) => p.employeeId === e.id)?.monthlyBasic,
      dateHired: iso(records.dateHired),
    });
    records.movements.forEach((m, i) =>
      events.push({
        id: `ev-${e.id}-${i}`,
        employeeId: e.id,
        type: m.action === "Salary adjustment" ? "Salary adjustment" : (m.action as EventType),
        effectiveDate: iso(m.date),
        to: m.detail,
        remarks: m.reference,
        recordedBy: "HR & People Operations",
        recordedAt: `${iso(m.date)}T09:00:00`,
      }),
    );
  }
  // Heads: the supervisory holder in each department.
  for (const u of units.filter((x) => x.kind === "department")) {
    const head = assignments.find((a) => positions.find((p) => p.id === a.positionId)?.departmentId === u.id && positions.find((p) => p.id === a.positionId)?.level !== "Rank and file");
    if (head) u.headId = head.employeeId;
  }
  return { units, positions, assignments, events };
}

// ---- Store (this browser) ----

const KEY = "msma-core-hr-v2";

interface Store {
  units: OrgUnit[];
  positions: Position[];
  assignments: Assignment[];
  events: EmploymentEvent[];
  /** The directory, once Core HR has edited it. */
  employees?: Employee[];
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Store>;
      if (Array.isArray(s.units) && Array.isArray(s.positions) && Array.isArray(s.assignments) && Array.isArray(s.events)) {
        if (Array.isArray(s.employees) && s.employees.length) setEmployeeDirectory(s.employees);
        return s as Store;
      }
    }
  } catch {
    // Broken saved data: start from the seed.
  }
  return seed();
}

let store: Store = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...store, employees: employeeDirectory }));
  } catch {
    // Storage full or blocked — changes still apply until reload.
  }
}

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 180));
const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// ---- Reads ----

export interface OrgUnitWithCounts extends OrgUnit {
  /** People in it and everything below it. */
  headcount: number;
  /** Open slots on positions in it (departments) or below it. */
  vacancies: number;
}

function descendants(id: string): string[] {
  const kids = store.units.filter((u) => u.parentId === id).map((u) => u.id);
  return [id, ...kids.flatMap(descendants)];
}

function unitDepartmentId(unitId?: string): string | undefined {
  let u = store.units.find((x) => x.id === unitId);
  while (u && u.kind === "team") u = store.units.find((x) => x.id === u!.parentId);
  return u?.kind === "department" ? u.id : undefined;
}

const activeHolders = (positionId: string) => store.assignments.filter((a) => a.positionId === positionId && a.status !== "Separated").length;

export function fetchOrgUnits(): Promise<OrgUnitWithCounts[]> {
  return delay(
    store.units.map((u) => {
      const ids = new Set(descendants(u.id));
      const headcount = store.assignments.filter((a) => a.status !== "Separated" && a.unitId && ids.has(a.unitId)).length;
      const vacancies = store.positions
        .filter((p) => p.active && ids.has(p.departmentId))
        .reduce((n, p) => n + Math.max(0, p.slots - activeHolders(p.id)), 0);
      return { ...u, headcount, vacancies };
    }),
  );
}

export interface PositionWithCounts extends Position {
  filled: number;
  vacant: number;
}

export function fetchPositions(): Promise<PositionWithCounts[]> {
  return delay(store.positions.map((p) => ({ ...p, filled: activeHolders(p.id), vacant: Math.max(0, p.slots - activeHolders(p.id)) })));
}

export function fetchAssignments(): Promise<Assignment[]> {
  return delay(store.assignments);
}

export function fetchAssignment(employeeId: string): Promise<Assignment | null> {
  return delay(store.assignments.find((a) => a.employeeId === employeeId) ?? null);
}

export function fetchEmploymentEvents(employeeId: string): Promise<EmploymentEvent[]> {
  return delay(
    store.events.filter((e) => e.employeeId === employeeId).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.recordedAt.localeCompare(a.recordedAt)),
  );
}

/** "Cebu HQ › Audit & Assurance › VCM team" */
export function unitPath(unitId: string | undefined, units: OrgUnit[] = store.units): string {
  const parts: string[] = [];
  let u = units.find((x) => x.id === unitId);
  while (u && u.kind !== "company") {
    parts.unshift(u.name);
    u = units.find((x) => x.id === u!.parentId);
  }
  return parts.join(" › ");
}

// ---- Organization ----

const CHILD_KIND: Record<OrgKind, OrgKind | null> = { company: "branch", branch: "department", department: "team", team: null };
export const childKindOf = (k: OrgKind) => CHILD_KIND[k];

export interface OrgUnitInput {
  id?: string;
  kind: OrgKind;
  name: string;
  code: string;
  parentId: string | null;
  headId?: string;
  address?: string;
}

export async function saveOrgUnit(input: OrgUnitInput): Promise<OrgUnit> {
  const name = input.name.trim();
  if (!name) throw new Error("Enter a name");
  const siblings = store.units.filter((u) => u.parentId === input.parentId && u.id !== input.id);
  if (siblings.some((u) => u.name.toLowerCase() === name.toLowerCase())) throw new Error(`There's already a ${input.kind} named "${name}" here`);
  if (input.id && input.parentId && descendants(input.id).includes(input.parentId)) throw new Error("A unit can't move under itself");
  const existing = store.units.find((u) => u.id === input.id);
  const unit: OrgUnit = { active: existing?.active ?? true, ...input, id: existing?.id ?? newId(input.kind.slice(0, 2)), name, code: input.code.trim().toUpperCase() || initialsCode(name) };
  store = { ...store, units: existing ? store.units.map((u) => (u.id === unit.id ? unit : u)) : [...store.units, unit] };
  // Renaming a branch or department keeps the directory's labels in step.
  if (existing && existing.name !== name && (unit.kind === "branch" || unit.kind === "department")) syncDirectory();
  save();
  return delay(unit);
}

export async function setOrgUnitActive(id: string, active: boolean): Promise<OrgUnit> {
  const unit = store.units.find((u) => u.id === id);
  if (!unit) throw new Error("That unit no longer exists");
  if (!active) {
    const ids = new Set(descendants(id));
    const people = store.assignments.filter((a) => a.status !== "Separated" && a.unitId && ids.has(a.unitId)).length;
    if (people) throw new Error(`Move the ${people} ${people === 1 ? "person" : "people"} in ${unit.name} first`);
    const openPositions = store.positions.filter((p) => p.active && ids.has(p.departmentId)).length;
    if (openPositions) throw new Error(`Close or move the ${openPositions} position${openPositions === 1 ? "" : "s"} in ${unit.name} first`);
  }
  store = { ...store, units: store.units.map((u) => (u.id === id ? { ...u, active } : u)) };
  save();
  return delay({ ...unit, active });
}

// ---- Positions ----

export interface PositionInput {
  id?: string;
  title: string;
  code: string;
  departmentId: string;
  level: JobLevel;
  employmentType: CoreEmploymentType;
  slots: number;
  reportsToId?: string;
}

export async function savePosition(input: PositionInput): Promise<Position> {
  const title = input.title.trim();
  if (!title) throw new Error("Enter the position title");
  if (!store.units.some((u) => u.id === input.departmentId && u.kind === "department")) throw new Error("Choose a department");
  if (!Number.isInteger(input.slots) || input.slots < 1) throw new Error("Slots must be at least 1");
  const existing = store.positions.find((p) => p.id === input.id);
  if (existing && input.slots < activeHolders(existing.id)) throw new Error(`${activeHolders(existing.id)} people hold this position; slots can't go below that`);
  if (store.positions.some((p) => p.id !== input.id && p.departmentId === input.departmentId && p.title.toLowerCase() === title.toLowerCase())) {
    throw new Error("This department already has that position");
  }
  const position: Position = { active: true, ...existing, ...input, title, code: input.code.trim().toUpperCase() || initialsCode(title), id: existing?.id ?? newId("ps") };
  store = { ...store, positions: existing ? store.positions.map((p) => (p.id === position.id ? position : p)) : [...store.positions, position] };
  if (existing && existing.title !== title) syncDirectory();
  save();
  return delay(position);
}

export async function setPositionActive(id: string, active: boolean): Promise<void> {
  if (!active && activeHolders(id) > 0) throw new Error("Move the people in this position first");
  store = { ...store, positions: store.positions.map((p) => (p.id === id ? { ...p, active } : p)) };
  save();
  return delay(undefined);
}

// ---- Employment changes ----

export interface EmploymentChangeInput {
  employeeId: string;
  type: EventType;
  effectiveDate: string;
  positionId?: string;
  unitId?: string;
  employmentType?: CoreEmploymentType;
  status?: EmployeeStatus;
  monthlySalary?: number;
  remarks?: string;
  actor?: AuditActor;
}

const peso = (n?: number) => (n === undefined ? "—" : `₱${n.toLocaleString("en-PH")}`);

function describe(a: Assignment): string {
  const p = store.positions.find((x) => x.id === a.positionId);
  return [p?.title, unitPath(a.unitId)].filter(Boolean).join(" · ");
}

/** Records a promotion, transfer, salary change… and applies it to the employee's current record. */
export async function recordEmploymentChange(input: EmploymentChangeInput): Promise<EmploymentEvent> {
  const current = store.assignments.find((a) => a.employeeId === input.employeeId);
  if (!current) throw new Error("This employee has no assignment yet");
  if (!input.effectiveDate) throw new Error("Choose the effective date");
  const next: Assignment = { ...current };
  let from = "";
  let to = "";

  if (input.type === "Promoted" || input.type === "Transferred") {
    if (!input.positionId) throw new Error("Choose the new position");
    const pos = store.positions.find((p) => p.id === input.positionId);
    if (!pos) throw new Error("That position no longer exists");
    if (pos.id !== current.positionId && activeHolders(pos.id) >= pos.slots) throw new Error(`${pos.title} has no open slot. Add a slot in Positions first.`);
    from = describe(current);
    next.positionId = pos.id;
    // A team must sit in the position's department; otherwise they go straight under the department.
    const unit = input.unitId && unitDepartmentId(input.unitId) === pos.departmentId ? input.unitId : pos.departmentId;
    next.unitId = unit;
    if (input.monthlySalary !== undefined) next.monthlySalary = input.monthlySalary;
    to = describe(next);
    if (input.monthlySalary !== undefined && input.monthlySalary !== current.monthlySalary) to += ` · ${peso(input.monthlySalary)}`;
  } else if (input.type === "Salary adjustment") {
    if (input.monthlySalary === undefined || input.monthlySalary <= 0) throw new Error("Enter the new monthly salary");
    from = peso(current.monthlySalary);
    to = peso(input.monthlySalary);
    next.monthlySalary = input.monthlySalary;
  } else if (input.type === "Regularized") {
    from = current.employmentType;
    to = "Regular";
    next.employmentType = "Regular";
    if (next.status === "Probationary") next.status = "Active";
  } else if (input.type === "Status change" || input.type === "Separated") {
    const status = input.type === "Separated" ? "Separated" : input.status;
    if (!status) throw new Error("Choose the new status");
    from = current.status;
    to = status;
    next.status = status;
  } else if (input.type === "Hired") {
    to = describe(current);
  }

  const event: EmploymentEvent = {
    id: newId("ev"),
    employeeId: input.employeeId,
    type: input.type,
    effectiveDate: input.effectiveDate,
    from: from || undefined,
    to: to || undefined,
    remarks: input.remarks?.trim() || undefined,
    recordedBy: input.actor?.name ?? "HR",
    recordedAt: new Date().toISOString(),
  };
  store = { ...store, assignments: store.assignments.map((a) => (a.employeeId === next.employeeId ? next : a)), events: [event, ...store.events] };
  syncDirectory();
  save();
  if (input.actor) logPersonnelAccess(input.employeeId, input.actor, "Edited", "Employment history", `${input.type}${to ? ` → ${to}` : ""}`);
  return delay(event);
}

// ---- Master data ----

export interface MasterDataInput {
  employeeId: string;
  name: string;
  email?: string;
  phone?: string;
  emergencyContact?: string;
  dateHired?: string;
  actor?: AuditActor;
}

export async function updateMasterData(input: MasterDataInput): Promise<Employee> {
  const name = input.name.trim();
  if (!name) throw new Error("Enter the employee's name");
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new Error("Check the work email");
  const e = employeeDirectory.find((x) => x.id === input.employeeId);
  if (!e) throw new Error("That employee no longer exists");
  const words = name.split(/\s+/);
  const updated: Employee = {
    ...e,
    name,
    initials: ((words[0]?.[0] ?? "") + (words[words.length - 1]?.[0] ?? "")).toUpperCase(),
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    emergencyContact: input.emergencyContact?.trim() || undefined,
  };
  setEmployeeDirectory(employeeDirectory.map((x) => (x.id === e.id ? updated : x)));
  if (input.dateHired) store = { ...store, assignments: store.assignments.map((a) => (a.employeeId === e.id ? { ...a, dateHired: input.dateHired } : a)) };
  save();
  if (input.actor) logPersonnelAccess(e.id, input.actor, "Edited", "Employee master data");
  return delay(updated);
}

/** The directory's position / department / office / status labels follow Core HR. */
function syncDirectory() {
  setEmployeeDirectory(
    employeeDirectory.map((e) => {
      const a = store.assignments.find((x) => x.employeeId === e.id);
      if (!a) return e;
      const pos = store.positions.find((p) => p.id === a.positionId);
      const dept = store.units.find((u) => u.id === pos?.departmentId);
      const branch = store.units.find((u) => u.id === dept?.parentId);
      const team = store.units.find((u) => u.id === a.unitId && u.kind === "team");
      return {
        ...e,
        position: pos?.title ?? e.position,
        department: dept?.name ?? e.department,
        office: (branch?.name as Employee["office"]) ?? e.office,
        cluster: (team?.code as Employee["cluster"]) ?? e.cluster,
        status: a.status === "On leave" ? "On leave" : "Active",
      };
    }),
  );
}

/** For new hires from the directory's Add employee: give them an assignment and a Hired event. */
export function assignNewHire(employee: Employee, actorName = "HR") {
  if (store.assignments.some((a) => a.employeeId === employee.id)) return;
  const dept = store.units.find((u) => u.kind === "department" && u.name === employee.department && store.units.find((b) => b.id === u.parentId)?.name === employee.office);
  const pos = store.positions.find((p) => p.departmentId === dept?.id && p.title === employee.position);
  const team = store.units.find((u) => u.kind === "team" && u.parentId === dept?.id && u.code === employee.cluster);
  const today = new Date().toISOString().slice(0, 10);
  const a: Assignment = { employeeId: employee.id, positionId: pos?.id, unitId: team?.id ?? dept?.id, employmentType: "Probationary", status: "Probationary", dateHired: today };
  store = {
    ...store,
    assignments: [...store.assignments, a],
    events: [{ id: newId("ev"), employeeId: employee.id, type: "Hired", effectiveDate: a.dateHired!, to: describe(a), recordedBy: actorName, recordedAt: new Date().toISOString() }, ...store.events],
  };
  save();
}
