// The approver's team pages from the real records (with the backend): who's on leave, the leave schedule, workforce
// alerts from attendance, team reports, and the shared team list and stats some screens read directly.

import { fullName, initialsOf, state as core } from "./corehr/store";
import { leave } from "./leave/store";
import { currentEmployee, managerTeamStats, setCurrentManager, teamRoster } from "./mockData";
import { reportTeamMembers, type ReportId, type ReportRow } from "./reportsData";
import { sessionWho } from "./session";
import { listDays, listRequests } from "./timekeeping/api";
import type { LeaveRequest as TeamLeaveRequest, WorkforceAlert } from "./types";
import { loadTeamData, teamRosterFromCore } from "./teamFigures";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ago = (days: number) => iso(new Date(Date.now() - days * 86_400_000));
const team = () => core.employees.filter((e) => sessionWho().team.includes(e.id) && e.job.status !== "Separated");
const positionOf = (positionId: string) => core.positions.find((p) => p.id === positionId)?.title ?? "";
const time = (isoAt?: string) => (isoAt ? new Date(isoAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }) : "");
const short = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

/**
 * Some approver screens read the shared team list and stats directly (they were demo values): fill them with the
 * real team, and make the signed-in approver their own "manager profile" (account settings, who filed a case).
 */
export function syncTeamShared(attendanceRate?: number) {
  const roster = teamRosterFromCore();
  teamRoster.splice(0, teamRoster.length, ...roster);
  managerTeamStats.teamHeadcount = roster.length;
  managerTeamStats.onLeaveToday = roster.filter((r) => r.status === "On leave").length;
  if (attendanceRate !== undefined) managerTeamStats.attendanceRate = attendanceRate;
  if (currentEmployee.id) {
    setCurrentManager({ name: currentEmployee.name, initials: currentEmployee.initials, title: currentEmployee.position, email: currentEmployee.email ?? "", phone: currentEmployee.phone ?? "", office: currentEmployee.office, emergencyContact: currentEmployee.emergencyContact ?? "", about: "" });
  }
}

/** The team's approved leave, newest first (Team calendar). */
export async function teamLeaveSchedule(): Promise<TeamLeaveRequest[]> {
  await loadTeamData();
  syncTeamShared();
  const members = new Map(team().map((e) => [e.id, e]));
  return leave.requests
    .filter((r) => members.has(r.employeeId) && r.status === "approved")
    .map((r) => {
      const e = members.get(r.employeeId)!;
      return {
        id: r.id,
        employeeName: fullName(e.personal),
        employeeInitials: initialsOf(e.personal),
        employeeRole: positionOf(e.job.positionId),
        type: (leave.types.find((t) => t.id === r.typeId)?.name ?? "Leave") as TeamLeaveRequest["type"],
        detail: `${r.days} day${r.days === 1 ? "" : "s"}${r.start === r.end ? ` · ${short(r.start)}` : ` · ${short(r.start)} – ${short(r.end)}`}`,
        status: "Approved" as const,
        requestedOn: r.filedAt.slice(0, 10),
        startDate: r.start,
        endDate: r.end,
        days: r.days,
      };
    })
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
}

/** Things worth the approver's attention, from the team's real attendance over the last two weeks. */
export async function teamWorkforceAlerts(): Promise<WorkforceAlert[]> {
  await loadTeamData();
  const members = team();
  const ids = new Set(members.map((m) => m.id));
  const days = (await listDays(ago(13), iso(new Date()))).filter((d) => ids.has(d.person.id));
  const weekAgo = ago(6);
  const alerts: WorkforceAlert[] = [];
  for (const m of members) {
    const mine = days.filter((d) => d.person.id === m.id);
    const base = { employeeName: fullName(m.personal), employeeInitials: initialsOf(m.personal) };
    const lates = mine.filter((d) => d.date >= weekAgo && d.lateMinutes > 0);
    if (lates.length >= 2) {
      const avg = Math.round(lates.reduce((n, d) => n + d.lateMinutes, 0) / lates.length);
      alerts.push({ id: `late-${m.id}`, ...base, category: "Punctuality", message: `${lates.length} late clock-ins in the last 7 days (average ${avg} min)`, severity: lates.length >= 3 ? "crit" : "warn", detectedLabel: "Last 7 days" });
    }
    const absent = mine.filter((d) => d.status === "absent");
    if (absent.length) {
      alerts.push({ id: `absent-${m.id}`, ...base, category: "Attendance", message: `${absent.length} absence${absent.length === 1 ? "" : "s"} without filed leave in the last 14 days (${absent.map((d) => short(d.date)).join(", ")})`, severity: absent.length >= 2 ? "crit" : "warn", detectedLabel: "Last 14 days" });
    }
    const overtime = mine.filter((d) => d.date >= weekAgo).reduce((n, d) => n + d.approvedOvertimeMinutes, 0);
    if (overtime >= 600) {
      alerts.push({ id: `ot-${m.id}`, ...base, category: "Overtime", message: `${(overtime / 60).toFixed(1)} hours of approved overtime in the last 7 days`, severity: overtime >= 900 ? "warn" : "info", detectedLabel: "Last 7 days" });
    }
  }
  const rank = { crit: 0, warn: 1, info: 2 } as const;
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || a.employeeName.localeCompare(b.employeeName));
}

