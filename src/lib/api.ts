import {
  adminOverviewStats,
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
  headcountByOffice,
  applicants,
  jobRequisitions,
  latesThisCutoff,
  leaveOverviewStats,
  leavePolicies,
  leaveBalances,
  leaveRequests,
  myDtrLog,
  offboardingCases,
  onLeaveToday,
  priorLeaveUsage,
  payrollCostBreakdown,
  payrollCutoff,
  payrollEntries,
  payrollReleasedAt,
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
  setApplicants,
  setEmployeeDirectory,
  setJobRequisitions,
  setOnboardingSubmissions,
  onboardingSubmissions,
  SITUATIONAL_DOCUMENT_TYPES,
  setLeaveRequests,
  setOffboardingCases,
  setPayrollEntries,
  setPayrollReleasedAt,
  setPayslips,
  setPerformanceReviewStatuses,
  setPersonnelDocuments,
  buildNewHireDocuments,
  setPersonnelProfiles,
  setProfessionalLicenses,
  setTrainingRecords,
  teamRoster,
  trainingRecords,
  workforceAlerts,
} from "./mockData";
import type {
  OnboardingSubmission,
  OnboardingSubmissionInput,
  Announcement,
  Applicant,
  ApplicantEducation,
  ApplicantProfession,
  ApplicantRole,
  ApplicantStage,
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
  EmploymentType,
  JobRequisition,
  LeaveRequest,
  LeaveType,
  OffboardingCase,
  OffboardingStage,
  AdminProfile,
  PartnerProfile,
  PayrollEntry,
  PersonnelDocument,
  PersonnelDocumentType,
  PersonnelDocumentChecklistItem,
  PersonnelDocumentStatus,
  PersonnelProfile,
  TrainingRecord,
  TrainingStatus,
} from "./types";
import { getCredential, getCredentials, setCredential } from "./credentials";
import { buildEmployeeFileRecords } from "./employmentRecords";
import { assignHireDateIds, isHireDateId, type IdCandidate } from "./employeeIds";
import { teamReports, type ReportId } from "./reportsData";
import { todayIso } from "./format";
import { normalizeConfig, type OnboardingFormConfig } from "./onboardingForm";
import { formatPhMobile } from "./govIds";

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

export function fetchCurrentEmployee() {
  return delay(currentEmployee);
}

export function fetchLeaveBalances() {
  return delay(leaveBalances);
}

export function fetchPayslips() {
  return delay(payslips);
}

export function fetchAnnouncements() {
  return delay(announcements);
}

export function fetchEmployeeDtrSummary() {
  return delay(employeeDtrSummary);
}

/** Months of basic pay earned so far this year, counting the current month. */
function monthsEarnedThisYear() {
  return Number(todayIso().slice(5, 7));
}

/** 13th-month pay accrued so far: basic salary earned this year ÷ 12 (BRD §5.9.5, to confirm). */
export function thirteenthMonthAccrued(monthlyBasic: number) {
  return Math.round(((monthlyBasic * monthsEarnedThisYear()) / 12) * 100) / 100;
}

export function fetchEmployeeThirteenthMonth() {
  // Read from the same payroll record HR sees, so both screens show one figure.
  const entry = entryFor(currentEmployee.id);
  return delay({ ...employeeThirteenthMonth, accrued: thirteenthMonthAccrued(entry.monthlyBasic) });
}

export function fetchEmployeeBenefits() {
  return delay(employeeBenefits);
}

export async function confirmBenefitEnrollment(id: string) {
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
  const benefit: EmployeeBenefit = { id: `b-${Date.now()}`, status: "Pending", ...input };
  setEmployeeBenefits([benefit, ...employeeBenefits]);
  return delay(benefit);
}

export async function removeEmployeeBenefit(id: string): Promise<void> {
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
  const next = { ...currentEmployee, faceEnrolled: true };
  setCurrentEmployee(next);
  return delay(next);
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
  return delay(personnelProfiles.find((p) => p.employeeId === employeeId) ?? null);
}

export function fetchAllPersonnelProfiles() {
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
  const existing = personnelProfiles.find((p) => p.employeeId === employeeId);
  const next: PersonnelProfile = { employeeId, dependents: [], ...existing, ...input };
  setPersonnelProfiles([...personnelProfiles.filter((p) => p.employeeId !== employeeId), next]);
  if (actor) logPersonnelAccess(employeeId, actor, "Edited", "Personal profile");
  return delay(next);
}

export function fetchPersonnelDocuments(employeeId: string) {
  return delay(personnelDocuments.filter((d) => d.employeeId === employeeId));
}

export function fetchAllPersonnelDocuments() {
  return delay(personnelDocuments);
}

export interface UpdatePersonnelProfileInput {
  photoDataUrl?: string;
  birthDate?: string;
  civilStatus?: CivilStatus;
  dependents?: Dependent[];
  bloodType?: string;
  address?: string;
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
  const next = personnelDocuments.map((d) => (d.id === id ? { ...d, ...input } : d));
  const updated = next.find((d) => d.id === id)!;
  setPersonnelDocuments(next);
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
  if (actor && target) logPersonnelAccess(target.employeeId, actor, "Removed", target.type, "Reset to Missing");
  return delay(next.find((d) => d.id === id)!);
}

