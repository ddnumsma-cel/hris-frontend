import type { FieldErrors, Resolver } from "react-hook-form";
import {
  fieldDef,
  includedFieldKeys,
  FORM_FIELDS,
  requiredValuesOf,
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

/** A form value path, e.g. "lastName" or "extras.nickname". */
export type ValuePath = string;

/** Reads a value by path ("extras.nickname"). */
export function valueAt(values: unknown, path: ValuePath): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), values);
}

export interface StepDef {
  /** A section key, "government" or "review". */
  id: string;
  title: string;
  /** Shown under the title in the step list. */
  summary: string;
  fields: ValuePath[];
  required: ValuePath[];
  /** HR's section this step shows; absent for the fixed Gov't IDs and Review steps. */
  section?: FormSectionConfig;
}

/** One step per section of HR's form, then Gov't IDs & 201 files, then Review. */
export function stepsFor(config: OnboardingFormConfig): StepDef[] {
  const sectionSteps = config.sections.map((s) => {
    const def = sectionDef(s.key);
    const labels = s.fields.map((f) => fieldDef(f.key).label);
    return {
      id: s.key,
      title: def.title,
      // One field usually shares the section's name ("Home address"), so its hint says more.
      summary:
        labels.length === 1 ? fieldDef(s.fields[0].key).hint : labels.length > 3 ? `${labels.slice(0, 3).join(", ")} and more` : labels.join(", "),
      fields: s.fields.flatMap((f) => fieldDef(f.key).values),
      required: s.fields.filter((f) => f.required).flatMap((f) => requiredValuesOf(f.key)),
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
  check("bankAccountNumber", "Bank account number", !String(v.extras?.bankAccountNumber ?? "").trim());
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
    extras: {},
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
  const filled = counted.filter((f) => isFilled(valueAt(values, f))).length;
  return { filled, total: counted.length };
}

// ---- 201 documents the new hire uploads ----

export const coreDocuments = PERSONNEL_DOCUMENT_TYPES.filter((t) => !SITUATIONAL_DOCUMENT_TYPES.includes(t));

/** Situational documents that apply to what they've entered so far (married). */
export function situationalFor(v: AddEmployeeFormValues): PersonnelDocumentType[] {
  return applicableDocuments({ lastName: "", firstName: "", civilStatus: v.civilStatus || undefined });
}

/** Uploads that still count: a situational document that no longer applies is dropped. */
export function activeUploads(v: AddEmployeeFormValues): UploadedDocument[] {
  const shown = new Set<string>([...coreDocuments, ...situationalFor(v)]);
  return (v.uploadedDocuments as UploadedDocument[]).filter((u) => shown.has(u.type));
}

// ---- Validation ----

const err = (message: string) => ({ type: "custom", message });

/** Puts an error at a path in react-hook-form's error tree. */
function setErrorAt(errors: Record<string, unknown>, path: ValuePath, error: unknown, overwrite = false) {
  const keys = path.split(".");
  let node = errors;
  for (const k of keys.slice(0, -1)) node = (node[k] ??= {}) as Record<string, unknown>;
  const last = keys[keys.length - 1];
  if (overwrite || !node[last]) node[last] = error;
}

function deleteErrorAt(errors: Record<string, unknown>, path: ValuePath) {
  const keys = path.split(".");
  const parent = keys.slice(0, -1).reduce<Record<string, unknown> | undefined>((o, k) => o?.[k] as Record<string, unknown> | undefined, errors);
  if (parent) delete parent[keys[keys.length - 1]];
  if (keys.length > 1 && parent && Object.keys(parent).length === 0) delete errors[keys[0]];
}

/** The message when a required field is left blank. */
function requiredMessage(path: ValuePath, key: FormFieldKey): string {
  const special: Record<string, string> = {
    street: "Enter your house no. and street",
    city: "Choose your city or municipality",
    province: "Choose your province",
    "extras.provStreet": "Enter the house no. and street",
    "extras.provCity": "Choose the city or municipality",
    "extras.provProvince": "Choose the province",
    emergencyName: "Enter who HR should call",
    emergencyPhone: "Enter their mobile number",
  };
  const def = fieldDef(key);
  return special[path] ?? (def.kind === "select" || ["suffix", "civilStatus", "bloodType"].includes(key) ? `Choose your ${def.label.toLowerCase()}` : `Enter your ${def.label.toLowerCase()}`);
}

/** zod skips object refinements while any other field has an error, so HR's rules run here instead —
 * they show up on the step the employee is on. The form passes HR's config as the resolver context. */
export function onboardingResolver(): Resolver<AddEmployeeFormValues, OnboardingFormConfig> {
  const base = zodResolver(addEmployeeSchema) as unknown as Resolver<AddEmployeeFormValues, OnboardingFormConfig>;
  return async (values, context, options) => {
    const result = await base(values, context, options);
    const errors = structuredClone(result.errors ?? {}) as Record<string, unknown>;
    if (context) {
      const included = includedFieldKeys(context);
      // Fields HR left out never block submitting (e.g. a stale emergency number in an old draft).
      for (const f of FORM_FIELDS) if (!included.has(f.key)) for (const path of f.values) deleteErrorAt(errors, path);
      const blank = (path: ValuePath) => !String(valueAt(values, path) ?? "").trim();
      for (const s of context.sections) {
        for (const f of s.fields) {
          if (!f.required) continue;
          // A provincial address that's the same as home needs nothing else.
          if (f.key === "provincialAddress" && valueAt(values, "extras.provSame") === "yes") continue;
          for (const path of requiredValuesOf(f.key)) if (blank(path)) setErrorAt(errors, path, err(requiredMessage(path, f.key)));
        }
      }
      if (included.has("civilStatus") && values.civilStatus === "Married" && !values.spouseName.trim()) {
        setErrorAt(errors, "spouseName", err("Enter your spouse's full name"), true);
      }
      if (included.has("pwd") && valueAt(values, "extras.pwd") === "Yes" && blank("extras.pwdId")) {
        setErrorAt(errors, "extras.pwdId", err("Enter your PWD ID number"));
      }
      const year = String(valueAt(values, "extras.yearGraduated") ?? "").trim();
      if (included.has("yearGraduated") && year && !(/^\d{4}$/.test(year) && +year >= 1950 && +year <= new Date().getFullYear())) {
        setErrorAt(errors, "extras.yearGraduated", err("Enter a four-digit year, e.g. 2020"), true);
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
  const blank = emptyValues() as unknown as Record<string, unknown>;
  const v = { ...values, extras: { ...values.extras }, dependents: [] } as unknown as Record<string, unknown> & { extras: Record<string, string> };
  for (const f of FORM_FIELDS) {
    if (included.has(f.key)) continue;
    for (const path of f.values) {
      if (path.startsWith("extras.")) delete v.extras[path.slice(7)];
      else v[path] = blank[path];
    }
  }
  return { ...toInput(v as unknown as AddEmployeeFormValues, governmentId), otherDetails: otherDetails(v as unknown as AddEmployeeFormValues, config) };
}

/** The extra fields HR added, as labelled answers HR reads when reviewing (Nickname: Jun, Bank: BDO…). */
export function otherDetails(v: AddEmployeeFormValues, config: OnboardingFormConfig): { label: string; value: string }[] {
  const e = v.extras ?? {};
  const out: { label: string; value: string }[] = [];
  for (const { key } of config.sections.flatMap((s) => s.fields)) {
    const def = fieldDef(key);
    if (def.kind) {
      const value = String(e[def.values[0].slice(7)] ?? "").trim();
      if (value) out.push({ label: def.label, value: def.unit ? `${value} ${def.unit}` : value });
    } else if (key === "provincialAddress") {
      const value =
        e.provSame === "yes"
          ? "Same as home address"
          : composeAddress({ street: e.provStreet ?? "", barangay: e.provBarangay ?? "", city: e.provCity ?? "", province: e.provProvince ?? "" });
      if (value) out.push({ label: def.label, value });
    } else if (key === "pwd" && e.pwd) {
      out.push({ label: def.label, value: e.pwd === "Yes" && e.pwdId?.trim() ? `Yes · ID ${e.pwdId.trim()}` : e.pwd });
    }
  }
  return out;
}

function toInput(v: AddEmployeeFormValues, governmentId: OnboardingSubmissionInput["governmentId"]): OnboardingSubmissionInput {
  const governmentNumbers = Object.fromEntries(
    (["tin", "sss", "philHealth", "pagIbig"] as const).filter((k) => v[k].trim()).map((k) => [k, v[k].trim()]),
  );
  return {
    lastName: v.lastName.trim(),
    firstName: v.firstName.trim(),
    middleName: v.middleName.trim(),
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
    // Work background (PRC license, previous employer) isn't asked any more; an old draft's values aren't sent.
  };
}
