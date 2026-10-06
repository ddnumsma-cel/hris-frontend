import { z } from "zod";

export const leaveTypes = ["Vacation", "Sick", "Emergency", "Bereavement"] as const;

export const leaveRequestSchema = z
  .object({
    type: z.enum(leaveTypes),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    reason: z.string().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  })
  .refine((data) => data.type !== "Emergency" || (data.reason?.trim().length ?? 0) > 0, {
    message: "Emergency leave requires a short reason",
    path: ["reason"],
  });

export type LeaveRequestFormValues = z.infer<typeof leaveRequestSchema>;

export const certificateTypes = [
  "Certificate of Employment",
  "Certificate of Tax Withheld (2316)",
  "Employment Verification Letter",
] as const;

export const certificateRequestSchema = z.object({
  type: z.enum(certificateTypes),
  purpose: z.string().min(1, "Let your HR team know what this is for"),
});

export type CertificateRequestFormValues = z.infer<typeof certificateRequestSchema>;

export const officeOptions = ["Cebu HQ", "Manila", "Davao"] as const;

export const clusterOptions = ["RPM", "VCM", "ADS"] as const;

/** The only job titles used across the company. */
export const POSITION_TITLES = ["Executive Assistant / Secretary", "Junior Associate", "Experienced Associate", "Experienced Admin Assistant", "BSS Team Leader", "Associate Director", "Partner"] as const;

// Department and cluster are picked together as one "Department · Cluster"
// assignment; each cluster only offers the departments it actually staffs.
export const departmentsByCluster: Record<(typeof clusterOptions)[number], string[]> = {
  RPM: ["Audit & Assurance", "Tax Advisory", "Bookkeeping"],
  VCM: ["Audit & Assurance", "Tax Advisory", "Bookkeeping"],
  ADS: ["Audit & Assurance", "Tax Advisory", "Corporate Legal", "Admin & Support"],
};

const ASSIGNMENT_SEPARATOR = "::";

export function toAssignment(cluster: string, department: string) {
  return `${cluster}${ASSIGNMENT_SEPARATOR}${department}`;
}

export function fromAssignment(assignment: string) {
  const [cluster, department = ""] = assignment.split(ASSIGNMENT_SEPARATOR);
  return { cluster: cluster as (typeof clusterOptions)[number], department };
}

export const sexOptions = ["Male", "Female"] as const;

export const addEmployeeSchema = z.object({
  lastName: z.string().trim().min(1, "Last name is required"),
  firstName: z.string().trim().min(1, "First name is required"),
  middleName: z.string().trim(),
  suffix: z.string().trim(),
  birthDate: z.string(),
  sex: z.union([z.enum(sexOptions), z.literal("")]),
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]),
  phone: z.string().trim(),
  position: z.string().trim().min(1, "Position is required"),
  assignment: z.string().min(1, "Choose a department and cluster"),
  office: z.enum(officeOptions),
  idType: z.string(),
  idNumber: z.string().trim(),
  idExpiry: z.string(),
});

export type AddEmployeeFormValues = z.infer<typeof addEmployeeSchema>;

export const registerSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  position: z.string().min(1, "Position is required"),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]),
  phone: z.union([z.literal(""), z.string().regex(/^9\d{9}$/, "Enter a 10-digit mobile number, e.g. 9171234567")]),
  cluster: z.enum(clusterOptions),
  office: z.enum(officeOptions),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
