/**
 * API contracts for the 201 file (documents checklist, personal info, employment history).
 * Rules and the document catalog live in ./records201.ts.
 */
import { z } from 'zod';
import {
  CHECKLIST_STATUSES,
  CIVIL_STATUSES,
  DEPENDENT_RELATIONSHIPS,
  DOCUMENT_TYPES,
  EMPLOYMENT_EVENT_TYPES,
  GOV_NUMBER_FORMATS,
} from './records201';
import { DateKeySchema, InstantSchema, MoneySchema } from './primitives';

export const DocumentTypeSchema = z.enum(DOCUMENT_TYPES);
export const ChecklistStatusSchema = z.enum(CHECKLIST_STATUSES);
export const CivilStatusSchema = z.enum(CIVIL_STATUSES);
export const DependentRelationshipSchema = z.enum(DEPENDENT_RELATIONSHIPS);
export const EmploymentEventTypeSchema = z.enum(EMPLOYMENT_EVENT_TYPES);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();
const optionalDate = DateKeySchema.nullable()
  .optional()
  .or(z.literal('').transform(() => null));

// ---------- Documents ----------

export const EmployeeDocumentSchema = z.object({
  id: z.string(),
  type: DocumentTypeSchema,
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  issuedOn: DateKeySchema.nullable(),
  expiresOn: DateKeySchema.nullable(),
  referenceNo: z.string().nullable(),
  notes: z.string().nullable(),
  uploadedAt: InstantSchema,
  uploadedBy: z.string().nullable(),
  /** The caller may open the file (GET /documents/{id}/file). */
  canOpen: z.boolean(),
  /** SUBMITTED: uploaded by the employee, waiting for HR; VERIFIED: checked against the original. */
  reviewStatus: z.enum(['SUBMITTED', 'VERIFIED']).optional(),
  reviewedBy: z.string().nullable().optional(),
  reviewedAt: InstantSchema.nullable().optional(),
});
export type EmployeeDocument = z.infer<typeof EmployeeDocumentSchema>;

export const ChecklistSummarySchema = z.object({
  required: z.number().int(),
  complete: z.number().int(),
  missing: z.number().int(),
  expiring: z.number().int(),
  expired: z.number().int(),
  percent: z.number().int().describe('0–100: required items on file and not expired'),
});
export type ChecklistSummaryDto = z.infer<typeof ChecklistSummarySchema>;

