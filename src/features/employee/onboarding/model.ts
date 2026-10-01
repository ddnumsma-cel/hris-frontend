import type { CreateEmployeeInput } from "@/lib/api";
import { formatPhMobile } from "@/lib/govIds";
import { todayIso } from "@/lib/format";
import { PERSONNEL_DOCUMENT_TYPES } from "@/lib/mockData";
import type { AddEmployeeFormValues } from "@/lib/schemas";
import type { PersonnelDocumentType } from "@/lib/types";

export type FieldName = keyof AddEmployeeFormValues;

export interface StepDef {
  id: "identity" | "contact" | "employment" | "government" | "review";
  title: string;
  /** Shown under the title in the step list. */
  summary: string;
  fields: FieldName[];
  required: FieldName[];
}

export const steps: StepDef[] = [
  {
    id: "identity",
    title: "Identity",
    summary: "Name, birth date, civil status",
    fields: ["lastName", "firstName", "middleName", "suffix", "birthDate", "sex", "civilStatus", "bloodType"],
    required: ["lastName", "firstName", "birthDate", "sex"],
  },
  {
    id: "contact",
    title: "Contact",
    summary: "Mobile, email, address, emergency",
    fields: [
      "phone",
      "personalEmail",
      "email",
      "street",
      "barangay",
      "city",
      "province",
      "emergencyName",
      "emergencyRelationship",
      "emergencyPhone",
    ],
    required: ["phone"],
  },
  {
    id: "employment",
    title: "Employment",
    summary: "Position, office, status, date hired",
    fields: ["position", "department", "cluster", "office", "dateHired", "employmentStatus"],
    required: ["position", "department", "cluster", "office", "dateHired", "employmentStatus"],
  },
  {
    id: "government",
    title: "Gov't IDs & documents",
    summary: "TIN, SSS, PhilHealth, Pag-IBIG · 201 checklist",
    fields: ["tin", "sss", "philHealth", "pagIbig", "receivedDocuments"],
    required: [],
  },
  { id: "review", title: "Review", summary: "Check and submit", fields: [], required: [] },
];

/** Details payroll and the 201 file need soon, but that HR can add after creating the record.
 * Sections the employee chose to leave for later aren't listed; HR follows up on those. */
export function stillNeededBeforePayroll(
  v: AddEmployeeFormValues,
  shown: { address: boolean; emergency: boolean } = { address: true, emergency: true },
): { label: string; step: number }[] {
  const missing: { label: string; step: number }[] = [];
  if (!v.civilStatus) missing.push({ label: "Civil status", step: 0 });
  if (shown.address && ![v.street, v.barangay, v.city, v.province].some((x) => x.trim())) missing.push({ label: "Home address", step: 1 });
  if (shown.emergency && !v.emergencyName.trim()) missing.push({ label: "Emergency contact", step: 1 });
  const gov: [keyof AddEmployeeFormValues, string][] = [
    ["tin", "TIN"],
    ["sss", "SSS number"],
    ["philHealth", "PhilHealth number"],
    ["pagIbig", "Pag-IBIG MID"],
  ];
  for (const [key, label] of gov) if (!String(v[key] ?? "").trim()) missing.push({ label, step: 3 });
  return missing;
}

export function emptyValues(): AddEmployeeFormValues {
  return {
    lastName: "",
    firstName: "",
    middleName: "",
    suffix: "",
    birthDate: "",
    sex: "",
    civilStatus: "",
    bloodType: "",
    phone: "",
    personalEmail: "",
    email: "",
    street: "",
    barangay: "",
    city: "",
    province: "",
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
    position: "",
    department: "",
    cluster: "",
    office: "Cebu HQ",
    dateHired: todayIso(),
    employmentStatus: "Probationary",
    reportsToId: "",
    tin: "",
    sss: "",
    philHealth: "",
    pagIbig: "",
    receivedDocuments: [],
    spouseName: "",
    dependents: [],
    licenseProfession: "",
    licenseNumber: "",
    licenseExpiry: "",
    previousEmployer: "",
    previousLastDay: "",
  };
}

export function isFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => (item && typeof item === "object" ? Object.values(item).some(isFilled) : isFilled(item)));
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

/** Progress counts required fields only, so leaving an optional field (e.g. suffix) blank never holds a step short of full.
 * Steps with no required fields count everything. */
