// The Onboarding form HR builds: which ready-made fields new hires fill in, in which sections and
// order, and which are required. Government numbers and 201 files are always a fixed last step,
// so they aren't part of this config.

export type FormSectionKey = "personal" | "contact" | "address" | "education" | "health" | "payroll";

export type FormFieldKey =
  // Personal
  | "legalName"
  | "birthDate"
  | "sex"
  | "middleName"
  | "suffix"
  | "nickname"
  | "civilStatus"
  | "bloodType"
  | "placeOfBirth"
  | "citizenship"
  | "religion"
  | "height"
  | "weight"
  // Contact
  | "phone"
  | "personalEmail"
  | "workEmail"
  | "altMobile"
  | "landline"
  | "emergencyContact"
  // Address
  | "address"
  | "provincialAddress"
  // Education
  | "educationLevel"
  | "school"
  | "course"
  | "yearGraduated"
  // Health
  | "medicalConditions"
  | "pwd"
  // Payroll
  | "bankName"
  | "bankAccountName"
  | "bankAccountNumber";

/** How a simple field is drawn. Fields without a kind have their own layout (name, address…). */
export type FieldKind = "text" | "textarea" | "select" | "number" | "tel";

export interface FormFieldDef {
  key: FormFieldKey;
  label: string;
  hint: string;
  section: FormSectionKey;
  /** Always in the form and always required: HR needs it for the 201 file and government registration. */
  locked?: boolean;
  /** Form value paths this field fills in (e.g. "extras.nickname"). */
  values: string[];
  /** What must be filled in when HR marks it required; defaults to the first value. */
  requiredValues?: string[];
  kind?: FieldKind;
  options?: readonly string[];
  placeholder?: string;
  /** Shown after the input, e.g. "cm". */
  unit?: string;
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
  { key: "contact", title: "Contact", description: "How HR reaches you, and who to call in an emergency.", locked: true },
  { key: "address", title: "Address", description: "Printed on your BIR Form 2316." },
  { key: "education", title: "Education", description: "Your highest level of schooling." },
  { key: "health", title: "Health", description: "Kept private; helps HR support you at work." },
  { key: "payroll", title: "Payroll", description: "Where your salary is deposited." },
];

const educationLevels = [
  "Elementary",
  "High school",
  "Senior high school",
  "Vocational / TESDA",
  "College undergraduate",
  "College graduate",
  "Master's degree",
  "Doctorate",
] as const;

const banks = [
  "BDO Unibank",
  "Bank of the Philippine Islands (BPI)",
  "Metrobank",
  "Land Bank of the Philippines",
  "Philippine National Bank (PNB)",
  "Security Bank",
  "UnionBank",
  "RCBC",
  "China Bank",
  "EastWest Bank",
  "PSBank",
  "GCash",
  "Maya",
  "Other",
] as const;

const x = (key: string) => `extras.${key}`;

export const FORM_FIELDS: FormFieldDef[] = [
  // Personal
  { key: "legalName", label: "Legal name", hint: "Last and first name, as on their PSA birth certificate", section: "personal", locked: true, values: ["lastName", "firstName"] },
  { key: "middleName", label: "Middle name", hint: "Mother's maiden surname", section: "personal", values: ["middleName"] },
  { key: "suffix", label: "Suffix", hint: "Jr., Sr., III…", section: "personal", values: ["suffix"] },
  { key: "nickname", label: "Nickname", hint: "What they like to be called at work", section: "personal", kind: "text", placeholder: "Jun", values: [x("nickname")] },
  { key: "birthDate", label: "Birth date", hint: "Shows their age; checks the minimum working age", section: "personal", locked: true, values: ["birthDate"] },
  { key: "sex", label: "Sex", hint: "For SSS and PhilHealth registration", section: "personal", locked: true, values: ["sex"] },
  { key: "civilStatus", label: "Civil status", hint: "Asks for the spouse's name when married", section: "personal", values: ["civilStatus", "spouseName"] },
  { key: "bloodType", label: "Blood type", hint: "For emergencies at work", section: "personal", values: ["bloodType"] },
  { key: "placeOfBirth", label: "Place of birth", hint: "City or municipality, as on their birth certificate", section: "personal", kind: "text", placeholder: "Cebu City", values: [x("placeOfBirth")] },
  { key: "citizenship", label: "Citizenship", hint: "Filipino, dual citizen…", section: "personal", kind: "select", options: ["Filipino", "Dual citizen", "Foreign national"], values: [x("citizenship")] },
  { key: "religion", label: "Religion", hint: "Optional; for holiday and leave planning", section: "personal", kind: "text", placeholder: "Roman Catholic", values: [x("religion")] },
  { key: "height", label: "Height", hint: "In centimeters, for uniforms and IDs", section: "personal", kind: "number", unit: "cm", placeholder: "165", values: [x("height")] },
  { key: "weight", label: "Weight", hint: "In kilograms, for the pre-employment medical", section: "personal", kind: "number", unit: "kg", placeholder: "60", values: [x("weight")] },
  // Contact
  { key: "phone", label: "Mobile number", hint: "Primary PH mobile number", section: "contact", locked: true, values: ["phone"] },
  { key: "personalEmail", label: "Personal email", hint: "Their own email address", section: "contact", values: ["personalEmail"] },
  { key: "workEmail", label: "Work email", hint: "If they already have a company email", section: "contact", values: ["email"] },
  { key: "altMobile", label: "Alternate mobile", hint: "A second number HR can try", section: "contact", kind: "tel", placeholder: "0918 000 0000", values: [x("altMobile")] },
  { key: "landline", label: "Landline", hint: "Home phone, with area code", section: "contact", kind: "tel", placeholder: "(032) 234 5678", values: [x("landline")] },
  { key: "emergencyContact", label: "Emergency contact", hint: "Name, relationship and mobile", section: "contact", values: ["emergencyName", "emergencyRelationship", "emergencyPhone"], requiredValues: ["emergencyName", "emergencyPhone"] },
  // Address
  { key: "address", label: "Home address", hint: "Street, then province, city and barangay from the list", section: "address", values: ["street", "barangay", "city", "province"], requiredValues: ["street", "city", "province"] },
  {
    key: "provincialAddress",
    label: "Provincial / permanent address",
    hint: "If different from where they live now",
    section: "address",
    values: [x("provSame"), x("provStreet"), x("provBarangay"), x("provCity"), x("provProvince")],
    requiredValues: [x("provStreet"), x("provCity"), x("provProvince")],
  },
  // Education
  { key: "educationLevel", label: "Highest attainment", hint: "Elementary to doctorate", section: "education", kind: "select", options: educationLevels, values: [x("educationLevel")] },
  { key: "school", label: "School", hint: "Where they finished it", section: "education", kind: "text", placeholder: "University of San Carlos", values: [x("school")] },
  { key: "course", label: "Course / degree", hint: "e.g. BS Accountancy", section: "education", kind: "text", placeholder: "BS Accountancy", values: [x("course")] },
  { key: "yearGraduated", label: "Year graduated", hint: "Four digits", section: "education", kind: "number", placeholder: "2020", values: [x("yearGraduated")] },
  // Health
  { key: "medicalConditions", label: "Medical conditions or allergies", hint: "Anything HR or first aiders should know", section: "health", kind: "textarea", placeholder: "e.g. Asthma; allergic to penicillin", values: [x("medicalConditions")] },
  { key: "pwd", label: "Person with disability (PWD)", hint: "Yes or no, plus the PWD ID number", section: "health", values: [x("pwd"), x("pwdId")] },
  // Payroll
  { key: "bankName", label: "Bank", hint: "Where salary is deposited", section: "payroll", kind: "select", options: banks, values: [x("bankName")] },
  { key: "bankAccountName", label: "Account name", hint: "Exactly as the bank has it", section: "payroll", kind: "text", placeholder: "Juan P. Dela Cruz", values: [x("bankAccountName")] },
  { key: "bankAccountNumber", label: "Account number", hint: "Digits only", section: "payroll", kind: "text", placeholder: "0012 3456 7890", values: [x("bankAccountNumber")] },
];

