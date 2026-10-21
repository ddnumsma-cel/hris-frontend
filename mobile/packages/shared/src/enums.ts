// Mirrors of the Prisma enums, usable by web and mobile without importing Prisma.

export const ROLES = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const EMPLOYMENT_STATUSES = ['PROBATIONARY', 'REGULAR', 'CONTRACTUAL', 'PROJECT'] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

/** FACE/FINGER/PIN come from attendance machines; PHONE_* are phone clock-ins confirmed by the phone's own lock. */
export const VERIFY_MODES = [
  'FACE',
  'FINGER',
  'PIN',
  'SELFIE',
  'PHONE_BIOMETRIC',
  'PHONE_PASSCODE',
] as const;
export type VerifyMode = (typeof VERIFY_MODES)[number];

export const HOLIDAY_TYPES = ['REGULAR', 'SPECIAL'] as const;
export type HolidayType = (typeof HOLIDAY_TYPES)[number];

export const DTR_STATUSES = ['PRESENT', 'ABSENT', 'LEAVE', 'RESTDAY', 'HOLIDAY'] as const;
export type DtrStatus = (typeof DTR_STATUSES)[number];

export const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const APPROVAL_TYPES = ['LEAVE', 'OT', 'UNDERTIME', 'DTR_FIX'] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const THEME_PREFERENCES = ['LIGHT', 'DARK', 'SYSTEM'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const TEXT_SIZES = ['STANDARD', 'LARGE'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const TABLE_DENSITIES = ['COMFORTABLE', 'COMPACT'] as const;
export type TableDensity = (typeof TABLE_DENSITIES)[number];

/** Plain-language labels for the UI. */
export const LABELS = {
  role: {
    EMPLOYEE: 'Employee',
    MANAGER: 'Manager',
    HR_ADMIN: 'HR Admin',
    PAYROLL_ADMIN: 'Payroll Admin',
    SYSTEM_ADMIN: 'System Admin',
  } satisfies Record<Role, string>,
  employmentStatus: {
    PROBATIONARY: 'Probationary',
    REGULAR: 'Regular',
    CONTRACTUAL: 'Contractual',
    PROJECT: 'Project-based',
  } satisfies Record<EmploymentStatus, string>,
  verifyMode: {
    FACE: 'Face',
    FINGER: 'Fingerprint',
    PIN: 'PIN',
    SELFIE: 'Selfie + GPS',
    PHONE_BIOMETRIC: 'Phone (fingerprint / face)',
    PHONE_PASSCODE: 'Phone (PIN / password)',
  } satisfies Record<VerifyMode, string>,
  dtrStatus: {
    PRESENT: 'Present',
    ABSENT: 'Absent',
    LEAVE: 'On leave',
    RESTDAY: 'Rest day',
    HOLIDAY: 'Holiday',
  } satisfies Record<DtrStatus, string>,
  requestStatus: {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
  } satisfies Record<RequestStatus, string>,
  approvalType: {
    LEAVE: 'Leave',
    OT: 'Overtime',
    UNDERTIME: 'Undertime',
    DTR_FIX: 'Time adjustment',
  } satisfies Record<ApprovalType, string>,
  theme: { LIGHT: 'Light', DARK: 'Dark', SYSTEM: 'Match my device' } satisfies Record<
    ThemePreference,
    string
  >,
} as const;
