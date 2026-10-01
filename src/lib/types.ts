export type Role = "employee" | "manager" | "admin";

export type Cluster = "RPM" | "VCM" | "ADS" | "Admin & Support";

export interface Employee {
  id: string;
  name: string;
  initials: string;
  position: string;
  department: string;
  office: "Cebu HQ" | "Manila" | "Davao";
  cluster: Cluster;
  status: "Active" | "On leave";
  reportsToId?: string;
  email?: string;
  phone?: string;
  emergencyContact?: string;
  faceEnrolled?: boolean;
  // Set for people added through "Add employee"; the hire date and name
  // parts decide their YYYY-MM-NN employee ID (see lib/employeeIds.ts).
  dateHired?: string;
  lastName?: string;
  firstName?: string;
  nickname?: string;
  personalEmail?: string;
  /** BRD §3.3 classification chosen when HR added them. */
  employmentStatus?: "Probationary" | "Regular" | "Project-Based" | "Contractual" | "Part-Time";
  /** Numbers HR typed in when adding them; shown as Pending in the 201 file until verified. */
  governmentNumbers?: Partial<Record<"tin" | "sss" | "philHealth" | "pagIbig", string>>;
}

export interface LeaveBalance {
  type: "Vacation" | "Sick" | "Emergency" | "Bereavement";
  used: number;
  entitlement: number;
}

export interface PayslipLineItem {
  label: string;
  amount: number;
  kind: "earning" | "deduction";
}

export interface Payslip {
  id: string;
  cutoffLabel: string;
  gross: number;
  deductions: number;
  net: number;
  status: "Paid" | "Processing";
  breakdown: PayslipLineItem[];
}

export interface Announcement {
  id: string;
  title: string;
  postedOn: string;
}

export type LeaveType = "Vacation" | "Sick" | "Emergency" | "Bereavement";

export interface LeaveRequest {
  id: string;
  employeeName: string;
  employeeInitials: string;
  employeeRole: string;
  type: LeaveType | "Overtime" | "Certificate of Employment";
  detail: string;
  /** "Returned" sends it back to the employee to edit and resubmit. */
  status: "Pending" | "Approved" | "Declined" | "Returned";
  requestedOn: string;
  /** Leave goes Filed → Partner → HR; set once the Partner signs off. */
  partnerApproved?: boolean;
  /** ISO dates, for the leave calendar and overlap checks. */
  startDate?: string;
  endDate?: string;
  /** Leave credits this request uses (overtime and COE requests have none). */
  days?: number;
  /** The employee's reason, shown in quotes. */
  reason?: string;
  /** Supporting document, e.g. "Medical certificate attached". */
  attachmentNote?: string;
  /** HR's note when returning the request. */
  returnNote?: string;
}

export interface LeavePolicy {
  code: string;
  type: string;
  days: number;
  accrual: string;
  cashConversion: string;
}

export interface LeaveOverviewStats {
  onLeaveToday: number;
  onLeaveOffices: number;
  utilizationPercent: number;
  utilizationLastYearPercent: number;
  vlToConvertDays: number;
}

export interface AttendancePoint {
  date: string;
  rate: number;
}

export interface OfficeHeadcount {
  office: "Cebu HQ" | "Manila" | "Davao";
  count: number;
}

export interface PayrollCostSegment {
  label: "Basic pay" | "Statutory" | "Allowances" | "Overtime";
  percent: number;
}

export interface ComplianceItem {
  id: string;
  filing: string;
  agency: "SSS" | "PhilHealth" | "Pag-IBIG" | "BIR";
  due: string;
  status: "Filed" | "Due soon" | "Overdue";
  note?: string;
  /** e.g. "September 2026". */
  periodCovered?: string;
  amount?: number;
  /** PRN, eFPS or bank reference once filed. */
  referenceNo?: string;
}

export interface OnboardingStage {
  stage: "Offer accepted" | "Documents submitted" | "Day 1 setup";
  count: number;
}

export interface AdminOverviewStats {
  totalHeadcount: number;
  newHiresThisMonth: number;
  attritionRateYtd: number;
  openPositions: { audit: number; tax: number; legal: number };
  payrollRunTotal: number;
  payrollCutoffLabel: string;
}

export type PayrollRunStepStatus = "done" | "current" | "pending";

