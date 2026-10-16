// Transaction records behind the Partner "Reports" pages (none yet). Each report is a
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

export const reportTeamMembers: string[] = [];

export const teamReports: Record<ReportId, ReportRow[]> = {
  overtime: [],
  leave: [],
  "locator-slip": [],
  timesheet: [],
  "temporary-shift": [],
  "broken-time": [],
  "offset-hours": [],
};
