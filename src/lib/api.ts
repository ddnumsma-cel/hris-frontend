import {
  announcements,
  attendanceRequests,
  attendanceTrend,
  auditLogEntries,
  certificateRequests,
  companyAssets,
  complianceCalendar,
  currentAdmin,
  currentEmployee,
  currentManager,
  setCurrentAdmin,
  employeeBenefits,
  employeeCases,
  employeeDirectory,
  employeeDtrSummary,
  employeeThirteenthMonth,
  jobRequisitions,
  leaveBalances,
  leaveRequests,
  myDtrLog,
  offboardingCases,
  onLeaveToday,
  payrollCostBreakdown,
  payrollCutoff,
  payrollEntries,
  payrollRunSteps,
  payslips,
  performanceReviewStatuses,
  personnelDocuments,
  personnelProfiles,
  professionalLicenses,
  setAnnouncements,
  setAttendanceRequests,
  setAuditLogEntries,
  setCertificateRequests,
  setComplianceCalendar,
  setCompanyAssets,
  setCurrentEmployee,
  setCurrentManager,
  setEmployeeBenefits,
  setEmployeeCases,
  setEmployeeDirectory,
  setLeaveRequests,
  setOffboardingCases,
  setPayrollEntries,
  setPayslips,
  setPerformanceReviewStatuses,
  setPersonnelDocuments,
  buildNewHireDocuments,
  setPersonnelProfiles,
  setProfessionalLicenses,
  setTrainingRecords,
  trainingRecords,
  workforceAlerts,
} from "./mockData";
import type {
  Announcement,
  AttendanceRequest,
  AttendanceRequestStatus,
  AuditLogEntry,
  CaseStatus,
  CaseType,
  CertificateRequest,
  CertificateRequestStatus,
  CivilStatus,
  ComplianceItem,
  CompanyAsset,
  Dependent,
  Employee,
  EmployeeBenefit,
  EmployeeCase,
  LeaveRequest,
  LeaveType,
  OffboardingCase,
  OffboardingStage,
  AdminProfile,
  PartnerProfile,
  PayrollEntry,
  PersonnelDocument,
  PersonnelDocumentChecklistItem,
  PersonnelDocumentStatus,
  PersonnelProfile,
  TrainingRecord,
  TrainingStatus,
} from "./types";
import { getExpiringPersonnelFields } from "./automation";
import { getCredential, getCredentials, setCredential } from "./credentials";
import { buildEmployeeFileRecords } from "./employmentRecords";
import { teamReports, type ReportId } from "./reportsData";
import { deny, sessionWho } from "./session";
import { isFaceEnrolled, markFaceEnrolled } from "./faceId";
import { tellAssigned, tellEmployees } from "./requestNotices";
import { fileCertificate } from "./certificates";
import { assertSeatsAvailable } from "./subscription/api";
import { defaultComplianceCalendar, headcountByOffice, homeStats, newHirePipeline } from "./homeFigures";
import { teamRosterFromCore } from "./teamFigures";
import type { AdminOverviewStats } from "./types";

/**
 * Every function here stands in for a real HTTP call. Swap the body for a
 * `fetch("/api/...")` once the backend exists — callers (React Query hooks)
 * don't need to change.
 */
const NETWORK_DELAY_MS = 350;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), NETWORK_DELAY_MS));
}

// ---- Employee ----

/** The signed-in employee's record id (the demo record when the account has none). */
const myEmployeeId = () => sessionWho().employeeId ?? currentEmployee.id;

export function fetchCurrentEmployee() {
  return delay({ ...currentEmployee, faceEnrolled: isFaceEnrolled(myEmployeeId()) });
}

export function fetchLeaveBalances() {
  return delay(leaveBalances);
}

export function fetchPayslips() {
  return delay(payslips);
}

export function fetchAnnouncements() {
  const denied = deny("announcements", "view");
  if (denied) return denied;
  return delay(announcements);
}

export function fetchEmployeeDtrSummary() {
  return delay(employeeDtrSummary);
}

export function fetchEmployeeThirteenthMonth() {
  return delay(employeeThirteenthMonth);
}

export function fetchEmployeeBenefits() {
  return delay(employeeBenefits);
}

export async function confirmBenefitEnrollment(id: string) {
  const denied = deny("selfService", "create");
  if (denied) return denied;
  const next = employeeBenefits.map((b) => (b.id === id ? { ...b, status: "Active" as const } : b));
  setEmployeeBenefits(next);
  return delay(next.find((b) => b.id === id)!);
}

export interface AddBenefitInput {
  name: string;
  provider: string;
  memberId: string;
}

export async function addEmployeeBenefit(input: AddBenefitInput): Promise<EmployeeBenefit> {
  const denied = deny("selfService", "create");
  if (denied) return denied;
  const benefit: EmployeeBenefit = { id: `b-${Date.now()}`, status: "Pending", ...input };
  setEmployeeBenefits([benefit, ...employeeBenefits]);
  return delay(benefit);
}

export async function removeEmployeeBenefit(id: string): Promise<void> {
  const denied = deny("selfService", "create");
  if (denied) return denied;
  setEmployeeBenefits(employeeBenefits.filter((b) => b.id !== id));
  return delay(undefined);
}

export function fetchMyDtrLog() {
  return delay(myDtrLog);
}

export interface UpdateProfileInput {
  email: string;
  phone: string;
  emergencyContact: string;
}

