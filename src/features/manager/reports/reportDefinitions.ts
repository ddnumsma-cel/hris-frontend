import type { ReportId, ReportRow, ReportStatus } from "@/lib/reportsData";

type Tone = "good" | "warn" | "crit" | "neutral";

export interface ReportColumn {
  key: string;
  header: string;
  kind?: "date" | "employee" | "number" | "status";
  /** Unit shown after numbers in the table, e.g. "h" for hours. */
  unit?: string;
}

export interface ReportSummaryTile {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}

export interface ReportDefinition {
  id: ReportId;
  label: string;
  description: string;
  columns: ReportColumn[];
  hasStatus: boolean;
  summarize: (rows: ReportRow[]) => ReportSummaryTile[];
}

function sum(rows: ReportRow[], key: string) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function withStatus(rows: ReportRow[], status: ReportStatus) {
  return rows.filter((row) => row.status === status);
}

function hours(value: number) {
  return `${Math.round(value * 10) / 10} h`;
}

/** The value that shows up most often in `key`, e.g. the most common leave type. */
function mostCommon(rows: ReportRow[], key: string, weightKey?: string) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const value = String(row[key]);
    totals.set(value, (totals.get(value) ?? 0) + (weightKey ? Number(row[weightKey] ?? 0) : 1));
  }
  let best: [string, number] | null = null;
  for (const entry of totals) if (!best || entry[1] > best[1]) best = entry;
  return best;
}

/** "1:30 PM" → minutes since midnight. */
function toMinutes(time: string) {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(time);
  if (!match) return 0;
  const hour = (Number(match[1]) % 12) + (match[3] === "PM" ? 12 : 0);
  return hour * 60 + Number(match[2]);
}

function pendingTile(rows: ReportRow[]): ReportSummaryTile {
  const pending = withStatus(rows, "Pending").length;
  return {
    label: "Pending approval",
    value: pending,
    hint: pending ? "Awaiting your review" : "All caught up",
    tone: pending ? "warn" : "good",
  };
}

