import type { FieldErrors, Resolver } from "react-hook-form";
import {
  fieldDef,
  includedFieldKeys,
  FORM_FIELDS,
  sectionDef,
  type FormFieldKey,
  type FormSectionConfig,
  type OnboardingFormConfig,
} from "@/lib/onboardingForm";
import { zodResolver } from "@hookform/resolvers/zod";
import { applicableDocuments } from "@/lib/api";
import { formatPhMobile } from "@/lib/govIds";
import { PERSONNEL_DOCUMENT_TYPES, SITUATIONAL_DOCUMENT_TYPES } from "@/lib/mockData";
import { addEmployeeSchema, type AddEmployeeFormValues } from "@/lib/schemas";
import type { OnboardingSubmissionInput, PersonnelDocumentType, UploadedDocument } from "@/lib/types";

export type FieldName = keyof AddEmployeeFormValues;

export interface StepDef {
  /** A section key, "government" or "review". */
  id: string;
  title: string;
  /** Shown under the title in the step list. */
  summary: string;
  fields: FieldName[];
  required: FieldName[];
  /** HR's section this step shows; absent for the fixed Gov't IDs and Review steps. */
  section?: FormSectionConfig;
}

/** What has to be filled in for a required field to count as answered. */
const requiredValues: Record<FormFieldKey, FieldName[]> = {
  legalName: ["lastName", "firstName"],
  birthDate: ["birthDate"],
  sex: ["sex"],
  phone: ["phone"],
  middleName: ["middleName"],
  suffix: ["suffix"],
  civilStatus: ["civilStatus"],
  bloodType: ["bloodType"],
  personalEmail: ["personalEmail"],
  workEmail: ["email"],
  address: ["street", "city", "province"],
  emergencyContact: ["emergencyName", "emergencyPhone"],
  dependents: ["dependents"],
};

/** One step per section of HR's form, then Gov't IDs & 201 files, then Review. */
export function stepsFor(config: OnboardingFormConfig): StepDef[] {
  const sectionSteps = config.sections.map((s) => {
    const def = sectionDef(s.key);
    const labels = s.fields.map((f) => fieldDef(f.key).label);
    return {
      id: s.key,
      title: def.title,
      summary: labels.length > 3 ? `${labels.slice(0, 3).join(", ")} and more` : labels.join(", "),
      fields: s.fields.flatMap((f) => fieldDef(f.key).values),
      required: s.fields.filter((f) => f.required).flatMap((f) => requiredValues[f.key]),
      section: s,
    };
  });
  return [
    ...sectionSteps,
    {
      id: "government",
      title: "Gov't IDs & 201 files",
      summary: "TIN, SSS, PhilHealth, Pag-IBIG · upload your 201 files",
      fields: ["tin", "sss", "philHealth", "pagIbig", "uploadedDocuments"],
      required: [],
    },
    { id: "review", title: "Review", summary: "Check and submit", fields: [], required: [] },
  ];
}

/** Details payroll and the 201 file need soon, but that can be added later. Only fields in HR's form are listed. */
export function stillNeededBeforePayroll(v: AddEmployeeFormValues, steps: StepDef[]): { label: string; step: number }[] {
  const missing: { label: string; step: number }[] = [];
  const stepOf = (key: FormFieldKey) => steps.findIndex((s) => s.section?.fields.some((f) => f.key === key));
  const check = (key: FormFieldKey, label: string, empty: boolean) => {
    const at = stepOf(key);
    if (at !== -1 && empty) missing.push({ label, step: at });
  };
  check("civilStatus", "Civil status", !v.civilStatus);
  check("address", "Home address", ![v.street, v.barangay, v.city, v.province].some((x) => x.trim()));
  check("emergencyContact", "Emergency contact", !v.emergencyName.trim());
  const gov: [keyof AddEmployeeFormValues, string][] = [
    ["tin", "TIN"],
    ["sss", "SSS number"],
    ["philHealth", "PhilHealth number"],
    ["pagIbig", "Pag-IBIG MID"],
  ];
  const govStep = steps.findIndex((s) => s.id === "government");
  for (const [key, label] of gov) if (!String(v[key] ?? "").trim()) missing.push({ label, step: govStep });
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

const requiredMessage: Partial<Record<FormFieldKey, string>> = {
  middleName: "Enter your middle name",
  suffix: "Choose your suffix",
  civilStatus: "Choose your civil status",
  bloodType: "Choose your blood type",
  personalEmail: "Enter your personal email",
  workEmail: "Enter your work email",
};

/** zod skips object refinements while any other field has an error, so HR's rules run here instead —
 * they show up on the step the employee is on. The form passes HR's config as the resolver context. */
export function onboardingResolver(): Resolver<AddEmployeeFormValues, OnboardingFormConfig> {
  const base = zodResolver(addEmployeeSchema) as unknown as Resolver<AddEmployeeFormValues, OnboardingFormConfig>;
  return async (values, context, options) => {
    const result = await base(values, context, options);
    const errors = { ...result.errors } as Record<string, unknown>;
    if (context) {
      const included = includedFieldKeys(context);
      // Fields HR left out never block submitting (e.g. a stale emergency number in an old draft).
      for (const f of FORM_FIELDS) if (!included.has(f.key)) for (const name of f.values) delete errors[name];
      const required = new Set(context.sections.flatMap((s) => s.fields.filter((f) => f.required).map((f) => f.key)));
      const blank = (name: FieldName) => !String(values[name] ?? "").trim();
      for (const [key, message] of Object.entries(requiredMessage) as [FormFieldKey, string][]) {
        const name = requiredValues[key][0];
        if (required.has(key) && blank(name) && !errors[name]) errors[name] = err(message);
      }
      if (required.has("address")) {
        if (blank("street")) errors.street ??= err("Enter your house no. and street");
        if (blank("city")) errors.city ??= err("Enter your city or municipality");
        if (blank("province")) errors.province ??= err("Enter your province");
      }
      if (required.has("emergencyContact")) {
        if (blank("emergencyName")) errors.emergencyName ??= err("Enter who HR should call");
        if (blank("emergencyPhone")) errors.emergencyPhone ??= err("Enter their mobile number");
      }
      if (included.has("civilStatus") && values.civilStatus === "Married" && !values.spouseName.trim()) {
        errors.spouseName = err("Enter your spouse's full name");
      }
      if (included.has("dependents")) {
        // A row with only a birth date is missing its name; fully empty rows are ignored.
        const rows = values.dependents.map((d) => (!d.name.trim() && d.birthDate ? { name: err("Enter their full name") } : undefined));
        if (rows.some(Boolean)) errors.dependents = rows;
        else if (required.has("dependents") && !values.dependents.some((d) => d.name.trim())) errors.dependents = err("Add at least one child or dependent");
      }
    }
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
    // The page clamps it to the current form's steps.
    const step = Number.isInteger(draft.step) ? Math.max(0, draft.step) : 0;
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
  values: AddEmployeeFormValues,
  governmentId: OnboardingSubmissionInput["governmentId"],
  config: OnboardingFormConfig,
): OnboardingSubmissionInput {
  const included = includedFieldKeys(config);
  const blank = emptyValues();
  const v = { ...values } as Record<string, unknown>;
  for (const f of FORM_FIELDS) if (!included.has(f.key)) for (const name of f.values) v[name] = blank[name];
  return toInput(v as AddEmployeeFormValues, governmentId);
}

function toInput(v: AddEmployeeFormValues, governmentId: OnboardingSubmissionInput["governmentId"]): OnboardingSubmissionInput {
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
