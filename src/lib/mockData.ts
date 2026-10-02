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

export const PEOPLE_STORE_KEY = "msma-demo-people-v2";

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
];

export function setPayslips(next: Payslip[]) {
  payslips = next;
}

export let announcements: Announcement[] = [
  { id: "an-1", title: "BIR Form 2316 for 2025 is now available for download", postedOn: "Posted Sept 20, 2026" },
];

export function setAnnouncements(next: Announcement[]) {
  announcements = next;
}

export let leaveRequests: LeaveRequest[] = [
  { id: "lr-1", employeeName: "Bea Santos", employeeInitials: "BS", employeeRole: "Audit Associate", type: "Vacation", detail: "Oct 6–8 · 3 days", status: "Pending", requestedOn: "2026-09-25", partnerApproved: true, startDate: "2026-10-06", endDate: "2026-10-08", days: 3, reason: "Family trip to Bohol" },
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
];

export let employeeBenefits: EmployeeBenefit[] = [
  { id: "b-1", name: "HMO", provider: "Maxicare", memberId: "MX-88213", status: "Active" },
];

export function setEmployeeBenefits(next: EmployeeBenefit[]) {
  employeeBenefits = next;
}

export const teamRoster: TeamRosterMember[] = [
  { id: "MSMA-00560", name: "Bea Santos", initials: "BS", position: "Audit Associate", tenureLabel: "2 yrs 3 mos", email: "bea.santos@msma.ph", status: "On leave" },
];

export let jobRequisitions: JobRequisition[] = stored.jobRequisitions ?? [
  { id: "jr-1", title: "Audit Associate", department: "Audit & Assurance", cluster: "VCM", office: "Cebu HQ", openings: 3, applicants: 21, applicantsThisWeek: 5, stage: "Interviewing", approval: "Approved" },
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
];

export function setPayrollEntries(next: PayrollEntry[]) {
  payrollEntries = next;
}

export const myDtrLog: DtrLogEntry[] = [
  { date: "Sept 25, 2026", timeIn: "8:58 AM", timeOut: "6:05 PM", status: "On time", location: "Onsite", method: "Fingerprint" },
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
];

export function setOffboardingCases(next: OffboardingCase[]) {
  offboardingCases = next;
}

export let companyAssets: CompanyAsset[] = [
  { id: "as-1", type: "Laptop", assetTag: "LT-0231", assignedToName: "Angela Dela Cruz", assignedToInitials: "AD", issuedOn: "2024-02-10", status: "Issued" },
];

export function setCompanyAssets(next: CompanyAsset[]) {
  companyAssets = next;
}

export let trainingRecords: TrainingRecord[] = [
  { id: "tr-1", employeeName: "Angela Dela Cruz", employeeInitials: "AD", course: "Data Privacy Act Refresher", dueDate: "Oct 15, 2026", status: "In progress" },
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
