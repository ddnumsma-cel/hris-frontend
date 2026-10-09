import { CIVIL_STATUSES } from "@/lib/corehr/types";
import { BANKS } from "@/lib/corehr/schemas";

export interface FieldSpec {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "select";
  options?: readonly string[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
  wide?: boolean;
}

export const PERSONAL_FIELDS: FieldSpec[] = [
  { name: "firstName", label: "First name", required: true },
  { name: "middleName", label: "Middle name" },
  { name: "lastName", label: "Last name", required: true },
  { name: "suffix", label: "Suffix", placeholder: "Jr., III" },
  { name: "birthDate", label: "Birth date", type: "date" },
  { name: "sex", label: "Sex", type: "select", options: ["Male", "Female"] },
  { name: "civilStatus", label: "Civil status", type: "select", options: CIVIL_STATUSES },
  { name: "nationality", label: "Nationality" },
];

export const CONTACT_FIELDS: FieldSpec[] = [
  { name: "workEmail", label: "Work email", type: "email", required: true },
  { name: "personalEmail", label: "Personal email", type: "email", required: true },
  { name: "mobile", label: "Mobile", type: "tel", placeholder: "0917 123 4567", required: true },
  { name: "address", label: "Home address", placeholder: "House no., street, barangay", wide: true, required: true },
  { name: "city", label: "City / municipality", required: true },
  { name: "province", label: "Province", required: true },
  { name: "emergencyName", label: "Emergency contact", required: true },
  { name: "emergencyRelationship", label: "Relationship", placeholder: "Spouse, parent…", required: true },
  { name: "emergencyPhone", label: "Emergency phone", type: "tel", required: true },
];

export const BANK_FIELDS: FieldSpec[] = [
  { name: "bank", label: "Bank", type: "select", options: BANKS },
  { name: "accountName", label: "Account name", placeholder: "As printed on the passbook or card" },
  { name: "accountNumber", label: "Account number", placeholder: "0012 3456 7890", wide: true },
];

export const GOVERNMENT_FIELDS: FieldSpec[] = [
  { name: "sss", label: "SSS number", placeholder: "34-1234567-8", hint: "10 digits" },
  { name: "philhealth", label: "PhilHealth number", placeholder: "12-345678901-2", hint: "12 digits" },
  { name: "pagibig", label: "Pag-IBIG MID", placeholder: "1234-5678-9012", hint: "12 digits" },
  { name: "tin", label: "TIN", placeholder: "123-456-789-000", hint: "9 or 12 digits" },
];