/**
 * The approver's reports from real records: overtime (the team's overtime requests), leave, and a weekly timesheet
 * from the daily attendance. Locator slips, temporary shifts, broken time and offset hours aren't kept anywhere
 * yet, so those reports are empty rather than showing demo rows.
 */
export async function teamReport(id: ReportId): Promise<ReportRow[]> {
  await loadTeamData();
  const members = new Map(team().map((e) => [e.id, e]));
  // The report's employee filter lists the real team (it reads this shared list directly).
  (reportTeamMembers as string[]).splice(0, reportTeamMembers.length, ...[...members.values()].map((e) => fullName(e.personal)).sort((a, b) => a.localeCompare(b)));
  const who = (employeeId: string) => {
    const e = members.get(employeeId)!;
    return { employee: fullName(e.personal), initials: initialsOf(e.personal) };
  };
  const status = (s: string) => (s === "approved" ? "Approved" : s === "pending" ? "Pending" : "Declined") as ReportRow["status"];
  if (id === "overtime") {
    return (await listRequests())
      .filter((r) => r.type === "overtime" && members.has(r.employeeId))
      .map((r) => ({ id: r.id, ...who(r.employeeId), date: r.date, timeIn: time(r.startAt), timeOut: time(r.endAt), hours: Math.round((r.minutes / 60) * 10) / 10, reason: r.reason, status: status(r.status) }));
  }
  if (id === "leave") {
    return leave.requests
      .filter((r) => members.has(r.employeeId) && r.status !== "cancelled")
      .map((r) => ({ id: r.id, ...who(r.employeeId), date: r.start, leaveType: leave.types.find((t) => t.id === r.typeId)?.name ?? "Leave", period: r.start === r.end ? short(r.start) : `${short(r.start)} – ${short(r.end)}`, days: r.days, filedOn: r.filedAt.slice(0, 10), status: status(r.status) }));
  }
  if (id === "timesheet") {
    // The last 8 weeks, Monday to Sunday, one row per person per week.
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 7 * 7);
    const days = (await listDays(iso(monday), iso(today))).filter((d) => members.has(d.person.id));
    const rows = new Map<string, ReportRow>();
    for (const d of days) {
      const dt = new Date(`${d.date}T12:00:00`);
      const start = new Date(dt);
      start.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const key = `${d.person.id}|${iso(start)}`;
      const row = rows.get(key) ?? { id: key, ...who(d.person.id), date: iso(start), week: `${short(iso(start))} – ${short(iso(end))}`, present: 0, absent: 0, lates: 0, lateMins: 0, undertimeMins: 0, hoursWorked: 0, overtimeHours: 0 };
      if (d.status === "done" || d.status === "working") row.present = Number(row.present) + 1;
      if (d.status === "absent") row.absent = Number(row.absent) + 1;
      if (d.lateMinutes > 0) row.lates = Number(row.lates) + 1;
      row.lateMins = Number(row.lateMins) + d.lateMinutes;
      row.undertimeMins = Number(row.undertimeMins) + d.undertimeMinutes;
      row.hoursWorked = Math.round((Number(row.hoursWorked) + d.workedMinutes / 60) * 10) / 10;
      row.overtimeHours = Math.round((Number(row.overtimeHours) + d.approvedOvertimeMinutes / 60) * 10) / 10;
      rows.set(key, row);
    }
    return [...rows.values()].sort((a, b) => b.date.localeCompare(a.date) || a.employee.localeCompare(b.employee));
  }
  return [];
}
