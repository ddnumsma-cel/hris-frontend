// What a new hire chose to provide on the "Let's set up your form" modal, and how each
// choice maps to fields and 201 documents. The legal core (name, birth date, sex, mobile,
// government numbers, valid ID) is never optional: HR needs it for the 201 file,
// SSS/PhilHealth/Pag-IBIG registration and payroll.

import { createContext, useContext } from "react";
import type { FieldErrors, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addEmployeeSchema, type AddEmployeeFormValues } from "@/lib/schemas";
import type { PersonnelDocumentType } from "@/lib/types";
import { coreDocuments, steps, type FieldName, type StepDef } from "./model";

export interface OnboardingChoices {
  married: boolean;
  dependents: boolean;
  licensed: boolean;
  previousEmployer: boolean;
  bloodType: boolean;
  address: boolean;
  emergency: boolean;
}

/** "Use the full form": every section shows. Also used for drafts saved before choices existed. */
export const FULL_FORM: OnboardingChoices = {
  married: true,
  dependents: true,
  licensed: true,
  previousEmployer: true,
  bloodType: true,
  address: true,
  emergency: true,
};

/** Where the modal starts: situational answers off, the optional details HR asks for most on. */
export const STARTING_CHOICES: OnboardingChoices = {
  married: false,
  dependents: false,
  licensed: false,
  previousEmployer: false,
  bloodType: false,
  address: true,
  emergency: true,
};

export const ChoicesContext = createContext<OnboardingChoices>(FULL_FORM);
export const useChoices = () => useContext(ChoicesContext);

// ---- Fields per choice ----

const fieldsByChoice: Record<keyof OnboardingChoices, FieldName[]> = {
  married: ["spouseName"],
  dependents: ["dependents"],
  licensed: ["licenseProfession", "licenseNumber", "licenseExpiry"],
  previousEmployer: ["previousEmployer", "previousLastDay"],
  bloodType: ["bloodType"],
  address: ["street", "barangay", "city", "province"],
  emergency: ["emergencyName", "emergencyRelationship", "emergencyPhone"],
};

const requiredByChoice: Partial<Record<keyof OnboardingChoices, FieldName[]>> = {
  married: ["spouseName"],
  dependents: ["dependents"],
  licensed: ["licenseNumber"],
  previousEmployer: ["previousEmployer"],
};

/** Which step each conditional field lives on. */
const stepOf: Partial<Record<FieldName, StepDef["id"]>> = {
  spouseName: "identity",
  dependents: "identity",
  licenseProfession: "employment",
  licenseNumber: "employment",
  licenseExpiry: "employment",
  previousEmployer: "employment",
  previousLastDay: "employment",
};

/** Fields the employee chose not to fill: hidden, not validated and not submitted. */
export function hiddenFields(c: OnboardingChoices): FieldName[] {
  return (Object.keys(fieldsByChoice) as (keyof OnboardingChoices)[]).filter((k) => !c[k]).flatMap((k) => fieldsByChoice[k]);
}

/** The five steps, with only the fields this employee will see (and progress counts against). */
export function stepsFor(c: OnboardingChoices): StepDef[] {
  const hidden = new Set(hiddenFields(c));
  const on = (Object.keys(fieldsByChoice) as (keyof OnboardingChoices)[]).filter((k) => c[k]);
  return steps.map((s) => {
    const extra = on.flatMap((k) => fieldsByChoice[k]).filter((f) => stepOf[f] === s.id);
    const extraRequired = on.flatMap((k) => requiredByChoice[k] ?? []).filter((f) => stepOf[f] === s.id);
    return {
      ...s,
      fields: [...s.fields.filter((f) => !hidden.has(f)), ...extra],
      required: [...s.required, ...extraRequired],
    };
  });
}

// ---- 201 documents per choice ----

const PREVIOUS_COE: PersonnelDocumentType = "Certificate of Employment (Previous)";

