// Mock transaction records behind the Partner "Reports" pages. Each report is a
// flat list of rows for the partner's team; the report page filters them by
// period, team member and status, and builds the summary tiles from them.

export type ReportId =
  | "overtime"
  | "leave"
  | "locator-slip"
  | "timesheet"
  | "temporary-shift"
  | "broken-time"
  | "offset-hours";

export type ReportStatus = "Approved" | "Pending" | "Declined";

export interface ReportRow {
  id: string;
  employee: string;
  initials: string;
  /** ISO date (yyyy-mm-dd) the record falls on — drives the period filter. */
  date: string;
  status?: ReportStatus;
  [field: string]: string | number | undefined;
}

const team = {
  AD: "Angela Dela Cruz",
} as const;

type Initials = keyof typeof team;

function who(initials: Initials) {
  return { employee: team[initials], initials };
}

export const reportTeamMembers = Object.values(team);

const overtime: ReportRow[] = [
  { id: "ot-1", ...who("AD"), date: "2026-09-24", timeIn: "6:00 PM", timeOut: "8:30 PM", hours: 2.5, reason: "Q3 inventory count wrap-up", status: "Pending" },
];

const leave: ReportRow[] = [
  { id: "lv-1", ...who("AD"), date: "2026-10-06", leaveType: "Vacation", period: "Oct 6 – Oct 8", days: 3, filedOn: "Sept 21", status: "Pending" },
];

const locatorSlip: ReportRow[] = [
  { id: "ls-1", ...who("AD"), date: "2026-09-24", destination: "Mandaue client site", purpose: "Inventory observation", timeOut: "1:00 PM", timeIn: "6:15 PM", status: "Approved" },
];

// Weekly DTR roll-up per team member for September.
const timesheetWeeks: { start: string; label: string }[] = [
  { start: "2026-09-01", label: "Sept 1 – 5" },
  { start: "2026-09-07", label: "Sept 7 – 12" },
  { start: "2026-09-14", label: "Sept 14 – 19" },
  { start: "2026-09-21", label: "Sept 21 – 26" },
];

const timesheetSeed: Record<Initials, [present: number, absent: number, lates: number, lateMins: number, undertime: number, overtime: number][]> = {
  AD: [[5, 0, 1, 12, 0, 1.5], [5, 0, 0, 0, 0, 0], [4, 1, 0, 0, 0, 2], [5, 0, 1, 8, 0, 0]],
};

const timesheet: ReportRow[] = (Object.keys(timesheetSeed) as Initials[]).flatMap((initials) =>
  timesheetSeed[initials].map(([present, absent, lates, lateMins, undertime, overtime], week) => ({
    id: `ts-${initials}-${week}`,
    ...who(initials),
    date: timesheetWeeks[week].start,
    week: timesheetWeeks[week].label,
    present,
    absent,
    lates,
    lateMins,
    undertimeMins: undertime,
    hoursWorked: Math.round((present * 8 - (lateMins + undertime) / 60) * 10) / 10,
    overtimeHours: overtime,
  })),
);

const temporaryShift: ReportRow[] = [
  { id: "tsh-1", ...who("AD"), date: "2026-09-28", effective: "Sept 28 – Oct 9", regularShift: "8:30 AM – 5:30 PM", temporaryShift: "10:00 AM – 7:00 PM", reason: "Client with late-afternoon cutoff", status: "Pending" },
];

const brokenTime: ReportRow[] = [
  { id: "bt-1", ...who("AD"), date: "2026-09-25", firstBlock: "8:00 AM – 12:00 PM", secondBlock: "4:00 PM – 8:00 PM", hours: 8, reason: "Child's school event mid-day", status: "Pending" },
];

const offsetHours: ReportRow[] = [
  { id: "oh-1", ...who("AD"), date: "2026-09-26", earnedFrom: "Sept 18 overtime", hoursEarned: 4, dateUsed: "Sept 26 (PM)", hoursUsed: 4, balance: 0, status: "Approved" },
];

export const teamReports: Record<ReportId, ReportRow[]> = {
  overtime,
  leave,
  "locator-slip": locatorSlip,
  timesheet,
  "temporary-shift": temporaryShift,
  "broken-time": brokenTime,
  "offset-hours": offsetHours,
};
