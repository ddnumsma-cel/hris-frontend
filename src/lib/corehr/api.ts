// Core HR mock API. Each function stands in for an HTTP call and resolves
// after a short delay with a copy of the data, the way a real response would.

import { firstIssue, bankSchema, contactSchema, governmentSchema, newEmployeeSchema, personalSchema, type NewEmployeeValues } from "./schemas";
import { commit, fullName, initialsOf, isoDate, newId, reconcile, state, type CoreHrState } from "./store";
import type {
  AuditEntry,
  CoreEmployee,
  DocumentType,
  EmployeeDocument,
  EmploymentStatus,
  JobEvent,
  JobLevel,
  OrgUnit,
  Position,
  EmploymentType,
  UnitType,
} from "./types";
import { can, visible } from "../permissions";
import { deny, employeeOfAccount, forbidden, sessionWho } from "../session";
import { admin, saveAdmin } from "../admin/store";
import { dropCase, ensureCase } from "../pay/finalPayStore";
import { notifyEmployee } from "../outbox";

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

/** "Cebu HQ › Audit & Assurance › VCM" */
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
  mobile: string;
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
    mobile: e.contact.mobile,
    documents: {
      verified: docs.filter((d) => d.status === "Verified").length,
      required: docs.length,
      needsAction: docs.filter((d) => d.status === "Missing" || d.status === "Submitted" || documentAlert(d) !== null).length,
    },
  };
}

export function listEmployees(): Promise<EmployeeSummary[]> {
  // People list: everyone, their team, or only themselves (lib/permissions.ts).
  const who = sessionWho();
  if (!can(who, "view", "people")) return forbidden();
  reconcile();
  return respond(visible(who, "people", state.employees, (e) => e.id).map(summarize).sort((a, b) => a.name.localeCompare(b.name)));
}

export interface EmployeeRecord {
  employee: CoreEmployee;
  summary: EmployeeSummary;
  position?: Position;
  unitPath: string;
  supervisor?: { id: string; name: string; positionTitle: string };
}

