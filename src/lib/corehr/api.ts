// Core HR mock API. Each function stands in for an HTTP call and resolves
// after a short delay with a copy of the data, the way a real response would.

import { firstIssue, contactSchema, governmentSchema, newEmployeeSchema, personalSchema, type NewEmployeeValues } from "./schemas";
import { commit, fullName, initialsOf, isoDate, newId, reconcile, state, type CoreHrState } from "./store";
import type {
  AuditEntry,
  ChangeKind,
  CoreEmployee,
  DocumentType,
  EmployeeDocument,
  EmploymentStatus,
  FieldChange,
  JobEvent,
  JobLevel,
  OrgUnit,
  Position,
  EmploymentType,
  UnitType,
} from "./types";

const DELAY_MS = 300;
function respond<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), DELAY_MS));
}
function fail(message: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), DELAY_MS));
}

export const peso = (n?: number) => (n ? `₱${n.toLocaleString("en-PH")}` : "—");

// ---- Lookups shared by the read models ----

const unitById = (id?: string) => state.units.find((u) => u.id === id);
const positionById = (id?: string) => state.positions.find((p) => p.id === id);
const employeeById = (id?: string) => state.employees.find((e) => e.id === id);
const isCurrent = (e: CoreEmployee) => e.job.status !== "Separated";

function ancestorOf(unitId: string | undefined, type: UnitType): OrgUnit | undefined {
  let u = unitById(unitId);
  while (u && u.type !== type) u = unitById(u.parentId ?? undefined);
  return u;
}

function subtree(id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const u of state.units) {
      if (u.parentId && ids.has(u.parentId) && !ids.has(u.id)) {
        ids.add(u.id);
        grew = true;
      }
    }
  }
  return ids;
}

const holdersOf = (positionId: string) => state.employees.filter((e) => isCurrent(e) && e.job.positionId === positionId);

/** "Cebu HQ › Audit & Assurance › VCM client group" */
export function unitPathOf(unitId: string | undefined, units: OrgUnit[]): string {
  const parts: string[] = [];
  let u = units.find((x) => x.id === unitId);
  while (u && u.type !== "company") {
    parts.unshift(u.name);
    const parent = u.parentId;
    u = units.find((x) => x.id === parent);
  }
  return parts.join(" › ");
}

function audit(employeeId: string, actor: string, action: AuditEntry["action"], section: string, summary: string): AuditEntry {
  return { id: newId("au"), employeeId, actor, action, section, summary, at: new Date().toISOString() };
}

// ---- Employees ----

export interface EmployeeSummary {
  id: string;
  name: string;
  initials: string;
  positionTitle: string;
  level?: JobLevel;
  unitId: string;
  departmentId?: string;
  departmentName: string;
  teamName?: string;
  branchId?: string;
  branchName: string;
  employmentType: EmploymentType;
  status: EmploymentStatus;
  dateHired: string;
  workEmail: string;
  documents: { verified: number; required: number; needsAction: number };
}

function summarize(e: CoreEmployee): EmployeeSummary {
  const docs = state.documents.filter((d) => d.employeeId === e.id && d.status !== "Not applicable");
  const dept = ancestorOf(e.job.unitId, "department");
  const branch = ancestorOf(e.job.unitId, "branch");
  const team = ancestorOf(e.job.unitId, "team");
  const position = positionById(e.job.positionId);
  return {
    id: e.id,
    name: fullName(e.personal),
    initials: initialsOf(e.personal),
    positionTitle: position?.title ?? "Unassigned",
    level: position?.level,
    unitId: e.job.unitId,
    departmentId: dept?.id,
    departmentName: dept?.name ?? "—",
    teamName: team?.name,
    branchId: branch?.id,
    branchName: branch?.name ?? "—",
    employmentType: e.job.employmentType,
    status: e.job.status,
    dateHired: e.job.dateHired,
    workEmail: e.contact.workEmail,
    documents: {
      verified: docs.filter((d) => d.status === "Verified").length,
      required: docs.length,
      needsAction: docs.filter((d) => d.status === "Missing" || d.status === "Submitted" || documentAlert(d) !== null).length,
    },
  };
}