export async function updateEmployeeProfile(input: UpdateProfileInput): Promise<Employee> {
  const next = { ...currentEmployee, ...input };
  setCurrentEmployee(next);
  return delay(next);
}

export async function enrollFaceId(): Promise<Employee> {
  markFaceEnrolled(myEmployeeId());
  return delay({ ...currentEmployee, faceEnrolled: true });
}

export function fetchMyAssets() {
  return delay(companyAssets.filter((a) => a.assignedToName === currentEmployee.name));
}

export function fetchMyTrainingRecords() {
  return delay(trainingRecords.filter((t) => t.employeeName === currentEmployee.name));
}

export function fetchMyProfessionalLicense() {
  return delay(professionalLicenses.find((l) => l.employeeId === currentEmployee.id) ?? null);
}

export function fetchProfessionalLicenses() {
  return delay(professionalLicenses);
}

export async function updateCpdUnits(id: string, cpdUnitsEarned: number) {
  const next = professionalLicenses.map((l) => (l.id === id ? { ...l, cpdUnitsEarned } : l));
  setProfessionalLicenses(next);
  return delay(next.find((l) => l.id === id)!);
}

// --- 201 File: HR/manager-side (full detail) ---

export function fetchPersonnelProfile(employeeId: string) {
  const denied = deny("people", "view", employeeId);
  if (denied) return denied;
  return delay(personnelProfiles.find((p) => p.employeeId === employeeId) ?? null);
}

export function fetchAllPersonnelProfiles() {
  const denied = deny("people", "view");
  if (denied) return denied;
  return delay(personnelProfiles);
}

export function fetchMyPhoto() {
  return delay(personnelProfiles.find((p) => p.employeeId === currentEmployee.id)?.photoDataUrl ?? null);
}

export async function updateMyPhoto(photoDataUrl: string) {
  return updatePersonnelProfile(currentEmployee.id, { photoDataUrl });
}

export async function updatePersonnelProfile(
  employeeId: string,
  input: UpdatePersonnelProfileInput,
  actor?: AuditActor,
) {
  const denied = deny("people", "edit", employeeId);
  if (denied) return denied;
  const existing = personnelProfiles.find((p) => p.employeeId === employeeId);
  const next: PersonnelProfile = { employeeId, dependents: [], ...existing, ...input };
  setPersonnelProfiles([...personnelProfiles.filter((p) => p.employeeId !== employeeId), next]);
  if (actor) logPersonnelAccess(employeeId, actor, "Edited", "Personal profile");
  return delay(next);
}

export function fetchPersonnelDocuments(employeeId: string) {
  const denied = deny("documents", "view", employeeId);
  if (denied) return denied;
  return delay(personnelDocuments.filter((d) => d.employeeId === employeeId));
}

export function fetchAllPersonnelDocuments() {
  const denied = deny("documents", "view");
  if (denied) return denied;
  return delay(personnelDocuments);
}

export interface UpdatePersonnelProfileInput {
  photoDataUrl?: string;
  birthDate?: string;
  civilStatus?: CivilStatus;
  dependents?: Dependent[];
}

export interface UpdatePersonnelDocumentInput {
  status?: PersonnelDocumentStatus;
  idType?: string;
  idNumber?: string;
  idExpiry?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
}

export async function updatePersonnelDocument(id: string, input: UpdatePersonnelDocumentInput, actor?: AuditActor) {
  const denied = deny("documents", "edit");
  if (denied) return denied;
  const next = personnelDocuments.map((d) => (d.id === id ? { ...d, ...input } : d));
  const updated = next.find((d) => d.id === id)!;
  setPersonnelDocuments(next);
  if (input.status === "Verified") tellEmployees(updated.employeeId, "documents", "approved", `Your ${updated.type} was checked`, "HR verified it against the original. Nothing else to do.");
  if (actor) {
    logPersonnelAccess(
      updated.employeeId,
      actor,
      input.status === "Verified" ? "Verified" : "Edited",
      updated.type,
      input.status === "Verified" ? undefined : "Details updated",
    );
  }
  return delay(updated);
}

/** HR/manager reset — clears a document back to Missing, including its file
 * and any structured fields (ID/license number, expiry). Used when a document
 * or the details on it were wrong and need a clean re-submission. */
export async function removePersonnelDocument(id: string, actor?: AuditActor) {
  const denied = deny("documents", "delete");
  if (denied) return denied;
  const target = personnelDocuments.find((d) => d.id === id);
  const next = personnelDocuments.map((d) =>
    d.id === id
      ? {
          id: d.id,
          employeeId: d.employeeId,
          type: d.type,
          status: "Missing" as const,
        }
      : d,
  );
  setPersonnelDocuments(next);
  if (target) tellEmployees(target.employeeId, "documents", "rejected", `Your ${target.type} was sent back`, "HR asked for it again. Upload a new one from your 201 file.");
  if (actor && target) logPersonnelAccess(target.employeeId, actor, "Removed", target.type, "Reset to Missing");
  return delay(next.find((d) => d.id === id)!);
}

// --- Audit log ---

export interface AuditActor {
  name: string;
  role: "manager" | "admin";
}

export function logPersonnelAccess(
  employeeId: string,
  actor: AuditActor,
  action: AuditLogEntry["action"],
  target: string,
  detail?: string,
) {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    employeeId,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    target,
    detail,
    timestamp: new Date().toISOString(),
  };
  setAuditLogEntries([entry, ...auditLogEntries]);
}

