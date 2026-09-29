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

const overtime: ReportRow[] = [
  { id: "ot-1", ...who("MR"), date: "2026-09-24", timeIn: "6:00 PM", timeOut: "8:30 PM", hours: 2.5, reason: "Q3 inventory count wrap-up", status: "Pending" },
  { id: "ot-2", ...who("MR"), date: "2026-09-22", timeIn: "6:00 PM", timeOut: "9:00 PM", hours: 3, reason: "Client fieldwork — Cebu Pacific Steel", status: "Approved" },
  { id: "ot-3", ...who("MR"), date: "2026-09-18", timeIn: "6:00 PM", timeOut: "10:00 PM", hours: 4, reason: "Year-end close support", status: "Approved" },
  { id: "ot-4", ...who("CU"), date: "2026-09-17", timeIn: "6:00 PM", timeOut: "8:00 PM", hours: 2, reason: "Review notes clearing", status: "Approved" },
  { id: "ot-5", ...who("BS"), date: "2026-09-15", timeIn: "6:00 PM", timeOut: "7:30 PM", hours: 1.5, reason: "Bank confirmation follow-ups", status: "Approved" },
  { id: "ot-6", ...who("JA"), date: "2026-09-12", timeIn: "9:00 AM", timeOut: "1:00 PM", hours: 4, reason: "Saturday stock count", status: "Approved" },
  { id: "ot-7", ...who("GT"), date: "2026-09-10", timeIn: "6:00 PM", timeOut: "8:00 PM", hours: 2, reason: "Working paper documentation", status: "Declined" },
  { id: "ot-8", ...who("CU"), date: "2026-09-05", timeIn: "6:00 PM", timeOut: "9:30 PM", hours: 3.5, reason: "Engagement planning memo", status: "Approved" },
  { id: "ot-9", ...who("DL"), date: "2026-08-28", timeIn: "6:00 PM", timeOut: "8:00 PM", hours: 2, reason: "Audit sampling", status: "Approved" },
];

const leave: ReportRow[] = [
  { id: "lv-1", ...who("BS"), date: "2026-10-06", leaveType: "Vacation", period: "Oct 6 – Oct 8", days: 3, filedOn: "Sept 21", status: "Pending" },
  { id: "lv-2", ...who("DL"), date: "2026-09-25", leaveType: "Emergency", period: "Sept 25", days: 1, filedOn: "Sept 25", status: "Pending" },
  { id: "lv-3", ...who("GT"), date: "2026-09-24", leaveType: "Vacation", period: "Sept 24 – Sept 30", days: 5, filedOn: "Sept 8", status: "Approved" },
  { id: "lv-4", ...who("CU"), date: "2026-09-22", leaveType: "Sick", period: "Sept 22", days: 1, filedOn: "Sept 22", status: "Pending" },
  { id: "lv-5", ...who("MR"), date: "2026-09-11", leaveType: "Vacation", period: "Sept 11", days: 1, filedOn: "Sept 2", status: "Approved" },
  { id: "lv-6", ...who("JA"), date: "2026-09-08", leaveType: "Sick", period: "Sept 8 – Sept 9", days: 2, filedOn: "Sept 10", status: "Approved" },
  { id: "lv-7", ...who("BS"), date: "2026-09-01", leaveType: "Birthday", period: "Sept 1", days: 1, filedOn: "Aug 20", status: "Approved" },
  { id: "lv-8", ...who("DL"), date: "2026-09-03", leaveType: "Vacation", period: "Sept 3 – Sept 4", days: 2, filedOn: "Sept 1", status: "Declined" },
  { id: "lv-9", ...who("CU"), date: "2026-08-17", leaveType: "Vacation", period: "Aug 17 – Aug 19", days: 3, filedOn: "Aug 3", status: "Approved" },
];