export const ChecklistItemSchema = z.object({
  type: DocumentTypeSchema,
  status: ChecklistStatusSchema,
  required: z.boolean(),
  count: z.number().int(),
  expiresOn: DateKeySchema.nullable(),
  /** The caller may add, edit or remove documents of this type. */
  canManage: z.boolean(),
  /** Documents of this type. Empty (with count > 0) when the caller may not see them. */
  documents: z.array(EmployeeDocumentSchema),
  /** Why HR returned the last upload (until a new one comes in). */
  note: z.string().nullable().optional(),
  /** HR marked it not applicable, or required although the usual rule says not. */
  override: z.enum(['NOT_APPLICABLE', 'REQUIRED']).nullable().optional(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const File201Schema = z.object({
  employee: z.object({
    id: z.string(),
    employeeNo: z.string(),
    fullName: z.string(),
    separationDate: DateKeySchema.nullable(),
  }),
  summary: ChecklistSummarySchema,
  items: z.array(ChecklistItemSchema),
  biometric: z.object({
    consentOnFile: z.boolean(),
    enrolledAt: InstantSchema.nullable(),
  }),
  retentionVerified: z.literal(false),
});
export type File201 = z.infer<typeof File201Schema>;

/** Text fields sent with the multipart upload (the file itself is the "file" part). */
export const UploadDocumentFieldsSchema = z.object({
  type: DocumentTypeSchema,
  issuedOn: optionalDate,
  expiresOn: optionalDate,
  referenceNo: optionalText(120),
  notes: optionalText(500),
});
export type UploadDocumentFields = z.infer<typeof UploadDocumentFieldsSchema>;

export const UpdateDocumentSchema = UploadDocumentFieldsSchema.omit({ type: true });
export type UpdateDocument = z.infer<typeof UpdateDocumentSchema>;

/** HR sends an upload back: what the employee has to fix. */
export const ReturnDocumentSchema = z.object({ note: z.string().trim().min(3, 'Say what needs fixing so they can resubmit').max(500) });
/** HR: this paper doesn't apply to this person, or is required although the usual rule says not (null: the usual rule). */
export const DocumentRequirementSchema = z.object({ state: z.enum(['NOT_APPLICABLE', 'REQUIRED']).nullable() });
export type DocumentRequirementInput = z.infer<typeof DocumentRequirementSchema>;

export const ArchiveDocumentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Please give a reason (at least 5 characters)')
    .max(500)
    .describe(
      'Why the document is removed from the 201 file, e.g. "Uploaded to the wrong employee"',
    ),
});
export type ArchiveDocument = z.infer<typeof ArchiveDocumentSchema>;

export const DocumentViewSchema = z.object({
  at: InstantSchema,
  by: z.string(),
  role: z.string(),
  action: z.string(),
});
export const DocumentViewsSchema = z.object({ items: z.array(DocumentViewSchema) });
export type DocumentViews = z.infer<typeof DocumentViewsSchema>;

// ---------- 201 files overview (HR) ----------

export const RECORDS_FILTERS = ['ALL', 'INCOMPLETE', 'EXPIRING', 'EXPIRED', 'COMPLETE'] as const;
export const RecordsListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  siteId: z.string().optional(),
  filter: z.enum(RECORDS_FILTERS).default('ALL'),
  missingType: DocumentTypeSchema.optional().describe('Only employees missing this document'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
export type RecordsListQuery = z.infer<typeof RecordsListQuerySchema>;

export const RecordsListItemSchema = z.object({
  employeeId: z.string(),
  employeeNo: z.string(),
  fullName: z.string(),
  siteName: z.string(),
  position: z.string().nullable(),
  summary: ChecklistSummarySchema,
  missingTypes: z.array(DocumentTypeSchema),
  nextExpiry: z.object({ type: DocumentTypeSchema, expiresOn: DateKeySchema }).nullable(),
});
export type RecordsListItem = z.infer<typeof RecordsListItemSchema>;

export const RecordsListResponseSchema = z.object({
  items: z.array(RecordsListItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type RecordsListResponse = z.infer<typeof RecordsListResponseSchema>;

export const RecordsSummaryQuerySchema = z.object({ siteId: z.string().optional() });

export const ExpiringDocumentSchema = z.object({
  documentId: z.string(),
  employeeId: z.string(),
  employeeName: z.string(),
  siteName: z.string(),
  type: DocumentTypeSchema,
  expiresOn: DateKeySchema,
  status: z.enum(['EXPIRING', 'EXPIRED']),
});
export type ExpiringDocument = z.infer<typeof ExpiringDocumentSchema>;

export const RecordsSummarySchema = z.object({
  employees: z.number().int(),
  complete: z.number().int().describe('Employees whose required 201 items are all on file'),
  incomplete: z.number().int(),
  withExpired: z.number().int(),
  expiringSoon: z.number().int(),
  renewals: z
    .array(ExpiringDocumentSchema)
    .describe('Expired or expiring within 30 days, soonest first'),
  topMissing: z.array(z.object({ type: DocumentTypeSchema, count: z.number().int() })),
  bySite: z.array(
    z.object({ siteName: z.string(), employees: z.number().int(), complete: z.number().int() }),
  ),
  withoutBiometricConsent: z.number().int(),
});
export type RecordsSummary = z.infer<typeof RecordsSummarySchema>;

// ---------- Personal info (personal data sheet + government numbers) ----------

const govNumber = (key: keyof typeof GOV_NUMBER_FORMATS) =>
  z
    .string()
    .trim()
    .regex(
      GOV_NUMBER_FORMATS[key].pattern,
      `${GOV_NUMBER_FORMATS[key].label}: use the format ${GOV_NUMBER_FORMATS[key].example}`,
    );

export const DependentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  relationship: DependentRelationshipSchema,
  birthDate: DateKeySchema.nullable(),
});
export type Dependent = z.infer<typeof DependentSchema>;

export const EmergencyContactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  relationship: z.string().trim().min(2).max(60),
  phone: z.string().trim().min(7).max(30),
});

export const SexSchema = z.enum(['MALE', 'FEMALE']);

/** Where take-home pay is sent: all three or none. */
export const BankDetailsSchema = z.object({
  bankName: z.string().trim().min(1).max(60),
  accountName: z.string().trim().min(1).max(120),
  accountNo: z
    .string()
    .trim()
    .regex(/^[\d -]{6,20}$/, 'Account number: 6 to 20 digits'),
});

export const PersonalInfoSchema = z.object({
  suffix: z.string().nullable(),
  sex: SexSchema.nullable(),
  nationality: z.string().nullable(),
  civilStatus: CivilStatusSchema.nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable(),
  bank: BankDetailsSchema.nullable(),
  mobileNo: z.string().nullable(),
  personalEmail: z.string().nullable(),
  emergencyContact: EmergencyContactSchema.nullable(),
  licenseType: z
    .string()
    .nullable()
    .describe('e.g. "PRC (CPA)"; set when the role needs a license'),
  regularizationDate: DateKeySchema.nullable(),
  separationDate: DateKeySchema.nullable(),
  separationReason: z.string().nullable(),
  dependents: z.array(DependentSchema),
});
export type PersonalInfo = z.infer<typeof PersonalInfoSchema>;

/** A government number, or "" when it isn't on file yet. */
const govNumberOrBlank = (key: keyof typeof GOV_NUMBER_FORMATS) =>
  govNumber(key).or(z.literal(''));

export const UpdatePersonalInfoSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(60),
    middleName: optionalText(60),
    lastName: z.string().trim().min(1, 'Last name is required').max(60),
    suffix: optionalText(10),
    birthDate: optionalDate,
    sex: SexSchema.nullable(),
    nationality: optionalText(60),
    workEmail: z
      .email('Enter a valid work email')
      .nullable()
      .or(z.literal('').transform(() => null)),
    civilStatus: CivilStatusSchema.nullable(),
    address: optionalText(300),
    city: optionalText(80),
    province: optionalText(80),
    bank: BankDetailsSchema.nullable(),
    mobileNo: optionalText(30),
    personalEmail: z
      .email()
      .nullable()
      .or(z.literal('').transform(() => null)),
    emergencyContact: EmergencyContactSchema.nullable(),
    licenseType: optionalText(80),
    regularizationDate: optionalDate,
    dependents: z.array(DependentSchema).max(20),
    govIds: z.object({
      tin: govNumberOrBlank('tin'),
      sss: govNumberOrBlank('sss'),
      philhealth: govNumberOrBlank('philhealth'),
      pagibig: govNumberOrBlank('pagibig'),
    }),
    /** When the change takes effect (for civil status / dependents / address changes). */
    effectiveDate: DateKeySchema.optional(),
  })
  .partial();