export function listEmployees(): Promise<EmployeeSummary[]> {
  reconcile();
  return respond(state.employees.map(summarize).sort((a, b) => a.name.localeCompare(b.name)));
}

export interface EmployeeRecord {
  employee: CoreEmployee;
  summary: EmployeeSummary;
  position?: Position;
  unitPath: string;
  supervisor?: { id: string; name: string; positionTitle: string };
}

export function getEmployee(id: string): Promise<EmployeeRecord | null> {
  reconcile();
  const e = employeeById(id);
  if (!e) return respond(null);
  const sup = employeeById(e.job.supervisorId);
  return respond({
    employee: e,
    summary: summarize(e),
    position: positionById(e.job.positionId),
    unitPath: unitPathOf(e.job.unitId, state.units),
    supervisor: sup ? { id: sup.id, name: fullName(sup.personal), positionTitle: positionById(sup.job.positionId)?.title ?? "" } : undefined,
  });
}

function nextEmployeeId(s: CoreHrState) {
  const max = Math.max(0, ...s.employees.map((e) => Number(e.id.replace(/\D/g, "")) || 0));
  return `MSMA-${String(max + 1).padStart(5, "0")}`;
}

const SITUATIONAL: DocumentType[] = ["Marriage Certificate (PSA)", "Child's Birth Certificate", "Professional License"];
export const DOCUMENT_TYPES: DocumentType[] = [
  "Application Form / Resume",
  "Birth Certificate (PSA)",
  "Marriage Certificate (PSA)",
  "Child's Birth Certificate",
  "Valid Government ID",
  "Diploma / Transcript of Records",
  "Professional License",
  "Certificate of Employment (Previous)",
  "NBI Clearance",
  "Police/Barangay Clearance",
  "Pre-Employment Medical Result",
];
/** Documents that carry an ID/license number and an expiry date. */
export const EXPIRING_TYPES: DocumentType[] = ["Valid Government ID", "Professional License", "NBI Clearance", "Police/Barangay Clearance"];

/** The ID HR scanned while adding someone; it becomes their submitted government ID. */
export interface ScannedGovernmentId {
  idType: string;
  idNumber?: string;
  idExpiry?: string;
  fileName: string;
}

export async function createEmployee(values: NewEmployeeValues, actor: string, scannedId?: ScannedGovernmentId): Promise<CoreEmployee> {
  const parsed = newEmployeeSchema.safeParse(values);
  if (!parsed.success) return fail(firstIssue(parsed));
  const v = parsed.data;
  const email = v.contact.workEmail.toLowerCase();
  if (state.employees.some((e) => e.contact.workEmail.toLowerCase() === email)) return fail("Another employee already uses that work email");
  const position = positionById(v.job.positionId);
  if (!position?.active) return fail("That position isn't available");
  if (holdersOf(position.id).length >= position.slots) return fail(`${position.title} has no opening. Add room for one more person in Positions first.`);
  const team = unitById(v.job.teamId);
  const unitId = team && team.parentId === position.departmentId ? team.id : position.departmentId;

  const id = nextEmployeeId(state);
  const employee: CoreEmployee = {
    id,
    personal: v.personal,
    contact: v.contact,
    government: v.government,
    job: {
      positionId: position.id,
      unitId,
      supervisorId: v.job.supervisorId || holdersOf(position.reportsToPositionId ?? "")[0]?.id,
      employmentType: v.job.employmentType,
      status: "Active",
      dateHired: v.job.dateHired,
      monthlySalary: v.job.monthlySalary,
      workSchedule: v.job.workSchedule,
    },
    createdAt: new Date().toISOString(),
  };
  const married = v.personal.civilStatus === "Married";
  const documents: EmployeeDocument[] = DOCUMENT_TYPES.map((type, i) => ({
    id: `doc-${id}-${i + 1}`,
    employeeId: id,
    type,
    status: SITUATIONAL.includes(type) && !(married && type === "Marriage Certificate (PSA)") ? "Not applicable" : "Missing",
    ...(type === "Valid Government ID" && scannedId
      ? { status: "Submitted" as const, fileName: scannedId.fileName, uploadedAt: isoDate(), referenceNo: scannedId.idNumber, expiresOn: scannedId.idExpiry }
      : {}),
  }));
  const event: JobEvent = {
    id: newId("ev"),
    employeeId: id,
    kind: "Hired",
    effectiveDate: v.job.dateHired,
    changes: [
      { label: "Position", to: `${position.title} · ${unitPathOf(unitId, state.units)}` },
      { label: "Employment type", to: v.job.employmentType },
      { label: "Monthly salary", to: peso(v.job.monthlySalary) },
    ],
    recordedBy: actor,
    recordedAt: new Date().toISOString(),
  };
  commit({
    ...state,
    employees: [...state.employees, employee],
    documents: [...state.documents, ...documents],
    events: [event, ...state.events],
    audit: [audit(id, actor, "Created", "201 file", "Created the employee record"), ...state.audit],
  });
  return respond(employee);
}

