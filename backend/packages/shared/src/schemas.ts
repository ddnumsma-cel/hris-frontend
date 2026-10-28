/**
 * API contracts shared by the API (validation + Swagger), web and mobile.
 * Money is always a decimal string with 2 places (e.g. "14862.50"); instants are ISO-8601 UTC strings;
 * calendar dates are Manila "YYYY-MM-DD" strings.
 */
import { z } from 'zod';
import {
  APPROVAL_TYPES,
  DTR_STATUSES,
  EMPLOYMENT_STATUSES,
  HOLIDAY_TYPES,
  REQUEST_STATUSES,
  ROLES,
  TABLE_DENSITIES,
  TEXT_SIZES,
  THEME_PREFERENCES,
  VERIFY_MODES,
} from './enums';

// ---------- Primitives ----------
export { CutoffCodeSchema, DateKeySchema, InstantSchema, MoneySchema } from './primitives';
import { CutoffCodeSchema, DateKeySchema, InstantSchema, MoneySchema } from './primitives';
import { EmploymentEventSchema, PersonalInfoSchema, Record201BriefSchema } from './schemas201';

export const RoleSchema = z.enum(ROLES);
export const EmploymentStatusSchema = z.enum(EMPLOYMENT_STATUSES);
export const VerifyModeSchema = z.enum(VERIFY_MODES);
export const DtrStatusSchema = z.enum(DTR_STATUSES);
export const RequestStatusSchema = z.enum(REQUEST_STATUSES);
export const ApprovalTypeSchema = z.enum(APPROVAL_TYPES);
export const HolidayTypeSchema = z.enum(HOLIDAY_TYPES);
export const ThemePreferenceSchema = z.enum(THEME_PREFERENCES);
export const TextSizeSchema = z.enum(TEXT_SIZES);
export const TableDensitySchema = z.enum(TABLE_DENSITIES);

const Ref = z.object({ id: z.string(), name: z.string() });

// ---------- Auth ----------
export const LoginRequestSchema = z.object({
  email: z.email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const PreferencesSchema = z.object({
  theme: ThemePreferenceSchema.nullable().describe(
    'null = app default (web: LIGHT, mobile: match device)',
  ),
  textSize: TextSizeSchema,
  tableDensity: TableDensitySchema,
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const UpdatePreferencesSchema = PreferencesSchema.partial();
export type UpdatePreferences = z.infer<typeof UpdatePreferencesSchema>;

export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: RoleSchema,
  displayName: z.string(),
  employeeId: z.string().nullable(),
  employeeNo: z.string().nullable(),
  site: Ref.nullable(),
  preferences: PreferencesSchema,
  /** A new or reset account: choose your own password. */
  mustChangePassword: z.boolean().optional(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.string(),
  user: SessionUserSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// ---------- Org ----------
export const ShiftBriefSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  startTime: z.string().describe('Manila wall-clock "HH:mm"'),
  endTime: z.string(),
  breakMinutes: z.number().int(),
  graceMinutes: z.number().int(),
  workDays: z.array(z.number().int()).describe('0 = Sunday … 6 = Saturday'),
  breakStart: z.string().nullable().describe('When the unpaid lunch starts, "12:00"'),
  flexible: z.boolean(),
  requiredMinutes: z.number().int().nullable().describe('Flexible shifts: minutes to work, not counting lunch'),
  saturdayEnd: z.string().nullable(),
  active: z.boolean(),
  people: z.number().int().describe('Active employees on this shift'),
});
export type ShiftBrief = z.infer<typeof ShiftBriefSchema>;

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 08:30');
/** Add or edit a shift (Attendance › Shifts). */
export const SaveShiftSchema = z
  .object({
    name: z.string().trim().min(1, 'Name the shift').max(60),
    startTime: HHMM,
    endTime: HHMM,
    breakMinutes: z.number().int().min(0).max(180),
    breakStart: HHMM.nullable(),
    graceMinutes: z.number().int().min(0).max(60),
    workDays: z.array(z.number().int().min(0).max(6)).min(1, 'Pick at least one work day'),
    flexible: z.boolean(),
    requiredMinutes: z.number().int().min(60).max(16 * 60).nullable(),
    saturdayEnd: HHMM.nullable(),
    active: z.boolean().optional(),
  })
  .refine((s) => !s.flexible || s.requiredMinutes, { message: 'Enter the hours to work on a flexible shift', path: ['requiredMinutes'] });
export type SaveShift = z.infer<typeof SaveShiftSchema>;

/** Put people on a usual shift (Attendance › Schedules). Applies from today. */
export const SetUsualShiftSchema = z.object({
  employeeIds: z.array(z.string()).min(1).max(500),
  shiftId: z.string().min(1),
});
export type SetUsualShift = z.infer<typeof SetUsualShiftSchema>;

export const OrgFiltersSchema = z.object({
  sites: z.array(Ref),
  departments: z.array(Ref),
  statuses: z.array(EmploymentStatusSchema),
  positions: z.array(Ref.extend({ departmentId: z.string() })),
  shifts: z.array(ShiftBriefSchema),
});

// ---------- Maintenance: offices (locations) and departments ----------
const blankToNull = (v: unknown) => (typeof v === 'string' && !v.trim() ? null : v);
/** PH mobile or landline, e.g. 0917 123 4567 or (032) 234 5678. */
const PhPhoneSchema = z
  .string()
  .trim()
  .refine((v) => /^(\+?63|0)\d{7,10}$/.test(v.replace(/[\s()-]/g, '')), 'Enter a phone like 0917 123 4567 or (032) 234 5678');

export const OrgLocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  address: z.string().nullable(),
  contactName: z.string().nullable(),
  contactPhone: z.string().nullable(),
  manager: Ref.nullable(),
  active: z.boolean(),
  headcount: z.number().int(),
  departments: z.number().int(),
});
export type OrgLocation = z.infer<typeof OrgLocationSchema>;

export const SaveLocationSchema = z.object({
  name: z.string().trim().min(1, 'Name the office').max(80),
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{2,5}$/, 'Use a short code of 2 to 5 letters or numbers')),
  address: z.string().trim().min(1, 'Enter the office address').max(300),
  contactName: z.string().trim().min(1, 'Enter the contact person at this office').max(120),
  contactPhone: PhPhoneSchema,
  managerId: z.preprocess(blankToNull, z.string().nullable()).optional(),
});
export type SaveLocation = z.infer<typeof SaveLocationSchema>;

export const OrgDepartmentSchema = z.object({
  id: z.string().describe('"<office id>:<department id>": a department as it exists at one office'),
  departmentId: z.string(),
  name: z.string(),
  code: z.string(),
  officeId: z.string(),
  office: z.string(),
  head: Ref.nullable(),
  active: z.boolean(),
  headcount: z.number().int(),
});
export type OrgDepartment = z.infer<typeof OrgDepartmentSchema>;

export const SaveDepartmentSchema = z.object({
  name: z.string().trim().min(1, 'Name the department').max(80),
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{2,6}$/, 'Use a short code of 2 to 6 letters or numbers')),
  officeId: z.string().min(1, 'Choose the office'),
  headEmployeeId: z.preprocess(blankToNull, z.string().nullable()).optional(),
});
export type SaveDepartment = z.infer<typeof SaveDepartmentSchema>;

export const SetActiveSchema = z.object({ active: z.boolean() });
export type SetActive = z.infer<typeof SetActiveSchema>;

// ---------- Add employee ----------
const blankToUndefined = (v: unknown) => (typeof v === 'string' && !v.trim() ? undefined : v);
const optionalField = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

