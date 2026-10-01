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
  Applicant,
  ApplicantProfession,
  JobRequisition,
  LeaveBalance,
  LeaveOverviewStats,
  LeavePolicy,
  LeaveRequest,
  LeaveType,
  OffboardingCase,
  OfficeHeadcount,
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
  OnboardingSubmission,
  ProfessionalLicense,
  TeamRosterMember,
  TrainingRecord,
  UploadedDocument,
  WorkforceAlert,
} from "./types";

// --- Demo persistence ---
// People added through Onboarding (and the signed-in employee's account) are kept in this browser so
// the hire flow survives a reload. Everything else stays in memory, as before. A backend replaces this.

export const PEOPLE_STORE_KEY = "msma-demo-people-v1";

interface PeopleStore {
  currentEmployee?: Employee;
  employeeDirectory?: Employee[];
  personnelProfiles?: PersonnelProfile[];
  personnelDocuments?: PersonnelDocument[];
  auditLogEntries?: AuditLogEntry[];
  onboardingSubmissions?: OnboardingSubmission[];
  applicants?: Applicant[];
  jobRequisitions?: JobRequisition[];
}

function loadPeopleStore(): PeopleStore {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(PEOPLE_STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    if (!parsed || typeof parsed !== "object") return {};
    // Anything that isn't the shape we expect is ignored rather than trusted.
    const list = <T,>(v: unknown) => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as T[]) : undefined);
    const me = parsed.currentEmployee as Employee | undefined;
    return {
      currentEmployee: me && typeof me.id === "string" && typeof me.name === "string" ? me : undefined,
      employeeDirectory: list<Employee>(parsed.employeeDirectory)?.filter((e) => typeof e.id === "string" && typeof e.name === "string"),
      personnelProfiles: list<PersonnelProfile>(parsed.personnelProfiles)?.map((p) => ({ ...p, dependents: Array.isArray(p.dependents) ? p.dependents : [] })),
      personnelDocuments: list<PersonnelDocument>(parsed.personnelDocuments),
      auditLogEntries: list<AuditLogEntry>(parsed.auditLogEntries),
      onboardingSubmissions: list<OnboardingSubmission>(parsed.onboardingSubmissions)?.filter((s) => typeof s.id === "string" && s.input && typeof s.input.firstName === "string" && typeof s.input.lastName === "string"),
      applicants: list<Applicant>(parsed.applicants)?.filter((a) => typeof a.id === "string" && typeof a.firstName === "string" && typeof a.lastName === "string" && typeof a.requisitionId === "string"),
      jobRequisitions: list<JobRequisition>(parsed.jobRequisitions)?.filter((r) => typeof r.id === "string" && typeof r.title === "string"),
    };
  } catch {
    return {};
  }
}

const stored = loadPeopleStore();

function savePeopleStore() {
  try {
    localStorage.setItem(
      PEOPLE_STORE_KEY,
      JSON.stringify({ currentEmployee, employeeDirectory, personnelProfiles, personnelDocuments, auditLogEntries, onboardingSubmissions, applicants, jobRequisitions }),
    );
  } catch {
    // Storage full or blocked — the data still lives until the page reloads.
  }
}