// --- Audit log ---

export interface AuditActor {
  name: string;
  role: "manager" | "admin";
}

function logPersonnelAccess(
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
  return delay(
    auditLogEntries
      .filter((e) => e.employeeId === employeeId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  );
}

// --- 201 File: employee-side (checklist only, no sensitive fields) ---

function toChecklistItem(doc: PersonnelDocument): PersonnelDocumentChecklistItem {
  return { id: doc.id, type: doc.type, status: doc.status };
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
  return delay(toChecklistItem(next.find((d) => d.id === id)!));
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
  };
  setCertificateRequests([request, ...certificateRequests]);
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
  return delay(leaveRequests.filter((r) => r.status === "Pending" && !r.partnerApproved));
}

/** The Partner's decision. Approved leave and overtime move on to HR (Filed → Partner → HR);
 * certificate requests stop here. */
export async function updateApprovalStatus(id: string, status: "Approved" | "Declined") {
  const next = leaveRequests.map((r) => {
    if (r.id !== id) return r;
    if (status === "Approved" && r.type !== "Certificate of Employment") return { ...r, partnerApproved: true };
    return { ...r, status };
  });
  setLeaveRequests(next);
  return delay(next.find((r) => r.id === id)!);
}

// ---- HR leave ----

const LEAVE_TYPES: LeaveType[] = ["Vacation", "Sick", "Emergency", "Bereavement"];

function isLeaveType(type: LeaveRequest["type"]): type is LeaveType {
  return (LEAVE_TYPES as string[]).includes(type);
}

function leaveCredits(type: LeaveType) {
  return leavePolicies.find((p) => p.type === type)?.days ?? 0;
}

function creditsUsed(employeeName: string, type: LeaveType, status: LeaveRequest["status"]) {
  return leaveRequests
    .filter((r) => r.employeeName === employeeName && r.type === type && r.status === status)
    .reduce((sum, r) => sum + (r.days ?? 0), 0);
}

export interface LeaveBalanceSummary {
  credits: number;
  used: number;
  pending: number;
  available: number;
}

export function leaveBalanceFor(employeeName: string, type: LeaveType): LeaveBalanceSummary {
  const credits = leaveCredits(type);
  const used = (priorLeaveUsage[employeeName]?.[type] ?? 0) + creditsUsed(employeeName, type, "Approved");
  const pending = creditsUsed(employeeName, type, "Pending");
  return { credits, used, pending, available: credits - used - pending };
}

export function fetchLeaveBalanceFor(employeeName: string, type: LeaveType) {
  return delay(leaveBalanceFor(employeeName, type));
}

export interface LeaveApplication extends LeaveRequest {
  employeeId?: string;
  department?: string;
  office?: Employee["office"];
  /** Credits left once this request is approved, e.g. { left: 5.5, of: 15 }; null for overtime. */
  balanceAfter: { left: number; of: number } | null;
  /** Teammates (same department) off on overlapping days, e.g. "Angela Dela Cruz (Oct 6)". */
  teamOffSameDays: string[];
  latesThisCutoff: number;
  /** Days since it was filed. */
  waitingDays: number;
}

function overlapLabel(a: LeaveRequest, b: LeaveRequest) {
  const start = a.startDate! > b.startDate! ? a.startDate! : b.startDate!;
  const end = a.endDate! < b.endDate! ? a.endDate! : b.endDate!;
  return start === end ? formatDate(start) : `${formatDate(start)}–${formatDate(end)}`;
}

/** Every leave and overtime filing, with what HR needs to decide on it. */
export function fetchLeaveApplications() {
  const today = todayIso();
  const applications: LeaveApplication[] = leaveRequests
    .filter((r) => r.type !== "Certificate of Employment")
    .map((r) => {
      const employee = employeeDirectory.find((e) => e.name === r.employeeName);
      const teamOffSameDays = leaveRequests
        .filter(
          (o) =>
            o.id !== r.id &&
            o.employeeName !== r.employeeName &&
            (o.status === "Approved" || o.status === "Pending") &&
            isLeaveType(o.type) &&
            r.startDate &&
            o.startDate &&
            o.startDate <= r.endDate! &&
            o.endDate! >= r.startDate &&
            employeeDirectory.find((e) => e.name === o.employeeName)?.department === employee?.department,
        )
        .map((o) => `${o.employeeName} (${overlapLabel(r, o)})`);
      let balanceAfter: LeaveApplication["balanceAfter"] = null;
      if (isLeaveType(r.type)) {
        const balance = leaveBalanceFor(r.employeeName, r.type);
        // Pending and approved requests already count against the balance; returned and rejected ones don't.
        const counted = r.status === "Pending" || r.status === "Approved";
        balanceAfter = { left: counted ? balance.available : balance.available - (r.days ?? 0), of: balance.credits };
      }
      return {
        ...r,
        employeeId: employee?.id,
        department: employee?.department,
        office: employee?.office,
        balanceAfter,
        teamOffSameDays,
        latesThisCutoff: latesThisCutoff[r.employeeName] ?? 0,
        waitingDays: Math.max(0, Math.round((Date.parse(today) - Date.parse(r.requestedOn)) / 86_400_000)),
      };
    });
  return delay(applications);
}