const SECTION_LABELS = {
  personal: { title: "Personal information", fields: { firstName: "First name", middleName: "Middle name", lastName: "Last name", suffix: "Suffix", birthDate: "Birth date", sex: "Sex", civilStatus: "Civil status", nationality: "Nationality" } },
  contact: { title: "Contact details", fields: { workEmail: "Work email", personalEmail: "Personal email", mobile: "Mobile", address: "Address", city: "City", province: "Province", emergencyName: "Emergency contact", emergencyRelationship: "Relationship", emergencyPhone: "Emergency phone" } },
  government: { title: "Government numbers", fields: { sss: "SSS", philhealth: "PhilHealth", pagibig: "Pag-IBIG", tin: "TIN" } },
} as const;

export type EditableSection = keyof typeof SECTION_LABELS;

export async function updateEmployeeSection<S extends EditableSection>(id: string, section: S, values: CoreEmployee[S], actor: string): Promise<CoreEmployee> {
  const schema = section === "personal" ? personalSchema : section === "contact" ? contactSchema : governmentSchema;
  const parsed = schema.safeParse(values);
  if (!parsed.success) return fail(firstIssue(parsed));
  const e = employeeById(id);
  if (!e) return fail("That employee no longer exists");
  const data = parsed.data as CoreEmployee[S];
  if (section === "contact") {
    const email = (data as CoreEmployee["contact"]).workEmail.toLowerCase();
    if (email && state.employees.some((x) => x.id !== id && x.contact.workEmail.toLowerCase() === email)) return fail("Another employee already uses that work email");
  }
  const labels = SECTION_LABELS[section].fields as Record<string, string>;
  const before = e[section] as unknown as Record<string, string>;
  const after = data as unknown as Record<string, string>;
  const changed = Object.keys(labels).filter((k) => (before[k] ?? "") !== (after[k] ?? ""));
  if (changed.length === 0) return respond(e);
  // Sensitive values are named in the trail, never written into it.
  const summary = section === "government" ? `Changed ${changed.map((k) => labels[k]).join(", ")}` : changed.map((k) => `${labels[k]}: ${before[k] || "—"} → ${after[k] || "—"}`).join("; ");
  const updated: CoreEmployee = { ...e, [section]: data };
  commit({
    ...state,
    employees: state.employees.map((x) => (x.id === id ? updated : x)),
    audit: [audit(id, actor, "Edited", SECTION_LABELS[section].title, summary), ...state.audit],
  });
  return respond(updated);
}

/** Showing unmasked government numbers is itself recorded. */
export async function logGovernmentReveal(id: string, actor: string): Promise<void> {
  commit({ ...state, audit: [audit(id, actor, "Viewed", "Government numbers", "Revealed full numbers"), ...state.audit] });
  return respond(undefined);
}

export function listAudit(employeeId: string): Promise<AuditEntry[]> {
  return respond(state.audit.filter((a) => a.employeeId === employeeId));
}