export let currentEmployee: Employee = stored.currentEmployee ?? {
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
  savePeopleStore();
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
  // Signed off by the Partner — waiting on HR.
  { id: "lr-1", employeeName: "Bea Santos", employeeInitials: "BS", employeeRole: "Audit Associate", type: "Vacation", detail: "Oct 6–8 · 3 days", status: "Pending", requestedOn: "2026-09-25", partnerApproved: true, startDate: "2026-10-06", endDate: "2026-10-08", days: 3, reason: "Family trip to Bohol" },
  { id: "lr-2", employeeName: "Miguel Reyes", employeeInitials: "MR", employeeRole: "Legal Associate", type: "Overtime", detail: "Sept 24 · 2.5 hrs", status: "Pending", requestedOn: "2026-09-24", partnerApproved: true, startDate: "2026-09-24", endDate: "2026-09-24", reason: "Board resolution filing deadline" },
  { id: "lr-3", employeeName: "Carla Uy", employeeInitials: "CU", employeeRole: "Senior Associate", type: "Sick", detail: "Sept 22 · 1 day", status: "Pending", requestedOn: "2026-09-24", partnerApproved: true, startDate: "2026-09-22", endDate: "2026-09-22", days: 1, attachmentNote: "Medical certificate attached" },
  // Still with the Partner.
  { id: "lr-4", employeeName: "Jon Ababa", employeeInitials: "JA", employeeRole: "Associate", type: "Certificate of Employment", detail: "Requested Sept 23", status: "Pending", requestedOn: "2026-09-23" },
  { id: "lr-5", employeeName: "Dennis Lim", employeeInitials: "DL", employeeRole: "Associate", type: "Emergency", detail: "Sept 25 · 1 day", status: "Pending", requestedOn: "2026-09-25", startDate: "2026-09-25", endDate: "2026-09-25", days: 1 },
  // Returned to the employee.
  { id: "lr-6", employeeName: "Paolo Cruz", employeeInitials: "PC", employeeRole: "Tax Associate", type: "Vacation", detail: "Oct 19–23 · 5 days", status: "Returned", requestedOn: "2026-09-23", partnerApproved: true, startDate: "2026-10-19", endDate: "2026-10-23", days: 5, reason: "Visiting family in Iloilo", returnNote: "Please attach your travel itinerary." },
  // Approved.
  { id: "lr-7", employeeName: "Grace Tan", employeeInitials: "GT", employeeRole: "Audit Associate", type: "Vacation", detail: "Sept 29–Oct 2 · 4 days", status: "Approved", requestedOn: "2026-09-15", partnerApproved: true, startDate: "2026-09-29", endDate: "2026-10-02", days: 4, reason: "Sister's wedding in Dumaguete" },
  { id: "lr-8", employeeName: "Dennis Lim", employeeInitials: "DL", employeeRole: "Associate", type: "Vacation", detail: "Oct 6 · 1 day", status: "Approved", requestedOn: "2026-09-18", partnerApproved: true, startDate: "2026-10-06", endDate: "2026-10-06", days: 1, reason: "Personal errand" },
  { id: "lr-9", employeeName: "Ramon Bautista", employeeInitials: "RB", employeeRole: "Bookkeeper", type: "Vacation", detail: "Oct 7 · 1 day", status: "Approved", requestedOn: "2026-09-19", partnerApproved: true, startDate: "2026-10-07", endDate: "2026-10-07", days: 1, reason: "Child's school program" },
  { id: "lr-10", employeeName: "Lourdes Vitug", employeeInitials: "LV", employeeRole: "Bookkeeper", type: "Vacation", detail: "Oct 15–16 · 2 days", status: "Approved", requestedOn: "2026-09-20", partnerApproved: true, startDate: "2026-10-15", endDate: "2026-10-16", days: 2, reason: "Out-of-town trip" },
  { id: "lr-11", employeeName: "Jon Ababa", employeeInitials: "JA", employeeRole: "Associate", type: "Vacation", detail: "Sept 15–16 · 2 days", status: "Approved", requestedOn: "2026-09-08", partnerApproved: true, startDate: "2026-09-15", endDate: "2026-09-16", days: 2 },
  { id: "lr-12", employeeName: "Joel Nierves", employeeInitials: "JN", employeeRole: "IT Support Associate", type: "Sick", detail: "Sept 14 · 1 day", status: "Approved", requestedOn: "2026-09-15", partnerApproved: true, startDate: "2026-09-14", endDate: "2026-09-14", days: 1, attachmentNote: "Medical certificate attached" },
  { id: "lr-13", employeeName: "Rafael Ortiz", employeeInitials: "RO", employeeRole: "Team Lead", type: "Vacation", detail: "Sept 8–9 · 2 days", status: "Approved", requestedOn: "2026-09-01", partnerApproved: true, startDate: "2026-09-08", endDate: "2026-09-09", days: 2 },
  { id: "lr-14", employeeName: "Carla Uy", employeeInitials: "CU", employeeRole: "Senior Associate", type: "Vacation", detail: "Sept 3 · 1 day", status: "Approved", requestedOn: "2026-08-28", partnerApproved: true, startDate: "2026-09-03", endDate: "2026-09-03", days: 1 },
  { id: "lr-15", employeeName: "Michelle Aquino", employeeInitials: "MA", employeeRole: "Paralegal", type: "Sick", detail: "Sept 17 · 1 day", status: "Approved", requestedOn: "2026-09-18", partnerApproved: true, startDate: "2026-09-17", endDate: "2026-09-17", days: 1 },
  { id: "lr-16", employeeName: "Ramon Bautista", employeeInitials: "RB", employeeRole: "Bookkeeper", type: "Sick", detail: "Sept 21 · 1 day", status: "Approved", requestedOn: "2026-09-22", partnerApproved: true, startDate: "2026-09-21", endDate: "2026-09-21", days: 1 },
  { id: "lr-17", employeeName: "Paolo Cruz", employeeInitials: "PC", employeeRole: "Tax Associate", type: "Vacation", detail: "Sept 4 · 1 day", status: "Approved", requestedOn: "2026-08-29", partnerApproved: true, startDate: "2026-09-04", endDate: "2026-09-04", days: 1 },
  { id: "lr-18", employeeName: "Miguel Reyes", employeeInitials: "MR", employeeRole: "Legal Associate", type: "Sick", detail: "Sept 10 · 1 day", status: "Approved", requestedOn: "2026-09-11", partnerApproved: true, startDate: "2026-09-10", endDate: "2026-09-10", days: 1 },
  // Rejected.
  { id: "lr-19", employeeName: "Michelle Aquino", employeeInitials: "MA", employeeRole: "Paralegal", type: "Vacation", detail: "Oct 1–2 · 2 days", status: "Declined", requestedOn: "2026-09-21", partnerApproved: true, startDate: "2026-10-01", endDate: "2026-10-02", days: 2, reason: "Long weekend" },
  { id: "lr-20", employeeName: "Ferdz Salazar", employeeInitials: "FS", employeeRole: "Liaison Officer", type: "Vacation", detail: "Sept 28 · 1 day", status: "Declined", requestedOn: "2026-09-22", partnerApproved: true, startDate: "2026-09-28", endDate: "2026-09-28", days: 1 },
];