export function logPersonnelView(employeeId: string, actor: AuditActor, target = "201 File") {
  logPersonnelAccess(employeeId, actor, "Viewed", target);
}

export function fetchAuditLog(employeeId: string) {
  const denied = deny("people", "view", employeeId);
  if (denied) return denied;
  return delay(
    auditLogEntries
      .filter((e) => e.employeeId === employeeId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  );
}

// --- 201 File: employee-side (checklist only, no sensitive fields) ---

function toChecklistItem(doc: PersonnelDocument): PersonnelDocumentChecklistItem {
  const [expiry] = getExpiringPersonnelFields(doc);
  return { id: doc.id, type: doc.type, status: doc.status, uploadedOn: doc.uploadedOn, ...(expiry ? { expiry: { status: expiry.status, note: expiry.note } } : {}) };
}

export function fetchMyPersonnelChecklist() {
  return delay(
    personnelDocuments.filter((d) => d.employeeId === currentEmployee.id).map(toChecklistItem),
  );
}

export async function uploadMyPersonnelDocument(id: string, fileName: string) {
  const next = personnelDocuments.map((d) =>
    d.id === id && d.employeeId === currentEmployee.id
      ? { ...d, status: "Submitted" as const, fileName, uploadedOn: new Date().toISOString().slice(0, 10) }
      : d,
  );
  setPersonnelDocuments(next);
  const uploaded = next.find((d) => d.id === id)!;
  tellAssigned("edit", "documents", "documents", "request", `${currentEmployee.name} uploaded their ${uploaded.type}`, "Check it against the original on the 201 documents page.");
  return delay(toChecklistItem(uploaded));
}

/** Employee undoing their own submission — only allowed before HR verifies
 * it (once Verified, only HR/manager can reset it, via removePersonnelDocument). */
export async function removeMyPersonnelDocument(id: string) {
  const next = personnelDocuments.map((d) =>
    d.id === id && d.employeeId === currentEmployee.id && d.status === "Submitted"
      ? { id: d.id, employeeId: d.employeeId, type: d.type, status: "Missing" as const }
      : d,
  );
  setPersonnelDocuments(next);
  return delay(toChecklistItem(next.find((d) => d.id === id)!));
}

export function fetchCertificateRequests() {
  return delay(certificateRequests);
}

export interface CreateCertificateRequestInput {
  type: string;
  purpose: string;
}

export async function createCertificateRequest(
  input: CreateCertificateRequestInput,
): Promise<CertificateRequest> {
  const request: CertificateRequest = {
    id: `cr-${Date.now()}`,
    type: input.type,
    purpose: input.purpose,
    status: "Pending",
    requestedOn: new Date().toISOString().slice(0, 10),
    employeeId: currentEmployee.id,
    employeeName: currentEmployee.name,
  };
  setCertificateRequests([request, ...certificateRequests]);
  tellAssigned("edit", "selfService", "certificate", "request", `${currentEmployee.name} requested a ${input.type}`, `${input.purpose ? `For: ${input.purpose}. ` : ""}Prepare it and mark it ready for pickup under Requests › Certificates.`);
  return delay(request);
}

export interface CreateLeaveRequestInput {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
}

export async function createLeaveRequest(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
  const employee = currentEmployee;
  const sameDay = input.startDate === input.endDate;
  const detail = sameDay
    ? `${formatDate(input.startDate)} · 1 day`
    : `${formatDate(input.startDate)}–${formatDate(input.endDate)}`;

  const request: LeaveRequest = {
    id: `lr-${Date.now()}`,
    employeeName: employee.name,
    employeeInitials: employee.initials,
    employeeRole: employee.position,
    type: input.type,
    detail,
    status: "Pending",
    requestedOn: new Date().toISOString().slice(0, 10),
  };

  setLeaveRequests([request, ...leaveRequests]);
  return delay(request);
}

export function fetchMyLeaveRequests() {
  return delay(leaveRequests.filter((r) => r.employeeName === currentEmployee.name));
}

export async function cancelLeaveRequest(id: string): Promise<void> {
  setLeaveRequests(
    leaveRequests.filter((r) => !(r.id === id && r.employeeName === currentEmployee.name && r.status === "Pending")),
  );
  return delay(undefined);
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// ---- Manager ----

export function fetchApprovalsQueue() {
  const denied = deny("partnerTools", "view");
  if (denied) return denied;
  return delay(leaveRequests.filter((r) => r.status === "Pending"));
}

export async function updateApprovalStatus(id: string, status: "Approved" | "Declined") {
  const denied = deny("partnerTools", "edit");
  if (denied) return denied;
  const next = leaveRequests.map((r) => (r.id === id ? { ...r, status } : r));
  setLeaveRequests(next);
  return delay(next.find((r) => r.id === id)!);
}

export function fetchOnLeaveToday() {
  const denied = deny("partnerTools", "view");
  if (denied) return denied;
  return delay(onLeaveToday);
}

export function fetchApprovedLeaveSchedule() {
  const denied = deny("partnerTools", "view");
  if (denied) return denied;
  return delay(leaveRequests.filter((r) => r.status === "Approved"));
}

export function fetchAttendanceTrend() {
  const denied = deny("partnerTools", "view");
  if (denied) return denied;
  return delay(attendanceTrend);
}

export function fetchWorkforceAlerts() {
  const denied = deny("partnerTools", "view");
  if (denied) return denied;
  return delay(workforceAlerts);
}

export function fetchTeamRoster() {
  const denied = deny("partnerTools", "view");
  if (denied) return denied;
  // The signed-in manager's direct reports, from Core HR.
  return delay(teamRosterFromCore());
}

export function fetchPerformanceReviewStatuses() {
  const denied = deny("partnerTools", "view");
  if (denied) return denied;
  return delay(performanceReviewStatuses);
}

export async function updatePerformanceReviewStatus(employeeId: string, status: "Submitted" | "Pending") {
  const denied = deny("partnerTools", "edit");
  if (denied) return denied;
  const next = { ...performanceReviewStatuses, [employeeId]: status };
  setPerformanceReviewStatuses(next);
  return delay(next);
}

export function fetchTeamTrainingRecords() {
  const denied = deny("trainings", "view");
  if (denied) return denied;
  const teamNames = new Set(teamRosterFromCore().map((m) => m.name));
  return delay(trainingRecords.filter((t) => teamNames.has(t.employeeName)));
}

/** An employee moving their own training forward (started, completed); never back, never someone else's. */
export async function updateMyTrainingStatus(id: string, status: Exclude<TrainingStatus, "Not started">) {
  const t = trainingRecords.find((x) => x.id === id && x.employeeName === currentEmployee.name);
  if (!t) return Promise.reject(new Error("That training isn't assigned to you"));
  if (t.status === "Completed") return delay(t);
  const next = trainingRecords.map((x) => (x.id === id ? { ...x, status } : x));
  setTrainingRecords(next);
  return delay(next.find((x) => x.id === id)!);
}

export async function updateTrainingStatus(id: string, status: TrainingStatus) {
  const denied = deny("trainings", "edit");
  if (denied) return denied;
  const next = trainingRecords.map((t) => (t.id === id ? { ...t, status } : t));
  setTrainingRecords(next);
  return delay(next.find((t) => t.id === id)!);
}

export function fetchEmployeeCases() {
  const denied = deny("partnerTools", "view");
  if (denied) return denied;
  return delay(employeeCases);
}

export interface CreateCaseInput {
  employeeName: string;
  employeeInitials: string;
  type: CaseType;
  summary: string;
  filedBy: string;
}

export async function createEmployeeCase(input: CreateCaseInput): Promise<EmployeeCase> {
  const denied = deny("partnerTools", "create");
  if (denied) return denied;
  const record: EmployeeCase = {
    id: `case-${Date.now()}`,
    employeeName: input.employeeName,
    employeeInitials: input.employeeInitials,
    type: input.type,
    filedBy: input.filedBy,
    status: "Open",
    filedOn: new Date().toISOString().slice(0, 10),
    summary: input.summary,
  };
  setEmployeeCases([record, ...employeeCases]);
  return delay(record);
}

export async function updateCaseStatus(id: string, status: CaseStatus) {
  const denied = deny("partnerTools", "edit");
  if (denied) return denied;
  const next = employeeCases.map((c) => (c.id === id ? { ...c, status } : c));
  setEmployeeCases(next);
  return delay(next.find((c) => c.id === id)!);
}

export interface UpdateCaseDetailsInput {
  type: CaseType;
  summary: string;
}

export async function updateCaseDetails(id: string, input: UpdateCaseDetailsInput) {
  const denied = deny("partnerTools", "edit");
  if (denied) return denied;
  const next = employeeCases.map((c) => (c.id === id ? { ...c, ...input } : c));
  setEmployeeCases(next);
  return delay(next.find((c) => c.id === id)!);
}

export async function deleteEmployeeCase(id: string): Promise<void> {
  const denied = deny("partnerTools", "delete");
  if (denied) return denied;
  setEmployeeCases(employeeCases.filter((c) => c.id !== id));
  return delay(undefined);
}

// ---- HR Admin ----

export function fetchAdminOverviewStats(): Promise<AdminOverviewStats> {
  const denied = deny("dashboard", "view");
  if (denied) return denied;
  // Worked out from the real records (lib/homeFigures.ts).
  const s = homeStats();
  const label = new Date().toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  return delay({ ...s, payrollRunTotal: s.monthlySalaries, payrollCutoffLabel: label });
}

export function fetchPayrollRunSteps() {
  const denied = deny("dashboard", "view");
  if (denied) return denied;
  return delay(payrollRunSteps);
}

export function fetchHeadcountByOffice() {
  const denied = deny("dashboard", "view");
  if (denied) return denied;
  return delay(headcountByOffice());
}

export function fetchPayrollCostBreakdown() {
  const denied = deny("dashboard", "view");
  if (denied) return denied;
  return delay(payrollCostBreakdown);
}

export function fetchComplianceCalendar() {
  const denied = deny("dashboard", "view");
  if (denied) return denied;
  // This month's deadlines are added once; the old sample filings (c-1…c-5) give way to them.
  const defaults = defaultComplianceCalendar();
  const kept = complianceCalendar.filter((c) => !/^c-[0-9]$/.test(c.id));
  const missing = defaults.filter((d) => !kept.some((c) => c.id === d.id));
  if (missing.length || kept.length !== complianceCalendar.length) setComplianceCalendar([...kept, ...missing]);
  return delay(complianceCalendar);
}

export function fetchEmployeeDirectory() {
  const denied = deny("people", "view");
  if (denied) return denied;
  return delay(employeeDirectory);
}

export interface CreateEmployeeInput {
  lastName: string;
  firstName: string;
  middleName?: string;
  suffix?: string;
  birthDate?: string;
  email?: string;
  phone?: string;
  position: string;
  department: string;
  office: Employee["office"];
  cluster: Employee["cluster"];
  /** Scanned or typed ID details — becomes the new hire's "Valid Government ID" 201 document. */
  governmentId?: { idType: string; idNumber?: string; idExpiry?: string; fileName?: string };
}

/** "Juan P. Dela Cruz Jr." — how names read across the directory. */
export function formatEmployeeName(
  input: Pick<CreateEmployeeInput, "firstName" | "middleName" | "lastName" | "suffix">,
) {
  const middleInitial = input.middleName?.trim() ? `${input.middleName.trim()[0]!.toUpperCase()}.` : "";
  return [input.firstName, middleInitial, input.lastName, input.suffix]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  const denied = deny("people", "create");
  if (denied) return denied;
  try {
    assertSeatsAvailable(1);
  } catch (err) {
    return Promise.reject(err);
  }
  const name = formatEmployeeName(input);
  const employee: Employee = {
    id: `MSMA-${Math.floor(10_000 + Math.random() * 89_999)}`,
    name,
    initials: initialsFor(`${input.firstName} ${input.lastName}`),
    position: input.position,
    department: input.department,
    office: input.office,
    cluster: input.cluster,
    status: "Active",
    email: input.email || undefined,
    phone: input.phone || undefined,
  };

  setEmployeeDirectory([employee, ...employeeDirectory]);
  setPersonnelProfiles([
    ...personnelProfiles,
    { employeeId: employee.id, dependents: [], birthDate: input.birthDate || undefined },
  ]);
  setPersonnelDocuments([...personnelDocuments, ...buildNewHireDocuments(employee.id, input.governmentId)]);
  return delay(employee);
}

export interface RegisterEmployeeInput {
  name: string;
  position: string;
  office: Employee["office"];
  cluster: Employee["cluster"];
}

export async function registerEmployee(input: RegisterEmployeeInput): Promise<Employee> {
  // No sign-in here (self-registration), but it still takes a seat.
  try {
    assertSeatsAvailable(1);
  } catch (err) {
    return Promise.reject(err);
  }
  const employee: Employee = {
    id: `MSMA-${Math.floor(10_000 + Math.random() * 89_999)}`,
    name: input.name,
    initials: initialsFor(input.name),
    position: input.position,
    department: input.cluster,
    office: input.office,
    cluster: input.cluster,
    status: "Active",
    reportsToId: "admin",
  };

  setEmployeeDirectory([employee, ...employeeDirectory]);
  return delay(employee);
}

export function fetchOnboardingPipeline() {
  const denied = deny("dashboard", "view");
  if (denied) return denied;
  return delay(newHirePipeline());
}

export function fetchJobRequisitions() {
  const denied = deny("dashboard", "view");
  if (denied) return denied;
  return delay(jobRequisitions);
}

export function fetchOrgChart() {
  const denied = deny("orgChart", "view");
  if (denied) return denied;
  const root = { id: "admin", name: currentAdmin.name, initials: currentAdmin.initials, title: currentAdmin.title };
  return delay({ root, employees: employeeDirectory });
}

export function fetchOffboardingCases() {
  const denied = deny("people", "view");
  if (denied) return denied;
  return delay(offboardingCases);
}

export interface CreateOffboardingInput {
  employeeName: string;
  employeeInitials: string;
  department: string;
  lastDay: string;
  stage: OffboardingStage;
}

export async function createOffboardingCase(input: CreateOffboardingInput): Promise<OffboardingCase> {
  const denied = deny("people", "create");
  if (denied) return denied;
  const record: OffboardingCase = { id: `off-${Date.now()}`, ...input };
  setOffboardingCases([record, ...offboardingCases]);
  return delay(record);
}

export async function updateOffboardingCase(
  id: string,
  input: CreateOffboardingInput,
): Promise<OffboardingCase> {
  const denied = deny("people", "edit");
  if (denied) return denied;
  const updated: OffboardingCase = { id, ...input };
  setOffboardingCases(offboardingCases.map((c) => (c.id === id ? updated : c)));
  return delay(updated);
}

export async function deleteOffboardingCase(id: string): Promise<void> {
  const denied = deny("people", "delete");
  if (denied) return denied;
  setOffboardingCases(offboardingCases.filter((c) => c.id !== id));
  return delay(undefined);
}

export function fetchCompanyAssets() {
  const denied = deny("people", "view");
  if (denied) return denied;
  return delay(companyAssets);
}

export interface CreateAssetInput {
  type: string;
  assetTag: string;
  assignedToName: string;
  assignedToInitials: string;
}

export async function createCompanyAsset(input: CreateAssetInput): Promise<CompanyAsset> {
  const denied = deny("people", "create");
  if (denied) return denied;
  const asset: CompanyAsset = {
    id: `as-${Date.now()}`,
    type: input.type,
    assetTag: input.assetTag,
    assignedToName: input.assignedToName,
    assignedToInitials: input.assignedToInitials,
    issuedOn: new Date().toISOString().slice(0, 10),
    status: "Issued",
  };
  setCompanyAssets([asset, ...companyAssets]);
  return delay(asset);
}

export interface UpdateAssetInput {
  type: string;
  assetTag: string;
  assignedToName: string;
  assignedToInitials: string;
  status: CompanyAsset["status"];
}

export async function updateCompanyAsset(id: string, input: UpdateAssetInput): Promise<CompanyAsset> {
  const denied = deny("people", "edit");
  if (denied) return denied;
  const existing = companyAssets.find((a) => a.id === id);
  const updated: CompanyAsset = { ...existing!, ...input };
  setCompanyAssets(companyAssets.map((a) => (a.id === id ? updated : a)));
  return delay(updated);
}

export async function deleteCompanyAsset(id: string): Promise<void> {
  const denied = deny("people", "delete");
  if (denied) return denied;
  setCompanyAssets(companyAssets.filter((a) => a.id !== id));
  return delay(undefined);
}

export function fetchAllTrainingRecords() {
  const denied = deny("trainings", "view");
  if (denied) return denied;
  return delay(trainingRecords);
}

export interface CreateTrainingRecordInput {
  employeeName: string;
  employeeInitials: string;
  course: string;
  dueDate: string;
}

export async function createTrainingRecord(input: CreateTrainingRecordInput): Promise<TrainingRecord> {
  const denied = deny("trainings", "create");
  if (denied) return denied;
  const record: TrainingRecord = { id: `tr-${Date.now()}`, status: "Not started", ...input };
  setTrainingRecords([record, ...trainingRecords]);
  return delay(record);
}

export async function deleteTrainingRecord(id: string): Promise<void> {
  const denied = deny("trainings", "delete");
  if (denied) return denied;
  setTrainingRecords(trainingRecords.filter((t) => t.id !== id));
  return delay(undefined);
}

export function fetchCertificateRequestsForReview() {
  const denied = deny("selfService", "edit");
  if (denied) return denied;
  return delay(certificateRequests);
}

const certificateStatusOrder: CertificateRequestStatus[] = ["Pending", "Ready for pickup", "Released"];

function handleCertificate(id: string, from: CertificateRequestStatus[], change: Partial<CertificateRequest>, actor: string) {
  const target = certificateRequests.find((r) => r.id === id);
  if (!target) return { error: "That request no longer exists" } as const;
  if (!from.includes(target.status)) return { error: `This request is already ${target.status.toLowerCase()}` } as const;
  const updated: CertificateRequest = { ...target, ...change, handledBy: actor, handledAt: new Date().toISOString() };
  setCertificateRequests(certificateRequests.map((r) => (r.id === id ? updated : r)));
  return { updated } as const;
}

/** HR sends the certificate as a digital copy: released at once, the employee downloads or prints it. */
export async function issueCertificate(id: string, actor: string): Promise<CertificateRequest> {
  const denied = deny("selfService", "edit");
  if (denied) return denied;
  const target = certificateRequests.find((x) => x.id === id);
  const person = employeeDirectory.find((e) => e.id === target?.employeeId);
  if (target && !person) return Promise.reject(new Error("This request isn't linked to an employee record, so a certificate can't be made. Prepare a signed copy for pickup instead."));
  const r = handleCertificate(id, ["Pending", "Ready for pickup"], { status: "Released", delivery: "digital", ...(target && person ? { issued: target.issued ?? fileCertificate(person, target, certificateRequests, actor) } : {}) }, actor);
  if ("error" in r) return Promise.reject(new Error(r.error));
  if (r.updated.employeeId) tellEmployees(r.updated.employeeId, "certificate", "approved", `Your ${r.updated.type} is ready`, `${actor} sent it (No. ${r.updated.issued?.number}). Download or print it from Certificates.`);
  return delay(r.updated);
}

/** HR prepares a signed paper copy for the employee to collect. */
export async function markCertificateReady(id: string, actor: string): Promise<CertificateRequest> {
  const denied = deny("selfService", "edit");
  if (denied) return denied;
  const r = handleCertificate(id, ["Pending"], { status: "Ready for pickup", delivery: "pickup" }, actor);
  if ("error" in r) return Promise.reject(new Error(r.error));
  if (r.updated.employeeId) tellEmployees(r.updated.employeeId, "certificate", "approved", `Your ${r.updated.type} is ready for pickup`, `${actor} prepared a signed copy. Pick it up from HR.`);
  return delay(r.updated);
}

/** The signed copy was handed over. */
export async function markCertificateReleased(id: string, actor: string): Promise<CertificateRequest> {
  const denied = deny("selfService", "edit");
  if (denied) return denied;
  const target = certificateRequests.find((x) => x.id === id);
  const person = employeeDirectory.find((e) => e.id === target?.employeeId);
  const r = handleCertificate(id, ["Ready for pickup"], { status: "Released", ...(target && person && !target.issued ? { issued: fileCertificate(person, target, certificateRequests, actor) } : {}) }, actor);
  if ("error" in r) return Promise.reject(new Error(r.error));
  if (r.updated.employeeId) tellEmployees(r.updated.employeeId, "certificate", "update", `You received your ${r.updated.type}`, `Released by ${actor}. A digital copy is on your Certificates page too.`);
  return delay(r.updated);
}

/** HR can't issue it; the employee is told why. */
export async function declineCertificate(id: string, reason: string, actor: string): Promise<CertificateRequest> {
  const denied = deny("selfService", "edit");
  if (denied) return denied;
  if (!reason.trim()) return Promise.reject(new Error("Say why, so the employee knows"));
  const r = handleCertificate(id, ["Pending"], { status: "Declined", note: reason.trim() }, actor);
  if ("error" in r) return Promise.reject(new Error(r.error));
  if (r.updated.employeeId) tellEmployees(r.updated.employeeId, "certificate", "rejected", `Your ${r.updated.type} request was declined`, `${actor}: “${reason.trim()}”`);
  return delay(r.updated);
}

export function nextCertificateStatus(status: CertificateRequestStatus): CertificateRequestStatus | null {
  const idx = certificateStatusOrder.indexOf(status);
  return idx < certificateStatusOrder.length - 1 ? certificateStatusOrder[idx + 1] : null;
}

/** Older one-step flow (Pending → Ready for pickup → Released); the Certificates page uses issue / ready / released / decline. */
export async function advanceCertificateRequest(id: string, actor = "HR") {
  const denied = deny("selfService", "edit");
  if (denied) return denied;
  const target = certificateRequests.find((r) => r.id === id);
  const nextStatus = target ? nextCertificateStatus(target.status) : null;
  if (!target || !nextStatus) return delay(target!);
  const next = certificateRequests.map((r) => (r.id === id ? { ...r, status: nextStatus, handledBy: actor, handledAt: new Date().toISOString() } : r));
  setCertificateRequests(next);
  if (target.employeeId) {
    if (nextStatus === "Ready for pickup") tellEmployees(target.employeeId, "certificate", "approved", `Your ${target.type} is ready for pickup`, `${actor} prepared it. Pick it up from HR.`);
    else tellEmployees(target.employeeId, "certificate", "update", `Your ${target.type} was released`, `Released by ${actor}.`);
  }
  return delay(next.find((r) => r.id === id)!);
}

export interface UpdateCertificateRequestInput {
  type: string;
  purpose: string;
}

export async function updateCertificateRequest(id: string, input: UpdateCertificateRequestInput) {
  const denied = deny("selfService", "edit");
  if (denied) return denied;
  const next = certificateRequests.map((r) => (r.id === id ? { ...r, ...input } : r));
  setCertificateRequests(next);
  return delay(next.find((r) => r.id === id)!);
}

export async function deleteCertificateRequest(id: string): Promise<void> {
  const denied = deny("selfService", "delete");
  if (denied) return denied;
  setCertificateRequests(certificateRequests.filter((r) => r.id !== id));
  return delay(undefined);
}

export async function cancelCertificateRequest(id: string): Promise<void> {
  setCertificateRequests(
    certificateRequests.filter((r) => !(r.id === id && r.status === "Pending")),
  );
  return delay(undefined);
}

export async function updateComplianceStatus(id: string, status: ComplianceItem["status"]) {
  const denied = deny("payrollReports", "edit");
  if (denied) return denied;
  const next = complianceCalendar.map((c) => (c.id === id ? { ...c, status, note: undefined } : c));
  setComplianceCalendar(next);
  return delay(next.find((c) => c.id === id)!);
}

export interface ComplianceItemInput {
  filing: string;
  agency: ComplianceItem["agency"];
  due: string;
}

export async function createComplianceItem(input: ComplianceItemInput): Promise<ComplianceItem> {
  const denied = deny("payrollReports", "create");
  if (denied) return denied;
  const item: ComplianceItem = { id: `c-${Date.now()}`, status: "Due soon", ...input };
  setComplianceCalendar([item, ...complianceCalendar]);
  return delay(item);
}

export async function updateComplianceItem(id: string, input: ComplianceItemInput) {
  const denied = deny("payrollReports", "edit");
  if (denied) return denied;
  const next = complianceCalendar.map((c) => (c.id === id ? { ...c, ...input } : c));
  setComplianceCalendar(next);
  return delay(next.find((c) => c.id === id)!);
}

export async function deleteComplianceItem(id: string): Promise<void> {
  const denied = deny("payrollReports", "delete");
  if (denied) return denied;
  setComplianceCalendar(complianceCalendar.filter((c) => c.id !== id));
  return delay(undefined);
}

export interface CreateAnnouncementInput {
  title: string;
}

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
  const denied = deny("announcements", "create");
  if (denied) return denied;
  const announcement: Announcement = {
    id: `an-${Date.now()}`,
    title: input.title,
    postedOn: `Posted ${new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`,
  };
  setAnnouncements([announcement, ...announcements]);
  return delay(announcement);
}

// ---- Partner: attendance approvals ----

export function fetchAttendanceRequests() {
  const denied = deny("attendanceRecords", "view");
  if (denied) return denied;
  return delay(attendanceRequests);
}

export async function updateAttendanceRequestStatus(
  id: string,
  status: Exclude<AttendanceRequestStatus, "Pending">,
): Promise<AttendanceRequest> {
  const denied = deny("attendanceRecords", "approve");
  if (denied) return denied;
  const next = attendanceRequests.map((r) => (r.id === id ? { ...r, status } : r));
  setAttendanceRequests(next);
  return delay(next.find((r) => r.id === id)!);
}

// ---- Partner: settings ----

export function fetchManagerProfile() {
  return delay(currentManager);
}

export type UpdateManagerProfileInput = Omit<PartnerProfile, "initials">;

export async function updateManagerProfile(input: UpdateManagerProfileInput): Promise<PartnerProfile> {
  const updated: PartnerProfile = { ...input, initials: initialsFor(input.name) };
  setCurrentManager(updated);
  return delay(updated);
}

// ---- HR: settings ----

export function fetchAdminProfile() {
  return delay(currentAdmin);
}

export type UpdateAdminProfileInput = Omit<AdminProfile, "initials">;

export async function updateAdminProfile(input: UpdateAdminProfileInput): Promise<AdminProfile> {
  const updated: AdminProfile = { ...input, initials: initialsFor(input.name) };
  setCurrentAdmin(updated);
  return delay(updated);
}

export interface ChangeCredentialsInput {
  currentPassword: string;
  username: string;
  newPassword?: string;
}

// Rejects (like a real auth endpoint would) when the current password is
// wrong or the username is already used by another account.
export async function changeAdminCredentials(input: ChangeCredentialsInput): Promise<{ username: string }> {
  const denied = deny("systemSettings", "edit");
  if (denied) return denied;
  const current = getCredential("hr");
  const username = input.username.trim().toLowerCase();
  await delay(null);
  if (input.currentPassword !== current.password) throw new Error("Your current password is incorrect.");
  if (getCredentials().some((c) => c.key !== "hr" && c.username === username)) {
    throw new Error(`The username "${username}" is already taken.`);
  }
  setCredential("hr", username, input.newPassword || current.password);
  return { username };
}

// ---- Partner: company payroll ----

export interface PayrollRegisterRow {
  employee: Employee;
  entry: PayrollEntry;
}

// New hires added through the directory have no pay record yet; seed one
// so they still show up on the register for the Partner to fill in.
function defaultPayrollEntry(employeeId: string): PayrollEntry {
  return { employeeId, monthlyBasic: 25000, allowance: 0, overtimeHours: 0, otherDeductions: 0, status: "Draft" };
}

function entryFor(employeeId: string) {
  return payrollEntries.find((e) => e.employeeId === employeeId) ?? defaultPayrollEntry(employeeId);
}

function upsertPayrollEntries(updated: PayrollEntry[]) {
  const byId = new Map(payrollEntries.map((e) => [e.employeeId, e]));
  for (const entry of updated) byId.set(entry.employeeId, entry);
  setPayrollEntries([...byId.values()]);
}

export function fetchPayrollCutoff() {
  const denied = deny("payrollRuns", "view");
  if (denied) return denied;
  return delay(payrollCutoff);
}

export function fetchPayrollRegister(): Promise<PayrollRegisterRow[]> {
  const denied = deny("payrollRuns", "view");
  if (denied) return denied;
  return delay(employeeDirectory.map((employee) => ({ employee, entry: entryFor(employee.id) })));
}

export type UpdatePayrollEntryInput = Pick<
  PayrollEntry,
  "monthlyBasic" | "allowance" | "overtimeHours" | "otherDeductions"
>;

/** Editing a figure sends the entry back to Draft so it has to be re-approved. */
export async function updatePayrollEntry(employeeId: string, input: UpdatePayrollEntryInput): Promise<PayrollEntry> {
  const denied = deny("payrollRuns", "edit");
  if (denied) return denied;
  const existing = entryFor(employeeId);
  if (existing.status === "Released") throw new Error("Released payroll can no longer be edited.");
  const updated: PayrollEntry = { ...existing, ...input, status: "Draft" };
  upsertPayrollEntries([updated]);
  return delay(updated);
}

export async function approvePayrollEntries(employeeIds: string[]): Promise<void> {
  const denied = deny("payrollRuns", "final");
  if (denied) return denied;
  const ids = new Set(employeeIds);
  upsertPayrollEntries(
    employeeDirectory
      .filter((e) => ids.has(e.id))
      .map((e) => entryFor(e.id))
      .filter((entry) => entry.status === "Draft")
      .map((entry) => ({ ...entry, status: "Approved" as const })),
  );
  return delay(undefined);
}

export async function revertPayrollEntry(employeeId: string): Promise<void> {
  const denied = deny("payrollRuns", "edit");
  if (denied) return denied;
  const existing = entryFor(employeeId);
  if (existing.status === "Approved") upsertPayrollEntries([{ ...existing, status: "Draft" }]);
  return delay(undefined);
}

/** Releases every approved entry and marks the matching employee payslip as paid. */
export async function releaseApprovedPayroll(): Promise<number> {
  const denied = deny("payrollRuns", "final");
  if (denied) return denied;
  const approved = employeeDirectory.map((e) => entryFor(e.id)).filter((entry) => entry.status === "Approved");
  upsertPayrollEntries(approved.map((entry) => ({ ...entry, status: "Released" as const })));
  if (approved.some((entry) => entry.employeeId === currentEmployee.id)) {
    setPayslips(payslips.map((p) => (p.id === payrollCutoff.payslipId ? { ...p, status: "Paid" } : p)));
  }
  return delay(approved.length);
}

// ---- Partner reports ----

export function fetchTeamReport(id: ReportId) {
  const denied = deny("analytics", "view");
  if (denied) return denied;
  return delay(teamReports[id]);
}

// ---- 201 File: government numbers, employment, during employment, separation ----

export function fetchEmployeeFileRecords(employeeId: string) {
  const denied = deny("people", "view", employeeId);
  if (denied) return denied;
  const employee = employeeDirectory.find((e) => e.id === employeeId);
  return delay(employee ? buildEmployeeFileRecords(employee) : null);
}

/** Date hired for every directory entry, keyed by employee ID — for the directory cards. */
export function fetchEmployeeHireDates() {
  const denied = deny("dashboard", "view");
  if (denied) return denied;
  return delay(
    Object.fromEntries(employeeDirectory.map((e) => [e.id, buildEmployeeFileRecords(e).employment.dateHired])) as Record<
      string,
      string
    >,
  );
}