const locatorSlip: ReportRow[] = [
  { id: "ls-1", ...who("BS"), date: "2026-09-24", destination: "Mandaue client site", purpose: "Inventory observation", timeOut: "1:00 PM", timeIn: "6:15 PM", status: "Approved" },
  { id: "ls-2", ...who("JA"), date: "2026-09-23", destination: "BIR RDO 81, Cebu City", purpose: "Filing of client returns", timeOut: "9:30 AM", timeIn: "11:45 AM", status: "Approved" },
  { id: "ls-3", ...who("MR"), date: "2026-09-21", destination: "Cebu Pacific Steel, Talisay", purpose: "Fieldwork — cash count", timeOut: "8:30 AM", timeIn: "4:00 PM", status: "Approved" },
  { id: "ls-4", ...who("CU"), date: "2026-09-19", destination: "SEC Cebu Extension Office", purpose: "Document retrieval", timeOut: "2:00 PM", timeIn: "4:30 PM", status: "Pending" },
  { id: "ls-5", ...who("GT"), date: "2026-09-16", destination: "BDO IT Park Branch", purpose: "Bank confirmation", timeOut: "10:00 AM", timeIn: "11:30 AM", status: "Approved" },
  { id: "ls-6", ...who("DL"), date: "2026-09-14", destination: "Lapu-Lapu client warehouse", purpose: "Fixed asset tagging", timeOut: "8:00 AM", timeIn: "5:30 PM", status: "Approved" },
  { id: "ls-7", ...who("JA"), date: "2026-09-09", destination: "SSS Cebu Branch", purpose: "Personal errand", timeOut: "3:00 PM", timeIn: "5:00 PM", status: "Declined" },
];

// Weekly DTR roll-up per team member for September.
const timesheetWeeks: { start: string; label: string }[] = [
  { start: "2026-09-01", label: "Sept 1 – 5" },
  { start: "2026-09-07", label: "Sept 7 – 12" },
  { start: "2026-09-14", label: "Sept 14 – 19" },
  { start: "2026-09-21", label: "Sept 21 – 26" },
];

const timesheetSeed: Record<Initials, [present: number, absent: number, lates: number, lateMins: number, undertime: number, overtime: number][]> = {
  BS: [[4, 1, 0, 0, 0, 0], [5, 0, 1, 12, 0, 0], [5, 0, 0, 0, 0, 1.5], [3, 2, 0, 0, 0, 0]],
  MR: [[5, 0, 1, 8, 0, 0], [4, 1, 0, 0, 0, 0], [5, 0, 2, 25, 0, 4], [5, 0, 1, 64, 0, 5.5]],
  CU: [[5, 0, 0, 0, 0, 3.5], [5, 0, 0, 0, 0, 0], [5, 0, 1, 6, 0, 2], [4, 1, 1, 32, 0, 0]],
  JA: [[5, 0, 0, 0, 30, 0], [3, 2, 0, 0, 0, 4], [5, 0, 0, 0, 0, 0], [5, 0, 0, 0, 0, 0]],
  DL: [[3, 2, 2, 41, 0, 0], [5, 0, 1, 18, 45, 0], [5, 0, 2, 100, 0, 0], [4, 1, 0, 0, 0, 0]],
  GT: [[5, 0, 0, 0, 0, 0], [5, 0, 0, 0, 0, 2], [5, 0, 0, 0, 0, 0], [2, 3, 0, 0, 0, 0]],
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
  { id: "tsh-1", ...who("MR"), date: "2026-09-28", effective: "Sept 28 – Oct 9", regularShift: "8:30 AM – 5:30 PM", temporaryShift: "10:00 AM – 7:00 PM", reason: "Client with late-afternoon cutoff", status: "Pending" },
  { id: "tsh-2", ...who("CU"), date: "2026-09-21", effective: "Sept 21 – Sept 25", regularShift: "8:30 AM – 5:30 PM", temporaryShift: "7:00 AM – 4:00 PM", reason: "Evening review course", status: "Approved" },
  { id: "tsh-3", ...who("JA"), date: "2026-09-14", effective: "Sept 14 – Sept 18", regularShift: "8:30 AM – 5:30 PM", temporaryShift: "6:00 AM – 3:00 PM", reason: "Warehouse count starts at dawn", status: "Approved" },
  { id: "tsh-4", ...who("GT"), date: "2026-09-07", effective: "Sept 7 – Sept 11", regularShift: "8:30 AM – 5:30 PM", temporaryShift: "9:30 AM – 6:30 PM", reason: "Medical appointments", status: "Approved" },
  { id: "tsh-5", ...who("DL"), date: "2026-09-02", effective: "Sept 2 – Sept 4", regularShift: "8:30 AM – 5:30 PM", temporaryShift: "11:00 AM – 8:00 PM", reason: "Personal preference", status: "Declined" },
];

