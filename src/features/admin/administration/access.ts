// Which access-matrix feature each page belongs to, so sidebars and routes can ask
// can(user, "view", feature). What each role may do is in lib/permissions.ts, nowhere else.

import { can, type Action, type Feature } from "@/lib/permissions";
import { REQUEST_TYPES } from "@/lib/requests/types";
import { useWho } from "@/lib/useCan";

const ATTENDANCE_REPORTS = ["attendance-logs", "overtime", "undertime", "time-adjustments", "tardiness"];

/**
 * The feature a page belongs to, in any workspace. null = no check of its own (old addresses that
 * redirect, Settings, which checks its sections itself).
 */
export function featureForPath(pathname: string): Feature | null {
  const [, ws = "", seg = "", sub = "", third = ""] = pathname.split("/");
  if (ws === "admin") {
    if (!seg) return "dashboard";
    if (seg === "maintenance") {
      if (sub === "people") return "people";
      if (sub === "departments") return "departments";
      if (sub === "locations") return "locations";
      if (sub === "org-chart") return "orgChart";
      if (sub === "documents") return "documents";
      if (sub === "rules") return "rules";
      if (sub === "leave") return third === "types" ? "leaveTypes" : third === "balances" ? "leaveBalances" : "leave";
      return null;
    }
    if (seg === "timekeeping") return sub === "remote" ? "remoteDays" : sub === "shifts" || sub === "schedules" ? "attendanceSettings" : null;
    if (seg === "payroll") return sub === "contributions" ? "contributions" : ["runs", "pay-details", "loans", "final-pay", "payouts", "year-end"].includes(sub) ? "payrollRuns" : null;
    if (seg === "reports") {
      if (sub === "payroll" || sub === "statutory") return "payrollReports";
      if (ATTENDANCE_REPORTS.includes(sub)) return "attendanceRecords";
      if (sub === "hr" || sub === "attendance" || sub === "management") return "analytics";
      return null;
    }
    if (seg === "requests") return (REQUEST_TYPES.find((t) => t.id === sub) ?? REQUEST_TYPES[0])!.feature;
    if (seg === "onboarding") return "trainings";
    if (seg === "administration") {
      if (sub === "users" || sub === "roles") return "roleAssignment";
      if (sub === "audit") return "audit";
      if (sub === "settings") return "systemSettings";
      if (sub === "subscription") return "subscription";
    }
    return null;
  }
  if (ws === "manager") {
    if (!seg) return "dashboard";
    if (seg === "approvals") return "claims";
    if (seg === "attendance" || seg === "attendance-approvals") return "attendanceRecords";
    if (seg === "calendar" || seg === "workforce" || seg === "performance" || seg === "cases") return "partnerTools";
    if (seg === "trainings") return "trainings";
    if (seg === "payroll") return "payrollRuns";
    if (seg === "reports") return "analytics";
    return null;
  }
  if (ws === "employee") {
    if (!seg) return "dashboard";
    if (seg === "leave") return "leave";
    if (seg === "attendance") return "attendanceRecords";
    if (seg === "payslips") return "payrollRuns";
    if (seg === "201-file") return "people";
    if (seg === "certificates" || seg === "benefits") return "selfService";
    if (seg === "trainings") return "trainings";
    if (seg === "reimbursements") return "claims";
    return null;
  }
  return null;
}

/** Pages that create records, so viewing the module isn't enough. */
const PAGE_ACTION: Record<string, Action> = { "/admin/maintenance/people/new": "create" };

/** The check a page needs: its feature and the action (view, or create for "add" pages). */
export function pageNeed(pathname: string): { feature: Feature; action: Action } | null {
  const feature = featureForPath(pathname);
  return feature ? { feature, action: PAGE_ACTION[pathname] ?? "view" } : null;
}

/** can(user, action, feature) for page paths: hides sidebar links and blocks pages. */
export function usePageAllowed() {
  const who = useWho();
  return (pathname: string) => {
    const need = pageNeed(pathname);
    return !need || can(who, need.action, need.feature);
  };
}

interface NavLike {
  to: string;
  children?: NavLike[];
}

/** Sidebar groups with only the pages this role may open (a module stays while any page does). */
export function filterNav<G extends { items: I[] }, I extends NavLike>(groups: G[], allowed: (to: string) => boolean): G[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items
        .map((i) => (i.children ? { ...i, children: i.children.filter((c) => allowed(c.to)) } : i))
        .filter((i) => (i.children ? i.children.length > 0 : allowed(i.to))),
    }))
    .filter((g) => g.items.length > 0);
}

/** Forms opened from another page's address (e.g. "Post announcement" lives on Home). */
const CREATE_FEATURE: Record<string, Feature> = { announcement: "announcements" };

/** Create-menu links this role may use: a "?create=" link needs Create on that form's feature. */
export function useCreateAllowed() {
  const who = useWho();
  return (to: string, action?: Action, feature?: Feature) => {
    const [path = "", query = ""] = to.split("?");
    const form = new URLSearchParams(query).get("create");
    const need = pageNeed(path);
    if (form && CREATE_FEATURE[form]) return can(who, "create", CREATE_FEATURE[form]);
    if (feature) return can(who, action ?? "view", feature);
    if (!need) return true;
    return can(who, action ?? (form ? "create" : need.action), need.feature);
  };
}
