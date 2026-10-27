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
});
export type AttendanceDay = z.infer<typeof AttendanceDaySchema>;

export const AttendanceDaysResponseSchema = z.object({
  employees: z.array(z.object({ id: z.string(), shift: ShiftBriefSchema })),
  days: z.array(AttendanceDaySchema),
});
export type AttendanceDaysResponse = z.infer<typeof AttendanceDaysResponseSchema>;

export const RecomputeQuerySchema = z.object({ from: DateKeySchema, to: DateKeySchema });
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
    leaveTypeCode: z.enum(['VL', 'SL', 'SIL']),
    startDate: DateKeySchema,
    endDate: DateKeySchema,
    reason: z.string().trim().min(3, 'Please give a short reason').max(300),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });
export type CreateLeaveRequest = z.infer<typeof CreateLeaveRequestSchema>;

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
  dailyRate: MoneySchema,
  todayStatus: DtrStatusSchema.nullable(),
  managerId: z.string().nullable().optional().describe('Who this person reports to (for the org chart)'),
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