export function fetchLeaveOverviewStats() {
  return delay(leaveOverviewStats);
}

export function fetchLeavePolicies() {
  return delay(leavePolicies);
}

export async function decideLeaveAsHr(id: string, status: "Approved" | "Declined") {
  const next = leaveRequests.map((r) => (r.id === id ? { ...r, status } : r));
  setLeaveRequests(next);
  return delay(next.find((r) => r.id === id)!);
}

/** Sends it back to the employee to edit and resubmit; it no longer counts against their balance. */
export async function returnLeaveRequest(id: string, note: string) {
  const next = leaveRequests.map((r) =>
    r.id === id ? { ...r, status: "Returned" as const, returnNote: note.trim() || undefined } : r,
  );
  setLeaveRequests(next);
  return delay(next.find((r) => r.id === id)!);
}

export interface FileLeaveForEmployeeInput {
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
}

/** Working days (Mon–Fri) from start to end, inclusive. */
export function countLeaveDays(startDate: string, endDate: string) {
  let days = 0;
  for (let d = new Date(startDate + "T00:00:00"); d <= new Date(endDate + "T00:00:00"); d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) days++;
  }
  return days;
}

/** HR files on the employee's behalf; it still goes to the Partner, then HR. */
export async function fileLeaveForEmployee(input: FileLeaveForEmployeeInput): Promise<LeaveRequest> {
  const employee = employeeDirectory.find((e) => e.id === input.employeeId);
  if (!employee) throw new Error("That employee is no longer in the directory.");
  const days = countLeaveDays(input.startDate, input.endDate);
  const dates =
    input.startDate === input.endDate
      ? formatDate(input.startDate)
      : `${formatDate(input.startDate)}–${formatDate(input.endDate)}`;
  const request: LeaveRequest = {
    id: `lr-${Date.now()}`,
    employeeName: employee.name,
    employeeInitials: employee.initials,
    employeeRole: employee.position,
    type: input.type,
    detail: `${dates} · ${days} ${days === 1 ? "day" : "days"}`,
    status: "Pending",
    requestedOn: new Date().toISOString().slice(0, 10),
    startDate: input.startDate,
    endDate: input.endDate,
    days,
    reason: input.reason?.trim() || undefined,
  };
  setLeaveRequests([request, ...leaveRequests]);
  return delay(request);
}

export function fetchOnLeaveToday() {
  return delay(onLeaveToday);
}

export function fetchApprovedLeaveSchedule() {
  return delay(leaveRequests.filter((r) => r.status === "Approved"));
}

export function fetchAttendanceTrend() {
  return delay(attendanceTrend);
}

export function fetchWorkforceAlerts() {
  return delay(workforceAlerts);
}

export function fetchTeamRoster() {
  return delay(teamRoster);
}

export function fetchPerformanceReviewStatuses() {
  return delay(performanceReviewStatuses);
}

export async function updatePerformanceReviewStatus(employeeId: string, status: "Submitted" | "Pending") {
  const next = { ...performanceReviewStatuses, [employeeId]: status };
  setPerformanceReviewStatuses(next);
  return delay(next);
}

export function fetchTeamTrainingRecords() {
  const teamNames = new Set(teamRoster.map((m) => m.name));
  return delay(trainingRecords.filter((t) => teamNames.has(t.employeeName)));
}

export async function updateTrainingStatus(id: string, status: TrainingStatus) {
  const next = trainingRecords.map((t) => (t.id === id ? { ...t, status } : t));
  setTrainingRecords(next);
  return delay(next.find((t) => t.id === id)!);
}

export function fetchEmployeeCases() {
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
  const next = employeeCases.map((c) => (c.id === id ? { ...c, status } : c));
  setEmployeeCases(next);
  return delay(next.find((c) => c.id === id)!);
}

export interface UpdateCaseDetailsInput {
  type: CaseType;
  summary: string;
}

export async function updateCaseDetails(id: string, input: UpdateCaseDetailsInput) {
  const next = employeeCases.map((c) => (c.id === id ? { ...c, ...input } : c));
  setEmployeeCases(next);
  return delay(next.find((c) => c.id === id)!);
}

export async function deleteEmployeeCase(id: string): Promise<void> {
  setEmployeeCases(employeeCases.filter((c) => c.id !== id));
  return delay(undefined);
}

// ---- HR Admin ----

export function fetchAdminOverviewStats() {
  return delay(adminOverviewStats);
}

export function fetchPayrollRunSteps() {
  return delay(payrollRunSteps);
}

export function fetchHeadcountByOffice() {
  return delay(headcountByOffice);
}

export function fetchPayrollCostBreakdown() {
  return delay(payrollCostBreakdown);
}

export function fetchComplianceCalendar() {
  return delay(complianceCalendar);
}

export function fetchEmployeeDirectory() {
  return delay(employeeDirectory);
}

