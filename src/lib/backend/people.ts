// People and 201 files from the backend, shaped like the in-browser Core HR data so the People
// pages work unchanged. Employees are keyed by their employee number (MSMA-0095), like the local
// records; the backend's own id is looked up when a detail call needs it.

import type { EmployeeRecord, EmployeeSummary, PositionSummary, UnitSummary } from "../corehr/api";
import type { NewEmployeeValues } from "../corehr/schemas";
import type { CivilStatus, CoreEmployee, DocumentType, EmployeeDocument, EmploymentType, JobEvent } from "../corehr/types";
import type { TkPerson } from "../timekeeping/api";
import { api } from "./client";

interface BackendEmployee {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: "PROBATIONARY" | "REGULAR" | "CONTRACTUAL" | "PROJECT";
  hireDate: string;
  site: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  position: string | null;
  dailyRate: string | null;
  todayStatus: string | null;
  /** Their usual shift. */
  shiftId?: string;
  record201: { percent: number; missing: number; expiring: number; expired: number } | null;
}

interface BackendEmployeeDetail extends BackendEmployee {
  middleName: string | null;
  email: string | null;
  mobileNo: string | null;
  birthDate: string | null;
  manager: { id: string; fullName: string } | null;
  shift: { name: string } | null;
  govIds: { tin: string | null; sss: string | null; philhealth: string | null; pagibig: string | null } | null;
  personal: {
    suffix: string | null;
    sex: "MALE" | "FEMALE" | null;
    nationality: string | null;
    civilStatus: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    bank: { bankName: string; accountName: string; accountNo: string } | null;
    personalEmail: string | null;
    emergencyContact: { name: string; relationship: string; phone: string } | null;
    regularizationDate: string | null;
    separationDate: string | null;
  } | null;
  history: { id: string; type: string; effectiveDate: string; positionTitle: string | null; siteName: string | null; dailyRate: string | null; remarks: string | null }[];
}

const EMPLOYMENT_TYPE: Record<BackendEmployee["status"], EmploymentType> = {
  PROBATIONARY: "Probationary",
  REGULAR: "Regular",
  CONTRACTUAL: "Fixed-term",
  // The website has no project-based type; it is a fixed-term contract.
  PROJECT: "Fixed-term",
};

/** employee number → backend id, filled by every list and detail call. */
const backendIds = new Map<string, string>();

/** backend id → employee number, for data the backend keys by its own id (attendance). */
export const employeeNoOf = (backendId: string) => [...backendIds].find(([, id]) => id === backendId)?.[0];

/** The backend's departments are company-wide; the app keeps one department per office, so each site + department pair is a unit. */
const unitIdOf = (e: Pick<BackendEmployee, "site" | "department">) => (e.department ? `${e.site?.id ?? "all"}:${e.department.id}` : (e.site?.id ?? ""));