export function setLeaveRequests(next: LeaveRequest[]) {
  leaveRequests = next;
}

/** Credits used before the requests on file (carried over from the old system). */
export const priorLeaveUsage: Record<string, Partial<Record<LeaveType, number>>> = {
  "Bea Santos": { Vacation: 6.5 },
  "Carla Uy": { Sick: 7 },
  "Jon Ababa": { Vacation: 2 },
  "Dennis Lim": { Emergency: 1, Sick: 3 },
};

export const latesThisCutoff: Record<string, number> = {
  "Dennis Lim": 2,
  "Jon Ababa": 1,
};

export const leavePolicies: LeavePolicy[] = [
  { code: "VL", type: "Vacation", days: 15, accrual: "1.25 / month", cashConversion: "Yes · Dec" },
  { code: "SL", type: "Sick", days: 15, accrual: "1.25 / month", cashConversion: "No" },
  { code: "SIL", type: "Service Incentive", days: 5, accrual: "After 1 year", cashConversion: "Yes" },
  { code: "EL", type: "Emergency", days: 3, accrual: "Yearly", cashConversion: "No" },
  { code: "ML", type: "Maternity", days: 105, accrual: "RA 11210", cashConversion: "No" },
  { code: "PL", type: "Paternity", days: 7, accrual: "RA 8187", cashConversion: "No" },
  { code: "SPL", type: "Solo Parent", days: 7, accrual: "RA 11861", cashConversion: "No" },
  { code: "BL", type: "Bereavement", days: 3, accrual: "Company policy", cashConversion: "No" },
];