const brokenTime: ReportRow[] = [
  { id: "bt-1", ...who("BS"), date: "2026-09-25", firstBlock: "8:00 AM – 12:00 PM", secondBlock: "4:00 PM – 8:00 PM", hours: 8, reason: "Child's school event mid-day", status: "Pending" },
  { id: "bt-2", ...who("CU"), date: "2026-09-18", firstBlock: "7:30 AM – 11:30 AM", secondBlock: "2:30 PM – 6:30 PM", hours: 8, reason: "CPA board review session", status: "Approved" },
  { id: "bt-3", ...who("DL"), date: "2026-09-15", firstBlock: "8:30 AM – 12:30 PM", secondBlock: "3:00 PM – 7:00 PM", hours: 8, reason: "LTO licence renewal", status: "Approved" },
  { id: "bt-4", ...who("MR"), date: "2026-09-10", firstBlock: "8:00 AM – 11:00 AM", secondBlock: "1:00 PM – 6:00 PM", hours: 8, reason: "Dental procedure", status: "Approved" },
  { id: "bt-5", ...who("JA"), date: "2026-09-04", firstBlock: "8:30 AM – 12:00 PM", secondBlock: "5:00 PM – 9:00 PM", hours: 7.5, reason: "Family errand", status: "Declined" },
];

const offsetHours: ReportRow[] = [
  { id: "oh-1", ...who("MR"), date: "2026-09-26", earnedFrom: "Sept 18 overtime", hoursEarned: 4, dateUsed: "Sept 26 (PM)", hoursUsed: 4, balance: 0, status: "Approved" },
  { id: "oh-2", ...who("JA"), date: "2026-09-19", earnedFrom: "Sept 12 Saturday count", hoursEarned: 4, dateUsed: "Sept 19 (AM)", hoursUsed: 4, balance: 0, status: "Approved" },
  { id: "oh-3", ...who("CU"), date: "2026-09-29", earnedFrom: "Sept 5 overtime", hoursEarned: 3.5, dateUsed: "Oct 2 (PM)", hoursUsed: 3, balance: 0.5, status: "Pending" },
  { id: "oh-4", ...who("BS"), date: "2026-09-22", earnedFrom: "Sept 15 overtime", hoursEarned: 1.5, dateUsed: "—", hoursUsed: 0, balance: 1.5, status: "Approved" },
  { id: "oh-5", ...who("CU"), date: "2026-09-17", earnedFrom: "Sept 17 overtime", hoursEarned: 2, dateUsed: "Sept 24 (AM)", hoursUsed: 2, balance: 0, status: "Approved" },
  { id: "oh-6", ...who("MR"), date: "2026-09-22", earnedFrom: "Sept 22 overtime", hoursEarned: 3, dateUsed: "—", hoursUsed: 0, balance: 3, status: "Approved" },
  { id: "oh-7", ...who("GT"), date: "2026-09-12", earnedFrom: "Sept 10 overtime", hoursEarned: 2, dateUsed: "Sept 12 (PM)", hoursUsed: 2, balance: 0, status: "Declined" },
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
