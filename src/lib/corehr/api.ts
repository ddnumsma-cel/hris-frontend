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
import { notifyEmployees } from "../notifications";
import { dates, tellApprover, tellAssigned, tellEmployees } from "../requestNotices";
import { assertSeatsAvailable, checkSeatThresholds, isSeatLimitError } from "../subscription/api";

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
  try {
    const employee = addEmployee(parsed.data, actor, scannedId);
    checkSeatThresholds();
    return respond(employee);
  } catch (err) {
    if (isSeatLimitError(err)) return Promise.reject(err);
    return fail(err instanceof Error ? err.message : "Couldn't add this employee");
  }
}

/**
 * Bulk import: checks the whole batch against the seats left before adding anyone, then adds
 * them one by one. Rows that fail their own checks (a taken email, a full position) are reported
 * and skipped. TODO: no import screen yet; this is the endpoint one would call.
 */
export async function importEmployees(rows: NewEmployeeValues[], actor: string): Promise<{ added: CoreEmployee[]; failed: { row: number; error: string }[] }> {
  const denied = deny("people", "create");
  if (denied) return denied;
  if (rows.length === 0) return fail("This import has no employees");
  const parsed = rows.map((r) => newEmployeeSchema.safeParse(r));
  const invalid = parsed.findIndex((p) => !p.success);
  if (invalid >= 0) return fail(`Row ${invalid + 1}: ${firstIssue(parsed[invalid]! as Extract<(typeof parsed)[number], { success: false }>)}`);
  try {
    assertSeatsAvailable(rows.length);
  } catch (err) {
    return Promise.reject(err);
  }
  const added: CoreEmployee[] = [];
  const failed: { row: number; error: string }[] = [];
  parsed.forEach((p, i) => {
    try {
      added.push(addEmployee(p.data!, actor));
    } catch (err) {
      failed.push({ row: i + 1, error: err instanceof Error ? err.message : "Couldn't add" });
    }
  });
  checkSeatThresholds();
  return respond({ added, failed });
}

/**
 * Adds one validated employee and saves, all in one synchronous step: the seat check and the
 * save can't be split by another request. Throws on any problem.
 */
function addEmployee(v: NewEmployeeValues, actor: string, scannedId?: ScannedGovernmentId): CoreEmployee {
  const email = v.contact.workEmail.toLowerCase();
  if (state.employees.some((e) => e.contact.workEmail.toLowerCase() === email)) throw new Error("Another employee already uses that work email");
  const position = positionById(v.job.positionId);
  if (!position?.active) throw new Error("That position isn't available");
  if (holdersOf(position.id).length >= position.slots) throw new Error(`${position.title} has no opening. Open the job on the Company page and add room for one more person first.`);
  assertSeatsAvailable(1);
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
  return employee;
}