/** A new hire, as HR fills in the Add employee form (personal, contact, government numbers, job). */
export const CreateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter the first name').max(60),
  middleName: optionalField(60),
  lastName: z.string().trim().min(1, 'Enter the last name').max(60),
  suffix: optionalField(10),
  birthDate: DateKeySchema,
  sex: z.enum(['MALE', 'FEMALE']),
  civilStatus: z.enum(['SINGLE', 'MARRIED', 'WIDOWED', 'SEPARATED', 'ANNULLED']),
  nationality: optionalField(60),
  workEmail: z.email('Enter a valid work email').transform((v) => v.trim().toLowerCase()),
  personalEmail: z.preprocess(blankToUndefined, z.email('Enter a valid personal email').optional()),
  mobileNo: z.string().trim().regex(/^(\+63|0)9\d{9}$/, 'Enter a mobile number like 09171234567'),
  address: optionalField(300),
  city: optionalField(80),
  province: optionalField(80),
  emergencyContact: z
    .object({
      name: z.string().trim().min(2).max(120),
      relationship: z.string().trim().min(2).max(60),
      phone: z.string().trim().min(7).max(30),
    })
    .optional(),
  govIds: z
    .object({
      tin: z.string().trim().max(20),
      sss: z.string().trim().max(20),
      philhealth: z.string().trim().max(20),
      pagibig: z.string().trim().max(20),
    })
    .partial()
    .optional(),
  siteId: z.string().min(1, 'Pick an office'),
  departmentId: z.string().min(1, 'Pick a department'),
  positionId: optionalField(40),
  cluster: optionalField(10),
  managerId: optionalField(40),
  shiftId: optionalField(40),
  status: EmploymentStatusSchema,
  hireDate: DateKeySchema,
  monthlySalary: z.coerce.number().positive('Enter the monthly salary').max(10_000_000),
});
export type CreateEmployee = z.infer<typeof CreateEmployeeSchema>;
export const CreatedEmployeeSchema = z.object({
  id: z.string(),
  employeeNo: z.string(),
  fullName: z.string(),
});
export type CreatedEmployee = z.infer<typeof CreatedEmployeeSchema>;

/** HR marks someone Separated: their last day and why (the website's reasons). */
export const SEPARATION_REASONS = ['Resigned', 'End of contract', 'Retired', 'Terminated', 'Redundancy', 'Death', 'Other'] as const;
export const RecordSeparationSchema = z.object({
  lastDay: DateKeySchema,
  reason: z.enum(SEPARATION_REASONS, { message: "Choose why they're leaving" }),
  note: z.string().trim().max(500).default(''),
});
export type RecordSeparation = z.infer<typeof RecordSeparationSchema>;
export const SeparationSchema = z.object({
  employeeId: z.string(),
  lastDay: DateKeySchema.nullable(),
});
export type Separation = z.infer<typeof SeparationSchema>;
export type OrgFilters = z.infer<typeof OrgFiltersSchema>;

// ---------- Attendance ----------
export const DtrRowSchema = z.object({
  date: DateKeySchema,
  timeIn: InstantSchema.nullable(),
  timeOut: InstantSchema.nullable(),
  workedMinutes: z.number().int(),
  lateMinutes: z.number().int(),
  undertimeMinutes: z.number().int(),
  otMinutes: z.number().int(),
  nightDiffMinutes: z.number().int(),
  status: DtrStatusSchema,
  remarks: z.string().nullable(),
});
export type DtrRow = z.infer<typeof DtrRowSchema>;

/** HR's attendance log: daily time records and the raw punches behind them, for up to 62 days. */
export const AttendanceDaysQuerySchema = z
  .object({
    from: DateKeySchema,
    to: DateKeySchema,
    employeeId: z.string().optional().describe('One person only'),
  })
  .refine((q) => q.from <= q.to, { message: '"from" must be on or before "to"', path: ['from'] })
  .refine((q) => Date.parse(q.to) - Date.parse(q.from) <= 62 * 86_400_000, {
    message: 'Pick at most 62 days',
    path: ['to'],
  });
export type AttendanceDaysQuery = z.infer<typeof AttendanceDaysQuerySchema>;

export const AttendancePunchSchema = z.object({
  id: z.string(),
  punchedAt: InstantSchema,
  verifyMode: VerifyModeSchema,
  deviceSerial: z.string(),
});

export const AttendanceDaySchema = DtrRowSchema.extend({
  employeeId: z.string(),
  punches: z.array(AttendancePunchSchema).describe('Every punch that day, earliest first'),
  approvedOtMinutes: z.number().int().describe('Overtime that counts for pay: approved requests, never more than the time clock shows'),
});
export type AttendanceDay = z.infer<typeof AttendanceDaySchema>;

export const AttendanceDaysResponseSchema = z.object({
  employees: z.array(z.object({ id: z.string(), shift: ShiftBriefSchema })),
  days: z.array(AttendanceDaySchema),
});
export type AttendanceDaysResponse = z.infer<typeof AttendanceDaysResponseSchema>;

export const RecomputeQuerySchema = z
  .object({ from: DateKeySchema, to: DateKeySchema })
  .refine((q) => q.from <= q.to, { message: '"from" must be on or before "to"', path: ['from'] })
  .refine((q) => Date.parse(q.to) - Date.parse(q.from) <= 62 * 86_400_000, { message: 'Pick at most 62 days', path: ['to'] });
export type RecomputeQuery = z.infer<typeof RecomputeQuerySchema>;

export const RecomputeResponseSchema = z.object({
  from: DateKeySchema,
  to: DateKeySchema,
  employees: z.number().int(),
  records: z.number().int(),
});
export type RecomputeResponse = z.infer<typeof RecomputeResponseSchema>;

// ---------- Leave ----------
export const LeaveBalanceSchema = z.object({
  leaveTypeCode: z.string(),
  leaveTypeName: z.string(),
  year: z.number().int(),
  entitled: z.string().describe('Days, e.g. "15.0"'),
  used: z.string(),
  remaining: z.string(),
});
export type LeaveBalance = z.infer<typeof LeaveBalanceSchema>;

/** HR / manager "Leave" page: who is away soon, and everyone's balances. */
export const LeaveOverviewQuerySchema = z.object({ siteId: z.string().optional() });
export type LeaveOverviewQuery = z.infer<typeof LeaveOverviewQuerySchema>;

const LeaveEmployeeSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  siteName: z.string(),
});

export const LeaveOverviewSchema = z.object({
  from: DateKeySchema,
  to: DateKeySchema,
  upcoming: z.array(
    z.object({
      id: z.string(),
      employee: LeaveEmployeeSchema,
      leaveTypeName: z.string(),
      startDate: DateKeySchema,
      endDate: DateKeySchema,
      days: z.string(),
      status: z.enum(['APPROVED', 'PENDING']),
    }),
  ),
  balances: z.array(
    z.object({
      employee: LeaveEmployeeSchema,
      /** Days left per leave type code (VL, SL, SIL), e.g. "12.0" */
      remaining: z.record(z.string(), z.string()),
    }),
  ),
});
export type LeaveOverview = z.infer<typeof LeaveOverviewSchema>;

export const CreateLeaveRequestSchema = z
  .object({
    leaveTypeCode: z.string().trim().min(1, 'Choose the leave type').max(12).describe('A leave type code, e.g. VL'),
    halfDay: z.enum(['am', 'pm']).optional(),
    startDate: DateKeySchema,
    endDate: DateKeySchema,
    reason: z.string().trim().min(3, 'Please give a short reason').max(300),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });
export type CreateLeaveRequest = z.infer<typeof CreateLeaveRequestSchema>;

// Leave types and credits as the website keeps them (Maintenance > Leave): one VL/SL pool by length of service.
export const LeaveTypeRuleSchema = z.object({
  name: z.string().trim().min(1, 'Name the leave type').max(80),
  code: z.string().trim().min(1, 'Give it a short code, e.g. VL').max(12),
  daysPerYear: z.number().finite().min(0).max(366),
  earning: z.union([
    z.object({ kind: z.literal('monthly'), perMonth: z.number().finite().min(0).max(31) }),
    z.object({ kind: z.literal('yearly') }),
    z.object({ kind: z.literal('per-event') }),
    z.object({ kind: z.literal('unlimited') }),
  ]),
  paid: z.boolean(),
  carryOverMax: z.number().finite().min(0).max(366),
  countBy: z.enum(['workdays', 'calendar']),
  eligibility: z.enum(['everyone', 'female', 'male-married', 'solo-parent', 'after-1-year', 'after-6-months']),
  attachmentOver: z.number().finite().min(0).max(366).nullable(),
  confidential: z.boolean(),
  basis: z.string().trim().max(200),
});
export const SaveLeaveTypeSchema = LeaveTypeRuleSchema.extend({ id: z.string().optional() });
export type SaveLeaveType = z.infer<typeof SaveLeaveTypeSchema>;
export const LeaveTypeViewSchema = LeaveTypeRuleSchema.extend({ id: z.string(), active: z.boolean() });
export type LeaveTypeView = z.infer<typeof LeaveTypeViewSchema>;