export interface PayrollRunStep {
  label: string;
  status: PayrollRunStepStatus;
}

export interface DtrSummary {
  onTimeRatePercent: number;
  lateCount: number;
  absentCount: number;
}

export interface ThirteenthMonthSummary {
  accrued: number;
  asOfLabel: string;
}

export type WorkforceAlertSeverity = "info" | "warn" | "crit";

export type WorkforceAlertCategory = "Punctuality" | "Overtime" | "Attendance" | "Leave pattern";

export interface WorkforceAlert {
  id: string;
  employeeName: string;
  employeeInitials: string;
  category: WorkforceAlertCategory;
  message: string;
  severity: WorkforceAlertSeverity;
  detectedLabel: string;
}

export type BenefitStatus = "Active" | "Pending" | "Not enrolled";

export interface EmployeeBenefit {
  id: string;
  name: string;
  provider: string;
  memberId: string;
  status: BenefitStatus;
}

export interface TeamRosterMember {
  id: string;
  name: string;
  initials: string;
  position: string;
  tenureLabel: string;
  email: string;
  status: "Active" | "On leave";
}

export type RequisitionStage = "Sourcing" | "Interviewing" | "Offer extended";

export type RequisitionApproval = "Approved" | "Pending L1" | "Pending L2";

export type EmploymentType = "Probationary → Regular" | "Project-based" | "Fixed-term" | "Part-time";

export interface JobRequisition {
  id: string;
  title: string;
  department: string;
  cluster?: Cluster;
  office: Employee["office"];
  openings: number;
  applicants: number;
  applicantsThisWeek: number;
  stage: RequisitionStage;
  approval: RequisitionApproval;
  employmentType?: EmploymentType;
  /** ISO date. */
  targetStart?: string;
  salaryRange?: string;
  justification?: string;
}

export type ApplicantStage = "Applied" | "Screening" | "Interview" | "Offered" | "Hired" | "Rejected";

export interface Applicant {
  id: string;
  requisitionId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  stage: ApplicantStage;
  /** One-line status under the name, e.g. "Exam 86% · Sep 24". */
  note: string;
  /** ISO date an open offer lapses. */
  offerExpires?: string;
  /** ISO start date once hired. */
  startDate?: string;
  /** Set once HR creates the 201 file from this application. */
  employeeId?: string;
}

export type DtrStatus = "On time" | "Late" | "Absent";
export type WorkLocation = "Onsite" | "Remote";
export type AttendanceMethod = "Fingerprint" | "Face Scan";

export interface DtrLogEntry {
  date: string;
  timeIn: string;
  timeOut: string;
  status: DtrStatus;
  location: WorkLocation;
  method: AttendanceMethod;
}

export type CertificateRequestStatus = "Pending" | "Ready for pickup" | "Released";

export interface CertificateRequest {
  id: string;
  type: string;
  purpose: string;
  status: CertificateRequestStatus;
  requestedOn: string;
}

export type OffboardingStage = "Resignation filed" | "Clearance in progress" | "Final pay released";

export interface OffboardingCase {
  id: string;
  employeeName: string;
  employeeInitials: string;
  department: string;
  lastDay: string;
  stage: OffboardingStage;
}

export type AssetStatus = "Issued" | "Returned" | "Under repair";

export interface CompanyAsset {
  id: string;
  type: string;
  assetTag: string;
  assignedToName: string;
  assignedToInitials: string;
  issuedOn: string;
  status: AssetStatus;
}

export type TrainingStatus = "Not started" | "In progress" | "Completed";

export interface TrainingRecord {
  id: string;
  employeeName: string;
  employeeInitials: string;
  course: string;
  dueDate: string;
  status: TrainingStatus;
}

export type CaseStatus = "Open" | "Under review" | "Resolved";
export type CaseType = "Attendance" | "Conduct" | "Performance" | "Grievance";

export interface EmployeeCase {
  id: string;
  employeeName: string;
  employeeInitials: string;
  type: CaseType;
  filedBy: string;
  status: CaseStatus;
  filedOn: string;
  summary: string;
}

export type CpdStatus = "Compliant" | "In progress" | "Due soon" | "Overdue";

export interface ProfessionalLicense {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  licenseType: string;
  licenseNumber: string;
  cpdUnitsEarned: number;
  cpdUnitsRequired: number;
  cycleEndDate: string;
}

