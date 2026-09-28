import type {
  AdminOverviewStats,
  Announcement,
  AttendancePoint,
  CertificateRequest,
  ComplianceItem,
  CompanyAsset,
  DtrLogEntry,
  Employee,
  EmployeeBenefit,
  EmployeeCase,
  JobRequisition,
  LeaveBalance,
  LeaveRequest,
  OffboardingCase,
  OfficeHeadcount,
  OnboardingStage,
  Payslip,
  PayrollCostSegment,
  PayrollRunStep,
  AuditLogEntry,
  AttendanceRequest,
  AdminProfile,
  PartnerProfile,
  PayrollEntry,
  PersonnelDocument,
  PersonnelDocumentType,
  PersonnelProfile,
  ProfessionalLicense,
  TeamRosterMember,
  TrainingRecord,
  WorkforceAlert,
} from "./types";

export let currentEmployee: Employee = {
  id: "MSMA-00482",
  name: "Angela Dela Cruz",
  initials: "AD",
  position: "Senior Tax Associate",
  department: "Tax Advisory",
  office: "Cebu HQ",
  cluster: "RPM",
  status: "Active",
  email: "angela.delacruz@msma.ph",
  phone: "+63 917 123 4567",
  emergencyContact: "Marco Dela Cruz (Spouse) · +63 917 765 4321",
  faceEnrolled: false,
};

export function setCurrentEmployee(next: Employee) {
  currentEmployee = next;
}

export const employeeDtrSummary = {
  onTimeRatePercent: 96,
  lateCount: 1,
  absentCount: 0,
};

export const employeeThirteenthMonth = {
  accrued: 31500,
  asOfLabel: "September 2026",
};

export const leaveBalances: LeaveBalance[] = [
  { type: "Vacation", used: 6.5, entitlement: 15 },
  { type: "Sick", used: 9, entitlement: 15 },
  { type: "Emergency", used: 1, entitlement: 3 },
  { type: "Bereavement", used: 0, entitlement: 3 },
];

const standardPayslipBreakdown: Payslip["breakdown"] = [
  { label: "Basic pay", amount: 35000, kind: "earning" },
  { label: "Transportation allowance", amount: 4000, kind: "earning" },
  { label: "Overtime pay", amount: 3000, kind: "earning" },
  { label: "SSS contribution", amount: 1350, kind: "deduction" },
  { label: "PhilHealth contribution", amount: 875, kind: "deduction" },
  { label: "Pag-IBIG contribution", amount: 200, kind: "deduction" },
  { label: "Withholding tax", amount: 1408.33, kind: "deduction" },
  { label: "Pag-IBIG salary loan", amount: 200, kind: "deduction" },
];

export let payslips: Payslip[] = [
  { id: "PS-2609B", cutoffLabel: "Sept 16–30, 2026", gross: 42000, deductions: 4033.33, net: 37966.67, status: "Processing", breakdown: standardPayslipBreakdown },
  { id: "PS-2609A", cutoffLabel: "Sept 1–15, 2026", gross: 42000, deductions: 4033.33, net: 37966.67, status: "Paid", breakdown: standardPayslipBreakdown },
  { id: "PS-2608B", cutoffLabel: "Aug 16–31, 2026", gross: 42000, deductions: 4033.33, net: 37966.67, status: "Paid", breakdown: standardPayslipBreakdown },
];

export function setPayslips(next: Payslip[]) {
  payslips = next;
}

export let announcements: Announcement[] = [
  { id: "an-1", title: "BIR Form 2316 for 2025 is now available for download", postedOn: "Posted Sept 20, 2026" },
  { id: "an-2", title: "Cebu HQ town hall — Oct 3, 2026, 4:00 PM, 5th floor training room", postedOn: "Posted Sept 18, 2026" },
  { id: "an-3", title: "HMO dependent enrollment closes Sept 30 — submit via Benefits", postedOn: "Posted Sept 12, 2026" },
];

export function setAnnouncements(next: Announcement[]) {
  announcements = next;
}

export let leaveRequests: LeaveRequest[] = [
  { id: "lr-1", employeeName: "Bea Santos", employeeInitials: "BS", employeeRole: "Audit Associate", type: "Vacation", detail: "Oct 6–8 · 3 days", status: "Pending", requestedOn: "2026-09-21" },
  { id: "lr-2", employeeName: "Miguel Reyes", employeeInitials: "MR", employeeRole: "Audit Associate", type: "Overtime", detail: "Sept 24 · 2.5 hrs", status: "Pending", requestedOn: "2026-09-24" },
  { id: "lr-3", employeeName: "Carla Uy", employeeInitials: "CU", employeeRole: "Senior Associate", type: "Sick", detail: "Sept 22 · 1 day", status: "Pending", requestedOn: "2026-09-22" },
  { id: "lr-4", employeeName: "Jon Ababa", employeeInitials: "JA", employeeRole: "Associate", type: "Certificate of Employment", detail: "Requested Sept 23", status: "Pending", requestedOn: "2026-09-23" },
  { id: "lr-5", employeeName: "Dennis Lim", employeeInitials: "DL", employeeRole: "Associate", type: "Emergency", detail: "Sept 25 · 1 day", status: "Pending", requestedOn: "2026-09-25" },
];