export const CreditAdjustmentInputSchema = z.object({
  employeeId: z.string().min(1).describe('Employee number'),
  leaves: z.number().finite().refine((n) => n !== 0 && Number.isInteger(n * 2), 'Enter the days to add (e.g. 1 or 0.5) or remove (e.g. -1)'),
  reason: z.string().trim().min(1, 'Say why the days are changing').max(300),
});
export type CreditAdjustmentInput = z.infer<typeof CreditAdjustmentInputSchema>;
export const LeaveAdjustmentViewSchema = z.object({ id: z.string(), employeeId: z.string(), typeId: z.string(), days: z.number(), reason: z.string(), by: z.string(), at: InstantSchema });
export type LeaveAdjustmentView = z.infer<typeof LeaveAdjustmentViewSchema>;
/** Everything the website needs to show and check leave, employees named by employee number. */
export const LeaveStateSchema = z.object({
  types: z.array(LeaveTypeViewSchema),
  requests: z.array(z.object({
    id: z.string(), employeeId: z.string(), typeId: z.string(), start: DateKeySchema, end: DateKeySchema, days: z.number(), reason: z.string(),
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']), filedBy: z.string(), filedAt: InstantSchema,
    decidedBy: z.string().optional(), decidedAt: InstantSchema.optional(), note: z.string().optional(),
  })),
  adjustments: z.array(LeaveAdjustmentViewSchema),
  carryOver: z.record(z.string(), z.number()),
  /** What leave filing allows (Rules › Time off & leave). */
  policy: z.object({ allowHalfDays: z.boolean(), allowNegative: z.boolean(), defaultCarryOver: z.number(), accrual: z.enum(['yearly', 'monthly', 'per-payroll']) }).optional(),
  /** For the leave rules: sex, civil status, employment type and hire date by employee number. */
  people: z.record(z.string(), z.object({ name: z.string(), departmentName: z.string(), branch: z.string(), sex: z.string(), civilStatus: z.string(), employmentType: z.string(), dateHired: DateKeySchema })),
});
export type LeaveState = z.infer<typeof LeaveStateSchema>;

// ---------- Overtime, undertime and time adjustment requests (filed by the employee) ----------

/** How far back an employee may file overtime, undertime or a time adjustment (days). */
export const REQUEST_FILING_WINDOW_DAYS = 30;

const TimeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 17:30')
  .describe('Manila time, 24-hour HH:mm');
const RequestReasonSchema = z.string().trim().min(3, 'Please give a short reason').max(300);

export const CreateOvertimeRequestSchema = z.object({
  date: DateKeySchema,
  minutes: z
    .number()
    .int()
    .min(30, 'Overtime starts at 30 minutes')
    .max(720, 'At most 12 hours of overtime a day')
    .refine((m) => m % 15 === 0, 'Use steps of 15 minutes'),
  reason: RequestReasonSchema,
});
export type CreateOvertimeRequest = z.infer<typeof CreateOvertimeRequestSchema>;

export const CreateUndertimeRequestSchema = z.object({
  date: DateKeySchema,
  leaveTime: TimeOfDaySchema.describe(
    'When the employee leaves (before the shift ends), Manila time',
  ),
  reason: RequestReasonSchema,
});
export type CreateUndertimeRequest = z.infer<typeof CreateUndertimeRequestSchema>;

export const CreateTimeAdjustmentSchema = z
  .object({
    date: DateKeySchema,
    timeIn: TimeOfDaySchema.optional(),
    timeOut: TimeOfDaySchema.optional(),
    reason: RequestReasonSchema,
  })
  .refine((v) => v.timeIn || v.timeOut, {
    message: 'Give the correct time in, time out, or both',
    path: ['timeIn'],
  });
export type CreateTimeAdjustment = z.infer<typeof CreateTimeAdjustmentSchema>;

// ---------- Employees ----------
export const EmployeeListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().describe('Search name or employee number'),
  siteId: z.string().optional(),
  departmentId: z.string().optional(),
  status: EmploymentStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
export type EmployeeListQuery = z.infer<typeof EmployeeListQuerySchema>;

/** Admin settings › Organization: company details and sign-in rules (the website's checks, enforced here too). */
export const CompanySettingsSchema = z.object({
  companyName: z.string().trim().min(1, 'Enter the company name').max(160),
  tin: z.string().trim().max(30).refine((v) => !v || /^\d{3}-\d{3}-\d{3}(-\d{3,5})?$/.test(v), 'TIN looks like 000-000-000-00000'),
  address: z.string().trim().max(300),
  contactEmail: z.string().trim().max(160).refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), 'Enter a valid HR email'),
  minPasswordLength: z.number().int().min(8, 'Passwords should be at least 8 characters (up to 64)').max(64, 'Passwords should be at least 8 characters (up to 64)'),
  lockAfterFailed: z.number().int().min(3, 'Lock after 3 to 10 wrong passwords').max(10, 'Lock after 3 to 10 wrong passwords'),
  lockMinutes: z.number().int().min(5, 'Lock for 5 minutes to 24 hours').max(1440, 'Lock for 5 minutes to 24 hours'),
  idleMinutes: z.number().int().min(5, 'Sign out after 5 minutes to 8 hours without activity').max(480, 'Sign out after 5 minutes to 8 hours without activity'),
  /** A small picture as a data URL ("" = none). */
  logo: z.string().max(700_000, 'Use a smaller logo (under about 500 KB)').refine((v) => !v || /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(v), 'The logo must be a PNG, JPG, WebP or SVG picture'),
  defaultTimezone: z.string().trim().min(1).max(60),
  currency: z.string().trim().min(3).max(3),
  workWeek: z.array(z.number().int().min(0).max(6)).min(1, 'Pick at least one working day').max(7),
  workStart: z.string().regex(/^\d{2}:\d{2}$/),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/),
  fiscalYearStartMonth: z.number().int().min(1, 'Pick the month the fiscal year starts').max(12, 'Pick the month the fiscal year starts'),
  retentionMonths: z.number().int().min(0, 'Keep records for 0 to 240 months').max(240, 'Keep records for 0 to 240 months'),
}).refine((s) => s.workStart < s.workEnd, { message: 'Working hours must end after they start', path: ['workEnd'] });
export type CompanySettings = z.infer<typeof CompanySettingsSchema>;
/** Rules › Scheduling. */
export const SchedulingRulesInputSchema = z.object({
  overtimeThresholdMinutes: z.number().int().min(0, 'Overtime threshold is 0 to 240 minutes.').max(240, 'Overtime threshold is 0 to 240 minutes.'),
  defaultBreakMinutes: z.number().int().min(0, 'Default break is 0 to 120 minutes.').max(120, 'Default break is 0 to 120 minutes.'),
  publishLeadDays: z.number().int().min(0, 'Publish 0 to 60 days ahead.').max(60, 'Publish 0 to 60 days ahead.'),
});
export type SchedulingRulesInput = z.infer<typeof SchedulingRulesInputSchema>;
/** Rules › Time off & leave: what leave filing allows. */
export const LeavePolicyInputSchema = z.object({
  allowHalfDays: z.boolean(),
  allowNegative: z.boolean(),
  defaultCarryOver: z.number().int().min(0, 'Carry-over is 0 to 365 days.').max(365, 'Carry-over is 0 to 365 days.'),
  accrual: z.enum(['yearly', 'monthly', 'per-payroll']),
});
export type LeavePolicyInput = z.infer<typeof LeavePolicyInputSchema>;

