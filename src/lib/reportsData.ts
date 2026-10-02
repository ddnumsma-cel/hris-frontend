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
  BS: "Bea Santos",
  MR: "Miguel Reyes",
  CU: "Carla Uy",
  JA: "Jon Ababa",
  DL: "Dennis Lim",
  GT: "Grace Tan",
} as const;

type Initials = keyof typeof team;

function who(initials: Initials) {
  return { employee: team[initials], initials };
}

export const reportTeamMembers = Object.values(team);

const overtime: ReportRow[] = [];

const leave: ReportRow[] = [];

const locatorSlip: ReportRow[] = [];

// Weekly DTR roll-up per team member for September.
const timesheetWeeks: { start: string; label: string }[] = [
  { start: "2026-09-01", label: "Sept 1 – 5" },
  { start: "2026-09-07", label: "Sept 7 – 12" },
  { start: "2026-09-14", label: "Sept 14 – 19" },
  { start: "2026-09-21", label: "Sept 21 – 26" },
];

const timesheetSeed: Record<Initials, [present: number, absent: number, lates: number, lateMins: number, undertime: number, overtime: number][]> = {
  BS: [],
  MR: [],
  CU: [],
  JA: [],
  DL: [],
  GT: [],
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

const temporaryShift: ReportRow[] = [];

const brokenTime: ReportRow[] = [];

const offsetHours: ReportRow[] = [];

export const teamReports: Record<ReportId, ReportRow[]> = {
  overtime,
  leave,
  "locator-slip": locatorSlip,
  timesheet,
  "temporary-shift": temporaryShift,
  "broken-time": brokenTime,
  "offset-hours": offsetHours,
};