/** What HR sets in Pipeline once a new hire has submitted Onboarding. */
export interface EmploymentInput {
  position: string;
  department: string;
  office: Employee["office"];
  cluster: Employee["cluster"];
  /** ISO date, e.g. "2026-09-29" — decides the employee ID. */
  dateHired: string;
  employmentStatus?: Employee["employmentStatus"];
  /** Directory ID of their supervisor; empty reports to HR. */
  reportsToId?: string;
}

export interface CreateEmployeeInput extends OnboardingSubmissionInput, EmploymentInput {
  /** Set when the hire comes from Recruitment, to link the application. */
  applicantId?: string;
  /** Who added them, for the audit log. */
  actor?: AuditActor;
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

/** "Maria Reyes (Mother) · +63 917 000 0000" — how emergency contacts are stored and shown. */
function formatEmergencyContact(contact: CreateEmployeeInput["emergencyContact"]) {
  const name = contact?.name.trim();
  if (!name) return undefined;
  const relationship = contact?.relationship ? ` (${contact.relationship})` : "";
  const phone = contact?.phone?.trim() ? ` · ${contact.phone.trim()}` : "";
  return `${name}${relationship}${phone}`;
}

/** Everyone already holding a hire-date ID, in the shape the ID assignment needs. */
function hireDateIdHolders(): IdCandidate[] {
  return employeeDirectory.flatMap((e) =>
    isHireDateId(e.id) && e.dateHired && e.lastName && e.firstName
      ? [{ id: e.id, dateHired: e.dateHired, lastName: e.lastName, firstName: e.firstName }]
      : [],
  );
}

/** The ID a new hire would get if saved now, and how many same-month hires it would renumber. */
export function previewEmployeeId(input: Pick<CreateEmployeeInput, "dateHired" | "lastName" | "firstName">) {
  const { newId, renamed } = assignHireDateIds(
    { dateHired: input.dateHired, lastName: input.lastName.trim(), firstName: input.firstName.trim() },
    hireDateIdHolders(),
  );
  return { id: newId, renumbers: renamed.size };
}

/** Moves every record keyed by an employee ID that changed. */
function rekeyEmployees(renamed: Map<string, string>) {
  if (renamed.size === 0) return;
  const to = (id: string) => renamed.get(id) ?? id;
  // The signed-in employee follows their record when a same-month hire renumbers them.
  if (renamed.has(currentEmployee.id)) setCurrentEmployee({ ...currentEmployee, id: to(currentEmployee.id) });
  setEmployeeDirectory(
    employeeDirectory.map((e) => ({ ...e, id: to(e.id), reportsToId: e.reportsToId && to(e.reportsToId) })),
  );
  setPersonnelProfiles(personnelProfiles.map((p) => ({ ...p, employeeId: to(p.employeeId) })));
  setPersonnelDocuments(
    personnelDocuments.map((d) =>
      renamed.has(d.employeeId)
        ? { ...d, employeeId: to(d.employeeId), id: d.id.replace(`doc-${d.employeeId}-`, `doc-${to(d.employeeId)}-`) }
        : d,
    ),
  );
  setAuditLogEntries(auditLogEntries.map((a) => ({ ...a, employeeId: to(a.employeeId) })));
  setApplicants(applicants.map((a) => (a.employeeId ? { ...a, employeeId: to(a.employeeId) } : a)));
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  const name = formatEmployeeName(input);
  const lastName = input.lastName.trim();
  const firstName = input.firstName.trim();
  const { newId, renamed } = assignHireDateIds({ dateHired: input.dateHired, lastName, firstName }, hireDateIdHolders());
  rekeyEmployees(renamed);

  const employee: Employee = {
    id: newId,
    name,
    dateHired: input.dateHired,
    lastName,
    firstName,
    initials: initialsFor(`${input.firstName} ${input.lastName}`),
    position: input.position,
    department: input.department,
    office: input.office,
    cluster: input.cluster,
    status: "Active",
    email: input.email || undefined,
    personalEmail: input.personalEmail || undefined,
    phone: input.phone || undefined,
    nickname: input.nickname?.trim() || undefined,
    emergencyContact: formatEmergencyContact(input.emergencyContact),
    employmentStatus: input.employmentStatus,
    reportsToId: input.reportsToId || "admin",
    governmentNumbers: input.governmentNumbers && Object.keys(input.governmentNumbers).length > 0 ? input.governmentNumbers : undefined,
  };

  setEmployeeDirectory([employee, ...employeeDirectory]);
  setPersonnelProfiles([
    ...personnelProfiles,
    {
      employeeId: employee.id,
      birthDate: input.birthDate || undefined,
      civilStatus: input.civilStatus,
      bloodType: input.bloodType || undefined,
      address: input.address?.trim() || undefined,
      dependents: (input.dependents ?? []).map((d, i) => ({ ...d, id: `dep-${employee.id}-${i + 1}` })),
      previousEmployer: input.previousEmployer,
      otherDetails: input.otherDetails?.length ? input.otherDetails : undefined,
    },
  ]);
  setPersonnelDocuments([
    ...personnelDocuments,
    ...buildNewHireDocuments(employee.id, input.governmentId, input.uploadedDocuments ?? [], applicableDocuments(input), input.license),
  ]);
  if (input.actor) logPersonnelAccess(employee.id, input.actor, "Created", "201 File", `Added as ${employee.position}`);
  // A Recruitment hire is also linked to the application.
  if (input.applicantId) {
    setApplicants(applicants.map((a) => (a.id === input.applicantId ? { ...a, employeeId: employee.id } : a)));
  }
  return delay(employee);
}

export interface PossibleDuplicate {
  employee: Employee;
  reason: string;
}

/**
 * Existing employees who may be the same person: same first + last name and birth date,
 * or a government number already on someone's 201 file. Catches rehires and double entry.
 */
export function findPossibleDuplicates(input: {
  lastName: string;
  firstName: string;
  birthDate?: string;
  governmentNumbers?: Employee["governmentNumbers"];
}): Promise<PossibleDuplicate[]> {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
  const digitsOf = (s?: string) => (s ?? "").replace(/\D/g, "");
  const entered = Object.entries(input.governmentNumbers ?? {}).filter(([, v]) => digitsOf(v).length > 0);
  const agencyKey: Record<string, keyof NonNullable<Employee["governmentNumbers"]>> = {
    SSS: "sss",
    PhilHealth: "philHealth",
    "Pag-IBIG (HDMF)": "pagIbig",
    "BIR (TIN)": "tin",
  };
  const labels: Record<string, string> = { tin: "TIN", sss: "SSS number", philHealth: "PhilHealth number", pagIbig: "Pag-IBIG MID" };

  const matches: PossibleDuplicate[] = [];
  for (const employee of employeeDirectory) {
    const profile = personnelProfiles.find((p) => p.employeeId === employee.id);
    const [first, ...rest] = employee.name.split(" ");
    const sameName =
      norm(employee.lastName ?? rest.join(" ")).endsWith(norm(input.lastName)) &&
      norm(employee.firstName ?? first).startsWith(norm(input.firstName));
    if (sameName && input.birthDate && profile?.birthDate === input.birthDate) {
      matches.push({ employee, reason: "Same name and birth date" });
      continue;
    }
    const onFile = buildEmployeeFileRecords(employee).government;
    const clash = entered.find(([key, value]) =>
      onFile.some((g) => agencyKey[g.agency] === key && digitsOf(g.number) === digitsOf(value)),
    );
    if (clash) matches.push({ employee, reason: `Same ${labels[clash[0]]}` });
  }
  return delay(matches);
}

export interface RegisterEmployeeInput {
  name: string;
  position: string;
  office: Employee["office"];
  cluster: Employee["cluster"];
}

export async function registerEmployee(input: RegisterEmployeeInput): Promise<Employee> {
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

/** Situational 201 documents that apply, from what the new hire told us. */
export function applicableDocuments(input: OnboardingSubmissionInput): PersonnelDocumentType[] {
  const applies: Record<string, boolean> = {
    "Marriage Certificate (PSA)": input.civilStatus === "Married",
    "Child's Birth Certificate": (input.dependents ?? []).some((d) => d.relationship === "Child"),
    "Professional License": Boolean(input.license?.number),
    "Certificate of Employment (Previous)": Boolean(input.previousEmployer?.name),
  };
  return SITUATIONAL_DOCUMENT_TYPES.filter((t) => applies[t]);
}

/** The new hire sends their details to HR; they wait in Pipeline until HR adds employment details. */
export function submitOnboarding(input: OnboardingSubmissionInput): Promise<OnboardingSubmission> {
  const submission: OnboardingSubmission = {
    id: `sub-${Date.now().toString(36)}`,
    submittedAt: new Date().toISOString(),
    input,
    fromSignedInEmployee: true,
  };
  // Sending again replaces their earlier submission rather than queuing a second one.
  setOnboardingSubmissions([submission, ...onboardingSubmissions.filter((s) => !s.fromSignedInEmployee)]);
  return delay(submission);
}

export function fetchOnboardingSubmissions() {
  return delay([...onboardingSubmissions].sort((x, y) => y.submittedAt.localeCompare(x.submittedAt)));
}

/** Where the signed-in employee is: not started, waiting for HR, or set up in the directory. */
export function fetchMyOnboardingStatus(): Promise<"none" | "pending" | "done"> {
  if (employeeDirectory.some((e) => e.id === currentEmployee.id)) return delay("done");
  return delay(onboardingSubmissions.some((s) => s.fromSignedInEmployee) ? "pending" : "none");
}

/** HR adds employment details: the new hire gets their ID and 201 file and joins the directory. */
export async function completeOnboarding(submissionId: string, employment: EmploymentInput, actor?: AuditActor): Promise<Employee> {
  const submission = onboardingSubmissions.find((s) => s.id === submissionId);
  if (!submission) throw new Error("That submission was already set up or removed.");
  // Taken off the list before anything awaits, so a second click can't add the same person twice.
  setOnboardingSubmissions(onboardingSubmissions.filter((s) => s.id !== submissionId));
  const created = await createEmployee({ ...submission.input, ...employment, actor });
  // Pipeline's Hired list reads these.
  const employee: Employee = { ...created, onboardingSubmittedAt: submission.submittedAt, acceptedAt: new Date().toISOString() };
  setEmployeeDirectory(employeeDirectory.map((e) => (e.id === employee.id ? employee : e)));
  // The demo has one signed-in employee: once set up, their account is this record.
  if (submission.fromSignedInEmployee) setCurrentEmployee({ ...employee, faceEnrolled: currentEmployee.faceEnrolled });
  return employee;
}

export function fetchJobRequisitions() {
  return delay(jobRequisitions);
}

export interface CreateJobRequisitionInput {
  title: string;
  department: string;
  cluster: Employee["cluster"];
  office: Employee["office"];
  openings: number;
  employmentType: EmploymentType;
  targetStart: string;
  salaryRange?: string;
  justification: string;
}

/** New requisitions start with the Partner (L1), then go to HR and the Project Sponsor (BRD §8.1). */
export async function createJobRequisition(input: CreateJobRequisitionInput): Promise<JobRequisition> {
  const requisition: JobRequisition = {
    id: `jr-${Date.now()}`,
    ...input,
    applicants: 0,
    applicantsThisWeek: 0,
    stage: "Sourcing",
    approval: "Pending L1",
  };
  setJobRequisitions([...jobRequisitions, requisition]);
  return delay(requisition);
}

export function fetchApplicants() {
  return delay(applicants);
}

export async function moveApplicant(id: string, stage: ApplicantStage): Promise<Applicant> {
  const next = applicants.map((a) => (a.id === id ? { ...a, stage } : a));
  setApplicants(next);
  return delay(next.find((a) => a.id === id)!);
}

export function fetchOrgChart() {
  const root = { id: "admin", name: currentAdmin.name, initials: currentAdmin.initials, title: currentAdmin.title };
  return delay({ root, employees: employeeDirectory });
}

export function fetchOffboardingCases() {
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
  const record: OffboardingCase = { id: `off-${Date.now()}`, ...input };
  setOffboardingCases([record, ...offboardingCases]);
  return delay(record);
}

export async function updateOffboardingCase(
  id: string,
  input: CreateOffboardingInput,
): Promise<OffboardingCase> {
  const updated: OffboardingCase = { id, ...input };
  setOffboardingCases(offboardingCases.map((c) => (c.id === id ? updated : c)));
  return delay(updated);
}

export async function deleteOffboardingCase(id: string): Promise<void> {
  setOffboardingCases(offboardingCases.filter((c) => c.id !== id));
  return delay(undefined);
}

export function fetchCompanyAssets() {
  return delay(companyAssets);
}

export interface CreateAssetInput {
  type: string;
  assetTag: string;
  assignedToName: string;
  assignedToInitials: string;
}

export async function createCompanyAsset(input: CreateAssetInput): Promise<CompanyAsset> {
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
  const existing = companyAssets.find((a) => a.id === id);
  const updated: CompanyAsset = { ...existing!, ...input };
  setCompanyAssets(companyAssets.map((a) => (a.id === id ? updated : a)));
  return delay(updated);
}

export async function deleteCompanyAsset(id: string): Promise<void> {
  setCompanyAssets(companyAssets.filter((a) => a.id !== id));
  return delay(undefined);
}

export function fetchAllTrainingRecords() {
  return delay(trainingRecords);
}

export interface CreateTrainingRecordInput {
  employeeName: string;
  employeeInitials: string;
  course: string;
  dueDate: string;
}

export async function createTrainingRecord(input: CreateTrainingRecordInput): Promise<TrainingRecord> {
  const record: TrainingRecord = { id: `tr-${Date.now()}`, status: "Not started", ...input };
  setTrainingRecords([record, ...trainingRecords]);
  return delay(record);
}

export async function deleteTrainingRecord(id: string): Promise<void> {
  setTrainingRecords(trainingRecords.filter((t) => t.id !== id));
  return delay(undefined);
}

export function fetchCertificateRequestsForReview() {
  return delay(certificateRequests);
}

const certificateStatusOrder: CertificateRequestStatus[] = ["Pending", "Ready for pickup", "Released"];

export function nextCertificateStatus(status: CertificateRequestStatus): CertificateRequestStatus | null {
  const idx = certificateStatusOrder.indexOf(status);
  return idx < certificateStatusOrder.length - 1 ? certificateStatusOrder[idx + 1] : null;
}

export async function advanceCertificateRequest(id: string) {
  const target = certificateRequests.find((r) => r.id === id);
  const nextStatus = target ? nextCertificateStatus(target.status) : null;
  if (!nextStatus) return delay(target!);
  const next = certificateRequests.map((r) => (r.id === id ? { ...r, status: nextStatus } : r));
  setCertificateRequests(next);
  return delay(next.find((r) => r.id === id)!);
}

export interface UpdateCertificateRequestInput {
  type: string;
  purpose: string;
}

export async function updateCertificateRequest(id: string, input: UpdateCertificateRequestInput) {
  const next = certificateRequests.map((r) => (r.id === id ? { ...r, ...input } : r));
  setCertificateRequests(next);
  return delay(next.find((r) => r.id === id)!);
}

export async function deleteCertificateRequest(id: string): Promise<void> {
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
  const next = complianceCalendar.map((c) => (c.id === id ? { ...c, status, note: undefined } : c));
  setComplianceCalendar(next);
  return delay(next.find((c) => c.id === id)!);
}

export interface ComplianceItemInput {
  filing: string;
  agency: ComplianceItem["agency"];
  due: string;
  periodCovered?: string;
  amount?: number;
  referenceNo?: string;
}

export async function createComplianceItem(input: ComplianceItemInput): Promise<ComplianceItem> {
  const item: ComplianceItem = { id: `c-${Date.now()}`, status: "Due soon", ...input };
  setComplianceCalendar([item, ...complianceCalendar]);
  return delay(item);
}

export async function updateComplianceItem(id: string, input: ComplianceItemInput) {
  const next = complianceCalendar.map((c) => (c.id === id ? { ...c, ...input } : c));
  setComplianceCalendar(next);
  return delay(next.find((c) => c.id === id)!);
}

export async function deleteComplianceItem(id: string): Promise<void> {
  setComplianceCalendar(complianceCalendar.filter((c) => c.id !== id));
  return delay(undefined);
}

export interface CreateAnnouncementInput {
  title: string;
}

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
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
  return delay(attendanceRequests);
}

export async function updateAttendanceRequestStatus(
  id: string,
  status: Exclude<AttendanceRequestStatus, "Pending">,
): Promise<AttendanceRequest> {
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
  const current = getCredential("admin");
  const username = input.username.trim().toLowerCase();
  await delay(null);
  if (input.currentPassword !== current.password) throw new Error("Your current password is incorrect.");
  if (getCredentials().some((c) => c.role !== "admin" && c.username === username)) {
    throw new Error(`The username "${username}" is already taken.`);
  }
  setCredential("admin", username, input.newPassword || current.password);
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
  return delay(payrollCutoff);
}

export function fetchPayrollRun() {
  return delay({ cutoff: payrollCutoff, releasedAt: payrollReleasedAt });
}

/** HR's final step: approves every remaining draft and releases the whole cutoff in one go. */
export async function approveAndReleasePayroll(): Promise<number> {
  upsertPayrollEntries(
    employeeDirectory
      .map((e) => entryFor(e.id))
      .filter((entry) => entry.status === "Draft")
      .map((entry) => ({ ...entry, status: "Approved" as const })),
  );
  const count = await releaseApprovedPayroll();
  const now = new Date();
  setPayrollReleasedAt(
    `${now.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}, ${now.toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
    })}`,
  );
  return count;
}

export function fetchPayrollRegister(): Promise<PayrollRegisterRow[]> {
  return delay(employeeDirectory.map((employee) => ({ employee, entry: entryFor(employee.id) })));
}

export type UpdatePayrollEntryInput = Pick<
  PayrollEntry,
  "monthlyBasic" | "allowance" | "overtimeHours" | "otherDeductions"
>;

/** Editing a figure sends the entry back to Draft so it has to be re-approved. */
export async function updatePayrollEntry(employeeId: string, input: UpdatePayrollEntryInput): Promise<PayrollEntry> {
  const existing = entryFor(employeeId);
  if (existing.status === "Released") throw new Error("Released payroll can no longer be edited.");
  const updated: PayrollEntry = { ...existing, ...input, status: "Draft" };
  upsertPayrollEntries([updated]);
  return delay(updated);
}

export async function approvePayrollEntries(employeeIds: string[]): Promise<void> {
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
  const existing = entryFor(employeeId);
  if (existing.status === "Approved") upsertPayrollEntries([{ ...existing, status: "Draft" }]);
  return delay(undefined);
}

/** Releases every approved entry and marks the matching employee payslip as paid. */
export async function releaseApprovedPayroll(): Promise<number> {
  const approved = employeeDirectory.map((e) => entryFor(e.id)).filter((entry) => entry.status === "Approved");
  upsertPayrollEntries(approved.map((entry) => ({ ...entry, status: "Released" as const })));
  if (approved.some((entry) => entry.employeeId === currentEmployee.id)) {
    setPayslips(payslips.map((p) => (p.id === payrollCutoff.payslipId ? { ...p, status: "Paid" } : p)));
  }
  return delay(approved.length);
}

// ---- Partner reports ----

export function fetchTeamReport(id: ReportId) {
  return delay(teamReports[id]);
}

// ---- 201 File: government numbers, employment, during employment, separation ----

export function fetchEmployeeFileRecords(employeeId: string) {
  const employee = employeeDirectory.find((e) => e.id === employeeId);
  return delay(employee ? buildEmployeeFileRecords(employee) : null);
}

/** Date hired for every directory entry, keyed by employee ID — for the directory cards. */
export function fetchEmployeeHireDates() {
  return delay(
    Object.fromEntries(employeeDirectory.map((e) => [e.id, buildEmployeeFileRecords(e).employment.dateHired])) as Record<
      string,
      string
    >,
  );
}

// --- The Onboarding form HR builds ---
// Kept in this browser (localStorage) so it survives a reload and both the HR and employee side
// read the same copy. A backend would store it per company.

const ONBOARDING_FORM_KEY = "msma-onboarding-form";

function readOnboardingForm(): OnboardingFormConfig | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_FORM_KEY);
    return raw ? normalizeConfig(JSON.parse(raw) as { sections?: unknown; updatedAt?: unknown }) : null;
  } catch {
    return null;
  }
}