/** Remote work days the Super Admin declares (offices empty: everyone). */
export const RemoteDayInputSchema = z.object({
  from: DateKeySchema,
  to: DateKeySchema,
  offices: z.array(z.string().trim().min(1).max(80)).max(50),
  reason: z.string().trim().min(3, 'Give the reason, for example "Typhoon Kristine, Signal No. 3"').max(300),
});
export type RemoteDayInput = z.infer<typeof RemoteDayInputSchema>;
export const WfhSchema = z.object({ on: z.boolean() });
export type WfhInput = z.infer<typeof WfhSchema>;
/** A time-in or time-out from home after the website's face scan. */
export const RemoteClockSchema = z.object({
  kind: z.enum(['in', 'out']),
  match: z.number().min(0).max(100),
  location: z.union([z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100_000) }), z.object({ unavailable: z.string().trim().max(200) })]).optional(),
});
export type RemoteClockInput = z.infer<typeof RemoteClockSchema>;

/** Payroll › Final pay: open a case (employeeId: the employee number). */
export const FinalPayOpenSchema = z.object({
  employeeId: z.string().trim().min(1).max(40),
  lastDay: DateKeySchema,
  reason: z.string().trim().min(1, "Choose why they're leaving").max(80),
});
export type FinalPayOpen = z.infer<typeof FinalPayOpenSchema>;
const PesoAmountSchema = z.number().finite().min(-100_000_000).max(100_000_000);
/** Release final pay with the figures worked out and what they were based on. */
export const FinalPayReleaseSchema = FinalPayOpenSchema.extend({
  reference: z.string().trim().min(1, 'Enter the check or transfer reference').max(120),
  items: z.array(z.object({ label: z.string().max(120), detail: z.string().max(500), amount: PesoAmountSchema })).min(1).max(40),
  total: PesoAmountSchema,
  basis: z.object({
    claimIds: z.array(z.string().min(1).max(40)).max(200),
    loans: z.array(z.object({ id: z.string().min(1).max(40), balance: PesoAmountSchema })).max(50),
  }),
});
export type FinalPayRelease = z.infer<typeof FinalPayReleaseSchema>;

/** Employee › HMO & Benefits: a benefit or dependent the employee adds. */
export const BenefitInputSchema = z.object({
  name: z.string().trim().min(1, 'Name the benefit').max(120),
  provider: z.string().trim().min(1, 'Name the provider').max(120),
  memberId: z.string().trim().min(1, 'Add the member ID or a note').max(120),
});
export type BenefitInput = z.infer<typeof BenefitInputSchema>;

/** A profile photo: a JPEG, PNG or WebP image as a data URL, up to about 500 KB. */
export const PhotoInputSchema = z.object({
  dataUrl: z
    .string()
    .max(700_000, 'That photo is too large; use one under 500 KB')
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'Use a JPEG, PNG or WebP photo'),
});
export type PhotoInput = z.infer<typeof PhotoInputSchema>;
/** CPD units logged so far in the license's current cycle. */
export const CpdUnitsSchema = z.object({ cpdUnitsEarned: z.number().int().min(0).max(999) });
export type CpdUnitsInput = z.infer<typeof CpdUnitsSchema>;

/** Rules › Tardiness: late this many work days in a row, or this many times in a month (0 turns one off). */
export const TardinessRuleSchema = z.object({
  consecutive: z.number().int().min(0).max(10).refine((n) => n !== 1, 'Days in a row should be 2 to 10, or 0 to turn it off'),
  perMonth: z.number().int().min(0).max(31).refine((n) => n !== 1, 'Times a month should be 2 to 31, or 0 to turn it off'),
});
export type TardinessRuleInput = z.infer<typeof TardinessRuleSchema>;
/** A tardiness or AWOL notice (employeeId: the employee number). */
export const NoticeInputSchema = z.object({
  employeeId: z.string().trim().min(1).max(40),
  kind: z.enum(['tardiness', 'awol']),
  subject: z.string().trim().min(1, 'Give the notice a subject').max(200),
  message: z.string().trim().min(1, 'Write the message the employee will read').max(4000),
  dates: z.array(DateKeySchema).max(62),
});
export type NoticeInput = z.infer<typeof NoticeInputSchema>;

/** Employee relations cases (Approver › Cases). */
export const CASE_TYPES = ['Attendance', 'Conduct', 'Performance', 'Grievance'] as const;
export const CaseInputSchema = z.object({
  employeeNo: z.string().trim().min(1).max(40),
  type: z.enum(CASE_TYPES),
  summary: z.string().trim().min(3, 'Describe what happened').max(2000),
});
export type CaseInput = z.infer<typeof CaseInputSchema>;
export const CaseUpdateSchema = z.object({
  type: z.enum(CASE_TYPES).optional(),
  summary: z.string().trim().min(3).max(2000).optional(),
  status: z.enum(['Open', 'Under review', 'Resolved']).optional(),
});
export type CaseUpdate = z.infer<typeof CaseUpdateSchema>;
/** Performance review status for someone, for a year (Approver › Performance). */
export const ReviewStatusSchema = z.object({ status: z.enum(['Submitted', 'Pending']), year: z.number().int().min(2000).max(2100) });
export type ReviewStatusInput = z.infer<typeof ReviewStatusSchema>;

/** A company announcement (Home and the bell). */
export const AnnouncementInputSchema = z.object({
  title: z.string().trim().min(3, 'Write the announcement').max(200, 'Keep the headline under 200 characters'),
  body: z.string().trim().max(2000).optional(),
});
export type AnnouncementInput = z.infer<typeof AnnouncementInputSchema>;

/** Org chart "Reports to": the manager's employee number, or null for no one. */
export const SetManagerSchema = z.object({ managerNo: z.string().trim().min(1).max(40).nullable() });
export type SetManager = z.infer<typeof SetManagerSchema>;

export const EmployeeListItemSchema = z.object({
  id: z.string(),
  employeeNo: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  status: EmploymentStatusSchema,
  hireDate: DateKeySchema,
  site: Ref,
  department: Ref,
  position: z.string().nullable(),
  /** Only for HR, Accounting and the Super Admin (null for an approver). */
  dailyRate: MoneySchema.nullable(),
  todayStatus: DtrStatusSchema.nullable(),
  managerId: z.string().nullable().optional().describe('Who this person reports to (for the org chart)'),
  middleName: z.string().nullable().optional(),
  email: z.string().nullable().optional().describe('Work email'),
  separationDate: DateKeySchema.nullable().optional().describe('Last day, once HR marks them separated'),
  shiftId: z.string().optional().describe('Their usual shift'),
  today: z
    .object({
      timeIn: z.string().nullable(),
      lateMinutes: z.number().int(),
      leaveType: z.string().nullable(),
      leaveUntil: DateKeySchema.nullable(),
    })
    .nullable()
    .optional()
    .describe("Today's time-in and minutes late, and the approved leave covering today (list only)"),
  record201: Record201BriefSchema.nullable().describe(
    '201 file status; null for roles that do not review 201 files',
  ),
});
export type EmployeeListItem = z.infer<typeof EmployeeListItemSchema>;

