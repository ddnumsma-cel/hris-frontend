// 201 File sections beyond pre-employment documents: government registration
// numbers, employment records, records kept during employment, and separation.
//
// Where the prototype already tracks something (trainings, employee-relations
// cases, company assets, professional licenses, offboarding, reviews) these
// sections read those same records, so every page stays consistent. The rest
// is mock data derived deterministically from the employee ID, so every
// directory entry — including newly added hires — has a complete-looking file.

import {
  companyAssets,
  employeeCases,
  employeeDirectory,
  offboardingCases,
  performanceReviewStatuses,
  professionalLicenses,
  trainingRecords,
} from "./mockData";
import type { CompanyAsset, Employee, EmployeeCase, OffboardingCase, ProfessionalLicense, TrainingRecord } from "./types";

export type RecordStatus = "Verified" | "On file" | "Pending" | "Missing";

// ---- Government registration numbers ----

export interface GovernmentRegistration {
  agency: "SSS" | "PhilHealth" | "Pag-IBIG (HDMF)" | "BIR (TIN)";
  description: string;
  number?: string;
  registeredOn?: string;
  status: RecordStatus;
  detail?: string;
}

// ---- Employment records ----

export type EmploymentType = "Regular" | "Probationary";
export type MovementAction = "Hired" | "Regularized" | "Promoted" | "Transferred" | "Salary adjustment";

export interface EmploymentMovement {
  date: string;
  action: MovementAction;
  detail: string;
  reference: string;
}

export interface EmploymentDocument {
  name: string;
  signedOn?: string;
  status: RecordStatus;
}

export interface PreviousEmployment {
  company: string;
  position: string;
  period: string;
}

export interface EmploymentRecords {
  dateHired: string;
  employmentType: EmploymentType;
  regularizedOn?: string;
  probationEnds?: string;
  schedule: string;
  payrollType: string;
  supervisor: string;
  documents: EmploymentDocument[];
  movements: EmploymentMovement[];
  previousEmployment: PreviousEmployment[];
}

// ---- During employment ----

export interface Appraisal {
  period: string;
  rating?: number;
  ratingLabel?: string;
  reviewer: string;
  status: "Completed" | "Pending";
}

export interface Commendation {
  date: string;
  title: string;
  detail: string;
}

export interface DuringEmploymentRecords {
  appraisals: Appraisal[];
  trainings: TrainingRecord[];
  licenses: ProfessionalLicense[];
  assets: CompanyAsset[];
  commendations: Commendation[];
  cases: EmployeeCase[];
}

// ---- Separation ----

export interface ClearanceItem {
  department: string;
  status: "Cleared" | "Pending";
}

export interface SeparationRecords {
  case: OffboardingCase;
  type: string;
  noticeFiledOn: string;
  reason: string;
  clearance: ClearanceItem[];
  requirements: { name: string; status: RecordStatus }[];
}

export interface EmployeeFileRecords {
  government: GovernmentRegistration[];
  employment: EmploymentRecords;
  during: DuringEmploymentRecords;
  separation: SeparationRecords | null;
}

// Employees in the original seed data get a full history; anyone added later
// through "Add employee" is treated as a new hire with a fresh file.
const seededIds = new Set(employeeDirectory.map((e) => e.id));

/** Small deterministic PRNG so an employee's mock file never changes between renders. */
function seededRandom(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function digits(rand: () => number, count: number) {
  return Array.from({ length: count }, () => Math.floor(rand() * 10)).join("");
}

const monthFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });

