import {
  adminOverviewStats,
  announcements,
  attendanceTrend,
  certificateRequests,
  companyAssets,
  complianceCalendar,
  currentAdmin,
  currentEmployee,
  employeeBenefits,
  employeeCases,
  employeeDirectory,
  employeeDtrSummary,
  employeeThirteenthMonth,
  headcountByOffice,
  jobRequisitions,
  leaveBalances,
  leaveRequests,
  myDtrLog,
  offboardingCases,
  onLeaveToday,
  onboardingPipeline,
  payrollCostBreakdown,
  payrollRunSteps,
  payslips,
  performanceReviewStatuses,
  professionalLicenses,
  setAnnouncements,
  setCertificateRequests,
  setComplianceCalendar,
  setCompanyAssets,
  setCurrentEmployee,
  setEmployeeBenefits,
  setEmployeeCases,
  setEmployeeDirectory,
  setLeaveRequests,
  setOffboardingCases,
  setPerformanceReviewStatuses,
  setProfessionalLicenses,
  setTrainingRecords,
  teamRoster,
  trainingRecords,
  workforceAlerts,
} from "./mockData";
import type {
  Announcement,
  CaseStatus,
  CaseType,
  CertificateRequest,
  CertificateRequestStatus,
  ComplianceItem,
  CompanyAsset,
  Employee,
  EmployeeBenefit,
  EmployeeCase,
  LeaveRequest,
  LeaveType,
  OffboardingCase,
  OffboardingStage,
  TrainingRecord,
  TrainingStatus,
} from "./types";

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

export function fetchEmployeeThirteenthMonth() {
  return delay(employeeThirteenthMonth);
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
  return delay(professionalLicenses.find((l) => l.employeeId === currentEmployee.id));
}

export function fetchProfessionalLicenses() {
  return delay(professionalLicenses);
}

export async function updateCpdUnits(id: string, cpdUnitsEarned: number) {
  const next = professionalLicenses.map((l) => (l.id === id ? { ...l, cpdUnitsEarned } : l));
  setProfessionalLicenses(next);
  return delay(next.find((l) => l.id === id)!);
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
  return delay(leaveRequests.filter((r) => r.status === "Pending"));
}

export async function updateApprovalStatus(id: string, status: "Approved" | "Declined") {
  const next = leaveRequests.map((r) => (r.id === id ? { ...r, status } : r));
  setLeaveRequests(next);
  return delay(next.find((r) => r.id === id)!);
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

export interface CreateEmployeeInput {
  name: string;
  position: string;
  department: string;
  office: Employee["office"];
  cluster: Employee["cluster"];
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
  const employee: Employee = {
    id: `MSMA-${Math.floor(10_000 + Math.random() * 89_999)}`,
    name: input.name,
    initials: initialsFor(input.name),
    position: input.position,
    department: input.department,
    office: input.office,
    cluster: input.cluster,
    status: "Active",
  };

  setEmployeeDirectory([employee, ...employeeDirectory]);
  return delay(employee);
}

export interface UpdateEmployeeInput {
  name: string;
  position: string;
  department: string;
  office: Employee["office"];
  cluster: Employee["cluster"];
  status: Employee["status"];
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee> {
  const existing = employeeDirectory.find((e) => e.id === id);
  const updated: Employee = { ...existing!, ...input, initials: initialsFor(input.name) };
  setEmployeeDirectory(employeeDirectory.map((e) => (e.id === id ? updated : e)));
  return delay(updated);
}

export async function deleteEmployee(id: string): Promise<void> {
  setEmployeeDirectory(employeeDirectory.filter((e) => e.id !== id));
  return delay(undefined);
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

export function fetchOnboardingPipeline() {
  return delay(onboardingPipeline);
}

export function fetchJobRequisitions() {
  return delay(jobRequisitions);
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
