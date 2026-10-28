// The approver's Home numbers for their own team (direct reports), from the real records:
// who they are, who's on leave, and the team's attendance over the last two weeks.

import { fullName, initialsOf, refreshCoreHr, state as core } from "./corehr/store";
import { leave, refreshLeave } from "./leave/store";
import { currentEmployee } from "./mockData";
import { sessionWho } from "./session";
import { listDays } from "./timekeeping/api";
import { branchOf, departmentOf } from "./timekeeping/store";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The signed-in manager: name, position, department and office, for the Home header. */
export function managerProfile() {
  const id = sessionWho().employeeId;
  const e = core.employees.find((x) => x.id === id);
  // The backend lists an approver's team, not the approver: their own record is the signed-in "me" (lib/backend/auth.ts).
  if (!e) return id && currentEmployee.id === id ? { name: currentEmployee.name, title: currentEmployee.position, department: currentEmployee.department || "My team", office: currentEmployee.office } : null;
  return {
    name: fullName(e.personal),
    title: core.positions.find((p) => p.id === e.job.positionId)?.title ?? "",
    department: departmentOf(e.job.unitId)?.name ?? "My team",
    office: branchOf(e.job.unitId),
  };
}

/** Loads the team and their leave from the server first (both no-ops with demo data), so the figures are real. */
export const loadTeamData = () => Promise.all([refreshCoreHr(2000), refreshLeave(2000)]).then(() => undefined);

const team = () => core.employees.filter((e) => sessionWho().team.includes(e.id) && e.job.status !== "Separated");
export const teamSize = () => team().length;

/** Team members on approved leave today, with the leave type and its last day. */
export async function teamOnLeaveToday() {
  await loadTeamData();
  const today = iso(new Date());
  return team().flatMap((e) => {
    const r = leave.requests.find((x) => x.employeeId === e.id && x.status === "approved" && x.start <= today && x.end >= today);
    if (!r) return [];
    const type = leave.types.find((t) => t.id === r.typeId)?.name ?? "Leave";
    const end = new Date(`${r.end}T12:00:00`);
    return [{ name: fullName(e.personal), initials: initialsOf(e.personal), reason: r.end === today ? `${type} · back tomorrow` : `${type} · until ${SHORT[end.getMonth()]} ${end.getDate()}` }];
  });
}

/** How many of the team have approved leave this week (Monday to Sunday). */
export function teamLeaveThisWeek() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const from = iso(monday);
  const to = iso(sunday);
  return team().filter((e) => leave.requests.some((r) => r.employeeId === e.id && r.status === "approved" && r.start <= to && r.end >= from)).length;
}

/** On-time rate per workday over the last 14 days, the overall attendance rate, and late arrivals in the last 7 days. */
export async function teamAttendanceTrend(): Promise<{ points: { date: string; rate: number }[]; rate: number; lateThisWeek: number }> {
  await loadTeamData();
  const ids = new Set(team().map((e) => e.id));
  const to = new Date();
  const from = new Date(to.getTime() - 13 * 86_400_000);
  const days = (await listDays(iso(from), iso(to))).filter((d) => ids.has(d.person.id) && d.kind === "work" && d.status !== "upcoming");
  const byDate = new Map<string, typeof days>();
  for (const d of days) byDate.set(d.date, [...(byDate.get(d.date) ?? []), d]);
  const present = (d: (typeof days)[number]) => d.status === "done" || d.status === "working";
  const points = [...byDate]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => {
      const dt = new Date(`${date}T12:00:00`);
      const onTime = list.filter((d) => present(d) && d.lateMinutes === 0).length;
      return { date: `${SHORT[dt.getMonth()]} ${dt.getDate()}`, rate: Math.round((onTime / list.length) * 100) };
    });
  const rate = days.length ? Math.round((days.filter(present).length / days.length) * 100) : 0;
  const weekAgo = iso(new Date(to.getTime() - 6 * 86_400_000));
  const lateThisWeek = days.filter((d) => d.date >= weekAgo && d.lateMinutes > 0).length;
  return { points, rate, lateThisWeek };
}

/** The team roster for the manager's Home: position, tenure, email and whether they're in. */
export function teamRosterFromCore() {
  const today = iso(new Date());
  const now = new Date();
  return team()
    .map((e) => {
      const hired = new Date(`${e.job.dateHired}T12:00:00`);
      const months = (now.getFullYear() - hired.getFullYear()) * 12 + now.getMonth() - hired.getMonth() - (now.getDate() < hired.getDate() ? 1 : 0);
      const y = Math.floor(months / 12);
      const m = months % 12;
      const away = e.job.status === "On leave" || leave.requests.some((r) => r.employeeId === e.id && r.status === "approved" && r.start <= today && r.end >= today);
      return {
        id: e.id,
        name: fullName(e.personal),
        initials: initialsOf(e.personal),
        position: core.positions.find((p) => p.id === e.job.positionId)?.title ?? "",
        tenureLabel: y ? `${y} yr${y > 1 ? "s" : ""}${m ? ` ${m} mo${m > 1 ? "s" : ""}` : ""}` : `${Math.max(0, m)} mo${m === 1 ? "" : "s"}`,
        email: e.contact.workEmail,
        status: (away ? "On leave" : "Active") as "Active" | "On leave",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