export function stepProgress(step: StepDef, values: AddEmployeeFormValues) {
  const counted = step.required.length > 0 ? step.required : step.fields;
  const filled = counted.filter((f) => isFilled(values[f])).length;
  return { filled, total: counted.length };
}

// ---- 201 documents HR can tick off on day one ----

/** Only needed if they apply (married, has children, licensed profession). */
export const situationalDocuments: PersonnelDocumentType[] = [
  "Marriage Certificate (PSA)",
  "Child's Birth Certificate",
  "Professional License",
];

export const coreDocuments = PERSONNEL_DOCUMENT_TYPES.filter((t) => !situationalDocuments.includes(t));

// ---- Draft (kept in this browser only) ----

const DRAFT_KEY = "msma-add-employee-draft";

export interface Draft {
  values: AddEmployeeFormValues;
  step: number;
  savedAt: string;
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    // Older or broken drafts lose nothing important — fall back to blanks for missing fields.
    return { ...draft, values: { ...emptyValues(), ...draft.values } };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<Draft, "savedAt">): string | null {
  const savedAt = new Date().toISOString();
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt }));
    return savedAt;
  } catch {
    // Storage blocked (private window) — the form still works, it just can't resume later.
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** A draft is worth offering back only if someone actually typed something. */
export function draftHasInput(values: AddEmployeeFormValues) {
  const blank = emptyValues();
  return (Object.keys(blank) as FieldName[]).some(
    (k) => k !== "dateHired" && JSON.stringify(values[k]) !== JSON.stringify(blank[k]),
  );
}

export function formatSavedAt(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

// ---- Form → create request ----

export function composeAddress(v: Pick<AddEmployeeFormValues, "street" | "barangay" | "city" | "province">) {
  const barangay = v.barangay.trim() && !/^(brgy|barangay)\b/i.test(v.barangay.trim()) ? `Brgy. ${v.barangay.trim()}` : v.barangay.trim();
  return [v.street.trim(), barangay, v.city.trim(), v.province.trim()].filter(Boolean).join(", ");
}

export function toCreateInput(
  v: AddEmployeeFormValues,
  extras: Pick<CreateEmployeeInput, "governmentId" | "applicantId" | "actor" | "applicableDocuments">,
): CreateEmployeeInput {
  const governmentNumbers = Object.fromEntries(
    (["tin", "sss", "philHealth", "pagIbig"] as const).filter((k) => v[k].trim()).map((k) => [k, v[k].trim()]),
  );
  return {
    lastName: v.lastName,
    firstName: v.firstName,
    middleName: v.middleName,
    suffix: v.suffix,
    birthDate: v.birthDate,
    civilStatus: v.civilStatus || undefined,
    bloodType: v.bloodType,
    email: v.email,
    personalEmail: v.personalEmail,
    phone: formatPhMobile(v.phone),
    address: composeAddress(v),
    emergencyContact: v.emergencyName
      ? {
          name: v.emergencyName,
          relationship: v.emergencyRelationship || undefined,
          phone: v.emergencyPhone ? formatPhMobile(v.emergencyPhone) : undefined,
        }
      : undefined,
    position: v.position,
    department: v.department,
    cluster: v.cluster as CreateEmployeeInput["cluster"],
    office: v.office,
    dateHired: v.dateHired,
    employmentStatus: v.employmentStatus,
    reportsToId: v.reportsToId || undefined,
    governmentNumbers,
    receivedDocuments: v.receivedDocuments as PersonnelDocumentType[],
    dependents: [
      ...(v.spouseName.trim() ? [{ name: v.spouseName.trim(), relationship: "Spouse" as const }] : []),
      ...v.dependents.filter((d) => d.name.trim()).map((d) => ({ name: d.name.trim(), relationship: "Child" as const, birthDate: d.birthDate || undefined })),
    ],
    license: v.licenseNumber.trim()
      ? { profession: v.licenseProfession || undefined, number: v.licenseNumber.trim(), expiry: v.licenseExpiry || undefined }
      : undefined,
    previousEmployer: v.previousEmployer.trim() ? { name: v.previousEmployer.trim(), lastDay: v.previousLastDay || undefined } : undefined,
    ...extras,
  };
}