/** The form new hires fill in, or null until HR has set one up. */
export function fetchOnboardingForm(): Promise<OnboardingFormConfig | null> {
  return delay(readOnboardingForm());
}

export function saveOnboardingForm(config: OnboardingFormConfig): Promise<OnboardingFormConfig> {
  const saved = normalizeConfig({ ...config, updatedAt: new Date().toISOString() });
  try {
    localStorage.setItem(ONBOARDING_FORM_KEY, JSON.stringify(saved));
  } catch {
    throw new Error("This browser won't let us save the form. Allow site storage and try again.");
  }
  return delay(saved);
}

/** Query key shared by HR and employee screens; another tab saving the form refreshes it. */
export const ONBOARDING_FORM_QUERY_KEY = ["onboarding-form"] as const;
export const ONBOARDING_FORM_STORAGE_KEY = ONBOARDING_FORM_KEY;

/** People hired through Onboarding, most recently accepted first (Pipeline's Hired list). */
export function fetchHiredThroughOnboarding() {
  return delay(
    employeeDirectory.filter((e) => e.acceptedAt).sort((a, b) => (b.acceptedAt ?? "").localeCompare(a.acceptedAt ?? "")),
  );
}

// --- Public job applications (the shareable "Apply" link) ---

/** Roles open to the public: approved and still hiring. */
export function fetchOpenRequisitions() {
  return delay(jobRequisitions.filter((r) => r.approval === "Approved" && r.openings > 0));
}