export const EmployeeListResponseSchema = z.object({
  items: z.array(EmployeeListItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type EmployeeListResponse = z.infer<typeof EmployeeListResponseSchema>;

export const EmployeeDetailSchema = EmployeeListItemSchema.extend({
  middleName: z.string().nullable(),
  email: z.string().nullable(),
  mobileNo: z.string().nullable(),
  birthDate: DateKeySchema.nullable(),
  manager: z.object({ id: z.string(), fullName: z.string() }).nullable(),
  shift: z.object({ name: z.string(), startTime: z.string(), endTime: z.string() }),
  govIds: z
    .object({ tin: z.string(), sss: z.string(), philhealth: z.string(), pagibig: z.string() })
    .nullable(),
  personal: PersonalInfoSchema.nullable().describe(
    'Personal data sheet: HR, System Admin and the employee only (null for others)',
  ),
  history: z.array(EmploymentEventSchema),
  biometricEnrolledAt: InstantSchema.nullable(),
  dtrs: z.array(DtrRowSchema),
  leaveBalances: z.array(LeaveBalanceSchema),
});
export type EmployeeDetail = z.infer<typeof EmployeeDetailSchema>;

// ---------- Approvals ----------
export const ApprovalListQuerySchema = z.object({
  status: RequestStatusSchema.optional().describe('Omit for all statuses'),
  type: ApprovalTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type ApprovalListQuery = z.infer<typeof ApprovalListQuerySchema>;

export const ApprovalItemSchema = z.object({
  id: z.string(),
  type: ApprovalTypeSchema,
  status: RequestStatusSchema,
  detail: z.string(),
  createdAt: InstantSchema,
  decidedAt: InstantSchema.nullable(),
  decidedBy: z.string().nullable(),
  reason: z.string().nullable(),
  employee: z.object({
    id: z.string(),
    fullName: z.string(),
    employeeNo: z.string(),
    siteName: z.string(),
  }),
  /** The approval workflow: its steps, which one it's at, who it's waiting for, and whether you may decide it. */
  steps: z.array(z.string()).optional(),
  step: z.number().int().optional(),
  waitingFor: z.string().optional(),
  canDecide: z.boolean().optional(),
});
export type ApprovalItem = z.infer<typeof ApprovalItemSchema>;

export const ApprovalListResponseSchema = z.object({
  items: z.array(ApprovalItemSchema),
  total: z.number().int(),
});
export type ApprovalListResponse = z.infer<typeof ApprovalListResponseSchema>;

export const ApproveRequestSchema = z.object({ reason: z.string().trim().max(500).optional() });
export type ApproveRequest = z.infer<typeof ApproveRequestSchema>;
export const RejectRequestSchema = z.object({
  reason: z
    .string({ error: 'Please give a reason' })
    .trim()
    .min(3, 'Please give a reason')
    .max(500),
});
export type RejectRequest = z.infer<typeof RejectRequestSchema>;

// ---------- Devices ----------
export const DeviceStatusSchema = z.object({
  serial: z.string(),
  name: z.string(),
  siteName: z.string(),
  lastSeenAt: InstantSchema.nullable(),
  online: z.boolean().describe('Seen within the last 5 minutes'),
});
export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

/** What syncing a terminal's user list with the HRIS would do. */
export const DeviceSyncPlanSchema = z.object({
  serial: z.string(),
  /** When the terminal last sent its user list (null = never asked yet). */
  usersReportedAt: InstantSchema.nullable(),
  onDevice: z.number().int().describe('Users the terminal reported'),
  toAdd: z.array(z.object({ pin: z.string(), name: z.string() })).describe('Active employees not on the terminal'),
  toDelete: z
    .array(z.object({ pin: z.string(), name: z.string().nullable() }))
    .describe('Users on the terminal who are not active employees'),
  pendingCommands: z.number().int(),
});
export type DeviceSyncPlan = z.infer<typeof DeviceSyncPlanSchema>;

export const DeviceSyncRequestSchema = z.object({
  /** Delete the terminal's users who aren't active employees (shown in the plan first). */
  deleteExtras: z.boolean(),
});
export type DeviceSyncRequest = z.infer<typeof DeviceSyncRequestSchema>;

export const DeviceCommandSchema = z.object({
  id: z.number().int(),
  command: z.string(),
  status: z.enum(['PENDING', 'SENT', 'DONE', 'FAILED']),
  result: z.string().nullable(),
  createdAt: InstantSchema,
  doneAt: InstantSchema.nullable(),
});
export type DeviceCommand = z.infer<typeof DeviceCommandSchema>;

/** Query string sent by ZKTeco ADMS terminals (/iclock/*). */
export const IclockQuerySchema = z.object({
  SN: z.string().trim().min(1).max(64).describe('Terminal serial number'),
  table: z.string().max(32).optional().describe('ATTLOG for attendance uploads'),
  Stamp: z.string().max(32).optional(),
  options: z.string().max(32).optional(),
});
export type IclockQuery = z.infer<typeof IclockQuerySchema>;

// ---------- Payroll ----------
export const PayrollPreviewQuerySchema = z.object({
  cutoff: CutoffCodeSchema,
  siteId: z.string().optional(),
});
export type PayrollPreviewQuery = z.infer<typeof PayrollPreviewQuerySchema>;

const PayAmounts = {
  daysPaid: z.string(),
  basicPay: MoneySchema,
  overtimePay: MoneySchema,
  nightDiffPay: MoneySchema,
  holidayPay: MoneySchema,
  lateUndertimeDeduction: MoneySchema,
  grossPay: MoneySchema,
  sss: MoneySchema,
  philhealth: MoneySchema,
  pagibig: MoneySchema,
  withholdingTax: MoneySchema,
  totalDeductions: MoneySchema,
  netPay: MoneySchema,
};

export const PayrollPreviewLineSchema = z.object({
  employeeId: z.string(),
  employeeNo: z.string(),
  fullName: z.string(),
  siteName: z.string(),
  dailyRate: MoneySchema,
  otMinutes: z.number().int(),
  nightDiffMinutes: z.number().int(),
  ...PayAmounts,
});
export type PayrollPreviewLine = z.infer<typeof PayrollPreviewLineSchema>;

export const StatutoryRateInfoSchema = z.object({
  name: z.string(),
  effectiveFrom: DateKeySchema,
  verified: z.boolean(),
  source: z.string(),
});

export const PayrollPreviewSchema = z.object({
  sample: z.literal(true),
  notice: z.string(),
  cutoff: CutoffCodeSchema,
  label: z.string(),
  ratesVerified: z.boolean(),
  rates: z.array(StatutoryRateInfoSchema),
  totals: z.object({
    employees: z.number().int(),
    gross: MoneySchema,
    deductions: MoneySchema,
    net: MoneySchema,
  }),
  lines: z.array(PayrollPreviewLineSchema),
});
export type PayrollPreview = z.infer<typeof PayrollPreviewSchema>;

export const PayslipViewSchema = z.object({
  id: z.string(),
  employeeName: z.string(),
  cutoffFrom: DateKeySchema,
  cutoffTo: DateKeySchema,
  label: z.string(),
  payDate: DateKeySchema,
  status: z.string(),
  ...PayAmounts,
});
export type PayslipView = z.infer<typeof PayslipViewSchema>;

// Payroll runs made on the website: it works the pay out with MSMA's workbook rules (its lib/pay/engine.ts) and the
// backend keeps each run, locks it on approval and writes the payslips. Employees are keyed by employee number.
const amount = z.number().finite();
/** One person's pay figures for a cut-off: never negative, never absurd. */
const pay = z.number().finite().min(0, 'Pay figures cannot be negative').max(10_000_000);
export const PayRunAdjustmentSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().trim().min(1).max(80),
  amount: amount.min(-1_000_000).max(1_000_000),
  taxable: z.boolean(),
  reason: z.string().trim().max(300),
});
export const PayRunAdjustmentsSchema = z.record(z.string(), z.array(PayRunAdjustmentSchema).max(50));
export const PayRunLineSchema = z.looseObject({
  person: z.looseObject({ id: z.string().min(1), name: z.string() }),
  pay: z.looseObject({}),
  time: z.looseObject({ present: z.number() }),
  basic: pay,
  deductions: pay,
  overtime: pay,
  premiums: pay,
  gross: pay,
  sssEe: pay,
  phEe: pay,
  piEe: pay,
  tax: pay,
  // Take-home can dip below zero when loans exceed pay; it is still bounded.
  net: amount.min(-1_000_000).max(10_000_000),
});
export type PayRunLine = z.infer<typeof PayRunLineSchema>;
const runPay = {
  lines: z.array(PayRunLineSchema).max(5000),
  auto: z.record(z.string(), z.array(z.looseObject({ id: z.string(), amount: amount.min(-1_000_000).max(1_000_000) })).max(50)),
};
export const CreatePayRunSchema = z.object({
  label: z.string().trim().min(1).max(80),
  from: DateKeySchema,
  to: DateKeySchema,
  adjustments: PayRunAdjustmentsSchema,
  ...runPay,
});
export type CreatePayRun = z.infer<typeof CreatePayRunSchema>;
/** A draft worked out again: from the latest attendance, or with an adjustment added or removed. */
export const UpdatePayRunSchema = z.object({ adjustments: PayRunAdjustmentsSchema, ...runPay });
export type UpdatePayRun = z.infer<typeof UpdatePayRunSchema>;
/** Approve exactly what the screen shows now. */
export const ApprovePayRunSchema = z.object(runPay);
export type ApprovePayRun = z.infer<typeof ApprovePayRunSchema>;
export const PayRunSchema = z.object({
  id: z.string(),
  label: z.string(),
  from: DateKeySchema,
  to: DateKeySchema,
  status: z.enum(['draft', 'approved']),
  lines: z.array(z.looseObject({})),
  adjustments: PayRunAdjustmentsSchema,
  auto: z.record(z.string(), z.array(z.looseObject({}))),
  createdBy: z.string(),
  createdAt: InstantSchema,
  computedAt: InstantSchema,
  reviewedBy: z.string().optional(),
  reviewedAt: InstantSchema.optional(),
  approvedBy: z.string().optional(),
  approvedAt: InstantSchema.optional(),
});
export type PayRun = z.infer<typeof PayRunSchema>;

/** Who is on payroll, with what the website's pay engine and payroll exports need. */
export const PayrollPersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.string(),
  department: z.string(),
  branch: z.string(),
  type: z.string(),
  status: z.string(),
  hired: DateKeySchema,
  separated: DateKeySchema.optional(),
  salary: z.number(),
  sex: z.string(),
  sssNo: z.string(),
  philhealthNo: z.string(),
  pagibigNo: z.string(),
  tin: z.string(),
  bank: z.object({ bank: z.string(), accountName: z.string(), accountNumber: z.string() }).optional(),
});
export type PayrollPerson = z.infer<typeof PayrollPersonSchema>;

// Payroll inputs set on the website (Payroll > Pay details, Loans & deductions), keyed by employee number.
export const PaydaysSchema = z.object({
  cutoffDays: z.tuple([z.number().int().min(1).max(31), z.number().int().min(1).max(31)]),
});
export type Paydays = z.infer<typeof PaydaysSchema>;
const nonNegative = z.number().finite().min(0, "Amounts can't be negative").max(10_000_000);
export const PayProfileSchema = z.object({
  workWeek: z.enum(['5-day', '6-day']),
  transportAllowance: nonNegative,
  otMealRate: nonNegative,
  deMinimis: nonNegative,
  otherNonTaxable: nonNegative,
  clientShare: z.number().finite().min(0).max(100, 'The share charged to a client is 0 to 100%'),
  client: z.string().trim().max(80),
  skipSss: z.boolean(),
  skipPhilhealth: z.boolean(),
  skipPagibig: z.boolean(),
});
export type PayProfile = z.infer<typeof PayProfileSchema>;
export const PaySettingsSchema = PaydaysSchema.extend({ profiles: z.record(z.string(), PayProfileSchema) });
export type PaySettings = z.infer<typeof PaySettingsSchema>;

export const LOAN_KINDS = ['SSS salary loan', 'SSS calamity loan', 'Pag-IBIG multi-purpose loan', 'Pag-IBIG calamity loan', 'Cash advance', 'Company loan', 'Other deduction'] as const;
export const LoanInputSchema = z
  .object({
    employeeId: z.string().min(1).describe('Employee number'),
    kind: z.enum(LOAN_KINDS, { message: 'Choose the kind of loan or deduction' }),
    reference: z.string().trim().min(1, 'Enter the loan or reference number').max(200),
    principal: z.number().finite().positive('Enter the total amount to deduct').max(100_000_000),
    installment: z.number().finite().positive('Enter how much to deduct each cutoff'),
    startDate: DateKeySchema,
    note: z.string().trim().max(500).default(''),
  })
  .refine((l) => l.installment <= l.principal, { message: "The amount per cutoff can't be more than the total", path: ['installment'] });
export type LoanInput = z.infer<typeof LoanInputSchema>;
export const LoanSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  kind: z.string(),
  reference: z.string(),
  principal: z.number(),
  installment: z.number(),
  startDate: DateKeySchema,
  status: z.enum(['active', 'stopped', 'settled']),
  note: z.string().optional(),
  createdBy: z.string(),
  createdAt: InstantSchema,
  closedBy: z.string().optional(),
  closedAt: InstantSchema.optional(),
  /** What approved payroll runs have taken for it so far. */
  paid: z.number(),
});
export type Loan = z.infer<typeof LoanSchema>;
export const StopLoanSchema = z.object({ reason: z.string().trim().min(1, 'Say why the deductions stop').max(300) });
export type StopLoan = z.infer<typeof StopLoanSchema>;