// ---- Organization ----

export interface UnitSummary extends OrgUnit {
  headcount: number;
  openSlots: number;
  positionCount: number;
  headName?: string;
}

export function listUnits(): Promise<UnitSummary[]> {
  reconcile();
  return respond(
    state.units.map((u) => {
      const ids = subtree(u.id);
      const positions = state.positions.filter((p) => p.active && ids.has(p.departmentId));
      const head = employeeById(u.headEmployeeId);
      return {
        ...u,
        headcount: state.employees.filter((e) => isCurrent(e) && ids.has(e.job.unitId)).length,
        openSlots: positions.reduce((n, p) => n + Math.max(0, p.slots - holdersOf(p.id).length), 0),
        positionCount: positions.length,
        headName: head ? fullName(head.personal) : undefined,
      };
    }),
  );
}

const PARENT_TYPE: Record<UnitType, UnitType | null> = { company: null, branch: "company", department: "branch", team: "department" };
export const CHILD_TYPE: Record<UnitType, UnitType | null> = { company: "branch", branch: "department", department: "team", team: null };

export interface UnitInput {
  id?: string;
  type: UnitType;
  name: string;
  code: string;
  parentId: string | null;
  headEmployeeId?: string;
  address?: string;
}

export async function saveUnit(input: UnitInput): Promise<OrgUnit> {
  const name = input.name.trim();
  if (!name) return fail("Enter a name");
  const existing = unitById(input.id);
  if (input.type !== "company") {
    const parent = unitById(input.parentId ?? undefined);
    if (!parent || parent.type !== PARENT_TYPE[input.type]) return fail(`Choose which ${PARENT_TYPE[input.type]} it belongs to`);
    if (!parent.active) return fail(`${parent.name} is inactive`);
  }
  if (state.units.some((u) => u.id !== input.id && u.parentId === input.parentId && u.name.toLowerCase() === name.toLowerCase())) return fail(`There's already a ${input.type} named "${name}" there`);
  const code = (input.code.trim() || name.replace(/[^A-Za-z ]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 4)).toUpperCase();
  const unit: OrgUnit = { active: true, ...existing, type: input.type, name, code, parentId: input.type === "company" ? null : input.parentId, headEmployeeId: input.headEmployeeId || undefined, address: input.address?.trim() || undefined, id: existing?.id ?? newId(input.type.slice(0, 2)) };
  // Moving a department to another branch carries its positions and people along with it.
  commit({ ...state, units: existing ? state.units.map((u) => (u.id === unit.id ? unit : u)) : [...state.units, unit] });
  return respond(unit);
}

export async function setUnitActive(id: string, active: boolean): Promise<OrgUnit> {
  const unit = unitById(id);
  if (!unit) return fail("That unit no longer exists");
  if (unit.type === "company") return fail("The company itself can't be closed");
  if (!active) {
    const ids = subtree(id);
    const people = state.employees.filter((e) => isCurrent(e) && ids.has(e.job.unitId)).length;
    if (people) return fail(`${people} ${people === 1 ? "person is" : "people are"} still in ${unit.name}. Move them to another department with a job change first.`);
    const positions = state.positions.filter((p) => p.active && ids.has(p.departmentId)).length;
    if (positions) return fail(`${unit.name} still has ${positions} open job${positions === 1 ? "" : "s"}. Close those jobs in Positions first.`);
    const kids = state.units.filter((u) => u.parentId === id && u.active).length;
    if (kids) return fail(`Close the departments and teams inside ${unit.name} first.`);
  } else {
    const parent = unitById(unit.parentId ?? undefined);
    if (parent && !parent.active) return fail(`Reopen ${parent.name} first.`);
  }
  const next = { ...unit, active };
  commit({ ...state, units: state.units.map((u) => (u.id === id ? next : u)) });
  return respond(next);
}

// ---- Positions ----

export interface PositionSummary extends Position {
  filled: number;
  open: number;
  holders: { id: string; name: string; initials: string; unitName: string; status: EmploymentStatus }[];
  departmentName: string;
  branchId?: string;
  branchName: string;
  reportsToTitle?: string;
}