export function setLeaveRequests(next: LeaveRequest[]) {
  leaveRequests = next;
}

export const onLeaveToday = [
  { name: "Dennis Lim", initials: "DL", reason: "Emergency Leave" },
  { name: "Grace Tan", initials: "GT", reason: "Vacation Leave" },
];

export const attendanceTrend: AttendancePoint[] = [
  { date: "Sep 12", rate: 96 },
  { date: "Sep 13", rate: 91 },
  { date: "Sep 14", rate: 97 },
  { date: "Sep 15", rate: 93 },
  { date: "Sep 16", rate: 98 },
  { date: "Sep 17", rate: 94 },
  { date: "Sep 18", rate: 89 },
  { date: "Sep 19", rate: 96 },
  { date: "Sep 20", rate: 97 },
  { date: "Sep 21", rate: 91 },
  { date: "Sep 22", rate: 96 },
  { date: "Sep 23", rate: 98 },
  { date: "Sep 24", rate: 92 },
  { date: "Sep 25", rate: 94 },
];

export const adminOverviewStats: AdminOverviewStats = {
  totalHeadcount: 312,
  newHiresThisMonth: 6,
  attritionRateYtd: 4.2,
  openPositions: { audit: 3, tax: 4, legal: 2 },
  payrollRunTotal: 13_400_000,
  payrollCutoffLabel: "Oct 25",
};

export const payrollRunSteps: PayrollRunStep[] = [
  { label: "Timekeeping locked — Sept 25", status: "done" },
  { label: "Payroll computation completed", status: "done" },
  { label: "Statutory remittances (SSS, PhilHealth, Pag-IBIG) in progress", status: "current" },
  { label: "Payslips released — scheduled Oct 30", status: "pending" },
];

export const headcountByOffice: OfficeHeadcount[] = [
  { office: "Cebu HQ", count: 168 },
  { office: "Manila", count: 96 },
  { office: "Davao", count: 48 },
];

export const payrollCostBreakdown: PayrollCostSegment[] = [
  { label: "Basic pay", percent: 68 },
  { label: "Statutory", percent: 14 },
  { label: "Allowances", percent: 11 },
  { label: "Overtime", percent: 7 },
];

export let complianceCalendar: ComplianceItem[] = [
  { id: "c-1", filing: "Monthly contribution remittance", agency: "SSS", due: "Sept 30", status: "Filed" },
  { id: "c-2", filing: "Monthly premium remittance", agency: "PhilHealth", due: "Sept 30", status: "Filed" },
  { id: "c-3", filing: "Monthly contribution remittance", agency: "Pag-IBIG", due: "Sept 30", status: "Due soon", note: "Due in 5 days" },
  { id: "c-4", filing: "Withholding tax remittance (1601-C)", agency: "BIR", due: "Oct 10", status: "Due soon", note: "Due in 15 days" },
  { id: "c-5", filing: "Certificate of Compensation (2316)", agency: "BIR", due: "Sept 15", status: "Overdue", note: "3 employees" },
];

export function setComplianceCalendar(next: ComplianceItem[]) {
  complianceCalendar = next;
}

export let employeeDirectory: Employee[] = [
  { id: "MSMA-00482", name: "Angela Dela Cruz", initials: "AD", position: "Senior Tax Associate", department: "Tax Advisory", office: "Cebu HQ", cluster: "RPM", status: "Active", reportsToId: "admin" },
  { id: "MSMA-00317", name: "Rafael Ortiz", initials: "RO", position: "Team Lead", department: "Audit & Assurance", office: "Cebu HQ", cluster: "VCM", status: "Active", reportsToId: "admin" },
  { id: "MSMA-00560", name: "Bea Santos", initials: "BS", position: "Audit Associate", department: "Audit & Assurance", office: "Cebu HQ", cluster: "VCM", status: "On leave", reportsToId: "MSMA-00317" },
  { id: "MSMA-00611", name: "Miguel Reyes", initials: "MR", position: "Legal Associate", department: "Corporate Legal", office: "Manila", cluster: "ADS", status: "Active", reportsToId: "admin" },
  { id: "MSMA-00098", name: "Lourdes Vitug", initials: "LV", position: "Bookkeeper", department: "Bookkeeping", office: "Davao", cluster: "RPM", status: "Active", reportsToId: "admin" },
  { id: "MSMA-00203", name: "Carla Uy", initials: "CU", position: "Senior Associate", department: "Audit & Assurance", office: "Cebu HQ", cluster: "VCM", status: "Active", reportsToId: "MSMA-00317" },
  { id: "MSMA-00276", name: "Jon Ababa", initials: "JA", position: "Associate", department: "Audit & Assurance", office: "Cebu HQ", cluster: "ADS", status: "Active", reportsToId: "MSMA-00317" },
  { id: "MSMA-00341", name: "Dennis Lim", initials: "DL", position: "Associate", department: "Audit & Assurance", office: "Cebu HQ", cluster: "RPM", status: "On leave", reportsToId: "MSMA-00317" },
  { id: "MSMA-00398", name: "Grace Tan", initials: "GT", position: "Audit Associate", department: "Audit & Assurance", office: "Cebu HQ", cluster: "VCM", status: "On leave", reportsToId: "MSMA-00317" },
  { id: "MSMA-00623", name: "Paolo Cruz", initials: "PC", position: "Tax Associate", department: "Tax Advisory", office: "Cebu HQ", cluster: "ADS", status: "Active", reportsToId: "MSMA-00482" },
  { id: "MSMA-00701", name: "Ramon Bautista", initials: "RB", position: "Bookkeeper", department: "Bookkeeping", office: "Davao", cluster: "RPM", status: "Active", reportsToId: "admin" },
  { id: "MSMA-00733", name: "Michelle Aquino", initials: "MA", position: "Paralegal", department: "Corporate Legal", office: "Manila", cluster: "ADS", status: "Active", reportsToId: "admin" },
  { id: "MSMA-00812", name: "Joel Nierves", initials: "JN", position: "IT Support Associate", department: "Admin & Support", office: "Cebu HQ", cluster: "Admin & Support", status: "Active", reportsToId: "admin" },
  { id: "MSMA-00845", name: "Ferdz Salazar", initials: "FS", position: "Liaison Officer", department: "Admin & Support", office: "Cebu HQ", cluster: "Admin & Support", status: "Active", reportsToId: "admin" },
];