export const leaveOverviewStats: LeaveOverviewStats = {
  onLeaveToday: 9,
  onLeaveOffices: 3,
  utilizationPercent: 41,
  utilizationLastYearPercent: 38,
  vlToConvertDays: 126,
};

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
  { id: "c-1", filing: "Monthly contribution remittance", agency: "SSS", due: "Sept 30", status: "Filed", periodCovered: "August 2026", amount: 18375, referenceNo: "PRN 0826-44192" },
  { id: "c-2", filing: "Monthly premium remittance", agency: "PhilHealth", due: "Sept 30", status: "Filed", periodCovered: "August 2026", amount: 13550, referenceNo: "PHP-0826-7713" },
  { id: "c-3", filing: "Monthly contribution remittance", agency: "Pag-IBIG", due: "Sept 30", status: "Due soon", note: "Due in 5 days", periodCovered: "August 2026", amount: 2800 },
  { id: "c-4", filing: "Withholding tax remittance (1601-C)", agency: "BIR", due: "Oct 10", status: "Due soon", note: "Due in 15 days", periodCovered: "September 2026", amount: 42469.42 },
  { id: "c-5", filing: "Certificate of Compensation (2316)", agency: "BIR", due: "Sept 15", status: "Overdue", note: "3 employees", periodCovered: "2025" },
];

export function setComplianceCalendar(next: ComplianceItem[]) {
  complianceCalendar = next;
}

// Empty until new hires submit Onboarding and HR sets up their employment in Pipeline.
export let employeeDirectory: Employee[] = stored.employeeDirectory ?? [];

export function setEmployeeDirectory(next: Employee[]) {
  employeeDirectory = next;
  savePeopleStore();
}


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

export let jobRequisitions: JobRequisition[] = stored.jobRequisitions ?? [
  { id: "jr-1", title: "Audit Associate", department: "Audit & Assurance", cluster: "VCM", office: "Cebu HQ", openings: 3, applicants: 21, applicantsThisWeek: 5, stage: "Interviewing", approval: "Approved" },
  { id: "jr-2", title: "Tax Associate", department: "Tax Advisory", cluster: "RPM", office: "Cebu HQ", openings: 4, applicants: 14, applicantsThisWeek: 3, stage: "Sourcing", approval: "Approved" },
  { id: "jr-3", title: "Corporate Lawyer", department: "Corporate Legal", cluster: "ADS", office: "Manila", openings: 2, applicants: 6, applicantsThisWeek: 1, stage: "Offer extended", approval: "Approved" },
  { id: "jr-4", title: "Bookkeeper", department: "Bookkeeping", cluster: "RPM", office: "Davao", openings: 1, applicants: 9, applicantsThisWeek: 3, stage: "Sourcing", approval: "Pending L2" },
];

export function setJobRequisitions(next: JobRequisition[]) {
  jobRequisitions = next;
  savePeopleStore();
}

const seedProfessions: Record<string, ApplicantProfession> = {
  "ap-1": "BS Accountancy graduate",
  "ap-2": "Accounting student / undergrad",
  "ap-3": "CPA",
  "ap-4": "CPA",
  "ap-5": "BS Accountancy graduate",
  "ap-6": "CPA",
  "ap-7": "BS Accountancy graduate",
  "ap-8": "CPA",
  "ap-9": "CPA",
  "ap-10": "BS Accountancy graduate",
  "ap-11": "Other",
  "ap-12": "CPA",
  "ap-13": "Other",
  "ap-14": "Other",
  "ap-15": "BS Accountancy graduate",
};