// ---------- Holiday calendar (the website's; national holidays are built into it) ----------
export const HolidayRepeatSchema = z.union([
  z.object({ kind: z.literal('fixed'), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) }),
  z.object({ kind: z.literal('once'), date: DateKeySchema }),
]);
export const HolidayRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['regular', 'special']),
  repeat: HolidayRepeatSchema,
  offices: z.array(z.string()),
  source: z.string(),
  builtIn: z.literal(false),
  active: z.literal(true),
});
export type HolidayRule = z.infer<typeof HolidayRuleSchema>;
export const HolidayChangeSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  year: z.number().int(),
  kind: z.enum(['move', 'cancel']),
  date: DateKeySchema.optional(),
  source: z.string(),
  by: z.string(),
  at: InstantSchema,
});
export type HolidayChange = z.infer<typeof HolidayChangeSchema>;
export const SavedHolidaysSchema = z.object({ rules: z.array(HolidayRuleSchema), changes: z.array(HolidayChangeSchema) });
export type SavedHolidays = z.infer<typeof SavedHolidaysSchema>;
export const AddHolidaySchema = z.object({
  name: z.string().trim().min(1, 'Name the holiday').max(120),
  type: z.enum(['regular', 'special']),
  date: DateKeySchema,
  everyYear: z.boolean(),
  offices: z.array(z.string().max(120)).max(50),
  source: z.string().trim().min(1, 'Name the source, for example the proclamation number or the city ordinance').max(200),
});
export type AddHoliday = z.infer<typeof AddHolidaySchema>;
export const ChangeHolidaySchema = z.object({
  ruleId: z.string().min(1).max(80),
  year: z.number().int().min(2000).max(2100),
  kind: z.enum(['move', 'cancel']),
  date: DateKeySchema.optional(),
  source: z.string().trim().min(1, 'Name the proclamation that changes it').max(200),
});
export type ChangeHoliday = z.infer<typeof ChangeHolidaySchema>;
/** The holidays the website works out for some years, so the backend's own day records mark them too. */
export const HolidayCalendarSchema = z.object({
  years: z.array(z.number().int().min(2000).max(2100)).min(1).max(5),
  holidays: z.array(z.object({ date: DateKeySchema, name: z.string().max(200), type: z.enum(['regular', 'special']) })).max(500),
});
export type HolidayCalendar = z.infer<typeof HolidayCalendarSchema>;

// ---------- Dashboard ----------
export const DashboardQuerySchema = z.object({
  siteId: z.string().optional(),
  date: DateKeySchema.optional(),
});
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;