export function getEmployee(id: string): Promise<EmployeeRecord | null> {
  const denied = deny("people", "view", id);
  if (denied) return denied;
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
  const denied = deny("people", "create");
  if (denied) return denied;
  const parsed = newEmployeeSchema.safeParse(values);
  if (!parsed.success) return fail(firstIssue(parsed));
  const v = parsed.data;
  const email = v.contact.workEmail.toLowerCase();
  if (state.employees.some((e) => e.contact.workEmail.toLowerCase() === email)) return fail("Another employee already uses that work email");
  const position = positionById(v.job.positionId);
  if (!position?.active) return fail("That position isn't available");
  if (holdersOf(position.id).length >= position.slots) return fail(`${position.title} has no opening. Open the job on the Company page and add room for one more person first.`);
  // The cluster (RPM / VCM / ADS) is a team inside the position's department; add it if that department has none yet.
  let units = state.units;
  let team = units.find((u) => u.type === "team" && u.parentId === position.departmentId && u.code === v.job.cluster);
  if (!team) {
    team = { id: newId("tm"), type: "team", name: v.job.cluster, code: v.job.cluster, parentId: position.departmentId, active: true };
    units = [...units, team];
  }
  const unitId = team.id;

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
      { label: "Position", to: `${position.title} · ${unitPathOf(unitId, units)}` },
      { label: "Employment type", to: v.job.employmentType },
      { label: "Monthly salary", to: peso(v.job.monthlySalary) },
    ],
    recordedBy: actor,
    recordedAt: new Date().toISOString(),
  };
  commit({
    ...state,
    units,
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
  bank: { title: "Bank account", fields: { bank: "Bank", accountName: "Account name", accountNumber: "Account number" } },
} as const;

export type EditableSection = keyof typeof SECTION_LABELS;

export async function updateEmployeeSection<S extends EditableSection>(id: string, section: S, values: CoreEmployee[S], actor: string): Promise<CoreEmployee> {
  // HR edits anyone in scope; employees ("Own") may update their own contact details only.
  const who = sessionWho();
  const ownContact = section === "contact" && id === who.employeeId;
  if (!ownContact) {
    const denied = deny("people", "edit", id);
    if (denied) return denied;
  }
  const schema = section === "personal" ? personalSchema : section === "contact" ? contactSchema : section === "bank" ? bankSchema : governmentSchema;
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
  const before = (e[section] ?? {}) as unknown as Record<string, string>;
  const after = data as unknown as Record<string, string>;
  const changed = Object.keys(labels).filter((k) => (before[k] ?? "") !== (after[k] ?? ""));
  if (changed.length === 0) return respond(e);
  // Sensitive values are named in the trail, never written into it.
  const summary = section === "government" || section === "bank" ? `Changed ${changed.map((k) => labels[k]).join(", ")}` : changed.map((k) => `${labels[k]}: ${before[k] || "—"} → ${after[k] || "—"}`).join("; ");
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
  const denied = deny("people", "view", id);
  if (denied) return denied;
  commit({ ...state, audit: [audit(id, actor, "Viewed", "Government numbers", "Revealed full numbers"), ...state.audit] });
  return respond(undefined);
}

export function listAudit(employeeId: string): Promise<AuditEntry[]> {
  const denied = deny("people", "view", employeeId);
  if (denied) return denied;
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
  // Departments and offices: anyone who sees them, or who adds people (to pick a department).
  const who = sessionWho();
  if (!(["departments", "locations", "orgChart"] as const).some((f) => can(who, "view", f)) && !can(who, "create", "people")) return forbidden();
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
  const who = sessionWho();
  if (!(["departments", "orgChart"] as const).some((f) => can(who, "view", f)) && !can(who, "create", "people")) return forbidden();
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

// ---- Organization chart ----

export interface OrgChart {
  /** The head of the company, at the top of the chart. */
  headId?: string;
  people: (EmployeeSummary & { supervisorId?: string })[];
}

/** Everyone currently employed with who they report to. */
export function getOrgChart(): Promise<OrgChart> {
  const denied = deny("orgChart", "view");
  if (denied) return denied;
  reconcile();
  const company = state.units.find((u) => u.type === "company");
  const people = state.employees.filter(isCurrent).map((e) => ({ ...summarize(e), supervisorId: e.job.supervisorId }));
  return respond({ headId: company?.headEmployeeId, people: people.sort((a, b) => a.name.localeCompare(b.name)) });
}

export async function setCompanyHead(employeeId: string, actor: string): Promise<void> {
  const denied = deny("orgChart", "edit");
  if (denied) return denied;
  const company = state.units.find((u) => u.type === "company");
  const e = employeeById(employeeId);
  if (!company) return fail("The company record is missing");
  if (!e || !isCurrent(e)) return fail("Choose a current employee");
  const before = employeeById(company.headEmployeeId);
  // The head reports to no one.
  commit({
    ...state,
    units: state.units.map((u) => (u.id === company.id ? { ...u, headEmployeeId: e.id } : u)),
    employees: state.employees.map((x) => (x.id === e.id ? { ...x, job: { ...x.job, supervisorId: undefined } } : x)),
    audit: [audit(e.id, actor, "Edited", "Organization chart", `Head of the company: ${before ? fullName(before.personal) : "—"} → ${fullName(e.personal)}`), ...state.audit],
  });
  return respond(undefined);
}

/** Change who someone reports to. Blocks loops (reporting to someone who reports to them). */
export async function setReportsTo(employeeId: string, supervisorId: string | null, actor: string): Promise<void> {
  const denied = deny("orgChart", "edit");
  if (denied) return denied;
  const e = employeeById(employeeId);
  if (!e || !isCurrent(e)) return fail("That employee no longer works here");
  if (supervisorId === employeeId) return fail("Someone can't report to themselves");
  const sup = supervisorId ? employeeById(supervisorId) : undefined;
  if (supervisorId && (!sup || !isCurrent(sup))) return fail("Choose a current employee");
  for (let x = sup; x; x = employeeById(x.job.supervisorId)) {
    if (x.id === employeeId) return fail(`${fullName(sup!.personal)} already reports to ${fullName(e.personal)}, directly or through someone else`);
  }
  const company = state.units.find((u) => u.type === "company");
  if (company?.headEmployeeId === employeeId && supervisorId) return fail("The head of the company reports to no one. Choose a new head first.");
  const before = employeeById(e.job.supervisorId);
  commit({
    ...state,
    employees: state.employees.map((x) => (x.id === e.id ? { ...x, job: { ...x.job, supervisorId: supervisorId ?? undefined } } : x)),
    audit: [audit(e.id, actor, "Edited", "Organization chart", `Reports to: ${before ? fullName(before.personal) : "—"} → ${sup ? fullName(sup.personal) : "—"}`), ...state.audit],
  });
  return respond(undefined);
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
  const who = sessionWho();
  if (!can(who, "view", "documents")) return forbidden();
  reconcile();
  return respond(visible(who, "documents", state.documents, (d) => d.employeeId).filter((d) => !employeeId || d.employeeId === employeeId));
}

export type DocumentAction =
  | { kind: "upload"; fileName: string; referenceNo?: string; expiresOn?: string }
  | { kind: "verify" }
  | { kind: "return"; note: string }
  | { kind: "not-applicable" }
  | { kind: "required" };

export async function updateDocument(id: string, action: DocumentAction, actor: string): Promise<EmployeeDocument> {
  const target = state.documents.find((x) => x.id === id);
  const denied = deny("documents", "edit", target?.employeeId);
  if (denied) return denied;
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
  const denied = deny("people", "view", employeeId);
  if (denied) return denied;
  return respond(
    state.events
      .filter((e) => e.employeeId === employeeId)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.recordedAt.localeCompare(a.recordedAt)),
  );
}


// ---- Separation ----

export const SEPARATION_REASONS = ["Resigned", "End of contract", "Retired", "Terminated", "Redundancy", "Death", "Other"] as const;

/**
 * HR records that someone is leaving: their last day and why. On or after the last day they're
 * separated (off payroll and headcount, their login stops working); before it they're shown as
 * leaving. Accounting gets a final pay case right away.
 */
export async function recordSeparation(id: string, input: { lastDay: string; reason: string; note: string }, actor: string): Promise<CoreEmployee> {
  const denied = deny("people", "edit", id);
  if (denied) return denied;
  const e = employeeById(id);
  if (!e) return fail("That employee no longer exists");
  if (e.job.status === "Separated") return fail("This employee is already separated");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.lastDay)) return fail("Enter their last day");
  if (input.lastDay < e.job.dateHired) return fail("The last day can't be before they were hired");
  if (!SEPARATION_REASONS.includes(input.reason as (typeof SEPARATION_REASONS)[number])) return fail("Choose why they're leaving");
  const today = isoDate();
  const done = input.lastDay < today;
  const updated: CoreEmployee = { ...e, job: { ...e.job, separationDate: input.lastDay, ...(done ? { status: "Separated" as const } : {}) } };
  const event: JobEvent = {
    id: newId("ev"),
    employeeId: id,
    kind: "Separation",
    effectiveDate: input.lastDay,
    changes: [
      { label: "Reason", to: input.reason },
      { label: "Last day", to: input.lastDay },
    ],
    remarks: input.note.trim() || undefined,
    recordedBy: actor,
    recordedAt: new Date().toISOString(),
  };
  commit({
    ...state,
    employees: state.employees.map((x) => (x.id === id ? updated : x)),
    events: [event, ...state.events],
    audit: [audit(id, actor, "Edited", "Employment", `Separation recorded: ${input.reason}, last day ${input.lastDay}`), ...state.audit],
  });
  closeAccountsIfGone(id);
  ensureCase(id, input.lastDay, input.reason, actor);
  notifyEmployee(updated.job.supervisorId, "separation", `${fullName(e.personal)} is leaving`, `HR recorded that ${fullName(e.personal)} is leaving (${input.reason}). Their last day is ${input.lastDay}.`);
  return respond(updated);
}

