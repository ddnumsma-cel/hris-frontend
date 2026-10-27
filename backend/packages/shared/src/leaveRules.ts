// Leave credits and filing checks, copied from the website's src/lib/leave/rules.ts so the backend counts leave
// exactly as the website shows it (sheet SIL: VL/SL days by length of service, June–May leave year). Keep the two
// in step. Holidays are passed in (the website's calendar, which it sends to the backend).

export type Earning = { kind: 'monthly'; perMonth: number } | { kind: 'yearly' } | { kind: 'per-event' } | { kind: 'unlimited' };
export type Eligibility = 'everyone' | 'female' | 'male-married' | 'solo-parent' | 'after-1-year' | 'after-6-months';

export interface LeaveTypeRule {
  id: string;
  name: string;
  code: string;
  daysPerYear: number;
  earning: Earning;
  paid: boolean;
  carryOverMax: number;
  countBy: 'workdays' | 'calendar';
  eligibility: Eligibility;
  attachmentOver: number | null;
  confidential: boolean;
  basis: string;
  active: boolean;
}

export interface LeaveRequestFact {
  id: string;
  employeeId: string;
  typeId: string;
  start: string;
  end: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
}

export interface LeaveAdjustmentFact {
  employeeId: string;
  typeId: string;
  days: number;
  at: string;
}

export interface HolidayFact {
  date: string;
  name: string;
  offices?: string[];
}

export interface LeavePolicy {
  allowHalfDays: boolean;
  allowNegative: boolean;
  defaultCarryOver: number;
  accrual: 'yearly' | 'monthly' | 'per-payroll';
}

export interface LeaveData {
  types: LeaveTypeRule[];
  requests: LeaveRequestFact[];
  adjustments: LeaveAdjustmentFact[];
  carryOver: Record<string, number>;
  policy?: Partial<LeavePolicy>;
  workWeek?: number[];
  holidays: HolidayFact[];
}

export const DEFAULT_LEAVE_POLICY: LeavePolicy = { allowHalfDays: true, allowNegative: false, defaultCarryOver: 0, accrual: 'yearly' };
export const DEFAULT_WORK_WEEK = [1, 2, 3, 4, 5];
export const policyOf = (data: Pick<LeaveData, 'policy'>): LeavePolicy => ({ ...DEFAULT_LEAVE_POLICY, ...data.policy });

/** Sex and civil status for eligibility ("Male"/"Female", "Married"…), hire date for service length. */
export interface LeavePersonFacts {
  personal: { sex: string; civilStatus: string };
  job: { dateHired: string; employmentType?: string };
}

// ---- Dates ----

export function addLeaveDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
// Leave days are counted for the whole company, so only holidays every office has are skipped.
const isHolidayIn = (holidays: HolidayFact[], date: string) => holidays.some((h) => h.date === date && !h.offices?.length);

/** Days a request covers: working days (the company's work week, not holidays) or every calendar day. */
export function countLeaveDays(start: string, end: string, countBy: LeaveTypeRule['countBy'], halfDay: 'am' | 'pm' | undefined, workWeek: number[], holidays: HolidayFact[]) {
  if (!start || !end || end < start) return 0;
  const isWorkday = (date: string) => workWeek.includes(weekday(date));
  const isHoliday = (date: string) => isHolidayIn(holidays, date);
  if (halfDay && start === end) return countBy === 'calendar' || (isWorkday(start) && !isHoliday(start)) ? 0.5 : 0;
  let n = 0;
  for (let d = start; d <= end; d = addLeaveDays(d, 1)) if (countBy === 'calendar' || (isWorkday(d) && !isHoliday(d))) n++;
  return n;
}

// ---- Eligibility ----

function eligibility(e: LeavePersonFacts | undefined, type: LeaveTypeRule, today: string): { eligible: boolean; note?: string } {
  if (!e) return { eligible: false, note: 'Employee not found' };
  // Leave without pay is for probationary staff; regular employees take paid leave from their VL/SL credits.
  if (type.earning.kind === 'unlimited' && e.job.employmentType === 'Regular') return { eligible: false, note: 'Regular employees use their VL/SL credits instead' };
  const sex = e.personal.sex;
  const months = e.job.dateHired ? (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${e.job.dateHired}T00:00:00Z`)) / (30.44 * 86_400_000) : 0;
  switch (type.eligibility) {
    case 'female':
      return sex === 'Male' ? { eligible: false, note: 'For female employees' } : { eligible: true };
    case 'male-married':
      if (sex === 'Female') return { eligible: false, note: 'For married male employees' };
      return e.personal.civilStatus && e.personal.civilStatus !== 'Married' ? { eligible: false, note: 'For married male employees' } : { eligible: true };
    case 'solo-parent':
      return months < 6 ? { eligible: false, note: 'After 6 months of service' } : { eligible: true };
    case 'after-1-year':
      return months < 12 ? { eligible: false, note: 'After 1 year of service' } : { eligible: true };
    case 'after-6-months':
      return months < 6 ? { eligible: false, note: 'After 6 months of service' } : { eligible: true };
    default:
      return { eligible: true };
  }
}

// ---- Credits (sheet SIL) ----

export const LEAVE_CREDITS_PER_YEAR = 18;

/** VL/SL days by length of service: years = days since hire ÷ 365; over 3 years 18, over 1 year 6 per year (rounded), over 6 months 3. */
export function silCredits(hireDate: string | undefined, asOf: string) {
  if (!hireDate) return 0;
  const years = Math.max((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${hireDate}T00:00:00Z`)) / 86_400_000 / 365, 0);
  return years > 3 ? 18 : years > 1 ? Math.round(years * 6) : years > 0.5 ? 3 : 0;
}