function formatDate(date: Date) {
  return monthFormat.format(date);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function hireDateFor(employee: Employee) {
  if (employee.dateHired) {
    const [y, m, d] = employee.dateHired.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  if (!seededIds.has(employee.id)) return new Date();
  // Lower employee numbers joined earlier: MSMA-00098 in 2016, MSMA-00845 in 2024.
  const n = Number(employee.id.replace(/\D/g, ""));
  const year = 2016 + Math.min(8, Math.floor(n / 100));
  return new Date(year, n % 12, 1 + (n % 27));
}

/** The job someone was likely hired into, stepping down one level from today's title. */
function entryPosition(position: string) {
  if (position === "Team Lead") return "Audit Associate";
  if (position.startsWith("Senior ")) return position.replace("Senior ", "");
  return position;
}

function ratingLabel(rating: number) {
  if (rating >= 4.5) return "Outstanding";
  if (rating >= 3.5) return "Very satisfactory";
  return "Satisfactory";
}

function buildGovernment(employee: Employee, hired: Date, rand: () => number): GovernmentRegistration[] {
  const isNew = !seededIds.has(employee.id);
  const registered = formatDate(addMonths(hired, -Math.floor(rand() * 30) - 6));
  const recent = Number(employee.id.replace(/\D/g, "")) > 800;
  const entry = (
    agency: GovernmentRegistration["agency"],
    description: string,
    number: string,
    detail: string,
    status: RecordStatus = "Verified",
  ): GovernmentRegistration =>
    isNew ? { agency, description, status: "Missing" } : { agency, description, number, registeredOn: registered, status, detail };

  return [
    entry("SSS", "Social Security System", `${digits(rand, 2)}-${digits(rand, 7)}-${digits(rand, 1)}`, "Contributions active"),
    entry("PhilHealth", "Philippine Health Insurance Corp.", `${digits(rand, 2)}-${digits(rand, 9)}-${digits(rand, 1)}`, "Member · premiums active"),
    entry(
      "Pag-IBIG (HDMF)",
      "Home Development Mutual Fund MID",
      `${digits(rand, 4)}-${digits(rand, 4)}-${digits(rand, 4)}`,
      "Contributions active",
      recent ? "On file" : "Verified",
    ),
    entry("BIR (TIN)", "Tax Identification Number", `${digits(rand, 3)}-${digits(rand, 3)}-${digits(rand, 3)}-000`, `RDO ${employee.office === "Manila" ? "039" : employee.office === "Davao" ? "113" : "081"} · Form 1902 filed`),
  ];
}

function buildEmployment(employee: Employee, hired: Date, rand: () => number): EmploymentRecords {
  const isNew = !seededIds.has(employee.id);
  const supervisor =
    employee.reportsToId && employee.reportsToId !== "admin"
      ? (employeeDirectory.find((e) => e.id === employee.reportsToId)?.name ?? "HR & People Operations")
      : "HR & People Operations";
  const regularized = addMonths(hired, 6);
  const year = hired.getFullYear();
  const ref = (i: number, date: Date) => `PAN-${date.getFullYear()}-${String(Math.floor(rand() * 900) + 100)}${i}`;

  const movements: EmploymentMovement[] = [
    { date: formatDate(hired), action: "Hired", detail: `${entryPosition(employee.position)} · ${employee.department}`, reference: ref(1, hired) },
  ];
  if (!isNew) {
    movements.push({ date: formatDate(regularized), action: "Regularized", detail: "Completed 6-month probation", reference: ref(2, regularized) });
    const entry = entryPosition(employee.position);
    if (employee.position === "Team Lead") {
      const senior = addMonths(hired, 30);
      movements.push({ date: formatDate(senior), action: "Promoted", detail: `${entry} → Senior Associate`, reference: ref(3, senior) });
      const lead = addMonths(hired, 60);
      movements.push({ date: formatDate(lead), action: "Promoted", detail: "Senior Associate → Team Lead", reference: ref(4, lead) });
    } else if (entry !== employee.position) {
      const promoted = addMonths(hired, 26);
      movements.push({ date: formatDate(promoted), action: "Promoted", detail: `${entry} → ${employee.position}`, reference: ref(3, promoted) });
    }
    if (employee.office !== "Cebu HQ" && year < 2020) {
      const moved = addMonths(hired, 18);
      movements.push({ date: formatDate(moved), action: "Transferred", detail: `Cebu HQ → ${employee.office}`, reference: ref(5, moved) });
    }
    if (year <= 2025) {
      const adjusted = new Date(2026, 0, 15);
      movements.push({ date: formatDate(adjusted), action: "Salary adjustment", detail: "Annual merit increase", reference: ref(6, adjusted) });
    }
    movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const signed = formatDate(addMonths(hired, 0));
  const docStatus: RecordStatus = isNew ? "Pending" : "Verified";
  const priorCompanies = ["SGV & Co.", "Punongbayan & Araullo", "Isla Lipana & Co.", "R.G. Manabat & Co.", "Aboitiz Equity Ventures"];

  return {
    dateHired: formatDate(hired),
    employmentType: isNew ? "Probationary" : "Regular",
    regularizedOn: isNew ? undefined : formatDate(regularized),
    probationEnds: isNew ? formatDate(regularized) : undefined,
    schedule: "Mon–Fri · 8:30 AM – 5:30 PM",
    payrollType: "Semi-monthly · Payroll account (BDO)",
    supervisor,
    documents: [
      { name: "Job Offer", signedOn: isNew ? undefined : signed, status: docStatus },
      { name: "Employment Contract", signedOn: isNew ? undefined : signed, status: docStatus },
      { name: "Non-Disclosure Agreement", signedOn: isNew ? undefined : signed, status: docStatus },
      { name: "Code of Conduct Acknowledgment", signedOn: isNew ? undefined : signed, status: isNew ? "Missing" : "Verified" },
      { name: "Notice of Regularization", signedOn: isNew ? undefined : formatDate(regularized), status: isNew ? "Pending" : "Verified" },
    ],
    movements,
    previousEmployment:
      isNew || rand() < 0.35
        ? []
        : [
            {
              company: priorCompanies[Math.floor(rand() * priorCompanies.length)],
              position: `${employee.department.split(" ")[0]} Staff`,
              period: `${year - 2} – ${year}`,
            },
          ],
  };
}

function buildDuring(employee: Employee, hired: Date, rand: () => number): DuringEmploymentRecords {
  const firstYear = hired.getFullYear() + 1;
  const appraisals: Appraisal[] = [];
  for (let y = Math.max(firstYear, 2023); y <= 2025; y++) {
    const rating = Math.round((3.4 + rand() * 1.3) * 10) / 10;
    appraisals.push({ period: `${y} Annual review`, rating, ratingLabel: ratingLabel(rating), reviewer: "Immediate supervisor", status: "Completed" });
  }
  if (seededIds.has(employee.id)) {
    // Only the Partner team has tracked mid-year statuses; everyone else is treated as reviewed.
    const midYear = performanceReviewStatuses[employee.id];
    appraisals.push({ period: "2026 Mid-year review", reviewer: "Immediate supervisor", status: midYear === "Pending" ? "Pending" : "Completed" });
    const last = appraisals[appraisals.length - 1];
    if (last.status === "Completed" && last.rating === undefined) {
      last.rating = Math.round((3.5 + rand() * 1.1) * 10) / 10;
      last.ratingLabel = ratingLabel(last.rating);
    }
  }
  appraisals.reverse();

  const commendations: Commendation[] =
    appraisals.some((a) => a.ratingLabel === "Outstanding")
      ? [{ date: "Feb 12, 2026", title: "Outstanding Performance Award", detail: "Recognized at the 2025 year-end town hall." }]
      : [];

  return {
    appraisals,
    trainings: trainingRecords.filter((t) => t.employeeName === employee.name),
    licenses: professionalLicenses.filter((l) => l.employeeId === employee.id),
    assets: companyAssets.filter((a) => a.assignedToName === employee.name),
    commendations,
    cases: employeeCases.filter((c) => c.employeeName === employee.name),
  };
}

function buildSeparation(employee: Employee): SeparationRecords | null {
  const offboarding = offboardingCases.find((c) => c.employeeName === employee.name);
  if (!offboarding) return null;
  const stageIndex = ["Resignation filed", "Clearance in progress", "Final pay released"].indexOf(offboarding.stage);
  const clearanceDone = (i: number) => stageIndex >= 2 || (stageIndex === 1 && i < 3);
  const departments = ["Immediate supervisor", "IT (accounts & devices)", "Admin (ID, assets)", "Finance (cash advances)", "HR"];
  const status = (done: boolean): RecordStatus => (done ? "Verified" : "Pending");

  return {
    case: offboarding,
    type: "Voluntary resignation",
    noticeFiledOn: offboarding.lastDay.startsWith("Oct 15") ? "Sep 15, 2026" : "Sep 30, 2026",
    reason: "Career opportunity abroad",
    clearance: departments.map((department, i) => ({ department, status: clearanceDone(i) ? "Cleared" : "Pending" })),
    requirements: [
      { name: "Resignation letter (30-day notice)", status: "Verified" },
      { name: "Acceptance of resignation", status: "Verified" },
      { name: "Exit interview", status: status(stageIndex >= 1) },
      { name: "Final pay computation", status: status(stageIndex >= 2) },
      { name: "Quitclaim & release", status: status(stageIndex >= 2) },
      { name: "Certificate of Employment", status: status(stageIndex >= 2) },
      { name: "BIR Form 2316", status: status(stageIndex >= 2) },
    ],
  };
}

export function buildEmployeeFileRecords(employee: Employee): EmployeeFileRecords {
  const rand = seededRandom(employee.id);
  const hired = hireDateFor(employee);
  return {
    government: buildGovernment(employee, hired, rand),
    employment: buildEmployment(employee, hired, rand),
    during: buildDuring(employee, hired, rand),
    separation: buildSeparation(employee),
  };
}