const fieldMap = new Map(FORM_FIELDS.map((f) => [f.key, f]));
const sectionMap = new Map(FORM_SECTIONS.map((s) => [s.key, s]));

export const fieldDef = (key: FormFieldKey) => fieldMap.get(key)!;
export const sectionDef = (key: FormSectionKey) => sectionMap.get(key)!;

/** What must be filled in for a required field to count as answered. */
export const requiredValuesOf = (key: FormFieldKey) => fieldDef(key).requiredValues ?? fieldDef(key).values.slice(0, 1);

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
 * Repairs a stored or edited config: drops unknown keys and duplicates, moves each field to its own
 * section (e.g. Emergency contact, which used to have a section of its own, now sits in Contact),
 * and makes sure the locked sections and fields are there and required.
 */
export function normalizeConfig(raw: { sections?: unknown; updatedAt?: unknown }): OnboardingFormConfig {
  const order: FormSectionKey[] = [];
  const picked: FormFieldConfig[] = [];
  const seen = new Set<string>();
  for (const s of (Array.isArray(raw.sections) ? raw.sections : []) as { key?: unknown; fields?: unknown }[]) {
    if (typeof s?.key === "string" && sectionMap.has(s.key as FormSectionKey) && !order.includes(s.key as FormSectionKey)) order.push(s.key as FormSectionKey);
    for (const f of (Array.isArray(s?.fields) ? s.fields : []) as { key?: unknown; required?: unknown }[]) {
      const def = typeof f?.key === "string" ? fieldMap.get(f.key as FormFieldKey) : undefined;
      if (!def || seen.has(def.key)) continue;
      seen.add(def.key);
      picked.push({ key: def.key, required: def.locked ? true : f.required === true });
    }
  }
  // Locked sections lead unless HR placed them; any other section a field needs goes at the end.
  for (const def of FORM_SECTIONS.filter((s) => s.locked).reverse()) if (!order.includes(def.key)) order.unshift(def.key);
  for (const f of picked) {
    const home = fieldDef(f.key).section;
    if (!order.includes(home)) order.push(home);
  }
  const sections = order.map((key) => ({ key, fields: [] as FormFieldConfig[] }));
  for (const f of picked) sections.find((s) => s.key === fieldDef(f.key).section)!.fields.push(f);
  // A missing locked field goes back where the catalog puts it among the fields already there.
  for (const def of FORM_FIELDS.filter((d) => d.locked && !seen.has(d.key))) {
    const section = sections.find((s) => s.key === def.section)!;
    const catalog = FORM_FIELDS.filter((d) => d.section === def.section).map((d) => d.key);
    const at = section.fields.findIndex((f) => catalog.indexOf(f.key) > catalog.indexOf(def.key));
    section.fields.splice(at === -1 ? section.fields.length : at, 0, { key: def.key, required: true });
  }
  return {
    // A section with nothing in it isn't worth a step.
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