export function setEmployeeDirectory(next: Employee[]) {
  employeeDirectory = next;
}

export const onboardingPipeline: OnboardingStage[] = [
  { stage: "Offer accepted", count: 2 },
  { stage: "Documents submitted", count: 3 },
  { stage: "Day 1 setup", count: 1 },
];

export const workforceAlerts: WorkforceAlert[] = [
  {
    id: "wa-1",
    employeeName: "Bea Santos",
    employeeInitials: "BS",
    category: "Punctuality",
    message: "3 late clock-ins this week (avg 14 min) — breaks a 6-week on-time streak",
    severity: "warn",
    detectedLabel: "Detected 2 hrs ago",
  },
  {
    id: "wa-2",
    employeeName: "Miguel Reyes",
    employeeInitials: "MR",
    category: "Overtime",
    message: "Logged 12.5 hrs overtime this week — 3x the team average",
    severity: "crit",
    detectedLabel: "Detected this morning",
  },
  {
    id: "wa-3",
    employeeName: "Audit & Assurance",
    employeeInitials: "AA",
    category: "Attendance",
    message: "Team attendance down 8% vs. the trailing 30-day average",
    severity: "warn",
    detectedLabel: "Detected yesterday",
  },
  {
    id: "wa-4",
    employeeName: "Jon Ababa",
    employeeInitials: "JA",
    category: "Leave pattern",
    message: "Sick leave filed on 3 of the last 4 Fridays — recommend a check-in",
    severity: "info",
    detectedLabel: "Detected 3 days ago",
  },
];

export let employeeBenefits: EmployeeBenefit[] = [
  { id: "b-1", name: "HMO", provider: "Maxicare", memberId: "MX-88213", status: "Active" },
  { id: "b-2", name: "SSS", provider: "Social Security System", memberId: "34-1122334-5", status: "Active" },
  { id: "b-3", name: "PhilHealth", provider: "PhilHealth", memberId: "12-345678901-2", status: "Active" },
  { id: "b-4", name: "Pag-IBIG", provider: "HDMF", memberId: "1211-2233-4455", status: "Active" },
  { id: "b-5", name: "HMO — Dependent", provider: "Maxicare", memberId: "Enrollment closes Sept 30", status: "Pending" },
];

export function setEmployeeBenefits(next: EmployeeBenefit[]) {
  employeeBenefits = next;
}

export const teamRoster: TeamRosterMember[] = [
  { id: "MSMA-00560", name: "Bea Santos", initials: "BS", position: "Audit Associate", tenureLabel: "2 yrs 3 mos", email: "bea.santos@msma.ph", status: "On leave" },
  { id: "MSMA-00591", name: "Miguel Reyes", initials: "MR", position: "Audit Associate", tenureLabel: "1 yr 8 mos", email: "miguel.reyes@msma.ph", status: "Active" },
  { id: "MSMA-00602", name: "Carla Uy", initials: "CU", position: "Senior Associate", tenureLabel: "3 yrs 1 mo", email: "carla.uy@msma.ph", status: "Active" },
  { id: "MSMA-00614", name: "Jon Ababa", initials: "JA", position: "Associate", tenureLabel: "11 mos", email: "jon.ababa@msma.ph", status: "Active" },
  { id: "MSMA-00625", name: "Dennis Lim", initials: "DL", position: "Associate", tenureLabel: "9 mos", email: "dennis.lim@msma.ph", status: "On leave" },
  { id: "MSMA-00398", name: "Grace Tan", initials: "GT", position: "Audit Associate", tenureLabel: "1 yr 4 mos", email: "grace.tan@msma.ph", status: "On leave" },
];