export function listPositions(): Promise<PositionSummary[]> {
  reconcile();
  return respond(
    state.positions.map((p) => {
      const holders = holdersOf(p.id);
      const dept = unitById(p.departmentId);
      const branch = ancestorOf(p.departmentId, "branch");
      return {
        ...p,
        filled: holders.length,
        open: Math.max(0, p.slots - holders.length),
        holders: holders.map((h) => ({ id: h.id, name: fullName(h.personal), initials: initialsOf(h.personal), unitName: unitById(h.job.unitId)?.name ?? "", status: h.job.status })),
        departmentName: dept?.name ?? "—",
        branchId: branch?.id,
        branchName: branch?.name ?? "—",
        reportsToTitle: positionById(p.reportsToPositionId)?.title,
      };
    }),
  );
}

export interface PositionInput {
  id?: string;
  title: string;
  code: string;
  departmentId: string;
  level: JobLevel;
  employmentType: EmploymentType;
  slots: number;
  reportsToPositionId?: string;
  description?: string;
}

export async function savePosition(input: PositionInput): Promise<Position> {
  const title = input.title.trim();
  if (!title) return fail("Enter the position title");
  const dept = unitById(input.departmentId);
  if (!dept || dept.type !== "department") return fail("Choose a department");
  if (!dept.active) return fail(`${dept.name} is inactive`);
  if (!Number.isInteger(input.slots) || input.slots < 1) return fail("Enter how many people this job needs (at least 1)");
  const existing = positionById(input.id);
  if (existing) {
    const filled = holdersOf(existing.id).length;
    if (input.slots < filled) return fail(`${filled} people hold this position, so it needs at least ${filled}`);
    if (filled && input.departmentId !== existing.departmentId) return fail("Move the people in this position before changing its department");
  }
  if (input.reportsToPositionId === input.id) return fail("A position can't report to itself");
  if (state.positions.some((p) => p.id !== input.id && p.departmentId === input.departmentId && p.title.toLowerCase() === title.toLowerCase())) return fail(`${dept.name} already has a ${title} position`);
  const code = (input.code.trim() || title.split(/\s+/).map((w) => w[0]).join("")).toUpperCase();
  const position: Position = { active: true, ...existing, ...input, title, code, reportsToPositionId: input.reportsToPositionId || undefined, description: input.description?.trim() || undefined, id: existing?.id ?? newId("ps") };
  commit({ ...state, positions: existing ? state.positions.map((p) => (p.id === position.id ? position : p)) : [...state.positions, position] });
  return respond(position);
}

export async function setPositionActive(id: string, active: boolean): Promise<Position> {
  const p = positionById(id);
  if (!p) return fail("That position no longer exists");
  const filled = holdersOf(id).length;
  if (!active && filled) return fail(`${filled} ${filled === 1 ? "person holds" : "people hold"} this job. Move them to another job first.`);
  if (active && !unitById(p.departmentId)?.active) return fail("Its department is closed. Reopen the department first.");
  const next = { ...p, active };
  commit({ ...state, positions: state.positions.map((x) => (x.id === id ? next : x)) });
  return respond(next);
}

// ---- Documents ----

