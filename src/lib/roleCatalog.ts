// Roles any company might hire for, grouped by field. The public application lists these so the
// form works for any business, not only accounting firms. Each field brings its own background
// options and skill suggestions.

import type { ApplicantProfession } from "./types";

export interface RoleField {
  key: string;
  label: string;
  roles: string[];
  /** "Which describes your … background?" options; `profession` ties accounting ones to accountant-first sorting. */
  backgrounds: { label: string; profession?: ApplicantProfession; licensed?: boolean }[];
  skills: string[];
}

const generic = (field: string, licence?: string): RoleField["backgrounds"] => [
  ...(licence ? [{ label: licence, licensed: true }] : []),
  { label: `Graduate of a ${field}-related course` },
  { label: `${field} student or undergraduate` },
  { label: "Other field" },
];

export const ROLE_FIELDS: RoleField[] = [
  {
    key: "accounting",
    label: "Accounting & Finance",
    roles: ["Audit Associate", "Tax Associate", "Bookkeeper", "Staff Accountant", "Senior Accountant", "Payroll Specialist", "Financial Analyst", "Accounts Payable Clerk", "Accounts Receivable Clerk", "Finance Manager"],
    backgrounds: [
      { label: "Certified Public Accountant (CPA)", profession: "CPA", licensed: true },
      { label: "BS Accountancy graduate", profession: "BS Accountancy graduate" },
      { label: "Accounting student or undergraduate", profession: "Accounting student / undergrad" },
      { label: "Other field", profession: "Other" },
    ],
    skills: ["Financial reporting", "Auditing", "Tax compliance", "Bookkeeping", "Microsoft Excel", "QuickBooks", "SAP", "Payroll"],
  },
  {
    key: "it",
    label: "Information Technology",
    roles: ["Software Developer", "Web Developer", "IT Support Specialist", "Network Administrator", "System Administrator", "Data Analyst", "QA Tester", "UI/UX Designer", "Cybersecurity Analyst", "IT Project Manager"],
    backgrounds: [
      { label: "IT professional with certifications (e.g. CCNA, AWS, CompTIA)" },
      { label: "BS IT / Computer Science / Computer Engineering graduate" },
      { label: "IT or Computer Science student or undergraduate" },
      { label: "Other field" },
    ],
    skills: ["JavaScript", "Python", "SQL", "React", "Networking", "Technical support", "Cloud (AWS / Azure)", "Git"],
  },
  {
    key: "hr",
    label: "Human Resources",
    roles: ["HR Assistant", "HR Generalist", "Recruiter", "Talent Acquisition Specialist", "Payroll and Benefits Officer", "Training Officer", "HR Manager"],
    backgrounds: generic("HR / Psychology", "Certified HR professional (e.g. CHRP)"),
    skills: ["Recruitment", "Onboarding", "Labor law (DOLE)", "Payroll", "Employee relations", "HRIS", "Interviewing"],
  },
  {
    key: "admin",
    label: "Administration & Office Support",
    roles: ["Administrative Assistant", "Executive Assistant", "Receptionist / Front Desk", "Office Manager", "Liaison Officer", "Data Encoder", "Records Clerk"],
    backgrounds: generic("Business Administration / Office Administration"),
    skills: ["Microsoft Office", "Scheduling", "Filing and records", "Data entry", "Customer service", "Government liaison"],
  },
  {
    key: "sales",
    label: "Sales & Business Development",
    roles: ["Sales Associate", "Account Executive", "Business Development Officer", "Sales Manager", "Inside Sales Representative"],
    backgrounds: generic("Marketing / Business"),
    skills: ["Prospecting", "Negotiation", "CRM", "Client relations", "Presentation", "Closing"],
  },
  {
    key: "marketing",
    label: "Marketing & Communications",
    roles: ["Marketing Associate", "Social Media Specialist", "Content Writer", "Graphic Designer", "Digital Marketing Specialist", "PR Officer"],
    backgrounds: generic("Marketing / Communication"),
    skills: ["Social media", "Copywriting", "Canva / Adobe", "SEO", "Analytics", "Video editing"],
  },
  {
    key: "customer",
    label: "Customer Service",
    roles: ["Customer Service Representative", "Technical Support Representative", "Team Leader", "Quality Analyst"],
    backgrounds: generic("Business / Communication"),
    skills: ["Communication", "Problem solving", "Ticketing tools", "Typing speed", "Email support"],
  },
  {
    key: "operations",
    label: "Operations & Logistics",
    roles: ["Operations Associate", "Logistics Coordinator", "Warehouse Staff", "Purchasing Officer", "Inventory Clerk", "Supply Chain Analyst"],
    backgrounds: generic("Operations / Supply Chain"),
    skills: ["Inventory management", "Procurement", "Logistics", "Forklift operation", "ERP systems"],
  },
  {
    key: "legal",
    label: "Legal",
    roles: ["Lawyer", "Paralegal", "Legal Assistant", "Compliance Officer"],
    backgrounds: generic("Law / Legal Management", "Lawyer (IBP member)"),
    skills: ["Legal research", "Contract drafting", "Corporate law", "Compliance", "Notarization"],
  },
  {
    key: "engineering",
    label: "Engineering & Technical",
    roles: ["Civil Engineer", "Electrical Engineer", "Mechanical Engineer", "Maintenance Technician", "Draftsman", "Safety Officer"],
    backgrounds: generic("Engineering", "Licensed engineer (PRC)"),
    skills: ["AutoCAD", "Project estimation", "Maintenance", "Safety compliance", "Site supervision"],
  },
  {
    key: "health",
    label: "Healthcare",
    roles: ["Nurse", "Company Nurse", "Medical Technologist", "Pharmacist", "Caregiver"],
    backgrounds: generic("Nursing / Health", "Licensed health professional (PRC)"),
    skills: ["Patient care", "First aid", "Medical records", "Vital signs", "Health and safety"],
  },
  {
    key: "education",
    label: "Education & Training",
    roles: ["Teacher", "Tutor", "Corporate Trainer", "Instructional Designer"],
    backgrounds: generic("Education", "Licensed professional teacher (LPT)"),
    skills: ["Lesson planning", "Classroom management", "Training delivery", "E-learning tools"],
  },
  {
    key: "hospitality",
    label: "Hospitality & Food Service",
    roles: ["Service Crew", "Cook", "Barista", "Housekeeping Attendant", "Front Office Agent"],
    backgrounds: generic("Hospitality / Culinary"),
    skills: ["Food safety", "Customer service", "Cash handling", "Food preparation", "Housekeeping"],
  },
];

export const fieldOfRole = (role: string) => ROLE_FIELDS.find((f) => f.roles.includes(role));