export const jobRequisitions: JobRequisition[] = [
  { id: "jr-1", title: "Audit Associate", department: "Audit & Assurance", openings: 3, applicants: 21, stage: "Interviewing" },
  { id: "jr-2", title: "Tax Associate", department: "Tax Advisory", openings: 4, applicants: 14, stage: "Sourcing" },
  { id: "jr-3", title: "Corporate Lawyer", department: "Corporate Legal", openings: 2, applicants: 6, stage: "Offer extended" },
  { id: "jr-4", title: "Bookkeeper", department: "Bookkeeping", openings: 1, applicants: 9, stage: "Sourcing" },
];

export const managerTeamStats = {
  teamHeadcount: 6,
  onLeaveToday: 3,
  attendanceRate: 94,
};

export let performanceReviewStatuses: Record<string, "Submitted" | "Pending"> = {
  "MSMA-00560": "Submitted",
  "MSMA-00591": "Submitted",
  "MSMA-00602": "Submitted",
  "MSMA-00614": "Submitted",
  "MSMA-00625": "Pending",
  "MSMA-00398": "Pending",
};

export function setPerformanceReviewStatuses(next: Record<string, "Submitted" | "Pending">) {
  performanceReviewStatuses = next;
}

const defaultManagerProfile: PartnerProfile = {
  name: "Rafael Ortiz",
  initials: "RO",
  title: "Audit & Assurance Team Lead",
  email: "rafael.ortiz@msma.ph",
  phone: "+63 917 555 0142",
  office: "Cebu HQ",
  emergencyContact: "",
  about: "",
};

const MANAGER_PROFILE_KEY = "msma-hris-partner-profile";

// The Partner's own profile is the one record in this prototype that
// survives a reload, so the info they enter in Settings sticks.
function loadManagerProfile(): PartnerProfile {
  try {
    const stored = localStorage.getItem(MANAGER_PROFILE_KEY);
    if (stored) return { ...defaultManagerProfile, ...(JSON.parse(stored) as Partial<PartnerProfile>) };
  } catch {
    // Storage blocked or corrupt — fall back to the seed profile.
  }
  return defaultManagerProfile;
}

export let currentManager: PartnerProfile = loadManagerProfile();