const initials =(first: string, last: string) => `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();

/** The backend's daily rate as a monthly salary (daily = monthly × 12 ÷ 261, lib/pay/engine.ts). */
const monthlyOf = (daily: string | null) => (daily ? Math.round((Number(daily) * 261) / 12) : 0);

function summarize(e: BackendEmployee, detail?: BackendEmployeeDetail): EmployeeSummary {
  backendIds.set(e.employeeNo, e.id);
  const unit = unitIdOf(e);
  const r = e.record201;
  // The list gives a percent and counts, not each paper: "verified" of 100 matches the percent bar.
  const documents = r ? { verified: r.percent, required: 100, needsAction: r.missing + r.expiring + r.expired } : { verified: 0, required: 0, needsAction: 0 };
  return {
    id: e.employeeNo,
    name: e.fullName,
    initials: initials(e.firstName, e.lastName),
    positionTitle: e.position ?? "Unassigned",
    unitId: unit,
    departmentId: e.department ? unit : undefined,
    departmentName: e.department?.name ?? "—",
    branchId: e.site?.id,
    branchName: e.site?.name ?? "—",
    employmentType: EMPLOYMENT_TYPE[e.status] ?? "Regular",
    status: detail?.personal?.separationDate ? "Separated" : e.todayStatus === "ON_LEAVE" ? "On leave" : "Active",
    dateHired: e.hireDate,
    workEmail: detail?.email ?? "",
    mobile: detail?.mobileNo ?? "",
    documents,
  };
}

async function fetchAll(): Promise<BackendEmployee[]> {
  const all: BackendEmployee[] = [];
  for (let page = 1; ; page++) {
    const res = await api<{ items: BackendEmployee[]; total: number }>("/employees", { query: { page, pageSize: 200 } });
    all.push(...res.items);
    if (!res.items.length || all.length >= res.total) break;
  }
  return all;
}

export async function backendListEmployees(): Promise<EmployeeSummary[]> {
  return (await fetchAll()).map((e) => summarize(e)).sort((a, b) => a.name.localeCompare(b.name));
}

/** Everyone in scope, as the attendance pages list people. */
export async function backendPeople(): Promise<TkPerson[]> {
  return (await fetchAll())
    .map((raw) => ({ raw, e: summarize(raw) }))
    .sort((a, b) => a.e.name.localeCompare(b.e.name))
    .map(({ raw, e }) => ({ id: e.id, name: e.name, initials: e.initials, positionTitle: e.positionTitle, departmentId: e.departmentId ?? "", departmentName: e.departmentName, branch: e.branchName, monthlySalary: 0, usualShiftId: raw.shiftId ?? null }));
}

/** Offices (the backend's sites) and the departments at each (Maintenance › Locations and Departments), with head counts. */
export async function backendListUnits(): Promise<UnitSummary[]> {
  const [offices, departments] = await Promise.all([
    api<{ id: string; name: string; code: string; address: string | null; contactName: string | null; contactPhone: string | null; active: boolean; headcount: number }[]>("/org/locations"),
    api<{ id: string; name: string; code: string; officeId: string; active: boolean; headcount: number }[]>("/org/departments"),
  ]);
  const base = { openSlots: 0, positionCount: 0 };
  const total = offices.reduce((n, o) => n + o.headcount, 0);
  return [
    { ...base, id: "company", type: "company", code: "MSMA", name: "MSMA", parentId: null, active: true, headcount: total },
    ...offices.map((o): UnitSummary => ({ ...base, id: o.id, type: "branch", code: o.code, name: o.name, parentId: "company", address: o.address ?? undefined, contactName: o.contactName ?? undefined, contactPhone: o.contactPhone ?? undefined, active: o.active, headcount: o.headcount })),
    ...departments.map((d): UnitSummary => ({ ...base, id: d.id, type: "department", code: d.code, name: d.name, parentId: d.officeId, active: d.active, headcount: d.headcount })),
  ];
}

/** The backend id for an employee number (or a backend id passed straight through). */
export async function backendIdOf(employeeNo: string): Promise<string | null> {
  if (backendIds.has(employeeNo)) return backendIds.get(employeeNo)!;
  if (!/^MSMA-/i.test(employeeNo)) return employeeNo;
  const res = await api<{ items: BackendEmployee[] }>("/employees", { query: { q: employeeNo, pageSize: 5 } });
  const hit = res.items.find((e) => e.employeeNo === employeeNo);
  if (hit) backendIds.set(hit.employeeNo, hit.id);
  return hit?.id ?? null;
}

const civil = (s: string | null): CivilStatus | "" => {
  const v = (s ?? "").charAt(0) + (s ?? "").slice(1).toLowerCase();
  return (["Single", "Married", "Widowed", "Separated"] as const).find((c) => c === v) ?? "";
};

async function detailOf(employeeNo: string): Promise<BackendEmployeeDetail | null> {
  const id = await backendIdOf(employeeNo);
  if (!id) return null;
  try {
    return await api<BackendEmployeeDetail>(`/employees/${id}`);
  } catch (err) {
    if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) return null;
    throw err;
  }
}

export async function backendGetEmployee(employeeNo: string): Promise<EmployeeRecord | null> {
  const d = await detailOf(employeeNo);
  if (!d) return null;
  const summary = summarize(d, d);
  const p = d.personal;
  const employee: CoreEmployee = {
    id: d.employeeNo,
    personal: {
      firstName: d.firstName,
      middleName: d.middleName ?? "",
      lastName: d.lastName,
      suffix: p?.suffix ?? "",
      birthDate: d.birthDate ?? "",
      sex: p?.sex === "MALE" ? "Male" : p?.sex === "FEMALE" ? "Female" : "",
      civilStatus: civil(p?.civilStatus ?? null),
      nationality: p?.nationality ?? "Filipino",
    },
    contact: {
      workEmail: d.email ?? "",
      personalEmail: p?.personalEmail ?? "",
      mobile: d.mobileNo ?? "",
      address: p?.address ?? "",
      city: p?.city ?? "",
      province: p?.province ?? "",
      emergencyName: p?.emergencyContact?.name ?? "",
      emergencyRelationship: p?.emergencyContact?.relationship ?? "",
      emergencyPhone: p?.emergencyContact?.phone ?? "",
    },
    government: { sss: d.govIds?.sss ?? "", philhealth: d.govIds?.philhealth ?? "", pagibig: d.govIds?.pagibig ?? "", tin: d.govIds?.tin ?? "" },
    bank: p?.bank ? { bank: p.bank.bankName, accountName: p.bank.accountName, accountNumber: p.bank.accountNo } : undefined,
    job: {
      positionId: "",
      unitId: summary.unitId,
      supervisorId: undefined,
      employmentType: summary.employmentType,
      status: summary.status,
      dateHired: d.hireDate,
      regularizationDate: p?.regularizationDate ?? undefined,
      separationDate: p?.separationDate ?? undefined,
      monthlySalary: monthlyOf(d.dailyRate),
      workSchedule: d.shift?.name ?? "",
    },
    createdAt: d.hireDate,
  };
  return {
    employee,
    summary,
    unitPath: [d.site?.name, d.department?.name].filter(Boolean).join(" › "),
    // The backend names the manager but not their employee number, so the link uses its id.
    supervisor: d.manager ? { id: d.manager.id, name: d.manager.fullName, positionTitle: "" } : undefined,
  };
}

/** Plain digits in the groups the backend writes a government number in ("3417654321" → "34-1765432-1"). */
function dashed(value: string, groups: number[]): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const parts: string[] = [];
  let at = 0;
  for (const n of groups) {
    if (at >= digits.length) break;
    parts.push(digits.slice(at, at + n));
    at += n;
  }
  if (at < digits.length) parts[parts.length - 1] += digits.slice(at);
  return parts.join("-");
}
const govIdsOf = (g: CoreEmployee["government"]) => ({
  tin: dashed(g.tin, [3, 3, 3, 3]),
  sss: dashed(g.sss, [2, 7, 1]),
  philhealth: dashed(g.philhealth, [2, 9, 1]),
  pagibig: dashed(g.pagibig, [4, 4, 4]),
});

/** Save a record section on the backend: personal details, contact details, government numbers or bank details. */
export async function backendUpdateSection(employeeNo: string, section: "personal" | "contact" | "government" | "bank", values: unknown): Promise<CoreEmployee> {
  const id = await backendIdOf(employeeNo);
  if (!id) throw new Error("That employee no longer exists");
  let body: Record<string, unknown>;
  if (section === "personal") {
    const p = values as CoreEmployee["personal"];
    body = {
      firstName: p.firstName,
      middleName: p.middleName,
      lastName: p.lastName,
      suffix: p.suffix,
      birthDate: p.birthDate,
      sex: p.sex ? p.sex.toUpperCase() : null,
      civilStatus: p.civilStatus.toUpperCase() || null,
      nationality: p.nationality,
    };
  } else if (section === "contact") {
    const c = values as CoreEmployee["contact"];
    body = {
      workEmail: c.workEmail,
      address: c.address || null,
      city: c.city || null,
      province: c.province || null,
      mobileNo: c.mobile || null,
      personalEmail: c.personalEmail,
      emergencyContact: c.emergencyName ? { name: c.emergencyName, relationship: c.emergencyRelationship, phone: c.emergencyPhone } : null,
    };
  } else if (section === "government") body = { govIds: govIdsOf(values as CoreEmployee["government"]) };
  else {
    const b = values as NonNullable<CoreEmployee["bank"]>;
    body = { bank: b.bank ? { bankName: b.bank, accountName: b.accountName, accountNo: b.accountNumber } : null };
  }
  await api(`/employees/${id}/personal`, { method: "PATCH", body });
  const record = await backendGetEmployee(employeeNo);
  if (!record) throw new Error("That employee no longer exists");
  return record.employee;
}

const EVENT_KIND: Record<string, JobEvent["kind"]> = {
  HIRED: "Hired",
  PROMOTED: "Promotion",
  TRANSFERRED: "Transfer",
  SALARY_ADJUSTED: "Salary adjustment",
  REGULARIZED: "Regularization",
  SEPARATED: "Separation",
};

export async function backendListEvents(employeeNo: string): Promise<JobEvent[]> {
  const d = await detailOf(employeeNo);
  if (!d) return [];
  return d.history.map((h) => ({
    id: h.id,
    employeeId: employeeNo,
    kind: EVENT_KIND[h.type] ?? "Status change",
    effectiveDate: h.effectiveDate,
    changes: [
      ...(h.positionTitle ? [{ label: "Position", to: h.positionTitle }] : []),
      ...(h.siteName ? [{ label: "Site", to: h.siteName }] : []),
      ...(h.dailyRate ? [{ label: "Monthly salary", to: `₱${monthlyOf(h.dailyRate).toLocaleString("en-PH")}` }] : []),
    ],
    remarks: h.remarks ?? undefined,
    recordedBy: "HR server",
    recordedAt: h.effectiveDate,
  }));
}

// ---- 201 file ----

/** Backend paper types that match the app's checklist; the backend's other papers aren't shown here. */
const DOCUMENT_TYPE: Record<string, DocumentType> = {
  RESUME: "Application Form / Resume",
  BIRTH_CERTIFICATE: "Birth Certificate (PSA)",
  MARRIAGE_CERTIFICATE: "Marriage Certificate (PSA)",
  CHILD_BIRTH_CERTIFICATE: "Child's Birth Certificate",
  GOVERNMENT_ID: "Valid Government ID",
  DIPLOMA_TOR: "Diploma / Transcript of Records",
  PROFESSIONAL_LICENSE: "Professional License",
  PREVIOUS_COE: "Certificate of Employment (Previous)",
  NBI_CLEARANCE: "NBI Clearance",
  POLICE_CLEARANCE: "Police/Barangay Clearance",
  MEDICAL_RESULTS: "Pre-Employment Medical Result",
};

interface Backend201 {
  items: {
    type: string;
    status: "ON_FILE" | "MISSING" | "EXPIRED" | "EXPIRING" | "NOT_NEEDED" | "NONE_YET" | "AUTOMATIC";
    expiresOn: string | null;
    documents: { id: string; fileName: string; uploadedAt: string; uploadedBy: string | null; expiresOn: string | null; referenceNo: string | null; notes: string | null }[];
  }[];
}

export function mapDocuments(employeeNo: string, file: Backend201): EmployeeDocument[] {
  return file.items.flatMap((item) => {
    const type = DOCUMENT_TYPE[item.type];
    if (!type) return [];
    const doc = item.documents[0];
    const status: EmployeeDocument["status"] = item.status === "NOT_NEEDED" ? "Not applicable" : doc ? "Verified" : "Missing";
    return [
      {
        id: doc?.id ?? `${employeeNo}-${item.type}`,
        employeeId: employeeNo,
        type,
        status,
        fileName: doc?.fileName,
        uploadedAt: doc?.uploadedAt,
        verifiedBy: doc?.uploadedBy ?? undefined,
        verifiedAt: doc?.uploadedAt,
        referenceNo: doc?.referenceNo ?? undefined,
        expiresOn: doc?.expiresOn ?? item.expiresOn ?? undefined,
        note: doc?.notes ?? undefined,
      },
    ];
  });
}

export async function backendListDocuments(employeeNo?: string): Promise<EmployeeDocument[]> {
  // shortcut: without an employee only the list's counts exist (one 201 call per person would be 180 calls); load a person's papers when their record opens.
  if (!employeeNo) return [];
  const id = await backendIdOf(employeeNo);
  if (!id) return [];
  return mapDocuments(employeeNo, await api<Backend201>(`/employees/${id}/201-file`));
}

interface BackendFilters {
  sites: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  positions: { id: string; name: string; departmentId: string }[];
}

/**
 * The backend's positions, one per office they're used in (its positions are company-wide; the app keeps them per
 * department and office). Id = "<site id>:<position id>". The backend has no headcount budget yet, so each shows one
 * open slot beyond the people who hold it.
 */
export async function backendListPositions(): Promise<PositionSummary[]> {
  const [f, people, atOffices] = await Promise.all([
    api<BackendFilters>("/employees/filters"),
    fetchAll(),
    api<{ id: string; officeId: string; active: boolean }[]>("/org/departments"),
  ]);
  const deptName = new Map(f.departments.map((d) => [d.id, d.name]));
  // Only active departments at each office (Maintenance › Departments).
  const open = new Set(atOffices.filter((d) => d.active).map((d) => d.id));
  const out: PositionSummary[] = [];
  for (const site of f.sites) {
    const here = people.filter((e) => e.site?.id === site.id);
    for (const pos of f.positions) {
      if (!open.has(`${site.id}:${pos.departmentId}`)) continue;
      const holders = here.filter((e) => e.department?.id === pos.departmentId && e.position === pos.name);
      out.push({
        id: `${site.id}:${pos.id}`,
        title: pos.name,
        code: "",
        departmentId: `${site.id}:${pos.departmentId}`,
        level: "Rank and file",
        employmentType: "Regular",
        slots: holders.length + 1,
        active: true,
        filled: holders.length,
        open: 1,
        holders: holders.map((h) => ({ id: h.employeeNo, name: h.fullName, initials: initials(h.firstName, h.lastName), unitName: deptName.get(pos.departmentId) ?? "", status: "Active" })),
        departmentName: deptName.get(pos.departmentId) ?? "—",
        branchId: site.id,
        branchName: site.name,
      });
    }
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}

const STATUS_OF: Record<EmploymentType, BackendEmployee["status"]> = { Probationary: "PROBATIONARY", Regular: "REGULAR", "Fixed-term": "CONTRACTUAL" };

/** Add a new hire on the backend from the Add employee form, then return their record the way the People pages show it. */
export async function backendCreateEmployee(v: NewEmployeeValues): Promise<CoreEmployee> {
  const [siteId, positionId] = v.job.positionId.split(":");
  const f = await api<BackendFilters>("/employees/filters");
  const position = f.positions.find((p) => p.id === positionId);
  if (!siteId || !position) throw new Error("Pick the position again: the list changed");
  const managerId = v.job.supervisorId ? await backendIdOf(v.job.supervisorId) : null;
  const p = v.personal;
  const c = v.contact;
  const created = await api<{ id: string; employeeNo: string }>("/employees", {
    method: "POST",
    body: {
      firstName: p.firstName,
      middleName: p.middleName,
      lastName: p.lastName,
      suffix: p.suffix,
      birthDate: p.birthDate,
      sex: p.sex.toUpperCase(),
      civilStatus: p.civilStatus.toUpperCase(),
      nationality: p.nationality,
      workEmail: c.workEmail,
      personalEmail: c.personalEmail,
      mobileNo: c.mobile.replace(/[\s-]/g, ""),
      address: c.address,
      city: c.city,
      province: c.province,
      emergencyContact: c.emergencyName ? { name: c.emergencyName, relationship: c.emergencyRelationship, phone: c.emergencyPhone } : undefined,
      govIds: govIdsOf(v.government),
      siteId,
      departmentId: position.departmentId,
      positionId: position.id,
      cluster: v.job.cluster,
      managerId: managerId ?? undefined,
      shiftId: v.job.shiftId || undefined,
      status: STATUS_OF[v.job.employmentType],
      hireDate: v.job.dateHired,
      monthlySalary: v.job.monthlySalary,
    },
  });
  backendIds.set(created.employeeNo, created.id);
  const record = await backendGetEmployee(created.employeeNo);
  if (!record) throw new Error("The new employee was added but couldn't be loaded. Refresh the People page.");
  return record.employee;
}
