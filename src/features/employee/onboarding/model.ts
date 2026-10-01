import type { FieldErrors, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { applicableDocuments } from "@/lib/api";
import { formatPhMobile } from "@/lib/govIds";
import { PERSONNEL_DOCUMENT_TYPES, SITUATIONAL_DOCUMENT_TYPES } from "@/lib/mockData";
import { addEmployeeSchema, type AddEmployeeFormValues } from "@/lib/schemas";
import type { OnboardingSubmissionInput, PersonnelDocumentType, UploadedDocument } from "@/lib/types";

export type FieldName = keyof AddEmployeeFormValues;

export interface StepDef {
  id: "identity" | "contact" | "government" | "review";
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
    fields: ["lastName", "firstName", "middleName", "suffix", "birthDate", "sex", "civilStatus", "bloodType", "spouseName", "dependents"],
    required: ["lastName", "firstName", "birthDate", "sex"],
  },
  {
    id: "contact",
    title: "Contact",
    summary: "Mobile, address, emergency, work background",
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
      "licenseProfession",
      "licenseNumber",
      "licenseExpiry",
      "previousEmployer",
      "previousLastDay",
    ],
    required: ["phone"],
  },
  {
    id: "government",
    title: "Gov't IDs & documents",
    summary: "TIN, SSS, PhilHealth, Pag-IBIG · upload your 201 files",
    fields: ["tin", "sss", "philHealth", "pagIbig", "uploadedDocuments"],
    required: [],
  },
  { id: "review", title: "Review", summary: "Check and submit", fields: [], required: [] },
];

/** Details payroll and the 201 file need soon, but that can be added later. */
export function stillNeededBeforePayroll(v: AddEmployeeFormValues): { label: string; step: number }[] {
  const missing: { label: string; step: number }[] = [];
  if (!v.civilStatus) missing.push({ label: "Civil status", step: 0 });
  if (![v.street, v.barangay, v.city, v.province].some((x) => x.trim())) missing.push({ label: "Home address", step: 1 });
  if (!v.emergencyName.trim()) missing.push({ label: "Emergency contact", step: 1 });
  const gov: [keyof AddEmployeeFormValues, string][] = [
    ["tin", "TIN"],
    ["sss", "SSS number"],
    ["philHealth", "PhilHealth number"],
    ["pagIbig", "Pag-IBIG MID"],
  ];
  for (const [key, label] of gov) if (!String(v[key] ?? "").trim()) missing.push({ label, step: 2 });
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
    tin: "",
    sss: "",
    philHealth: "",
    pagIbig: "",
    uploadedDocuments: [],
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

// ---- 201 documents the new hire uploads ----

export const coreDocuments = PERSONNEL_DOCUMENT_TYPES.filter((t) => !SITUATIONAL_DOCUMENT_TYPES.includes(t));

/** Situational documents that apply to what they've entered so far (married, a child, a license, a previous job). */
export function situationalFor(v: AddEmployeeFormValues): PersonnelDocumentType[] {
  return applicableDocuments({
    lastName: "",
    firstName: "",
    civilStatus: v.civilStatus || undefined,
    dependents: v.dependents.filter((d) => d.name.trim()).map((d) => ({ name: d.name, relationship: "Child" as const })),
    license: v.licenseNumber.trim() ? { number: v.licenseNumber } : undefined,
    previousEmployer: v.previousEmployer.trim() ? { name: v.previousEmployer } : undefined,
  });
}

/** Uploads that still count: a situational document that no longer applies is dropped. */
export function activeUploads(v: AddEmployeeFormValues): UploadedDocument[] {
  const shown = new Set<string>([...coreDocuments, ...situationalFor(v)]);
  return (v.uploadedDocuments as UploadedDocument[]).filter((u) => shown.has(u.type));
}

// ---- Validation ----

const err = (message: string) => ({ type: "custom", message });

/** zod skips object refinements while any other field has an error, so the conditional rules
 * run here instead — they show up on the step the employee is on. */
export function onboardingResolver(): Resolver<AddEmployeeFormValues> {
  const base = zodResolver(addEmployeeSchema) as unknown as Resolver<AddEmployeeFormValues>;
  return async (values, context, options) => {
    const result = await base(values, context, options);
    const extra: FieldErrors<AddEmployeeFormValues> = {};
    if (values.civilStatus === "Married" && !values.spouseName.trim()) extra.spouseName = err("Enter your spouse's full name");
    // A row with only a birth date is missing its name; fully empty rows are ignored.
    const rows = values.dependents.map((d) => (!d.name.trim() && d.birthDate ? { name: err("Enter their full name") } : undefined));
    if (rows.some(Boolean)) extra.dependents = rows as FieldErrors<AddEmployeeFormValues>["dependents"];
    const errors = { ...result.errors, ...extra };
    if (Object.keys(errors).length === 0) {
      return { values: (result.values && Object.keys(result.values).length ? result.values : values) as AddEmployeeFormValues, errors: {} };
    }
    return { values: {}, errors: errors as FieldErrors<AddEmployeeFormValues> };
  };
}

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
    // Older or broken drafts lose nothing important: blanks fill missing fields, and fields this
    // form no longer has (e.g. employment details from the old form) are dropped.
    const blank = emptyValues();
    const kept = Object.fromEntries(Object.entries(draft.values ?? {}).filter(([k]) => k in blank));
    const step = Number.isInteger(draft.step) ? Math.max(0, Math.min(draft.step, steps.length - 2)) : 0;
    return { ...draft, step, values: { ...blank, ...kept } as AddEmployeeFormValues };
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
  return (Object.keys(blank) as FieldName[]).some((k) => JSON.stringify(values[k]) !== JSON.stringify(blank[k]));
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

export function toSubmissionInput(
  v: AddEmployeeFormValues,
  governmentId: OnboardingSubmissionInput["governmentId"],
): OnboardingSubmissionInput {
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
    governmentNumbers,
    governmentId,
    uploadedDocuments: activeUploads(v),
    dependents: [
      ...(v.civilStatus === "Married" && v.spouseName.trim() ? [{ name: v.spouseName.trim(), relationship: "Spouse" as const }] : []),
      ...v.dependents.filter((d) => d.name.trim()).map((d) => ({ name: d.name.trim(), relationship: "Child" as const, birthDate: d.birthDate || undefined })),
    ],
    license: v.licenseNumber.trim()
      ? { profession: v.licenseProfession || undefined, number: v.licenseNumber.trim(), expiry: v.licenseExpiry || undefined }
      : undefined,
    previousEmployer: v.previousEmployer.trim() ? { name: v.previousEmployer.trim(), lastDay: v.previousLastDay || undefined } : undefined,
  };
}