export const DashboardSummarySchema = z.object({
  date: DateKeySchema,
  siteId: z.string().nullable(),
  generatedAt: InstantSchema,
  kpis: z.object({
    headcount: z.number().int(),
    present: z.number().int(),
    late: z.number().int(),
    absent: z.number().int(),
    onLeave: z.number().int(),
    pendingApprovals: z.number().int(),
  }),
  presentBySite: z.array(
    z.object({
      siteId: z.string(),
      siteName: z.string(),
      present: z.number().int(),
      scheduled: z.number().int(),
    }),
  ),
  trend: z.array(
    z.object({
      date: DateKeySchema,
      present: z.number().int(),
      scheduled: z.number().int(),
      rate: z.number().describe('Percent, 1 decimal'),
    }),
  ),
  latestPunches: z.array(
    z.object({
      id: z.string(),
      punchedAt: InstantSchema,
      employeeId: z.string(),
      employeeName: z.string(),
      siteName: z.string(),
      deviceName: z.string(),
      method: VerifyModeSchema,
      kind: z.enum(['IN', 'OUT']),
      lateMinutes: z.number().int(),
    }),
  ),
  devices: z.array(DeviceStatusSchema),
  payroll: z
    .object({
      sample: z.literal(true),
      cutoff: CutoffCodeSchema,
      label: z.string(),
      payDate: DateKeySchema,
      employees: z.number().int(),
      gross: MoneySchema,
      deductions: MoneySchema,
      net: MoneySchema,
      openIssues: z.number().int().describe('DTRs in the cutoff with a missing time-out'),
    })
    .nullable()
    .describe('null for roles that may not see payroll totals (managers)'),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;

// ---------- Me (mobile) ----------
export const MeTodaySchema = z.object({
  date: DateKeySchema,
  shift: z.object({ name: z.string(), startTime: z.string(), endTime: z.string() }),
  isWorkday: z.boolean(),
  holiday: z.object({ name: z.string(), type: HolidayTypeSchema }).nullable(),
  onLeave: z.boolean(),
  timeIn: InstantSchema.nullable(),
  timeOut: InstantSchema.nullable(),
  lateMinutes: z.number().int(),
  status: z.enum([
    'NOT_CLOCKED_IN',
    'CLOCKED_IN',
    'CLOCKED_OUT',
    'ON_LEAVE',
    'REST_DAY',
    'HOLIDAY',
  ]),
  nextAction: z.enum(['CLOCK_IN', 'CLOCK_OUT']),
  siteName: z.string(),
});
export type MeToday = z.infer<typeof MeTodaySchema>;

export const ClockRequestSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  phoneCheck: z
    .enum(['PHONE_BIOMETRIC', 'PHONE_PASSCODE'])
    .describe(
      "How the phone confirmed it's the employee: its fingerprint/face unlock or its PIN/password. " +
        'Checked on the phone; the API only receives the result.',
    ),
});
export type ClockRequest = z.infer<typeof ClockRequestSchema>;

export const ClockResponseSchema = z.object({
  punchedAt: InstantSchema,
  action: z.enum(['CLOCK_IN', 'CLOCK_OUT']),
  today: MeTodaySchema,
});
export type ClockResponse = z.infer<typeof ClockResponseSchema>;

export const MyRequestSchema = z.object({
  id: z.string(),
  type: ApprovalTypeSchema,
  status: RequestStatusSchema,
  detail: z.string(),
  createdAt: InstantSchema,
  decidedAt: InstantSchema.nullable(),
  reason: z.string().nullable(),
});
export type MyRequest = z.infer<typeof MyRequestSchema>;

// ---------- Company policies (Maintenance > Rules on the website) ----------
export const POLICY_CATEGORIES = ['Employee handbook', 'Code of conduct', 'Attendance & time', 'Leave', 'Pay & benefits', 'Data privacy', 'Health & safety', 'Other'] as const;
export const PolicyInputSchema = z.object({
  title: z.string().trim().min(1, 'Give the policy a title').max(160),
  category: z.enum(POLICY_CATEGORIES),
  effectiveDate: DateKeySchema,
  summary: z.string().trim().max(500).default(''),
  body: z.string().trim().max(100_000).default(''),
  fileId: z.string().max(200).optional(),
  fileName: z.string().max(200).optional(),
  requireAck: z.boolean(),
});
export type PolicyInput = z.infer<typeof PolicyInputSchema>;
export const PolicySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(POLICY_CATEGORIES),
  version: z.number().int(),
  effectiveDate: DateKeySchema,
  summary: z.string(),
  body: z.string(),
  fileId: z.string().optional(),
  fileName: z.string().optional(),
  requireAck: z.boolean(),
  status: z.enum(['draft', 'published', 'archived']),
  updatedBy: z.string(),
  updatedAt: InstantSchema,
});
export type PolicyView = z.infer<typeof PolicySchema>;
export const PolicyRowSchema = PolicySchema.extend({ acknowledged: z.number().int(), total: z.number().int() });
export type PolicyRowView = z.infer<typeof PolicyRowSchema>;
export const MyPolicySchema = PolicySchema.extend({ acknowledgedAt: InstantSchema.optional() });
export const PolicyStatusSchema = z.object({ status: z.enum(['draft', 'published', 'archived']) });
export const PolicyAcksSchema = z.object({ done: z.array(z.object({ name: z.string(), at: InstantSchema })), waiting: z.array(z.string()) });

// ---------- Onboarding: recruitment (job requisitions, applicants) and trainings ----------
export const REQUISITION_STAGES = ['Sourcing', 'Interviewing', 'Offer extended'] as const;
export const APPLICANT_STAGES = ['Applied', 'Screening', 'Interview', 'Offered', 'Hired', 'Rejected'] as const;
export const TRAINING_STATUSES = ['Not started', 'In progress', 'Completed'] as const;
const shortText = (max: number) => z.string().trim().max(max);

export const RequisitionInputSchema = z.object({
  title: shortText(120).min(1, 'Name the role'),
  department: shortText(120).min(1, 'Choose the department'),
  cluster: shortText(60).optional(),
  office: shortText(120).min(1, 'Choose the office'),
  openings: z.number().int().min(1, 'At least one opening').max(500),
  employmentType: shortText(40).optional(),
  targetStart: z.string().max(40).optional(),
  salaryRange: shortText(80).optional(),
  justification: shortText(2000).optional(),
});
export type RequisitionInput = z.infer<typeof RequisitionInputSchema>;
export const RequisitionSchema = z.looseObject({ id: z.string(), title: z.string(), openings: z.number(), applicants: z.number(), applicantsThisWeek: z.number() });

/** What someone sends from the shared job link (no sign-in). */
export const ApplicationInputSchema = z.object({
  requisitionId: shortText(60).optional(),
  appliedRole: shortText(120).min(1, 'Choose the role'),
  field: shortText(120),
  background: shortText(200).default(''),
  workExperience: shortText(4000).default(''),
  firstName: shortText(80).min(1, 'Enter your first name'),
  lastName: shortText(80).min(1, 'Enter your last name'),
  email: z.email('Enter a valid email').max(160),
  phone: shortText(40).min(7, 'Enter your mobile number'),
  province: shortText(80).default(''),
  city: shortText(80).default(''),
  profession: z.enum(['CPA', 'BS Accountancy graduate', 'Accounting student / undergrad', 'Other']),
  yearsExperience: z.number().min(0).max(60).default(0),
  prcLicenseNumber: shortText(40).optional(),
  resumeFileName: shortText(200).optional(),
  message: shortText(4000).optional(),
  experienceLevel: z.enum(['Fresh graduate', 'Has work experience']).optional(),
  coverLetter: z.union([z.object({ kind: z.literal('upload'), fileName: shortText(200) }), z.object({ kind: z.literal('write'), text: shortText(8000) })]).optional(),
  languages: z.array(shortText(60)).max(20).optional(),
  careerHistory: z.array(z.object({ title: shortText(120), company: shortText(120), start: shortText(10), end: shortText(10), description: shortText(2000).optional() })).max(30).optional(),
  education: z.array(z.object({ degree: shortText(160), school: shortText(160), finished: shortText(10) })).max(20).optional(),
  skills: z.array(shortText(60)).max(60).optional(),
});
export type ApplicationInput = z.infer<typeof ApplicationInputSchema>;
export const ApplicantSchema = z.looseObject({ id: z.string(), requisitionId: z.string(), firstName: z.string(), lastName: z.string(), stage: z.enum(APPLICANT_STAGES) });
export const ApplicantStageSchema = z.object({ stage: z.enum(APPLICANT_STAGES) });

