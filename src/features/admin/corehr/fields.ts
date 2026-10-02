import { CIVIL_STATUSES } from "@/lib/corehr/types";

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
  { name: "workEmail", label: "Work email", type: "email" },
  { name: "personalEmail", label: "Personal email", type: "email" },
  { name: "mobile", label: "Mobile", type: "tel", placeholder: "0917 123 4567" },
  { name: "address", label: "Home address", placeholder: "House no., street, barangay", wide: true },
  { name: "city", label: "City / municipality" },
  { name: "province", label: "Province" },
  { name: "emergencyName", label: "Emergency contact" },
  { name: "emergencyRelationship", label: "Relationship", placeholder: "Spouse, parent…" },
  { name: "emergencyPhone", label: "Emergency phone", type: "tel" },
];

export const GOVERNMENT_FIELDS: FieldSpec[] = [
  { name: "sss", label: "SSS number", placeholder: "34-1234567-8", hint: "10 digits" },
  { name: "philhealth", label: "PhilHealth number", placeholder: "12-345678901-2", hint: "12 digits" },
  { name: "pagibig", label: "Pag-IBIG MID", placeholder: "1234-5678-9012", hint: "12 digits" },
  { name: "tin", label: "TIN", placeholder: "123-456-789-000", hint: "9 or 12 digits" },
];