/** The leave year runs June to May (sheet SIL, "FY 26-27"). */
export function leaveYearOf(today: string) {
  const y = Number(today.slice(0, 4));
  const start = Number(today.slice(5, 7)) >= 6 ? y : y - 1;
  return { from: `${start}-06-01`, to: `${start + 1}-05-31`, label: `June ${start} – May ${start + 1}` };
}

/** Adjustments with this type id change the yearly VL/SL pool, not one leave type. */
export const CREDITS_ADJUSTMENT = 'credits';

export interface Credits {
  total: number;
  adjusted: number;
  used: number;
  pending: number;
  available: number;
}

/** The VL/SL days for the leave year: earned by length of service, plus HR's changes, less the paid leave used or waiting. */
export function creditsOf(data: LeaveData, employeeId: string, today: string, hireDate?: string): Credits {
  const fy = leaveYearOf(today);
  const inYear = (d: string) => d.slice(0, 10) >= fy.from && d.slice(0, 10) <= fy.to;
  const paid = new Set(data.types.filter((t) => t.earning.kind !== 'unlimited').map((t) => t.id));
  const mine = data.requests.filter((r) => r.employeeId === employeeId && paid.has(r.typeId) && inYear(r.start));
  const used = mine.filter((r) => r.status === 'approved').reduce((n, r) => n + r.days, 0);
  const pending = mine.filter((r) => r.status === 'pending').reduce((n, r) => n + r.days, 0);
  const adjusted = data.adjustments.filter((a) => a.employeeId === employeeId && a.typeId === CREDITS_ADJUSTMENT && inYear(a.at)).reduce((n, a) => n + a.days, 0);
  const total = Math.max(0, silCredits(hireDate, today) + adjusted);
  return { total, adjusted, used, pending, available: Math.max(0, total - used - pending) };
}

export const fmtCredits = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

// ---- Filing ----

export interface LeaveFiling {
  employeeId: string;
  typeId: string;
  start: string;
  end: string;
  halfDay?: 'am' | 'pm';
}

/** The website's File leave checks: days counted, eligibility, VL/SL left and overlaps. Supporting documents aren't on the backend yet, so they aren't checked here. */
export function checkLeaveFiling(data: LeaveData, person: LeavePersonFacts | undefined, input: LeaveFiling, today: string): { days: number; errors: string[] } {
  const type = data.types.find((t) => t.id === input.typeId);
  if (!type || !type.active) return { days: 0, errors: ['Choose the leave type'] };
  if (input.end < input.start) return { days: 0, errors: ['The end date is before the start date'] };
  const policy = policyOf(data);
  const halfDay = input.start === input.end && policy.allowHalfDays ? input.halfDay : undefined;
  const days = countLeaveDays(input.start, input.end, type.countBy, halfDay, data.workWeek ?? DEFAULT_WORK_WEEK, data.holidays);
  const errors: string[] = [];
  if (days === 0) errors.push('Those dates are all weekends or holidays, so no leave is needed');
  const elig = eligibility(person, type, today);
  if (!elig.eligible) errors.push(elig.note ?? "This employee can't use this leave type");
  if (type.earning.kind !== 'unlimited') {
    const credits = creditsOf(data, input.employeeId, today, person?.job.dateHired);
    if (credits.available < days && !policy.allowNegative)
      errors.push(`Only ${fmtCredits(credits.available)} of VL/SL left this leave year (June to May). File the rest as Leave without pay.`);
  }
  const overlap = data.requests.find((r) => r.employeeId === input.employeeId && (r.status === 'pending' || r.status === 'approved') && r.start <= input.end && r.end >= input.start);
  if (overlap) errors.push(`Overlaps another ${overlap.status} request (${overlap.start === overlap.end ? overlap.start : `${overlap.start} to ${overlap.end}`})`);
  return { days, errors };
}
