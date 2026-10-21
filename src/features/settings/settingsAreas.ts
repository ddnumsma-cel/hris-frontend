// Which settings areas and sections someone has. Kept apart from SettingsLayout so the top bar's
// gear menu can use it without pulling the (lazy-loaded) Settings page into the main bundle.

import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/lib/permissions";
import { useWho } from "@/lib/useCan";

export interface SectionLink {
  path: string;
  label: string;
}

const PERSONAL: SectionLink[] = [
  { path: "account", label: "Account" },
  { path: "security", label: "Security" },
  { path: "notifications", label: "Notifications" },
  { path: "appearance", label: "Appearance" },
];

export type WorkspaceSection = "organization" | "time-off" | "scheduling" | "roles" | "data" | "subscription";
/** "hr": HR rules (leave, scheduling). "admin": system administration (company, access, data). */
export type SettingsAreaKey = "my" | "hr" | "admin";

const WORKSPACE: (SectionLink & { path: WorkspaceSection; area: "hr" | "admin" })[] = [
  { path: "time-off", label: "Time off & leave", area: "hr" },
  { path: "scheduling", label: "Scheduling", area: "hr" },
  { path: "organization", label: "Organization", area: "admin" },
  { path: "roles", label: "Roles & permissions", area: "admin" },
  { path: "data", label: "Data & privacy", area: "admin" },
  { path: "subscription", label: "Subscription", area: "admin" },
];

/**
 * Workspace sections this person may open (HR workspace only), from the access matrix
 * (lib/permissions.ts): Organization and Data for those who manage system settings, Time off and
 * Scheduling for those who manage the rules and attendance setup, Roles for role assignment.
 */
export function useWorkspaceSections() {
  const { user } = useAuth();
  const who = useWho();
  if (user?.role !== "admin") return [];
  const allowed: Record<WorkspaceSection, boolean> = {
    organization: can(who, "edit", "systemSettings"),
    "time-off": can(who, "edit", "rules") || can(who, "edit", "leaveTypes"),
    scheduling: can(who, "edit", "rules") || can(who, "edit", "attendanceSettings"),
    roles: can(who, "view", "roleAssignment"),
    data: can(who, "edit", "systemSettings"),
    // The company's own plan: Super Admin and HR. System Admins manage every client's elsewhere.
    subscription: can(who, "view", "subscription") && !can(who, "view", "clients"),
  };
  // HR has no Admin settings, so their (read-only) Subscription sits with their HR settings.
  const adminArea = can(who, "edit", "systemSettings");
  return WORKSPACE.filter((s) => allowed[s.path]).map((s) => (s.path === "subscription" && !adminArea ? { ...s, area: "hr" as const } : s));
}

export interface SettingsArea {
  key: SettingsAreaKey;
  label: string;
  /** HR and Admin areas only: these change things for everyone. */
  badge?: string;
  note?: string;
  items: SectionLink[];
}

/**
 * The settings areas someone has: everyone gets My settings; HR settings and Admin settings
 * appear only with that access, so employees see just their own settings.
 */
export function useSettingsAreas(): SettingsArea[] {
  const workspace = useWorkspaceSections();
  const hr = workspace.filter((s) => s.area === "hr");
  const admin = workspace.filter((s) => s.area === "admin");
  const areas: SettingsArea[] = [{ key: "my", label: "My settings", items: PERSONAL }];
  if (hr.length) areas.push({ key: "hr", label: "HR settings", badge: "HR only", note: "Leave and scheduling rules. Changes apply to everyone in the company.", items: hr });
  if (admin.length) areas.push({ key: "admin", label: "Admin settings", badge: "Admin only", note: "Company details, who can do what, and company data. Changes apply to everyone.", items: admin });
  return areas;
}