export const TrainingInputSchema = z.object({
  employeeName: shortText(160).min(1, 'Choose the employee'),
  employeeInitials: shortText(4).optional(),
  course: shortText(160).min(1, 'Choose the course'),
  dueDate: shortText(40).min(1, 'Enter the due date, e.g. Nov 15, 2026'),
});
export type TrainingInput = z.infer<typeof TrainingInputSchema>;
export const TrainingSchema = z.object({ id: z.string(), employeeName: z.string(), employeeInitials: z.string(), course: z.string(), dueDate: z.string(), status: z.enum(TRAINING_STATUSES) });
export type TrainingView = z.infer<typeof TrainingSchema>;
export const TrainingStatusSchema = z.object({ status: z.enum(TRAINING_STATUSES) });

// ---------- Support tickets, the subscription and the audit trail (Administration on the website) ----------
export const TICKET_CATEGORIES = ['Bug or error', 'How do I…', 'Account or sign-in', 'Payroll', 'Data fix', 'Billing', 'Feature request'] as const;
export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const TICKET_STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'] as const;
export const FileTicketSchema = z.object({
  subject: z.string().trim().min(1, 'Give the problem a short title.').max(160),
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES),
  text: z.string().trim().min(1, 'Describe what happened.').max(8000),
  page: z.string().max(300).optional(),
});
export type FileTicket = z.infer<typeof FileTicketSchema>;
export const TicketReplySchema = z.object({ text: z.string().trim().min(1, 'Write a reply first.').max(8000) });
export const TicketPatchSchema = z.object({ status: z.enum(TICKET_STATUSES).optional(), priority: z.enum(TICKET_PRIORITIES).optional(), assignee: z.string().trim().max(120).optional() });
export type TicketPatch = z.infer<typeof TicketPatchSchema>;
export const TicketSchema = z.looseObject({ id: z.string(), number: z.number(), subject: z.string(), status: z.enum(TICKET_STATUSES) });

export const UsageSchema = z.looseObject({ clientId: z.string(), seatsUsed: z.number(), seatLimit: z.number(), seatCap: z.number(), adminsUsed: z.number(), adminLimit: z.number() });
export const UpgradeRequestSchema = z.object({ note: z.string().trim().max(1000).default('') });
export const ChangePlanSchema = z.object({ planId: z.string().min(1, 'Choose a plan') });
export const SeatOverrideSchema = z.object({ seats: z.number().int().min(1, 'Enter a whole number of seats, 1 or more').max(100000).nullable() });
export const ExtensionSchema = z.object({ extension: z.object({ seats: z.number().int().min(1, 'Enter how many extra seats, 1 or more').max(10000), until: DateKeySchema }).nullable() });

export const AuditRowSchema = z.object({ id: z.string(), at: InstantSchema, actor: z.string(), module: z.string(), action: z.string(), target: z.string(), detail: z.string() });

// ---------- User accounts (Administration › Users on the website) ----------
/** The website's six fixed role ids (lib/admin/store.ts DEFAULT_ROLES). */
export const WEB_ROLE_IDS = ['system-admin', 'super-admin', 'hr', 'approver', 'accounting', 'employee'] as const;
export type WebRoleId = (typeof WEB_ROLE_IDS)[number];
export const CreateAccountSchema = z.object({
  name: z.string().trim().min(1, "Enter the person's name").max(120),
  username: z.email("Use the person's email as the username (they sign in with it)").max(160),
  roleId: z.enum(WEB_ROLE_IDS, { message: 'Choose a role' }),
  employeeId: z.string().max(40).optional().describe('Employee number, when the login belongs to an employee'),
});
export type CreateAccount = z.infer<typeof CreateAccountSchema>;
export const AccountRoleSchema = z.object({ roleId: z.enum(WEB_ROLE_IDS, { message: 'Choose a role' }) });
export const AccountStatusSchema = z.object({ status: z.enum(['active', 'disabled']) });
export const AccountRowSchema = z.looseObject({ id: z.string(), username: z.string(), roleId: z.string(), status: z.string(), locked: z.boolean() });
export const TempPasswordSchema = z.object({ username: z.string(), password: z.string() });
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(200),
  // bcrypt reads only the first 72 bytes, so longer passwords would be cut without telling anyone.
  newPassword: z.string().min(8, 'Use at least 8 characters.').max(72, 'Use 72 characters or fewer.'),
});
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;

// ---------- Approval workflows (Maintenance > Rules on the website) ----------
export const WorkflowStepSchema = z.object({
  approver: z.enum(['supervisor', 'department-head', 'role']),
  /** For approver = role: the website's role id, e.g. hr. */
  roleId: z.string().max(40).optional(),
  /** Only for requests longer than this many days. */
  overDays: z.number().int().min(1, "The 'only when longer than' days must be 1 or more").max(366).optional(),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export const WorkflowSchema = z.object({
  kind: z.enum(['leave', 'overtime', 'undertime', 'correction', 'profile']),
  steps: z.array(WorkflowStepSchema).max(10),
  remindAfterDays: z.number().int().min(0, 'Reminder days must be 0 or more').max(60),
  active: z.boolean(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

// ---------- Reimbursement claims (Requests > Reimbursements on the website) ----------
export const CLAIM_CATEGORIES = ['Transportation', 'Meals & client meetings', 'Office supplies', 'Communication', 'Training & seminars', 'Medical', 'Other'] as const;
export const ClaimInputSchema = z.object({
  employeeId: z.string().max(40).describe('Employee number (yours)'),
  category: z.enum(CLAIM_CATEGORIES, { message: 'Choose what the expense was for' }),
  otherType: z.string().trim().max(60, 'Keep it under 60 characters').optional(),
  merchant: z.string().trim().min(1, 'Enter the store or merchant on the receipt').max(120),
  purchaseDate: DateKeySchema,
  amount: z.number().finite().positive('Enter the total on the receipt'),
  description: z.string().trim().min(1, 'Say what it was for').max(1000),
  receipt: z.string().min(1, 'Add a photo of the receipt').max(4_000_000, 'That photo is too large. Try a smaller or cropped photo.'),
});
export type ClaimInput = z.infer<typeof ClaimInputSchema>;
export const ClaimDecisionSchema = z.object({ approve: z.boolean(), note: z.string().trim().max(500).default('') });
export const ClaimPaySchema = z.object({
  ids: z.array(z.string()).min(1, 'Choose the claims to pay').max(500),
  method: z.enum(['cash', 'transfer', 'e-wallet', 'check']),
  reference: z.string().trim().max(120).default(''),
  paidOn: DateKeySchema,
});
export type ClaimPay = z.infer<typeof ClaimPaySchema>;
export const ClaimSchema = z.looseObject({ id: z.string(), employeeId: z.string(), status: z.enum(['pending', 'endorsed', 'approved', 'rejected']), amount: z.number() });

// ---------- Certificate requests (Requests > Certificates on the website) ----------
export const CERTIFICATE_TYPES = ['Certificate of Employment', 'Certificate of Tax Withheld (2316)', 'Employment Verification Letter'] as const;
export const CertificateInputSchema = z.object({
  type: z.enum(CERTIFICATE_TYPES, { message: 'Choose the certificate' }),
  purpose: z.string().trim().max(300).default(''),
});
export const CertificateDeclineSchema = z.object({ reason: z.string().trim().min(1, 'Say why, so the employee knows').max(500) });
export const CertificateSchema = z.looseObject({ id: z.string(), type: z.string(), status: z.enum(['Pending', 'Ready for pickup', 'Released', 'Declined']) });
