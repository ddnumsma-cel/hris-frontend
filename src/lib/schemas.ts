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

export const clusterOptions = ["RPM", "VCM", "ADS", "Admin & Support"] as const;

// What "Add employee" offers: the firm's two departments, and the client
// cluster the person is assigned to within it.
export const hireDepartmentOptions = ["Accounting", "IT"] as const;
export const hireClusterOptions = ["RPM", "VCM", "ADS"] as const;

export const sexOptions = ["Male", "Female"] as const;
export const bloodTypeOptions = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const emergencyRelationshipOptions = ["Spouse", "Parent", "Sibling", "Child", "Relative", "Partner", "Friend"] as const;

export const addEmployeeSchema = z.object({
  lastName: z.string().trim().min(1, "Last name is required"),
  firstName: z.string().trim().min(1, "First name is required"),
  middleName: z.string().trim(),
  suffix: z.string().trim(),
  birthDate: z.string(),
  sex: z.union([z.enum(sexOptions), z.literal("")]),
  bloodType: z.union([z.enum(bloodTypeOptions), z.literal("")]),
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]),
  phone: z.string().trim().min(1, "Mobile number is required"),
  address: z.string().trim(),
  emergencyName: z.string().trim(),
  emergencyRelationship: z.union([z.enum(emergencyRelationshipOptions), z.literal("")]),
  emergencyPhone: z.string().trim(),
  position: z.string().trim().min(1, "Position is required"),
  dateHired: z.string().min(1, "Date hired is required"),
  department: z.union([z.enum(hireDepartmentOptions), z.literal("")]).refine((v) => v.length > 0, "Choose a department"),
  cluster: z.union([z.enum(hireClusterOptions), z.literal("")]),
  office: z.enum(officeOptions),
  idType: z.string(),
  idNumber: z.string().trim(),
  idExpiry: z.string(),
});

export type AddEmployeeFormValues = z.infer<typeof addEmployeeSchema>;

/** Add-employee schema with the cluster required once a department is picked. */
export const addEmployeeFormSchema = addEmployeeSchema.refine((v) => v.department.length === 0 || v.cluster.length > 0, {
  message: "Choose a cluster",
  path: ["cluster"],
});

export const clusterDescriptions: Record<(typeof clusterOptions)[number], string> = {
  RPM: "Accountants — RPM client group",
  VCM: "Accountants — VCM client group",
  ADS: "Accountants — ADS client group",
  "Admin & Support": "IT, Admin Associates, Front Desk, HR and Liaison Officers",
};

export const registerSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  position: z.string().min(1, "Position is required"),
  cluster: z.enum(clusterOptions),
  office: z.enum(officeOptions),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