export type UpdatePersonalInfo = z.infer<typeof UpdatePersonalInfoSchema>;
/** What an employee may change about themselves (Employee › 201 File › Edit profile): contact details only. */
export const SelfContactSchema = UpdatePersonalInfoSchema.pick({ address: true, city: true, province: true, mobileNo: true, personalEmail: true, emergencyContact: true });
export type SelfContact = z.infer<typeof SelfContactSchema>;

export const EmploymentEventSchema = z.object({
  id: z.string(),
  type: EmploymentEventTypeSchema,
  effectiveDate: DateKeySchema,
  positionTitle: z.string().nullable(),
  siteName: z.string().nullable(),
  dailyRate: MoneySchema.nullable().describe('Hidden (null) for roles that may not see pay'),
  remarks: z.string().nullable(),
});
export type EmploymentEvent = z.infer<typeof EmploymentEventSchema>;

export const BiometricEnrollmentSchema = z.object({
  employeeId: z.string(),
  enrolledAt: InstantSchema,
});
export type BiometricEnrollment = z.infer<typeof BiometricEnrollmentSchema>;

/** Short 201 status shown in the employee list (null for roles that don't review 201 files). */
export const Record201BriefSchema = z.object({
  percent: z.number().int(),
  missing: z.number().int(),
  expiring: z.number().int(),
  expired: z.number().int(),
});
export type Record201Brief = z.infer<typeof Record201BriefSchema>;
