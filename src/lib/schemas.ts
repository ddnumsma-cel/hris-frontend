import { z } from "zod";
import { govIdPattern, isValidGovId, isValidPhMobile, type GovIdKey } from "./govIds";

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

export const civilStatusOptions = ["Single", "Married", "Widowed", "Separated"] as const;
export const suffixOptions = ["Jr.", "Sr.", "II", "III", "IV", "V"] as const;

/** BRD §3.3 employment classifications. */
export const employmentStatusOptions = ["Probationary", "Regular", "Project-Based", "Contractual", "Part-Time"] as const;

/** Youngest a person can be employed, with work-hour limits until 18 (RA 9231). */
export const MINIMUM_WORKING_AGE = 15;

function ageOn(birthDate: string, today = new Date()) {
  const b = new Date(birthDate + "T00:00:00");
  let age = today.getFullYear() - b.getFullYear();
  if (today < new Date(today.getFullYear(), b.getMonth(), b.getDate())) age--;
  return age;
}

const optionalEmail = z.union([z.string().trim().email("Enter an email like juan.delacruz@gmail.com"), z.literal("")]);
const govId = (key: GovIdKey) =>
  z
    .string()
    .trim()
    .refine((v) => isValidGovId(key, v), `Use the format ${govIdPattern(key)}, or leave it blank and add it later`);

/**
 * Everything "Add employee" collects. Only 7 fields are required, so HR can create the
 * record on day one and fill in government numbers and documents as the new hire brings them.
 */
export const addEmployeeSchema = z
  .object({
    // 1 · Identity
    lastName: z.string().trim().min(1, "Enter the last name"),
    firstName: z.string().trim().min(1, "Enter the first name"),
    middleName: z.string().trim(),
    suffix: z.union([z.enum(suffixOptions), z.literal("")]),
    // Needed to register SSS and PhilHealth, and to check the minimum working age.
    birthDate: z
      .string()
      .min(1, "Enter the birth date")
      .refine((v) => new Date(v + "T00:00:00") <= new Date(), "Birth date can't be in the future")
      .refine(
        (v) => ageOn(v) >= MINIMUM_WORKING_AGE,
        `Check the birth date — employees must be at least ${MINIMUM_WORKING_AGE} years old`,
      ),
    sex: z.union([z.enum(sexOptions), z.literal("")]).refine((v) => v.length > 0, "Choose sex"),
    civilStatus: z.union([z.enum(civilStatusOptions), z.literal("")]),
    bloodType: z.union([z.enum(bloodTypeOptions), z.literal("")]),

    // 2 · Contact
    phone: z
      .string()
      .trim()
      .min(1, "Enter a mobile number")
      .refine(isValidPhMobile, "Use a PH mobile number, e.g. 0917 552 0184 or +63 917 552 0184"),
    personalEmail: optionalEmail,
    email: optionalEmail,
    street: z.string().trim(),
    barangay: z.string().trim(),
    city: z.string().trim(),
    province: z.string().trim(),
    emergencyName: z.string().trim(),
    emergencyRelationship: z.union([z.enum(emergencyRelationshipOptions), z.literal("")]),
    emergencyPhone: z
      .string()
      .trim()
      .refine((v) => !v || isValidPhMobile(v), "Use a PH mobile number, e.g. 0917 552 0184"),

    // 3 · Employment
    position: z.string().trim().min(1, "Enter the position"),
    department: z.union([z.enum(hireDepartmentOptions), z.literal("")]).refine((v) => v.length > 0, "Choose a department"),
    cluster: z.union([z.enum(hireClusterOptions), z.literal("Admin & Support"), z.literal("")]),
    office: z.enum(officeOptions),
    dateHired: z.string().min(1, "Enter the date hired"),
    employmentStatus: z.enum(employmentStatusOptions),
    reportsToId: z.string(),

    // 4 · Government IDs & documents (all optional)
    tin: govId("tin"),
    sss: govId("sss"),
    philHealth: govId("philHealth"),
    pagIbig: govId("pagIbig"),
    receivedDocuments: z.array(z.string()),
  })
  // Client clusters only apply to Accounting; IT staff sit under Admin & Support.
  .refine((v) => v.department !== "Accounting" || (hireClusterOptions as readonly string[]).includes(v.cluster), {
    message: "Choose a cluster",
    path: ["cluster"],
  });

export type AddEmployeeFormValues = z.infer<typeof addEmployeeSchema>;

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
