import { CIVIL_STATUSES } from "@/lib/corehr/types";
import { BANKS } from "@/lib/corehr/schemas";

/** Name suffixes, written the way the ID scanner reads them (lib/idValidate.ts). */
export interface FieldSpec {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "select";
  options?: readonly string[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
  wide?: boolean;
  /** Digits only, typed into this shape: "#" is a digit, anything else is added as you type. */
  mask?: string;
}

export const SUFFIXES = ["Jr.", "Sr.", "II", "III", "IV", "V"] as const;
export const RELATIONSHIPS = ["Spouse", "Parent", "Child", "Sibling", "Partner", "Relative", "Guardian", "Friend", "Other"] as const;
const MOBILE = "#### ### ####";

/** "09171234567" in "#### ### ####" → "0917 123 4567"; letters dropped, stops when the shape is full. */
export function applyMask(value: string, mask: string) {
  const digits = value.replace(/\D/g, "");
  let out = "";
  let i = 0;
  for (const m of mask) {
    if (i >= digits.length) break;
    out += m === "#" ? digits[i++] : m;
  }
  return out;
}

export const PERSONAL_FIELDS: FieldSpec[] = [
  { name: "firstName", label: "First name", required: true },
  { name: "middleName", label: "Middle name" },
  { name: "lastName", label: "Last name", required: true },
  { name: "suffix", label: "Suffix", type: "select", options: SUFFIXES },
  { name: "birthDate", label: "Birth date", type: "date" },
  { name: "sex", label: "Sex", type: "select", options: ["Male", "Female"] },
  { name: "civilStatus", label: "Civil status", type: "select", options: CIVIL_STATUSES },
  { name: "nationality", label: "Nationality" },
];

export const CONTACT_FIELDS: FieldSpec[] = [
  { name: "workEmail", label: "Work email", type: "email", required: true },
  { name: "personalEmail", label: "Personal email", type: "email", required: true },
  { name: "mobile", label: "Mobile", type: "tel", placeholder: "0917 123 4567", mask: MOBILE, required: true },
  { name: "address", label: "Home address", placeholder: "House no., street, barangay", wide: true, required: true },
  { name: "city", label: "City / municipality", required: true },
  { name: "province", label: "Province", required: true },
  { name: "emergencyName", label: "Emergency contact person", required: true },
  { name: "emergencyRelationship", label: "Relationship", type: "select", options: RELATIONSHIPS, required: true },
  { name: "emergencyPhone", label: "Emergency phone", type: "tel", placeholder: "0917 123 4567", mask: MOBILE, hint: "Must be different from the mobile number", required: true },
];

export const BANK_FIELDS: FieldSpec[] = [
  { name: "bank", label: "Bank", type: "select", options: BANKS },
  { name: "accountName", label: "Account name", placeholder: "As printed on the passbook or card" },
  { name: "accountNumber", label: "Account number", placeholder: "0012 3456 7890", wide: true },
];

export const GOVERNMENT_FIELDS: FieldSpec[] = [
  { name: "sss", label: "SSS number", placeholder: "34-1234567-8", hint: "10 digits", mask: "##-#######-#" },
  { name: "philhealth", label: "PhilHealth number", placeholder: "12-345678901-2", hint: "12 digits", mask: "##-#########-#" },
  { name: "pagibig", label: "Pag-IBIG MID", placeholder: "1234-5678-9012", hint: "12 digits", mask: "####-####-####" },
  { name: "tin", label: "TIN", placeholder: "123-456-789-000", hint: "9 or 12 digits", mask: "###-###-###-###" },
];