export function setCurrentManager(next: PartnerProfile) {
  currentManager = next;
  try {
    localStorage.setItem(MANAGER_PROFILE_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal: the change still applies for this session.
  }
}

export let attendanceRequests: AttendanceRequest[] = [
  { id: "ar-1", employeeName: "Bea Santos", employeeInitials: "BS", employeeRole: "Audit Associate", kind: "Missed clock-out", date: "Sept 24, 2026", recordedTime: "In 8:52 AM · Out —", requestedTime: "Out 6:15 PM", reason: "Left straight from the client site in Mandaue; scanner was not reachable.", status: "Pending", filedOn: "2026-09-25" },
  { id: "ar-2", employeeName: "Carla Uy", employeeInitials: "CU", employeeRole: "Senior Associate", kind: "Late justification", date: "Sept 25, 2026", recordedTime: "In 9:32 AM", requestedTime: "In 9:32 AM (excused)", reason: "Flooding along Banilad; team lead was informed by 8:30 AM.", status: "Pending", filedOn: "2026-09-25" },
  { id: "ar-3", employeeName: "Jon Ababa", employeeInitials: "JA", employeeRole: "Associate", kind: "Remote work", date: "Sept 26, 2026", recordedTime: "No scan", requestedTime: "WFH 9:00 AM – 6:00 PM", reason: "Working remotely on the Q3 inventory count report.", status: "Pending", filedOn: "2026-09-26" },
  { id: "ar-4", employeeName: "Miguel Reyes", employeeInitials: "MR", employeeRole: "Audit Associate", kind: "Time correction", date: "Sept 23, 2026", recordedTime: "In 10:04 AM", requestedTime: "In 8:56 AM", reason: "Fingerprint scanner failed to read; security logbook shows 8:56 AM.", status: "Pending", filedOn: "2026-09-24" },
  { id: "ar-5", employeeName: "Grace Tan", employeeInitials: "GT", employeeRole: "Audit Associate", kind: "Missed clock-in", date: "Sept 22, 2026", recordedTime: "In — · Out 6:02 PM", requestedTime: "In 8:48 AM", reason: "Forgot to scan in after the morning client call.", status: "Approved", filedOn: "2026-09-22" },
  { id: "ar-6", employeeName: "Dennis Lim", employeeInitials: "DL", employeeRole: "Associate", kind: "Late justification", date: "Sept 19, 2026", recordedTime: "In 10:40 AM", requestedTime: "In 10:40 AM (excused)", reason: "Overslept.", status: "Declined", filedOn: "2026-09-19" },
];

export function setAttendanceRequests(next: AttendanceRequest[]) {
  attendanceRequests = next;
}

export const payrollCutoff = {
  label: "Sept 16–30, 2026",
  payDate: "Sept 30, 2026",
  // Must match the employee-side payslip for the same cutoff so releasing
  // payroll here flips that payslip to Paid.
  payslipId: "PS-2609B",
};

export let payrollEntries: PayrollEntry[] = [
  { employeeId: "MSMA-00482", monthlyBasic: 70000, allowance: 4000, overtimeHours: 6, otherDeductions: 200, status: "Draft" },
  { employeeId: "MSMA-00317", monthlyBasic: 95000, allowance: 5000, overtimeHours: 0, otherDeductions: 0, status: "Draft" },
  { employeeId: "MSMA-00560", monthlyBasic: 32000, allowance: 2000, overtimeHours: 0, otherDeductions: 0, status: "Draft" },
  { employeeId: "MSMA-00611", monthlyBasic: 45000, allowance: 3000, overtimeHours: 4, otherDeductions: 500, status: "Draft" },
  { employeeId: "MSMA-00098", monthlyBasic: 26000, allowance: 1500, overtimeHours: 0, otherDeductions: 0, status: "Draft" },
  { employeeId: "MSMA-00203", monthlyBasic: 48000, allowance: 3000, overtimeHours: 8, otherDeductions: 0, status: "Draft" },
  { employeeId: "MSMA-00276", monthlyBasic: 28000, allowance: 2000, overtimeHours: 2.5, otherDeductions: 0, status: "Draft" },
  { employeeId: "MSMA-00341", monthlyBasic: 28000, allowance: 2000, overtimeHours: 0, otherDeductions: 1000, status: "Draft" },
  { employeeId: "MSMA-00398", monthlyBasic: 32000, allowance: 2000, overtimeHours: 0, otherDeductions: 0, status: "Draft" },
  { employeeId: "MSMA-00623", monthlyBasic: 34000, allowance: 2000, overtimeHours: 3, otherDeductions: 0, status: "Draft" },
  { employeeId: "MSMA-00701", monthlyBasic: 25000, allowance: 1500, overtimeHours: 0, otherDeductions: 0, status: "Draft" },
  { employeeId: "MSMA-00733", monthlyBasic: 30000, allowance: 2000, overtimeHours: 0, otherDeductions: 0, status: "Draft" },
  { employeeId: "MSMA-00812", monthlyBasic: 27000, allowance: 1500, overtimeHours: 5, otherDeductions: 0, status: "Draft" },
  { employeeId: "MSMA-00845", monthlyBasic: 22000, allowance: 3000, overtimeHours: 0, otherDeductions: 0, status: "Draft" },
];

export function setPayrollEntries(next: PayrollEntry[]) {
  payrollEntries = next;
}

export const myDtrLog: DtrLogEntry[] = [
  { date: "Sept 25, 2026", timeIn: "8:58 AM", timeOut: "6:05 PM", status: "On time", location: "Onsite", method: "Fingerprint" },
  { date: "Sept 24, 2026", timeIn: "9:14 AM", timeOut: "6:02 PM", status: "Late", location: "Remote", method: "Face Scan" },
  { date: "Sept 23, 2026", timeIn: "8:47 AM", timeOut: "5:58 PM", status: "On time", location: "Onsite", method: "Fingerprint" },
  { date: "Sept 22, 2026", timeIn: "8:52 AM", timeOut: "6:10 PM", status: "On time", location: "Remote", method: "Face Scan" },
  { date: "Sept 19, 2026", timeIn: "8:55 AM", timeOut: "6:00 PM", status: "On time", location: "Onsite", method: "Fingerprint" },
  { date: "Sept 18, 2026", timeIn: "—", timeOut: "—", status: "Absent", location: "Onsite", method: "Fingerprint" },
  { date: "Sept 17, 2026", timeIn: "8:50 AM", timeOut: "6:03 PM", status: "On time", location: "Onsite", method: "Fingerprint" },
];

export let certificateRequests: CertificateRequest[] = [
  { id: "cr-1", type: "Certificate of Employment", purpose: "Bank loan application", status: "Released", requestedOn: "2026-08-14" },
];

export function setCertificateRequests(next: CertificateRequest[]) {
  certificateRequests = next;
}

const defaultAdminProfile: AdminProfile = {
  name: "Dinah Marquez",
  initials: "DM",
  title: "HR & People Operations Head",
  email: "dinah.marquez@msma.ph",
  phone: "+63 917 555 0118",
  office: "Cebu HQ",
  emergencyContact: "",
  about: "",
};

const ADMIN_PROFILE_KEY = "msma-hris-admin-profile";

// Like the Partner's, HR's own profile survives a reload so Settings edits stick.
function loadAdminProfile(): AdminProfile {
  try {
    const stored = localStorage.getItem(ADMIN_PROFILE_KEY);
    if (stored) return { ...defaultAdminProfile, ...(JSON.parse(stored) as Partial<AdminProfile>) };
  } catch {
    // Storage blocked or corrupt — fall back to the seed profile.
  }
  return defaultAdminProfile;
}

export let currentAdmin: AdminProfile = loadAdminProfile();

export function setCurrentAdmin(next: AdminProfile) {
  currentAdmin = next;
  try {
    localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal: the change still applies for this session.
  }
}

export let offboardingCases: OffboardingCase[] = [
  { id: "off-1", employeeName: "Grace Tan", employeeInitials: "GT", department: "Audit & Assurance", lastDay: "Oct 15, 2026", stage: "Clearance in progress" },
  { id: "off-2", employeeName: "Paolo Cruz", employeeInitials: "PC", department: "Tax Advisory", lastDay: "Oct 31, 2026", stage: "Resignation filed" },
];

export function setOffboardingCases(next: OffboardingCase[]) {
  offboardingCases = next;
}

export let companyAssets: CompanyAsset[] = [
  { id: "as-1", type: "Laptop", assetTag: "LT-0231", assignedToName: "Angela Dela Cruz", assignedToInitials: "AD", issuedOn: "2024-02-10", status: "Issued" },
  { id: "as-2", type: "Company ID", assetTag: "ID-0482", assignedToName: "Angela Dela Cruz", assignedToInitials: "AD", issuedOn: "2024-02-01", status: "Issued" },
  { id: "as-3", type: "Laptop", assetTag: "LT-0198", assignedToName: "Rafael Ortiz", assignedToInitials: "RO", issuedOn: "2022-06-15", status: "Issued" },
  { id: "as-4", type: "Access Card", assetTag: "AC-1187", assignedToName: "Bea Santos", assignedToInitials: "BS", issuedOn: "2023-11-20", status: "Issued" },
  { id: "as-5", type: "Company Phone", assetTag: "PH-0344", assignedToName: "Miguel Reyes", assignedToInitials: "MR", issuedOn: "2023-04-02", status: "Under repair" },
  { id: "as-6", type: "Laptop", assetTag: "LT-0356", assignedToName: "Carla Uy", assignedToInitials: "CU", issuedOn: "2023-08-22", status: "Issued" },
  { id: "as-7", type: "Access Card", assetTag: "AC-1203", assignedToName: "Jon Ababa", assignedToInitials: "JA", issuedOn: "2025-01-10", status: "Issued" },
  { id: "as-8", type: "Laptop", assetTag: "LT-0104", assignedToName: "Grace Tan", assignedToInitials: "GT", issuedOn: "2024-11-05", status: "Returned" },
];

export function setCompanyAssets(next: CompanyAsset[]) {
  companyAssets = next;
}

export let trainingRecords: TrainingRecord[] = [
  { id: "tr-1", employeeName: "Angela Dela Cruz", employeeInitials: "AD", course: "Data Privacy Act Refresher", dueDate: "Oct 15, 2026", status: "In progress" },
  { id: "tr-2", employeeName: "Angela Dela Cruz", employeeInitials: "AD", course: "Anti-Money Laundering Basics", dueDate: "Nov 1, 2026", status: "Not started" },
  { id: "tr-3", employeeName: "Bea Santos", employeeInitials: "BS", course: "Data Privacy Act Refresher", dueDate: "Oct 15, 2026", status: "Completed" },
  { id: "tr-4", employeeName: "Miguel Reyes", employeeInitials: "MR", course: "Data Privacy Act Refresher", dueDate: "Oct 15, 2026", status: "Completed" },
  { id: "tr-5", employeeName: "Carla Uy", employeeInitials: "CU", course: "Anti-Money Laundering Basics", dueDate: "Nov 1, 2026", status: "In progress" },
  { id: "tr-6", employeeName: "Jon Ababa", employeeInitials: "JA", course: "Workplace Safety Orientation", dueDate: "Oct 1, 2026", status: "Not started" },
  { id: "tr-7", employeeName: "Dennis Lim", employeeInitials: "DL", course: "Workplace Safety Orientation", dueDate: "Oct 1, 2026", status: "Completed" },
];

export function setTrainingRecords(next: TrainingRecord[]) {
  trainingRecords = next;
}

export let employeeCases: EmployeeCase[] = [
  {
    id: "case-1",
    employeeName: "Jon Ababa",
    employeeInitials: "JA",
    type: "Attendance",
    filedBy: "Rafael Ortiz",
    status: "Under review",
    filedOn: "2026-09-18",
    summary: "Recurring late clock-ins flagged by workforce intelligence; verbal coaching scheduled.",
  },
  {
    id: "case-2",
    employeeName: "Dennis Lim",
    employeeInitials: "DL",
    type: "Conduct",
    filedBy: "Rafael Ortiz",
    status: "Resolved",
    filedOn: "2026-08-02",
    summary: "Dress code violation during client visit; addressed with a written reminder. No recurrence since.",
  },
  {
    id: "case-3",
    employeeName: "Bea Santos",
    employeeInitials: "BS",
    type: "Grievance",
    filedBy: "Rafael Ortiz",
    status: "Open",
    filedOn: "2026-09-24",
    summary: "Raised a workload concern following overtime spikes; scheduling a 1:1 to review team capacity.",
  },
];

export function setEmployeeCases(next: EmployeeCase[]) {
  employeeCases = next;
}

export let professionalLicenses: ProfessionalLicense[] = [
  {
    id: "lic-1",
    employeeId: "MSMA-00482",
    employeeName: "Angela Dela Cruz",
    employeeInitials: "AD",
    licenseType: "CPA",
    licenseNumber: "0123456",
    cpdUnitsEarned: 58,
    cpdUnitsRequired: 60,
    cycleEndDate: "Oct 1, 2026",
  },
  {
    id: "lic-2",
    employeeId: "MSMA-00317",
    employeeName: "Rafael Ortiz",
    employeeInitials: "RO",
    licenseType: "CPA",
    licenseNumber: "0087654",
    cpdUnitsEarned: 50,
    cpdUnitsRequired: 60,
    cycleEndDate: "Sept 20, 2026",
  },
  {
    id: "lic-3",
    employeeId: "MSMA-00203",
    employeeName: "Carla Uy",
    employeeInitials: "CU",
    licenseType: "CPA",
    licenseNumber: "0145233",
    cpdUnitsEarned: 60,
    cpdUnitsRequired: 60,
    cycleEndDate: "Mar 15, 2027",
  },
  {
    id: "lic-4",
    employeeId: "MSMA-00623",
    employeeName: "Paolo Cruz",
    employeeInitials: "PC",
    licenseType: "CPA",
    licenseNumber: "0198812",
    cpdUnitsEarned: 25,
    cpdUnitsRequired: 60,
    cycleEndDate: "Dec 1, 2026",
  },
];

export function setProfessionalLicenses(next: ProfessionalLicense[]) {
  professionalLicenses = next;
}

// --- 201 File: personal profile + pre-employment/identity documents ---
// Full detail here is HR/manager-only; the employee-facing API layer
// projects these down to a status-only checklist before returning them.

export let personnelProfiles: PersonnelProfile[] = [
  { employeeId: "MSMA-00482", birthDate: "1997-03-14", civilStatus: "Single", dependents: [] },
  {
    employeeId: "MSMA-00317",
    birthDate: "1988-06-02",
    civilStatus: "Married",
    dependents: [
      { id: "dep-1", name: "Liza Ortiz", relationship: "Spouse" },
      { id: "dep-2", name: "Miko Ortiz", relationship: "Child", birthDate: "2015-09-10" },
    ],
  },
  { employeeId: "MSMA-00560", birthDate: "2000-01-22", civilStatus: "Single", dependents: [] },
  {
    employeeId: "MSMA-00611",
    birthDate: "1995-11-05",
    civilStatus: "Married",
    dependents: [{ id: "dep-3", name: "Anna Reyes", relationship: "Spouse" }],
  },
  {
    employeeId: "MSMA-00098",
    birthDate: "1974-04-18",
    civilStatus: "Widowed",
    dependents: [{ id: "dep-4", name: "Karl Vitug", relationship: "Child", birthDate: "2008-02-20" }],
  },
  {
    employeeId: "MSMA-00203",
    birthDate: "1993-02-27",
    civilStatus: "Married",
    dependents: [{ id: "dep-5", name: "Sofia Uy", relationship: "Child", birthDate: "2020-04-11" }],
  },
  { employeeId: "MSMA-00276", birthDate: "2002-08-30", civilStatus: "Single", dependents: [] },
  { employeeId: "MSMA-00341", birthDate: "1999-05-12", civilStatus: "Single", dependents: [] },
  {
    employeeId: "MSMA-00398",
    birthDate: "1997-07-19",
    civilStatus: "Married",
    dependents: [{ id: "dep-6", name: "Leo Tan", relationship: "Child", birthDate: "2022-01-30" }],
  },
  { employeeId: "MSMA-00623", birthDate: "1998-10-03", civilStatus: "Single", dependents: [] },
  {
    employeeId: "MSMA-00701",
    birthDate: "1981-01-09",
    civilStatus: "Married",
    dependents: [
      { id: "dep-7", name: "Ana Bautista", relationship: "Spouse" },
      { id: "dep-8", name: "Rico Bautista", relationship: "Child", birthDate: "2010-06-18" },
    ],
  },
  { employeeId: "MSMA-00733", birthDate: "1996-03-25", civilStatus: "Single", dependents: [] },
  {
    employeeId: "MSMA-00812",
    birthDate: "1992-12-14",
    civilStatus: "Married",
    dependents: [{ id: "dep-9", name: "Mia Nierves", relationship: "Spouse" }],
  },
  {
    employeeId: "MSMA-00845",
    birthDate: "1966-02-08",
    civilStatus: "Married",
    dependents: [{ id: "dep-10", name: "Elena Salazar", relationship: "Spouse" }],
  },
];

export function setPersonnelProfiles(next: PersonnelProfile[]) {
  personnelProfiles = next;
}

const PERSONNEL_DOCUMENT_TYPES: PersonnelDocumentType[] = [
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

const LICENSED_EMPLOYEE_IDS = new Set(professionalLicenses.map((l) => l.employeeId));

function buildPersonnelDocuments(
  employeeId: string,
  overrides: Partial<Record<PersonnelDocumentType, Partial<PersonnelDocument>>> = {},
): PersonnelDocument[] {
  const profile = personnelProfiles.find((p) => p.employeeId === employeeId);
  const married = profile?.civilStatus === "Married";
  const hasChild = profile?.dependents.some((d) => d.relationship === "Child") ?? false;
  const licensed = LICENSED_EMPLOYEE_IDS.has(employeeId);

  return PERSONNEL_DOCUMENT_TYPES.map((type, i) => {
    let status: PersonnelDocument["status"] = "Submitted";
    if (type === "Marriage Certificate (PSA)" && !married) status = "Not applicable";
    if (type === "Child's Birth Certificate" && !hasChild) status = "Not applicable";
    if (type === "Professional License" && !licensed) status = "Not applicable";

    const doc: PersonnelDocument = {
      id: `doc-${employeeId}-${i + 1}`,
      employeeId,
      type,
      status,
      ...(status === "Submitted"
        ? { fileName: `${type.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`, uploadedOn: "2024-01-15" }
        : {}),
      ...(type === "Valid Government ID" && status === "Submitted"
        ? { idType: "UMID", idNumber: `01-${employeeId.slice(-7)}-0`, idExpiry: "2028-05-01" }
        : {}),
      ...(type === "Professional License" && licensed
        ? {
            licenseNumber: professionalLicenses.find((l) => l.employeeId === employeeId)?.licenseNumber,
            licenseExpiry: "2029-01-01",
          }
        : {}),
    };
    return { ...doc, ...overrides[type] };
  });
}

export interface NewHireGovernmentId {
  idType: string;
  idNumber?: string;
  idExpiry?: string;
  fileName?: string;
}

/** A fresh 201 checklist for someone just added through the directory:
 * everything Missing (situational documents Not applicable) except the
 * government ID, when HR scanned one while adding them. */
export function buildNewHireDocuments(employeeId: string, governmentId?: NewHireGovernmentId): PersonnelDocument[] {
  const situational: PersonnelDocumentType[] = [
    "Marriage Certificate (PSA)",
    "Child's Birth Certificate",
    "Professional License",
  ];
  const today = new Date().toISOString().slice(0, 10);
  return PERSONNEL_DOCUMENT_TYPES.map((type, i) => {
    const doc: PersonnelDocument = {
      id: `doc-${employeeId}-${i + 1}`,
      employeeId,
      type,
      status: situational.includes(type) ? "Not applicable" : "Missing",
    };
    if (type === "Valid Government ID" && governmentId) {
      return { ...doc, status: "Submitted", uploadedOn: today, ...governmentId };
    }
    return doc;
  });
}

export let personnelDocuments: PersonnelDocument[] = [
  ...buildPersonnelDocuments("MSMA-00482", {
    "Valid Government ID": { idType: "UMID", idNumber: "01-0482-1997-0", idExpiry: "2026-10-05" },
    "Professional License": { status: "Verified", licenseNumber: "0123456", licenseExpiry: "2027-06-15" },
    "Pre-Employment Medical Result": { status: "Missing", fileName: undefined, uploadedOn: undefined },
  }),
  ...buildPersonnelDocuments("MSMA-00317", {
    "Application Form / Resume": { status: "Verified" },
    "Birth Certificate (PSA)": { status: "Verified" },
    "Valid Government ID": { status: "Verified", idType: "Passport", idNumber: "P1234567A", idExpiry: "2030-01-01" },
    "Professional License": { status: "Verified", licenseNumber: "0087654", licenseExpiry: "2029-01-01" },
    "NBI Clearance": { status: "Verified" },
  }),
  ...buildPersonnelDocuments("MSMA-00560", {
    "NBI Clearance": { status: "Missing", fileName: undefined, uploadedOn: undefined },
    "Police/Barangay Clearance": { status: "Missing", fileName: undefined, uploadedOn: undefined },
  }),
  ...buildPersonnelDocuments("MSMA-00611"),
  ...buildPersonnelDocuments("MSMA-00098"),
  ...buildPersonnelDocuments("MSMA-00203", {
    "Professional License": { status: "Verified", licenseNumber: "0145233", licenseExpiry: "2028-03-15" },
  }),
  ...buildPersonnelDocuments("MSMA-00276"),
  ...buildPersonnelDocuments("MSMA-00341"),
  ...buildPersonnelDocuments("MSMA-00398"),
  ...buildPersonnelDocuments("MSMA-00623", {
    "Professional License": { status: "Submitted", licenseNumber: "0198812", licenseExpiry: "2027-12-01" },
  }),
  ...buildPersonnelDocuments("MSMA-00701"),
  ...buildPersonnelDocuments("MSMA-00733"),
  ...buildPersonnelDocuments("MSMA-00812"),
  ...buildPersonnelDocuments("MSMA-00845"),
];

export function setPersonnelDocuments(next: PersonnelDocument[]) {
  personnelDocuments = next;
}

export let auditLogEntries: AuditLogEntry[] = [
  {
    id: "audit-1",
    employeeId: "MSMA-00482",
    actorName: "Dinah Marquez",
    actorRole: "admin",
    action: "Verified",
    target: "Professional License",
    detail: "Marked Verified",
    timestamp: "2026-09-20T10:15:00",
  },
  {
    id: "audit-2",
    employeeId: "MSMA-00560",
    actorName: "Rafael Ortiz",
    actorRole: "manager",
    action: "Viewed",
    target: "201 File",
    timestamp: "2026-09-25T09:02:00",
  },
];

export function setAuditLogEntries(next: AuditLogEntry[]) {
  auditLogEntries = next;
}