/** Undo a separation recorded by mistake, or a resignation that was withdrawn. */
export async function cancelSeparation(id: string, actor: string): Promise<CoreEmployee> {
  const denied = deny("people", "edit", id);
  if (denied) return denied;
  const e = employeeById(id);
  if (!e?.job.separationDate) return fail("There's no separation to cancel");
  const { separationDate, ...job } = e.job;
  const updated: CoreEmployee = { ...e, job: { ...job, status: e.job.status === "Separated" ? "Active" : e.job.status } };
  commit({
    ...state,
    employees: state.employees.map((x) => (x.id === id ? updated : x)),
    events: state.events.filter((ev) => !(ev.employeeId === id && ev.kind === "Separation" && ev.effectiveDate === separationDate)),
    audit: [audit(id, actor, "Edited", "Employment", `Separation cancelled (last day was ${separationDate})`), ...state.audit],
  });
  dropCase(id);
  return respond(updated);
}

/** Turns off the logins of someone whose last day has passed. */
function closeAccountsIfGone(id: string) {
  const e = employeeById(id);
  if (!e?.job.separationDate || e.job.separationDate >= isoDate()) return;
  // Linked in Users, the demo login's profile, or the same name.
  const name = fullName(e.personal).toLowerCase();
  const theirs = (a: (typeof admin.accounts)[number]) => a.employeeId === id || (!a.employeeId && (employeeOfAccount(a) === id || a.name.trim().toLowerCase() === name));
  if (admin.accounts.some((a) => theirs(a) && a.status === "active")) {
    saveAdmin({ ...admin, accounts: admin.accounts.map((a) => (theirs(a) ? { ...a, status: "disabled" as const } : a)) });
  }
}