export let applicants: Applicant[] = stored.applicants ?? ([
  { id: "ap-1", requisitionId: "jr-1", firstName: "Kristine Mae", lastName: "Abellana", email: "kristine.abellana@gmail.com", stage: "Applied", note: "JobStreet · Sep 28" },
  { id: "ap-2", requisitionId: "jr-1", firstName: "John Paul", lastName: "Ybañez", email: "jp.ybanez@gmail.com", stage: "Applied", note: "Referral · Sep 27" },
  { id: "ap-3", requisitionId: "jr-1", firstName: "Cyril", lastName: "Go", email: "cyril.go@yahoo.com", stage: "Applied", note: "LinkedIn · Sep 26" },
  { id: "ap-4", requisitionId: "jr-1", firstName: "Angelica", lastName: "Sy", email: "angelica.sy@gmail.com", stage: "Screening", note: "Exam 86% · Sep 24" },
  { id: "ap-5", requisitionId: "jr-1", firstName: "Mark", lastName: "Lao", email: "mark.lao@gmail.com", stage: "Screening", note: "Exam 79% · Sep 23" },
  { id: "ap-6", requisitionId: "jr-1", firstName: "Rachelle", lastName: "Tumulak", email: "rachelle.tumulak@gmail.com", stage: "Interview", note: "Partner interview · Oct 1, 2:00 PM" },
  { id: "ap-7", requisitionId: "jr-1", firstName: "Mark Anthony", lastName: "Cabahug", email: "ma.cabahug@gmail.com", stage: "Interview", note: "HR interview · Oct 2, 10:00 AM" },
  { id: "ap-8", requisitionId: "jr-1", firstName: "Cyrus", lastName: "Villamor", email: "cyrus.villamor@gmail.com", stage: "Offered", note: "Offer sent Sep 26 · expires Oct 3", offerExpires: "2026-10-03" },
  { id: "ap-9", requisitionId: "jr-1", firstName: "Joanna", lastName: "Villacura", email: "joanna.villacura@gmail.com", phone: "+63 917 552 0184", stage: "Hired", note: "Accepted · starts Oct 16", startDate: "2026-10-16" },
  { id: "ap-10", requisitionId: "jr-1", firstName: "Kenneth", lastName: "Go", email: "kenneth.go@gmail.com", stage: "Rejected", note: "Did not meet CPA requirement" },
  { id: "ap-11", requisitionId: "jr-2", firstName: "Patricia", lastName: "Lim", email: "patricia.lim@gmail.com", stage: "Applied", note: "JobStreet · Sep 29" },
  { id: "ap-12", requisitionId: "jr-2", firstName: "Ramon", lastName: "Dizon", email: "ramon.dizon@gmail.com", stage: "Screening", note: "Exam scheduled · Oct 1" },
  { id: "ap-13", requisitionId: "jr-3", firstName: "Liza", lastName: "Moreno", email: "liza.moreno@gmail.com", stage: "Applied", note: "Referral · Sep 25" },
  { id: "ap-14", requisitionId: "jr-3", firstName: "Paolo", lastName: "Santiago", email: "paolo.santiago@gmail.com", stage: "Screening", note: "Bar passer 2025 · Sep 22" },
  { id: "ap-15", requisitionId: "jr-4", firstName: "Jenny", lastName: "Alcantara", email: "jenny.alcantara@gmail.com", stage: "Applied", note: "Walk-in · Sep 28" },
] as Applicant[]).map((a) => ({ ...a, profession: seedProfessions[a.id] }));

export function setApplicants(next: Applicant[]) {
  applicants = next;
  savePeopleStore();
}

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
  shortLabel: "Sept 16–30",
  payDate: "Sept 30, 2026",
  timekeepingLockedOn: "Sept 25",
  payrollBank: "BDO",
  // Must match the employee-side payslip for the same cutoff so releasing
  // payroll here flips that payslip to Paid.
  payslipId: "PS-2609B",
};

/** Set once HR approves and releases the cutoff, e.g. "Sept 30, 4:12 PM". */
export let payrollReleasedAt: string | null = null;

export function setPayrollReleasedAt(next: string | null) {
  payrollReleasedAt = next;
}