// --- 201 File: pre-employment / identity records ---
// Full detail (including the structured fields below) is HR- and
// manager-visible only. Employees see a submission checklist of these same
// document types, without the sensitive fields or the file itself.

export type PersonnelDocumentType =
  | "Application Form / Resume"
  | "Birth Certificate (PSA)"
  | "Marriage Certificate (PSA)"
  | "Child's Birth Certificate"
  | "Valid Government ID"
  | "Diploma / Transcript of Records"
  | "Professional License"
  | "Certificate of Employment (Previous)"
  | "NBI Clearance"
  | "Police/Barangay Clearance"
  | "Pre-Employment Medical Result";

export type PersonnelDocumentStatus = "Missing" | "Submitted" | "Verified" | "Not applicable";

export interface PersonnelDocument {
  id: string;
  employeeId: string;
  type: PersonnelDocumentType;
  status: PersonnelDocumentStatus;
  fileName?: string;
  /** Further images of the same document, e.g. the back of an ID card. */
  extraFileNames?: string[];
  uploadedOn?: string;
  // Populated only for the document types where it applies.
  idType?: string;
  idNumber?: string;
  idExpiry?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
}

/** The employee-safe projection of a PersonnelDocument — status only, no
 * sensitive fields and no file — used by the employee's own checklist view. */
export interface PersonnelDocumentChecklistItem {
  id: string;
  type: PersonnelDocumentType;
  status: PersonnelDocumentStatus;
}

export type CivilStatus = "Single" | "Married" | "Widowed" | "Separated";

export interface Dependent {
  id: string;
  name: string;
  relationship: "Spouse" | "Child";
  birthDate?: string;
}

export interface PersonnelProfile {
  employeeId: string;
  photoDataUrl?: string;
  birthDate?: string;
  civilStatus?: CivilStatus;
  dependents: Dependent[];
  bloodType?: string;
  address?: string;
  /** Declared during Onboarding, for the BIR 2316 from their last job. */
  previousEmployer?: { name: string; lastDay?: string };
}

// --- Audit log for restricted personnel data ---
// Every view, edit, verify, or removal touching a 201 File's sensitive
// fields is recorded here — who did it, to whose record, and when.

export type AuditAction = "Created" | "Viewed" | "Edited" | "Verified" | "Removed";

export interface AuditLogEntry {
  id: string;
  employeeId: string;
  actorName: string;
  actorRole: "manager" | "admin";
  action: AuditAction;
  target: string;
  detail?: string;
  timestamp: string;
}

// --- Partner-side attendance approvals ---
// DTR exceptions an employee files against their own time record (a missed
// scan, a late arrival with a valid reason, an unscheduled WFH day). Nothing
// here touches the DTR until the Partner approves it.

export type AttendanceRequestKind = "Missed clock-out" | "Missed clock-in" | "Late justification" | "Remote work" | "Time correction";
export type AttendanceRequestStatus = "Pending" | "Approved" | "Declined";

export interface AttendanceRequest {
  id: string;
  employeeName: string;
  employeeInitials: string;
  employeeRole: string;
  kind: AttendanceRequestKind;
  date: string;
  recordedTime: string;
  requestedTime: string;
  reason: string;
  status: AttendanceRequestStatus;
  filedOn: string;
}

// --- Partner profile (Settings) ---

export interface PartnerProfile {
  name: string;
  initials: string;
  title: string;
  email: string;
  phone: string;
  office: Employee["office"];
  emergencyContact: string;
  about: string;
}

// HR's own profile (Settings) has the same shape as the Partner's.
export type AdminProfile = PartnerProfile;

// --- Company payroll register ---
// One entry per employee for the open cutoff. Pay figures are inputs; the
// computed lines (statutory, tax, net) come from lib/payroll.ts.

export type PayrollEntryStatus = "Draft" | "Approved" | "Released";

export interface PayrollEntry {
  employeeId: string;
  monthlyBasic: number;
  allowance: number;
  overtimeHours: number;
  otherDeductions: number;
  status: PayrollEntryStatus;
  /** Overtime paid last cutoff, to flag unusual jumps before release. */
  lastCutoffOvertimeHours?: number;
  /** Overtime approved in advance; hours above this need review. Unset means all of it was pre-approved. */
  preApprovedOvertimeHours?: number;
}