export interface ApplicationInput {
  /** An open requisition; empty when they picked a role from the catalog with no opening yet. */
  requisitionId?: string;
  /** The role they picked, e.g. "Web Developer". */
  appliedRole: string;
  /** Its field, e.g. "Information Technology". */
  field: string;
  /** What they chose for "Which describes your … background?". */
  background: string;
  /** In their own words. */
  workExperience: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  province: string;
  city: string;
  profession: ApplicantProfession;
  yearsExperience: number;
  prcLicenseNumber?: string;
  resumeFileName?: string;
  message?: string;
  experienceLevel: "Fresh graduate" | "Has work experience";
  coverLetter?: { kind: "upload"; fileName: string } | { kind: "write"; text: string };
  languages: string[];
  careerHistory: ApplicantRole[];
  education: ApplicantEducation[];
  skills: string[];
}

/** Someone applies through the shared link; they land in Recruitment's Applied column. */
export async function submitApplication(input: ApplicationInput): Promise<Applicant> {
  let role = input.requisitionId
    ? jobRequisitions.find((r) => r.id === input.requisitionId)
    : jobRequisitions.find((r) => r.approval === "Approved" && r.openings > 0 && r.title.toLowerCase() === input.appliedRole.toLowerCase());
  if (input.requisitionId && (!role || role.approval !== "Approved" || role.openings <= 0)) throw new Error("This role is no longer open.");
  // A role from the catalog with no opening yet still reaches HR: it gets its own pipeline in Recruitment.
  if (!role) {
    role = {
      id: `jr-${Date.now().toString(36)}`,
      title: input.appliedRole,
      department: input.field,
      office: "Cebu HQ",
      openings: 1,
      applicants: 0,
      applicantsThisWeek: 0,
      stage: "Sourcing",
      approval: "Approved",
    };
    setJobRequisitions([...jobRequisitions, role]);
  }
  const roleId = role.id;
  const email = input.email.trim().toLowerCase();
  if (applicants.some((a) => a.requisitionId === role.id && a.email?.toLowerCase() === email)) {
    throw new Error(`You've already applied for ${role.title} with this email. HR will contact you there.`);
  }
  const now = new Date();
  const applicant: Applicant = {
    id: `ap-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    requisitionId: role.id,
    background: input.background,
    workExperience: input.workExperience.trim() || undefined,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email,
    phone: formatPhMobile(input.phone),
    stage: "Applied",
    note: `Shared link · ${now.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`,
    source: "Shared link",
    appliedAt: now.toISOString(),
    profession: input.profession,
    province: input.province,
    city: input.city,
    yearsExperience: input.yearsExperience,
    prcLicenseNumber: input.prcLicenseNumber?.trim() || undefined,
    resumeFileName: input.resumeFileName,
    message: input.message?.trim() || undefined,
    experienceLevel: input.experienceLevel,
    coverLetter: input.coverLetter,
    languages: input.languages,
    careerHistory: input.careerHistory,
    education: input.education,
    skills: input.skills,
  };
  setApplicants([applicant, ...applicants]);
  setJobRequisitions(jobRequisitions.map((r) => (r.id === roleId ? { ...r, applicants: r.applicants + 1, applicantsThisWeek: r.applicantsThisWeek + 1 } : r)));
  return delay(applicant);
}
