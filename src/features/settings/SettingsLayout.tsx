// The Settings page. Everyone has My settings; HR and Admin also get their own areas (tabs at the
// top, marked "HR only" / "Admin only"), so employees only ever see their personal settings. Each
// area lists its sections on the left (a select on phones), the chosen section on the right. Lives inside each workspace (/admin/settings, /employee/settings,
// /manager/settings) so the sidebar stays; /settings/... redirects there.

import type { ReactNode } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { can } from "@/lib/permissions";
import { useWho } from "@/lib/useCan";

interface SectionLink {
  path: string;
  label: string;
}

const PERSONAL: SectionLink[] = [
  { path: "account", label: "Account" },
  { path: "security", label: "Security" },
  { path: "notifications", label: "Notifications" },
  { path: "appearance", label: "Appearance" },
];

export type WorkspaceSection = "organization" | "time-off" | "scheduling" | "roles" | "data";
/** "hr": HR rules (leave, scheduling). "admin": system administration (company, access, data). */
export type SettingsAreaKey = "my" | "hr" | "admin";

const WORKSPACE: (SectionLink & { path: WorkspaceSection; area: "hr" | "admin" })[] = [
  { path: "time-off", label: "Time off & leave", area: "hr" },
  { path: "scheduling", label: "Scheduling", area: "hr" },
  { path: "organization", label: "Organization", area: "admin" },
  { path: "roles", label: "Roles & permissions", area: "admin" },
  { path: "data", label: "Data & privacy", area: "admin" },
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
  };
  return WORKSPACE.filter((s) => allowed[s.path]);
}

/** True when there's at least one workspace section to show. */
export const useCanManageWorkspace = () => useWorkspaceSections().length > 0;

interface SettingsArea {
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

const badgeClass = "flex-none rounded-[var(--radius-pill)] bg-brand-tint px-2 py-0.5 text-[11px] font-semibold text-brand-ink";

export function SettingsLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const areas = useSettingsAreas();
  if (!user) return null;
  const base = `/${user.role}/settings`;
  const current = pathname.slice(base.length + 1).split("/")[0] ?? "";
  const area = areas.find((a) => a.items.some((s) => s.path === current)) ?? areas[0]!;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Only people with HR or Admin settings get the tabs; employees just have their own. */}
      {areas.length > 1 && (
        <nav aria-label="Settings areas" className="flex flex-wrap gap-1 border-b border-[var(--line-strong)]">
          {areas.map((a) => {
            const on = a.key === area.key;
            return (
              <NavLink
                key={a.key}
                to={`${base}/${a.items[0]!.path}`}
                aria-current={on ? "page" : undefined}
                className={`-mb-px flex min-h-10 items-center gap-2 rounded-t-[var(--radius-control)] border-b-2 px-3 text-[13.5px] font-semibold transition-colors ${
                  on ? "border-[var(--accent)] text-ink" : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {a.label}
                {a.badge && <span className={badgeClass}>{a.badge}</span>}
              </NavLink>
            );
          })}
        </nav>
      )}

      <div className="flex min-w-0 flex-col gap-6 md:flex-row md:items-start md:gap-10">
        {/* Phones: one select for the sections in this area (the tabs above switch areas). */}
        <div className="md:hidden">
          <label htmlFor="settings-section" className="mb-1 block text-xs font-medium text-ink">
            Settings section
          </label>
          <select id="settings-section" value={current} onChange={(e) => navigate(`${base}/${e.target.value}`)} className="field w-full px-3 py-2 text-sm">
            {area.items.map((s) => (
              <option key={s.path} value={s.path}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <nav aria-label={area.label} className="sticky top-[calc(var(--topbar-h)+1rem)] hidden w-52 flex-none flex-col gap-0.5 md:flex">
          <span className="px-3 pb-1 text-[10.5px] font-semibold tracking-[0.1em] text-[var(--nav-label)] uppercase">{area.label}</span>
          {area.items.map((s) => (
            <NavLink
              key={s.path}
              to={`${base}/${s.path}`}
              className={({ isActive }) =>
                `flex min-h-9 items-center rounded-[var(--radius-control)] px-3 text-[13px] transition-colors ${
                  isActive ? "bg-[var(--nav-active-bg)] font-semibold text-[var(--nav-active-text)] shadow-[var(--nav-active-shadow)]" : "font-medium text-[var(--nav-text)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-hover-text)]"
                }`
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex w-full max-w-[720px] min-w-0 flex-col gap-6">
          {area.note && (
            <p className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line-strong)] bg-[var(--tint)] px-3 py-2 text-[13px] text-ink-2">
              <span className={badgeClass}>{area.badge}</span>
              {area.note}
            </p>
          )}
          <Outlet />
        </div>
      </div>
    </div>
  );
}

/** Workspace sections: anyone without access is sent to their own settings. */
export function WorkspaceGuard({ section, children }: { section: WorkspaceSection; children: ReactNode }) {
  const { user } = useAuth();
  const allowed = useWorkspaceSections().some((s) => s.path === section);
  if (!user) return null;
  return allowed ? <>{children}</> : <Navigate to={`/${user.role}/settings/account`} replace />;
}

/** Unknown settings paths (or HR/Admin ones in another workspace) → My settings › Account. */
export function ToMyAccount() {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigate to={`/${user.role}/settings/account`} replace />;
}

/** Existing management pages shown inside a settings section: their page title shrinks to a sub-heading. */
export function Embedded({ children }: { children: ReactNode }) {
  return <div className="settings-embed flex min-w-0 flex-col gap-5">{children}</div>;
}

/** /settings and /settings/:section → the same section inside the person's workspace. */
export function SettingsRedirect() {
  const { user } = useAuth();
  const params = useParams();
  const rest = params["*"] ?? "";
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}/settings${rest ? `/${rest}` : ""}`} replace />;
}
