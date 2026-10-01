// The Onboarding form HR builds: which ready-made fields new hires fill in, in which sections and
// order, and which are required. Government numbers and 201 files are always a fixed last step,
// so they aren't part of this config.

import type { AddEmployeeFormValues } from "./schemas";

export type FormSectionKey = "personal" | "contact" | "address" | "emergency" | "family";

export type FormFieldKey =
  | "legalName"
  | "birthDate"
  | "sex"
  | "middleName"
  | "suffix"
  | "civilStatus"
  | "bloodType"
  | "phone"
  | "personalEmail"
  | "workEmail"
  | "address"
  | "emergencyContact"
  | "dependents";

export interface FormFieldDef {
  key: FormFieldKey;
  label: string;
  hint: string;
  section: FormSectionKey;
  /** Always in the form and always required: HR needs it for the 201 file and government registration. */
  locked?: boolean;
  /** Form values this field fills in. The first one decides whether it counts as answered. */
  values: (keyof AddEmployeeFormValues)[];
}

export interface FormSectionDef {
  key: FormSectionKey;
  title: string;
  description: string;
  /** Holds locked fields, so it can't be removed. */
  locked?: boolean;
}

export const FORM_SECTIONS: FormSectionDef[] = [
  { key: "personal", title: "Personal details", description: "Used to register SSS and PhilHealth, and for the 201 file.", locked: true },
  { key: "contact", title: "Contact", description: "How HR reaches you.", locked: true },
  { key: "address", title: "Home address", description: "Printed on your BIR Form 2316." },
  { key: "emergency", title: "Emergency contact", description: "Who HR calls if something happens at work." },
  { key: "family", title: "Family", description: "For your HMO coverage and tax records." },
];

export const FORM_FIELDS: FormFieldDef[] = [
  { key: "legalName", label: "Legal name", hint: "Last and first name, as on their PSA birth certificate", section: "personal", locked: true, values: ["lastName", "firstName"] },
  { key: "middleName", label: "Middle name", hint: "Mother's maiden surname", section: "personal", values: ["middleName"] },
  { key: "suffix", label: "Suffix", hint: "Jr., Sr., III…", section: "personal", values: ["suffix"] },
  { key: "birthDate", label: "Birth date", hint: "Shows their age; checks the minimum working age", section: "personal", locked: true, values: ["birthDate"] },
  { key: "sex", label: "Sex", hint: "For SSS and PhilHealth registration", section: "personal", locked: true, values: ["sex"] },
  { key: "civilStatus", label: "Civil status", hint: "Asks for the spouse's name when married", section: "personal", values: ["civilStatus", "spouseName"] },
  { key: "bloodType", label: "Blood type", hint: "For emergencies at work", section: "personal", values: ["bloodType"] },
  { key: "phone", label: "Mobile number", hint: "Primary PH mobile number", section: "contact", locked: true, values: ["phone"] },
  { key: "personalEmail", label: "Personal email", hint: "Their own email address", section: "contact", values: ["personalEmail"] },
  { key: "workEmail", label: "Work email", hint: "If they already have a company email", section: "contact", values: ["email"] },
  { key: "address", label: "Home address", hint: "Street, barangay, city and province", section: "address", values: ["street", "barangay", "city", "province"] },
  { key: "emergencyContact", label: "Emergency contact", hint: "Name, relationship and mobile", section: "emergency", values: ["emergencyName", "emergencyRelationship", "emergencyPhone"] },
  { key: "dependents", label: "Children & dependents", hint: "Each child or dependent for HMO coverage", section: "family", values: ["dependents"] },
];

const fieldMap = new Map(FORM_FIELDS.map((f) => [f.key, f]));
const sectionMap = new Map(FORM_SECTIONS.map((s) => [s.key, s]));

export const fieldDef = (key: FormFieldKey) => fieldMap.get(key)!;
export const sectionDef = (key: FormSectionKey) => sectionMap.get(key)!;

export interface FormFieldConfig {
  key: FormFieldKey;
  required: boolean;
}

export interface FormSectionConfig {
  key: FormSectionKey;
  fields: FormFieldConfig[];
}

export interface OnboardingFormConfig {
  sections: FormSectionConfig[];
  /** ISO timestamp of the last save. */
  updatedAt: string;
}

/** Where the builder starts: the locked basics only. */
export function starterConfig(): OnboardingFormConfig {
  return normalizeConfig({ sections: [], updatedAt: "" });
}

/**
 * Repairs a stored or edited config: drops unknown keys and duplicates, puts each field in its own
 * section, and makes sure the locked sections and fields are there and required.
 */
export function normalizeConfig(raw: { sections?: unknown; updatedAt?: unknown }): OnboardingFormConfig {
  const seen = new Set<string>();
  const sections: FormSectionConfig[] = [];
  const list = Array.isArray(raw.sections) ? raw.sections : [];
  for (const s of list as { key?: unknown; fields?: unknown }[]) {
    if (typeof s?.key !== "string" || !sectionMap.has(s.key as FormSectionKey) || sections.some((x) => x.key === s.key)) continue;
    const key = s.key as FormSectionKey;
    const fields: FormFieldConfig[] = [];
    for (const f of (Array.isArray(s.fields) ? s.fields : []) as { key?: unknown; required?: unknown }[]) {
      const def = typeof f?.key === "string" ? fieldMap.get(f.key as FormFieldKey) : undefined;
      if (!def || def.section !== key || seen.has(def.key)) continue;
      seen.add(def.key);
      fields.push({ key: def.key, required: def.locked ? true : f.required === true });
    }
    sections.push({ key, fields });
  }
  // Locked sections and fields always exist; missing ones go back to their place.
  for (const def of FORM_SECTIONS.filter((s) => s.locked).reverse()) {
    if (!sections.some((s) => s.key === def.key)) sections.unshift({ key: def.key, fields: [] });
  }
  for (const def of FORM_FIELDS.filter((f) => f.locked && !seen.has(f.key))) {
    const section = sections.find((s) => s.key === def.section)!;
    const order = FORM_FIELDS.filter((f) => f.section === def.section).map((f) => f.key);
    const at = section.fields.findIndex((f) => order.indexOf(f.key) > order.indexOf(def.key));
    section.fields.splice(at === -1 ? section.fields.length : at, 0, { key: def.key, required: true });
  }
  // A section with nothing in it isn't worth a step.
  return {
    sections: sections.filter((s) => s.fields.length > 0),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

/** Fields of the form, in order, with their section. */
export function formFields(config: OnboardingFormConfig) {
  return config.sections.flatMap((s) => s.fields.map((f) => ({ ...f, section: s.key })));
}

export function includedFieldKeys(config: OnboardingFormConfig) {
  return new Set(formFields(config).map((f) => f.key));
}
