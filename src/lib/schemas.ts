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

export const addEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  position: z.string().min(1, "Position is required"),
  department: z.string().min(1, "Department is required"),
  office: z.enum(officeOptions),
  cluster: z.enum(clusterOptions),
});

export type AddEmployeeFormValues = z.infer<typeof addEmployeeSchema>;

export const employeeStatusOptions = ["Active", "On leave"] as const;

export const editEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  position: z.string().min(1, "Position is required"),
  department: z.string().min(1, "Department is required"),
  office: z.enum(officeOptions),
  cluster: z.enum(clusterOptions),
  status: z.enum(employeeStatusOptions),
});

export type EditEmployeeFormValues = z.infer<typeof editEmployeeSchema>;

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
