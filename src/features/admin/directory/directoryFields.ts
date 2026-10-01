// The details shown for each person in the Employee Directory, on cards and as table columns.

import type { DocumentCompletion } from "@/components/shared/PersonnelFilePanels";
import type { Employee, PersonnelProfile } from "@/lib/types";

export type DirectoryFieldGroup = "Work" | "Contact" | "Personal" | "Records";



/** Everything a field might read for one person. */
export interface DirectoryRowData {
  employee: Employee;
  profile?: PersonnelProfile;
  hiredOn?: string;
  completion?: DocumentCompletion;
  managerName?: string;
}

export interface DirectoryFieldDef {
  key: string;
  label: string;
  /** Fits a card line and a table header; defaults to label. */
  short?: string;
  hint: string;
  group: DirectoryFieldGroup;
  /** Text shown for this person; undefined renders as "—". The 201 progress field draws a bar instead. */
  value: (d: DirectoryRowData) => string | undefined;
}

function formatDate(iso?: string) {
  return iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : undefined;
}

const govCount = (e: Employee) => Object.values(e.governmentNumbers ?? {}).filter((v) => v?.trim()).length;

export const DIRECTORY_FIELDS: DirectoryFieldDef[] = [
  { key: "department", label: "Department", hint: "Team they belong to", group: "Work", value: (d) => d.employee.department || undefined },
  {
    key: "office",
    label: "Office & cluster",
    hint: "Where they report and their client group",
    group: "Work",
    value: (d) => [d.employee.office, d.employee.cluster].filter(Boolean).join(" · ") || undefined,
  },
  { key: "employmentStatus", label: "Employment status", short: "Employment", hint: "Probationary, regular, contractual…", group: "Work", value: (d) => d.employee.employmentStatus },
  { key: "dateHired", label: "Date hired", hint: "First day with the company", group: "Work", value: (d) => d.hiredOn ?? formatDate(d.employee.dateHired) },
  { key: "reportsTo", label: "Reports to", hint: "Their direct supervisor", group: "Work", value: (d) => d.managerName },
  { key: "email", label: "Work email", hint: "Company email address", group: "Contact", value: (d) => d.employee.email },
  { key: "phone", label: "Mobile", hint: "Primary mobile number", group: "Contact", value: (d) => d.employee.phone },
  { key: "personalEmail", label: "Personal email", hint: "Their own email address", group: "Contact", value: (d) => d.employee.personalEmail },
  { key: "emergencyContact", label: "Emergency contact", short: "Emergency", hint: "Who to call if something happens", group: "Contact", value: (d) => d.employee.emergencyContact },
  { key: "birthDate", label: "Birth date", hint: "For birthdays and benefits", group: "Personal", value: (d) => formatDate(d.profile?.birthDate) },
  { key: "civilStatus", label: "Civil status", hint: "Single, married, widowed…", group: "Personal", value: (d) => d.profile?.civilStatus },
  { key: "bloodType", label: "Blood type", hint: "For emergencies at work", group: "Personal", value: (d) => d.profile?.bloodType },
  {
    key: "documents",
    label: "201 document progress",
    short: "201 files",
    hint: "How many documents are verified",
    group: "Records",
    value: (d) => (d.completion ? `${d.completion.verified}/${d.completion.applicable} verified` : undefined),
  },
  {
    key: "governmentNumbers",
    label: "Government numbers",
    short: "Gov't numbers",
    hint: "TIN, SSS, PhilHealth, Pag-IBIG on file",
    group: "Records",
    value: (d) => `${govCount(d.employee)} of 4 on file`,
  },
];

const byKey = new Map(DIRECTORY_FIELDS.map((f) => [f.key, f]));

export const fieldByKey = (key: string) => byKey.get(key);

export const DEFAULT_DIRECTORY_FIELDS = ["department", "office", "email", "phone", "dateHired", "documents"];