export let payrollEntries: PayrollEntry[] = [
  { employeeId: "MSMA-00482", monthlyBasic: 70000, allowance: 4000, overtimeHours: 6, otherDeductions: 200, status: "Draft" },
  { employeeId: "MSMA-00317", monthlyBasic: 95000, allowance: 5000, overtimeHours: 0, otherDeductions: 0, status: "Draft" },
  { employeeId: "MSMA-00560", monthlyBasic: 32000, allowance: 2000, overtimeHours: 0, otherDeductions: 0, status: "Draft" },
  { employeeId: "MSMA-00611", monthlyBasic: 45000, allowance: 3000, overtimeHours: 4, otherDeductions: 500, status: "Draft", preApprovedOvertimeHours: 0 },
  { employeeId: "MSMA-00098", monthlyBasic: 26000, allowance: 1500, overtimeHours: 0, otherDeductions: 0, status: "Draft" },
  { employeeId: "MSMA-00203", monthlyBasic: 48000, allowance: 3000, overtimeHours: 8, otherDeductions: 0, status: "Draft", lastCutoffOvertimeHours: 2 },
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

export let personnelProfiles: PersonnelProfile[] = stored.personnelProfiles ?? [];

export function setPersonnelProfiles(next: PersonnelProfile[]) {
  personnelProfiles = next;
  savePeopleStore();
}

export const PERSONNEL_DOCUMENT_TYPES: PersonnelDocumentType[] = [
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

export interface NewHireGovernmentId {
  idType: string;
  idNumber?: string;
  idExpiry?: string;
  fileName?: string;
  extraFileNames?: string[];
}

/** Situational 201 documents: only needed when they apply to the person. */
export const SITUATIONAL_DOCUMENT_TYPES: PersonnelDocumentType[] = [
  "Marriage Certificate (PSA)",
  "Child's Birth Certificate",
  "Professional License",
  "Certificate of Employment (Previous)",
];

/** A fresh 201 checklist for a new hire: what they uploaded in Onboarding is Submitted
 * (awaiting HR verification), the rest Missing, and situational documents that don't apply
 * Not applicable. */
export function buildNewHireDocuments(
  employeeId: string,
  governmentId: NewHireGovernmentId | undefined,
  uploads: UploadedDocument[],
  /** Situational documents that apply to this person; the others are Not applicable. */
  applicable: PersonnelDocumentType[],
  license?: { number: string; expiry?: string },
  uploadedOn = new Date().toISOString().slice(0, 10),
): PersonnelDocument[] {
  return PERSONNEL_DOCUMENT_TYPES.map((type, i) => {
    const doc: PersonnelDocument = {
      id: `doc-${employeeId}-${i + 1}`,
      employeeId,
      type,
      status: SITUATIONAL_DOCUMENT_TYPES.includes(type) && !applicable.includes(type) ? "Not applicable" : "Missing",
    };
    if (type === "Professional License" && license) Object.assign(doc, { licenseNumber: license.number, licenseExpiry: license.expiry });
    const upload = uploads.find((u) => u.type === type);
    if (type === "Valid Government ID" && governmentId) {
      return { ...doc, status: "Submitted", uploadedOn, ...governmentId, ...(upload ? { fileName: upload.fileName } : {}) };
    }
    if (upload && doc.status !== "Not applicable") return { ...doc, status: "Submitted", uploadedOn, fileName: upload.fileName };
    return doc;
  });
}

export let personnelDocuments: PersonnelDocument[] = stored.personnelDocuments ?? [];

export function setPersonnelDocuments(next: PersonnelDocument[]) {
  personnelDocuments = next;
  savePeopleStore();
}

export let auditLogEntries: AuditLogEntry[] = stored.auditLogEntries ?? [];

export function setAuditLogEntries(next: AuditLogEntry[]) {
  auditLogEntries = next;
  savePeopleStore();
}

// --- Onboarding submissions waiting for HR to add employment details (Pipeline) ---

export let onboardingSubmissions: OnboardingSubmission[] = stored.onboardingSubmissions ?? [];

export function setOnboardingSubmissions(next: OnboardingSubmission[]) {
  onboardingSubmissions = next;
  savePeopleStore();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== PEOPLE_STORE_KEY) return;
    const next = loadPeopleStore();
    if (next.applicants) applicants = next.applicants;
    if (next.jobRequisitions) jobRequisitions = next.jobRequisitions;
    if (next.onboardingSubmissions) onboardingSubmissions = next.onboardingSubmissions;
    if (next.employeeDirectory) employeeDirectory = next.employeeDirectory;
    if (next.personnelProfiles) personnelProfiles = next.personnelProfiles;
    if (next.personnelDocuments) personnelDocuments = next.personnelDocuments;
    if (next.auditLogEntries) auditLogEntries = next.auditLogEntries;
    if (next.currentEmployee) currentEmployee = next.currentEmployee;
  });
}