const DAY = 86_400_000;
export function daysUntil(iso: string) {
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${isoDate()}T00:00:00`).getTime()) / DAY);
}

/** "expired" / "expiring" when an on-file document lapses within 30 days. */
export function documentAlert(d: Pick<EmployeeDocument, "status" | "expiresOn">): "expired" | "expiring" | null {
  if (!d.expiresOn || d.status === "Missing" || d.status === "Not applicable") return null;
  const days = daysUntil(d.expiresOn);
  return days < 0 ? "expired" : days <= 30 ? "expiring" : null;
}

export function listDocuments(employeeId?: string): Promise<EmployeeDocument[]> {
  reconcile();
  return respond(state.documents.filter((d) => !employeeId || d.employeeId === employeeId));
}

export type DocumentAction =
  | { kind: "upload"; fileName: string; referenceNo?: string; expiresOn?: string }
  | { kind: "verify" }
  | { kind: "return"; note: string }
  | { kind: "not-applicable" }
  | { kind: "required" };

export async function updateDocument(id: string, action: DocumentAction, actor: string): Promise<EmployeeDocument> {
  const d = state.documents.find((x) => x.id === id);
  if (!d) return fail("That document no longer exists");
  const now = new Date().toISOString();
  let next: EmployeeDocument;
  let entry: AuditEntry;
  switch (action.kind) {
    case "upload": {
      if (!action.fileName) return fail("Choose a file");
      if (EXPIRING_TYPES.includes(d.type) && d.type !== "Police/Barangay Clearance" && !action.expiresOn) return fail("Enter the expiry date");
      if (action.expiresOn && daysUntil(action.expiresOn) < 0) return fail("That document has already expired");
      next = { ...d, status: "Submitted", fileName: action.fileName, uploadedAt: isoDate(), referenceNo: action.referenceNo?.trim() || undefined, expiresOn: action.expiresOn || undefined, verifiedAt: undefined, verifiedBy: undefined, note: undefined };
      entry = audit(d.employeeId, actor, "Uploaded", d.type, d.fileName ? `Replaced the file with ${action.fileName}` : `Uploaded ${action.fileName}`);
      break;
    }
    case "verify":
      if (d.status !== "Submitted") return fail("Only a submitted document can be verified");
      next = { ...d, status: "Verified", verifiedBy: actor, verifiedAt: now, note: undefined };
      entry = audit(d.employeeId, actor, "Verified", d.type, "Checked against the original and verified");
      break;
    case "return":
      if (!action.note.trim()) return fail("Say what needs fixing so the employee can resubmit");
      next = { ...d, status: "Missing", fileName: undefined, uploadedAt: undefined, verifiedAt: undefined, verifiedBy: undefined, note: action.note.trim() };
      entry = audit(d.employeeId, actor, "Edited", d.type, `Returned for resubmission: ${action.note.trim()}`);
      break;
    case "not-applicable":
      next = { ...d, status: "Not applicable", fileName: undefined, uploadedAt: undefined, verifiedAt: undefined, verifiedBy: undefined, expiresOn: undefined, referenceNo: undefined };
      entry = audit(d.employeeId, actor, "Edited", d.type, "Marked not applicable");
      break;
    case "required":
      next = { ...d, status: "Missing" };
      entry = audit(d.employeeId, actor, "Edited", d.type, "Marked as required");
      break;
  }
  commit({ ...state, documents: state.documents.map((x) => (x.id === id ? next : x)), audit: [entry, ...state.audit] });
  return respond(next);
}

// ---- Employment history ----

export function listEvents(employeeId: string): Promise<JobEvent[]> {
  return respond(
    state.events
      .filter((e) => e.employeeId === employeeId)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.recordedAt.localeCompare(a.recordedAt)),
  );
}

export interface ChangeInput {
  employeeId: string;
  kind: ChangeKind;
  effectiveDate: string;
  positionId?: string;
  teamId?: string;
  supervisorId?: string;
  monthlySalary?: number;
  status?: EmploymentStatus;
  remarks: string;
}

/** Applies a promotion, transfer, salary change… to the employee's current job and adds it to their history. */
export async function recordChange(input: ChangeInput, actor: string): Promise<JobEvent> {
  const e = employeeById(input.employeeId);
  if (!e) return fail("That employee no longer exists");
  if (!isCurrent(e)) return fail("This employee is already separated");
  if (!input.effectiveDate) return fail("Choose the effective date");
  if (input.effectiveDate < e.job.dateHired) return fail("The effective date can't be before the date hired");
  const job = { ...e.job };
  const changes: FieldChange[] = [];
  const nameOf = (id?: string) => {
    const x = employeeById(id);
    return x ? fullName(x.personal) : "—";
  };

  switch (input.kind) {
    case "Promotion":
    case "Transfer": {
      const position = positionById(input.positionId);
      if (!position?.active) return fail("Choose the new position");
      const team = unitById(input.teamId);
      const unitId = team && team.parentId === position.departmentId ? team.id : position.departmentId;
      if (position.id === job.positionId && unitId === job.unitId) return fail(input.kind === "Promotion" ? "Choose a different position" : "Choose a different position or team");
      if (position.id !== job.positionId && holdersOf(position.id).length >= position.slots) return fail(`${position.title} has no opening. Add room for one more person in Positions first.`);
      if (position.id !== job.positionId) changes.push({ label: "Position", from: positionById(job.positionId)?.title, to: position.title });
      if (unitId !== job.unitId) changes.push({ label: "Unit", from: unitPathOf(job.unitId, state.units), to: unitPathOf(unitId, state.units) });
      job.positionId = position.id;
      job.unitId = unitId;
      const supervisorId = input.supervisorId || holdersOf(position.reportsToPositionId ?? "").find((h) => h.id !== e.id)?.id;
      if (supervisorId !== job.supervisorId) changes.push({ label: "Supervisor", from: nameOf(job.supervisorId), to: nameOf(supervisorId) });
      job.supervisorId = supervisorId;
      if (input.monthlySalary !== undefined && input.monthlySalary !== job.monthlySalary) {
        if (input.monthlySalary <= 0) return fail("Enter a valid monthly salary");
        changes.push({ label: "Monthly salary", from: peso(job.monthlySalary), to: peso(input.monthlySalary) });
        job.monthlySalary = input.monthlySalary;
      }
      break;
    }
    case "Salary adjustment":
      if (!input.monthlySalary || input.monthlySalary <= 0) return fail("Enter the new monthly salary");
      if (input.monthlySalary === job.monthlySalary) return fail("That's the current salary");
      changes.push({ label: "Monthly salary", from: peso(job.monthlySalary), to: peso(input.monthlySalary) });
      job.monthlySalary = input.monthlySalary;
      break;
    case "Regularization":
      if (job.employmentType !== "Probationary") return fail("Only probationary employees can be regularized");
      changes.push({ label: "Employment type", from: job.employmentType, to: "Regular" });
      job.employmentType = "Regular";
      job.regularizationDate = input.effectiveDate;
      break;
    case "Supervisor change":
      if (!input.supervisorId) return fail("Choose the new supervisor");
      if (input.supervisorId === e.id) return fail("An employee can't supervise themselves");
      if (input.supervisorId === job.supervisorId) return fail("That's already their supervisor");
      changes.push({ label: "Supervisor", from: nameOf(job.supervisorId), to: nameOf(input.supervisorId) });
      job.supervisorId = input.supervisorId;
      break;
    case "Status change":
      if (!input.status || input.status === "Separated") return fail("Choose the new status");
      if (input.status === job.status) return fail(`They're already ${job.status.toLowerCase()}`);
      changes.push({ label: "Status", from: job.status, to: input.status });
      job.status = input.status;
      break;
    case "Separation":
      if (!input.remarks.trim()) return fail("Give the reason for separation");
      changes.push({ label: "Status", from: job.status, to: "Separated" });
      job.status = "Separated";
      job.separationDate = input.effectiveDate;
      break;
  }

  const event: JobEvent = { id: newId("ev"), employeeId: e.id, kind: input.kind, effectiveDate: input.effectiveDate, changes, remarks: input.remarks.trim() || undefined, recordedBy: actor, recordedAt: new Date().toISOString() };
  // People who reported to someone now separated lose that link.
  const employees = state.employees.map((x) => (x.id === e.id ? { ...x, job } : input.kind === "Separation" && x.job.supervisorId === e.id ? { ...x, job: { ...x.job, supervisorId: undefined } } : x));
  commit({
    ...state,
    employees,
    events: [event, ...state.events],
    audit: [audit(e.id, actor, "Recorded", "Employment history", `${input.kind}: ${changes.map((c) => `${c.label} → ${c.to}`).join("; ")}`), ...state.audit],
  });
  return respond(event);
}