const SECTION_LABELS = {
  personal: { title: "Personal information", fields: { firstName: "First name", middleName: "Middle name", lastName: "Last name", suffix: "Suffix", birthDate: "Birth date", sex: "Sex", civilStatus: "Civil status", nationality: "Nationality" } },
  contact: { title: "Contact details", fields: { workEmail: "Work email", personalEmail: "Personal email", mobile: "Mobile", address: "Address", city: "City", province: "Province", emergencyName: "Emergency contact person", emergencyRelationship: "Relationship", emergencyPhone: "Emergency phone" } },
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
  // A head who has left or been deleted isn't sent, so the chart never hangs off someone missing.
  const headId = people.some((p) => p.id === company?.headEmployeeId) ? company?.headEmployeeId : undefined;
  return respond({ headId, people: people.sort((a, b) => a.name.localeCompare(b.name)) });
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
  tellEmployees(e.id, "orgchart", "update", sup ? `You now report to ${fullName(sup.personal)}` : "Your manager changed", sup ? "They approve your leave, overtime and claims from now on." : "You no longer have a manager on the org chart.");
  if (sup) tellEmployees(sup.id, "orgchart", "update", `${fullName(e.personal)} now reports to you`, "You'll get their leave, overtime and claim requests to approve.");
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
  const owner = employeeById(d.employeeId);
  const ownerName = owner ? fullName(owner.personal) : d.employeeId;
  if (action.kind === "upload") {
    if (sessionWho().employeeId === d.employeeId) tellAssigned("edit", "documents", "documents", "request", `${ownerName} uploaded their ${d.type}`, "Check it against the original on the 201 documents page.");
    else tellEmployees(d.employeeId, "documents", "update", `HR added your ${d.type}`, `${actor} uploaded it to your 201 file.`);
  } else if (action.kind === "verify") {
    tellEmployees(d.employeeId, "documents", "approved", `Your ${d.type} was checked`, `${actor} verified it against the original. Nothing else to do.`);
  } else if (action.kind === "return") {
    tellEmployees(d.employeeId, "documents", "rejected", `Your ${d.type} was sent back`, `“${action.note.trim()}” Upload a new one from your 201 file.`);
  }
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


// ---- 201 document reminders ----

export interface DocumentReminder {
  employeeId: string;
  name: string;
  departmentName: string;
  missing: string[];
  expired: string[];
  expiring: string[];
  /** When HR last sent them a reminder (from the audit trail). */
  lastReminded?: string;
}

const REMINDER = "Reminder sent";

/** What someone still has to hand in or renew. Documents waiting for HR to check aren't theirs to act on. */
function owedBy(employeeId: string) {
  const mine = state.documents.filter((d) => d.employeeId === employeeId && d.status !== "Not applicable");
  return {
    missing: mine.filter((d) => d.status === "Missing").map((d) => d.type),
    expired: mine.filter((d) => d.status !== "Missing" && documentAlert(d) === "expired").map((d) => d.type),
    expiring: mine.filter((d) => d.status !== "Missing" && documentAlert(d) === "expiring").map((d) => d.type),
  };
}

/** Current employees who owe 201 documents (missing, expired or expiring soon). */
export function listDocumentReminders(): Promise<DocumentReminder[]> {
  const denied = deny("documents", "edit");
  if (denied) return denied;
  const rows = state.employees
    .filter(isCurrent)
    .map((e) => {
      const owed = owedBy(e.id);
      const last = state.audit.find((a) => a.employeeId === e.id && a.section === "201 documents" && a.summary.startsWith(REMINDER));
      return { employeeId: e.id, name: fullName(e.personal), departmentName: unitById(positionById(e.job.positionId)?.departmentId)?.name ?? "", ...owed, lastReminded: last?.at };
    })
    .filter((r) => r.missing.length + r.expired.length + r.expiring.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  return respond(rows);
}

/**
 * Reminds these employees what they still owe: an email (and text) through the outbox, and a
 * notification in their bell. Logged on each person's record. Returns how many were reminded.
 */
export async function sendDocumentReminders(employeeIds: string[], note: string, actor: string): Promise<number> {
  const denied = deny("documents", "edit");
  if (denied) return denied;
  if (!employeeIds.length) return fail("Choose who to remind");
  const extra = note.trim();
  const entries: AuditEntry[] = [];
  for (const id of employeeIds) {
    const e = employeeById(id);
    if (!e || !isCurrent(e)) continue;
    const { missing, expired, expiring } = owedBy(id);
    const total = missing.length + expired.length + expiring.length;
    if (!total) continue;
    const lines = [
      ...missing.map((t) => `• ${t}: not handed in yet`),
      ...expired.map((t) => `• ${t}: expired, please send a renewed copy`),
      ...expiring.map((t) => `• ${t}: expiring soon, please send a renewed copy`),
    ];
    const name = e.personal.firstName || fullName(e.personal);
    notifyEmployee(
      id,
      "documents",
      `Your 201 file needs ${total} document${total === 1 ? "" : "s"}`,
      `Hi ${name},\n\nHR is completing your 201 file and still needs:\n${lines.join("\n")}\n\nUpload them from My 201 file in the app, or bring the originals to HR.${extra ? `\n\n${extra}` : ""}\n\n${actor}`,
      `MSMA HR: your 201 file still needs ${total} document${total === 1 ? "" : "s"}. Please upload them in the app or bring them to HR.`,
    );
    notifyEmployees([id], `HR needs ${total} document${total === 1 ? "" : "s"} for your 201 file`, `${[...missing, ...expired, ...expiring].slice(0, 3).join(", ")}${total > 3 ? ` and ${total - 3} more` : ""}.${extra ? ` ${extra}` : ""}`, "/employee/201-file");
    entries.push(audit(id, actor, "Recorded", "201 documents", `${REMINDER} for ${total} document${total === 1 ? "" : "s"}`));
  }
  if (!entries.length) return fail("No one chosen still owes documents");
  commit({ ...state, audit: [...entries, ...state.audit] });
  return respond(entries.length);
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
  checkSeatThresholds();
  ensureCase(id, input.lastDay, input.reason, actor);
  tellApprover(id, "separation", "update", `${fullName(e.personal)} is leaving`, `${input.reason}. Last day ${dates(input.lastDay)}.`);
  tellAssigned("final", "payrollRuns", "separation", "request", `Final pay to prepare for ${fullName(e.personal)}`, `${input.reason}, last day ${dates(input.lastDay)}. A final pay case was opened.`);
  notifyEmployee(updated.job.supervisorId, "separation", `${fullName(e.personal)} is leaving`, `HR recorded that ${fullName(e.personal)} is leaving (${input.reason}). Their last day is ${input.lastDay}.`);
  return respond(updated);
}

/** Undo a separation recorded by mistake, or a resignation that was withdrawn. */
export async function cancelSeparation(id: string, actor: string): Promise<CoreEmployee> {
  const denied = deny("people", "edit", id);
  if (denied) return denied;
  const e = employeeById(id);
  if (!e?.job.separationDate) return fail("There's no separation to cancel");
  // Bringing back someone already separated takes a seat again.
  if (e.job.status === "Separated") {
    try {
      assertSeatsAvailable(1);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  const { separationDate, ...job } = e.job;
  const updated: CoreEmployee = { ...e, job: { ...job, status: e.job.status === "Separated" ? "Active" : e.job.status } };
  commit({
    ...state,
    employees: state.employees.map((x) => (x.id === id ? updated : x)),
    events: state.events.filter((ev) => !(ev.employeeId === id && ev.kind === "Separation" && ev.effectiveDate === separationDate)),
    audit: [audit(id, actor, "Edited", "Employment", `Separation cancelled (last day was ${separationDate})`), ...state.audit],
  });
  dropCase(id);
  checkSeatThresholds();
  return respond(updated);
}

/**
 * Deletes someone's 201 file for good: their record, documents and job history. Their direct
 * reports lose them as supervisor and their logins are turned off. Use separation for people who
 * actually worked here and left; delete is for records added by mistake.
 */
export async function deleteEmployee(id: string, actor: string): Promise<void> {
  const denied = deny("people", "delete", id);
  if (denied) return denied;
  const e = employeeById(id);
  if (!e) return fail("That employee no longer exists");
  // The org chart hangs from the head of the company: choose a new head first.
  if (state.units.some((u) => u.type === "company" && u.headEmployeeId === id)) return fail(`${fullName(e.personal)} is the head of the company. Make someone else the head on the org chart first.`);
  disableAccounts(id);
  // Their team moves up to their own manager; departments they led are left without a head.
  const up = e.job.supervisorId;
  commit({
    ...state,
    units: state.units.map((u) => (u.headEmployeeId === id ? { ...u, headEmployeeId: undefined } : u)),
    employees: state.employees.filter((x) => x.id !== id).map((x) => (x.job.supervisorId === id ? { ...x, job: { ...x.job, supervisorId: up } } : x)),
    documents: state.documents.filter((d) => d.employeeId !== id),
    events: state.events.filter((ev) => ev.employeeId !== id),
    audit: [audit(id, actor, "Deleted", "Employee", `${fullName(e.personal)} (${id}) deleted`), ...state.audit.filter((a) => a.employeeId !== id)],
  });
  dropCase(id);
  checkSeatThresholds();
  return respond(undefined);
}

/** Turns off the logins of someone whose last day has passed. */
function closeAccountsIfGone(id: string) {
  const e = employeeById(id);
  if (!e?.job.separationDate || e.job.separationDate >= isoDate()) return;
  disableAccounts(id);
}

function disableAccounts(id: string) {
  const e = employeeById(id);
  if (!e) return;
  // Linked in Users, the demo login's profile, or the same name.
  const name = fullName(e.personal).toLowerCase();
  const theirs = (a: (typeof admin.accounts)[number]) => a.employeeId === id || (!a.employeeId && (employeeOfAccount(a) === id || a.name.trim().toLowerCase() === name));
  if (admin.accounts.some((a) => theirs(a) && a.status === "active")) {
    saveAdmin({ ...admin, accounts: admin.accounts.map((a) => (theirs(a) ? { ...a, status: "disabled" as const } : a)) });
  }
}
