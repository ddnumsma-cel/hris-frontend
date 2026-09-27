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
  status: "Pending" | "Approved" | "Declined";
  requestedOn: string;
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

export interface JobRequisition {
  id: string;
  title: string;
  department: "Audit & Assurance" | "Tax Advisory" | "Corporate Legal" | "Bookkeeping";
  openings: number;
  applicants: number;
  stage: RequisitionStage;
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
