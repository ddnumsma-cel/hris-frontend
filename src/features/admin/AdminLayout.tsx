import { Link, Outlet, useLocation } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav, type SideNavGroup } from "@/components/layout/SideNav";
import { BarChartIcon, BuildingIcon, CalendarIcon, ClockIcon, FolderIcon, GridIcon, LockIcon, ShieldIcon, UsersIcon } from "@/components/icons";
import { moduleForPath, useAccess } from "./administration/access";

const GROUPS: SideNavGroup[] = [
  {
    title: "Organization",
    items: [{ label: "Overview", to: "/admin", end: true, icon: <GridIcon /> }],
  },
  {
    title: "Core HR",
    items: [
      { label: "People", to: "/admin/people", icon: <UsersIcon /> },
      { label: "Company", to: "/admin/company", icon: <BuildingIcon /> },
      { label: "Documents", to: "/admin/documents", icon: <FolderIcon /> },
    ],
  },
  {
    title: "Time & Attendance",
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
        ],
      },
    ],
  },
  {
    title: "Leave",
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
  const allowed = (to: string) => {
    const m = moduleForPath(to);
    return !m || access[m] !== "none";
  };
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => allowed(i.to)) })).filter((g) => g.items.length > 0);

  return (
    <RolePage sidenav={<SideNav groups={groups} />}>
      {allowed(pathname) ? <Outlet /> : <NoAccess />}
    </RolePage>
  );
}
