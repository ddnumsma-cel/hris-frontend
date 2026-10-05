import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav, type SideNavGroup } from "@/components/layout/SideNav";
import { BarChartIcon, BuildingIcon, CalendarIcon, ClockIcon, FolderIcon, GridIcon, LockIcon, ShieldIcon, UsersIcon } from "@/components/icons";
import { RailNav } from "@/components/layout/RailNav";
import { moduleForPath, SUPER_ADMIN_PAGES, useAccess, useIsSuperAdmin } from "./administration/access";

const GROUPS: SideNavGroup[] = [
  {
    title: "Organization",
    short: "Home",
    items: [{ label: "Overview", to: "/admin", end: true, icon: <GridIcon /> }],
  },
  {
    title: "Core HR",
    short: "Core HR",
    items: [
      { label: "People", to: "/admin/people", icon: <UsersIcon /> },
      { label: "Company", to: "/admin/company", icon: <BuildingIcon /> },
      { label: "Documents", to: "/admin/documents", icon: <FolderIcon /> },
    ],
  },
  {
    title: "Time & Attendance",
    short: "Time",
    items: [
      {
        label: "Timekeeping & Attendance",
        to: "/admin/timekeeping",
        icon: <ClockIcon />,
        children: [
          { label: "Shifts", to: "/admin/timekeeping/shifts" },
          { label: "Schedules", to: "/admin/timekeeping/schedules" },
          { label: "Attendance logs", to: "/admin/timekeeping/logs" },
          { label: "Overtime", to: "/admin/timekeeping/overtime" },
          { label: "Undertime", to: "/admin/timekeeping/undertime" },
          { label: "Tardiness", to: "/admin/timekeeping/tardiness" },
          { label: "Time corrections", to: "/admin/timekeeping/corrections" },
        ],
      },
    ],
  },
  {
    title: "Leave",
    short: "Leave",
    items: [
      {
        label: "Leave Management",
        to: "/admin/leave",
        icon: <CalendarIcon />,
        children: [
          { label: "Overview", to: "/admin/leave/overview" },
          { label: "Requests", to: "/admin/leave/requests" },
          { label: "Balances", to: "/admin/leave/balances" },
          { label: "Leave types", to: "/admin/leave/types" },
        ],
      },
    ],
  },
  {
    title: "Insights",
    short: "Reports",
    items: [
      {
        label: "Reports & Analytics",
        to: "/admin/reports",
        icon: <BarChartIcon />,
        children: [
          { label: "Dashboard", to: "/admin/reports/dashboard" },
          { label: "HR reports", to: "/admin/reports/hr" },
          { label: "Attendance", to: "/admin/reports/attendance" },
          { label: "Payroll", to: "/admin/reports/payroll" },
          { label: "Government", to: "/admin/reports/statutory" },
          { label: "Management", to: "/admin/reports/management" },
        ],
      },
    ],
  },
  {
    title: "System",
    short: "Admin",
    items: [
      {
        label: "Administration & Security",
        to: "/admin/administration",
        icon: <ShieldIcon />,
        children: [
          { label: "Users", to: "/admin/administration/users" },
          { label: "Roles & access", to: "/admin/administration/roles" },
          { label: "Approval workflows", to: "/admin/administration/workflows" },
          { label: "Audit trail", to: "/admin/administration/audit" },
          { label: "System settings", to: "/admin/administration/settings" },
        ],
      },
    ],
  },
];

function NoAccess() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-6 py-16 text-center">
      <LockIcon className="h-6 w-6 text-ink-3" />
      <h1 className="font-display text-lg font-semibold">You don't have access to this page</h1>
      <p className="max-w-md text-sm text-ink-2">Your role doesn't include this module. If you need it for your work, ask an HR administrator to update your role.</p>
      <Link to="/admin" className="text-sm font-medium text-brand hover:underline">
        Go to the overview
      </Link>
    </div>
  );
}

export function AdminLayout() {
  const access = useAccess();
  const { pathname } = useLocation();
  const isSuper = useIsSuperAdmin();
  // System-only accounts (Super Admin) have no HR modules, so no HR overview either.
  const hrModules = Object.entries(access).some(([k, v]) => k !== "administration" && v !== "none");
  const allowed = (to: string) => {
    if (!isSuper && SUPER_ADMIN_PAGES.some((p) => to === p || to.startsWith(`${p}/`))) return false;
    if (to === "/admin" && !hrModules) return false;
    const m = moduleForPath(to);
    return !m || access[m] !== "none";
  };
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => allowed(i.to)).map((i) => (i.children ? { ...i, children: i.children.filter((c) => allowed(c.to)) } : i)),
  })).filter((g) => g.items.length > 0);

  return (
    <RolePage
      sidenav={
        <>
          {/* Phones get the slide-in menu; desktop gets the icon rail. */}
          <SideNav groups={groups} desktop={false} />
          <RailNav groups={groups} />
        </>
      }
    >
      {allowed(pathname) ? <Outlet /> : pathname === "/admin" && groups[0] ? <Navigate to={groups[0].items[0]!.children?.[0]?.to ?? groups[0].items[0]!.to} replace /> : <NoAccess />}
    </RolePage>
  );
}