export const reportDefinitions: ReportDefinition[] = [
  {
    id: "overtime",
    label: "Overtime",
    description: "Overtime filed by your team, with hours rendered and approval status.",
    hasStatus: true,
    columns: [
      { key: "date", header: "Date", kind: "date" },
      { key: "employee", header: "Employee", kind: "employee" },
      { key: "timeIn", header: "Start" },
      { key: "timeOut", header: "End" },
      { key: "hours", header: "Hours", kind: "number", unit: "h" },
      { key: "reason", header: "Reason" },
      { key: "status", header: "Status", kind: "status" },
    ],
    summarize: (rows) => {
      const approved = withStatus(rows, "Approved");
      const top = mostCommon(approved, "employee", "hours");
      return [
        { label: "Approved overtime", value: hours(sum(approved, "hours")), hint: `${approved.length} approved requests` },
        { label: "Requests filed", value: rows.length, hint: `${hours(sum(rows, "hours"))} requested in total` },
        pendingTile(rows),
        { label: "Most overtime", value: top ? top[0] : "—", hint: top ? `${hours(top[1])} approved` : "No approved overtime" },
      ];
    },
  },
  {
    id: "leave",
    label: "Leave",
    description: "Leave applications by type, covered dates and approval status.",
    hasStatus: true,
    columns: [
      { key: "date", header: "Start date", kind: "date" },
      { key: "employee", header: "Employee", kind: "employee" },
      { key: "leaveType", header: "Leave type" },
      { key: "period", header: "Period" },
      { key: "days", header: "Days", kind: "number" },
      { key: "filedOn", header: "Filed on" },
      { key: "status", header: "Status", kind: "status" },
    ],
    summarize: (rows) => {
      const approved = withStatus(rows, "Approved");
      const common = mostCommon(rows, "leaveType");
      return [
        { label: "Days approved", value: sum(approved, "days"), hint: `${approved.length} approved applications` },
        { label: "Applications", value: rows.length, hint: `${sum(rows, "days")} days requested` },
        pendingTile(rows),
        { label: "Most common type", value: common ? common[0] : "—", hint: common ? `${common[1]} applications` : undefined },
      ];
    },
  },
  {
    id: "locator-slip",
    label: "Locator Slip",
    description: "Official business trips out of the office — where, why and for how long.",
    hasStatus: true,
    columns: [
      { key: "date", header: "Date", kind: "date" },
      { key: "employee", header: "Employee", kind: "employee" },
      { key: "destination", header: "Destination" },
      { key: "purpose", header: "Purpose" },
      { key: "timeOut", header: "Time out" },
      { key: "timeIn", header: "Time in" },
      { key: "status", header: "Status", kind: "status" },
    ],
    summarize: (rows) => {
      const approved = withStatus(rows, "Approved");
      const minutesOut = approved.reduce(
        (total, row) => total + Math.max(0, toMinutes(String(row.timeIn)) - toMinutes(String(row.timeOut))),
        0,
      );
      const top = mostCommon(rows, "employee");
      return [
        { label: "Slips filed", value: rows.length, hint: `${approved.length} approved` },
        { label: "Time out of office", value: hours(minutesOut / 60), hint: "On approved slips" },
        pendingTile(rows),
        { label: "Most trips", value: top ? top[0] : "—", hint: top ? `${top[1]} slips` : undefined },
      ];
    },
  },
  {
    id: "timesheet",
    label: "Timesheet",
    description: "Weekly DTR summary per team member — attendance, tardiness and hours worked.",
    hasStatus: false,
    columns: [
      { key: "week", header: "Week" },
      { key: "employee", header: "Employee", kind: "employee" },
      { key: "present", header: "Present", kind: "number", unit: "d" },
      { key: "absent", header: "Absent", kind: "number", unit: "d" },
      { key: "lates", header: "Lates", kind: "number" },
      { key: "lateMins", header: "Late", kind: "number", unit: "m" },
      { key: "undertimeMins", header: "Undertime", kind: "number", unit: "m" },
      { key: "hoursWorked", header: "Hours worked", kind: "number", unit: "h" },
      { key: "overtimeHours", header: "Overtime", kind: "number", unit: "h" },
    ],
    summarize: (rows) => {
      const present = sum(rows, "present");
      const scheduled = present + sum(rows, "absent");
      const rate = scheduled ? Math.round((present / scheduled) * 100) : 0;
      return [
        { label: "Hours worked", value: hours(sum(rows, "hoursWorked")), hint: `${present} days present` },
        {
          label: "Attendance rate",
          value: `${rate}%`,
          hint: `${sum(rows, "absent")} days absent`,
          tone: rate >= 90 ? "good" : rate >= 80 ? "warn" : "crit",
        },
        {
          label: "Late incidents",
          value: sum(rows, "lates"),
          hint: `${sum(rows, "lateMins")} minutes in total`,
          tone: sum(rows, "lates") > 8 ? "warn" : "neutral",
        },
        { label: "Overtime rendered", value: hours(sum(rows, "overtimeHours")), hint: `${sum(rows, "undertimeMins")} min undertime` },
      ];
    },
  },
  {
    id: "temporary-shift",
    label: "Temporary Shift",
    description: "Short-term schedule changes requested against each member's regular shift.",
    hasStatus: true,
    columns: [
      { key: "date", header: "Starts", kind: "date" },
      { key: "employee", header: "Employee", kind: "employee" },
      { key: "effective", header: "Effective" },
      { key: "regularShift", header: "Regular shift" },
      { key: "temporaryShift", header: "Temporary shift" },
      { key: "reason", header: "Reason" },
      { key: "status", header: "Status", kind: "status" },
    ],
    summarize: (rows) => [
      { label: "Requests", value: rows.length, hint: "Schedule changes filed" },
      { label: "Approved", value: withStatus(rows, "Approved").length, tone: "good" },
      pendingTile(rows),
      { label: "Declined", value: withStatus(rows, "Declined").length, tone: withStatus(rows, "Declined").length ? "crit" : "neutral" },
    ],
  },
  {
    id: "broken-time",
    label: "Broken Time",
    description: "Split working days where the shift is served in two separate blocks.",
    hasStatus: true,
    columns: [
      { key: "date", header: "Date", kind: "date" },
      { key: "employee", header: "Employee", kind: "employee" },
      { key: "firstBlock", header: "First block" },
      { key: "secondBlock", header: "Second block" },
      { key: "hours", header: "Hours", kind: "number", unit: "h" },
      { key: "reason", header: "Reason" },
      { key: "status", header: "Status", kind: "status" },
    ],
    summarize: (rows) => {
      const approved = withStatus(rows, "Approved");
      return [
        { label: "Requests", value: rows.length, hint: "Split-shift days filed" },
        { label: "Hours covered", value: hours(sum(approved, "hours")), hint: `${approved.length} approved days` },
        pendingTile(rows),
        { label: "Declined", value: withStatus(rows, "Declined").length, tone: withStatus(rows, "Declined").length ? "crit" : "neutral" },
      ];
    },
  },
  {
    id: "offset-hours",
    label: "Offset Hours",
    description: "Overtime converted to time off — hours earned, used and still available.",
    hasStatus: true,
    columns: [
      { key: "date", header: "Date", kind: "date" },
      { key: "employee", header: "Employee", kind: "employee" },
      { key: "earnedFrom", header: "Earned from" },
      { key: "hoursEarned", header: "Earned", kind: "number", unit: "h" },
      { key: "dateUsed", header: "Used on" },
      { key: "hoursUsed", header: "Used", kind: "number", unit: "h" },
      { key: "balance", header: "Balance", kind: "number", unit: "h" },
      { key: "status", header: "Status", kind: "status" },
    ],
    summarize: (rows) => {
      const approved = withStatus(rows, "Approved");
      return [
        { label: "Hours earned", value: hours(sum(approved, "hoursEarned")), hint: "From approved overtime" },
        { label: "Hours used", value: hours(sum(approved, "hoursUsed")), hint: "Taken as time off" },
        { label: "Unused balance", value: hours(sum(approved, "balance")), hint: "Still available to the team", tone: "good" },
        pendingTile(rows),
      ];
    },
  },
];

export function getReportDefinition(id: string | undefined) {
  return reportDefinitions.find((d) => d.id === id);
}