export function documentsFor(c: OnboardingChoices) {
  const situational: PersonnelDocumentType[] = [];
  if (c.married) situational.push("Marriage Certificate (PSA)");
  if (c.dependents) situational.push("Child's Birth Certificate");
  if (c.licensed) situational.push("Professional License");
  if (c.previousEmployer) situational.push(PREVIOUS_COE);
  return { core: coreDocuments.filter((t) => t !== PREVIOUS_COE), situational };
}

// ---- Validation for the chosen sections ----

const err = (message: string) => ({ type: "custom", message });

/** zod skips object refinements while any other field has an error, so the choice-based
 * rules run here instead — they show up on the step the employee is on. */
export function choicesResolver(): Resolver<AddEmployeeFormValues, OnboardingChoices> {
  const base = zodResolver(addEmployeeSchema) as unknown as Resolver<AddEmployeeFormValues, OnboardingChoices>;
  return async (values, context, options) => {
    const result = await base(values, context, options);
    // The form passes the current choices as its resolver context.
    const c = context ?? FULL_FORM;
    const extra: FieldErrors<AddEmployeeFormValues> = {};
    if (c.married && !values.spouseName.trim()) extra.spouseName = err("Enter your spouse's full name");
    if (c.dependents) {
      const rows = values.dependents.map((d) => (d.name.trim() ? undefined : { name: err("Enter their full name") }));
      if (values.dependents.length === 0 || rows.some(Boolean)) {
        extra.dependents = (values.dependents.length ? rows : [{ name: err("Enter their full name") }]) as FieldErrors<AddEmployeeFormValues>["dependents"];
      }
    }
    if (c.licensed && !values.licenseNumber.trim()) extra.licenseNumber = err("Enter your PRC license number");
    if (c.previousEmployer && !values.previousEmployer.trim()) extra.previousEmployer = err("Enter the company name");
    // Hidden sections never block submitting.
    const errors = { ...result.errors } as Record<string, unknown>;
    for (const f of hiddenFields(c)) delete errors[f];
    Object.assign(errors, extra);
    if (Object.keys(errors).length === 0) return { values: (result.values && Object.keys(result.values).length ? result.values : values) as AddEmployeeFormValues, errors: {} };
    return { values: {}, errors: errors as FieldErrors<AddEmployeeFormValues> };
  };
}

// ---- The "building your form" checklist ----

export function buildLines(c: OnboardingChoices, firstName?: string): string[] {
  const lines = [`Setting up the basics HR needs${firstName ? ` for ${firstName}` : ""}`];
  lines.push(c.married ? "Adding your spouse and marriage certificate" : "Skipping marriage details");
  lines.push(c.dependents ? "Adding a dependents section" : "Skipping dependents");
  if (c.licensed) lines.push("Adding your PRC license");
  if (c.previousEmployer) lines.push("Adding your previous employer");
  const optional = [c.address && "address", c.emergency && "emergency contact", c.bloodType && "blood type"].filter(Boolean);
  lines.push(optional.length ? `Including your ${optional.join(", ").replace(/, ([^,]*)$/, " and $1")}` : "Leaving optional details for later");
  return lines;
}

// ---- Saved choices (this browser only, like the draft) ----

const CHOICES_KEY = "msma-onboarding-choices";

export function loadChoices(): OnboardingChoices | null {
  try {
    const raw = localStorage.getItem(CHOICES_KEY);
    return raw ? { ...FULL_FORM, ...(JSON.parse(raw) as Partial<OnboardingChoices>) } : null;
  } catch {
    return null;
  }
}

export function saveChoices(c: OnboardingChoices) {
  try {
    localStorage.setItem(CHOICES_KEY, JSON.stringify(c));
  } catch {
    // Storage blocked — the choices still apply until the page reloads.
  }
}

export function clearChoices() {
  try {
    localStorage.removeItem(CHOICES_KEY);
  } catch {
    // Nothing to clear.
  }
}
