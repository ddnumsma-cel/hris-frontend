import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav, type SideNavGroup } from "@/components/layout/SideNav";
import { BarChartIcon, CalendarIcon, ClockIcon, FolderIcon, GridIcon, LockIcon, OrgChartIcon, ReceiptIcon, ShieldIcon, UsersIcon, WalletIcon } from "@/components/icons";
import { AppNav } from "@/components/layout/AppNav";
import { NON_HR_MODULES, type ModuleKey } from "@/lib/admin/store";
import { canChange, EDIT_PAGES, moduleForPath, SUPER_ADMIN_PAGES, useAccess, useIsSuperAdmin } from "./administration/access";

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
      { label: "Org chart", to: "/admin/org-chart", icon: <OrgChartIcon /> },
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
          { label: "Time adjustments", to: "/admin/timekeeping/corrections" },
          { label: "Remote work days", to: "/admin/timekeeping/remote" },
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
    title: "Expenses",
    short: "Claims",
    items: [{ label: "Reimbursements", to: "/admin/reimbursements", icon: <ReceiptIcon /> }],
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
          { label: "HR reports", to: "/admin/reports/hr" },
          { label: "Attendance", to: "/admin/reports/attendance" },
          { label: "Management", to: "/admin/reports/management" },
        ],
      },
    ],
  },
  {
    title: "Payroll",
    short: "Payroll",
    items: [
      {
        label: "Payroll",
        to: "/admin/payroll",
        icon: <WalletIcon />,
        children: [
          { label: "Payroll runs", to: "/admin/payroll/runs" },
          { label: "Payroll report", to: "/admin/reports/payroll" },
          { label: "Government reports", to: "/admin/reports/statutory" },
          { label: "Government contributions", to: "/admin/payroll/contributions" },
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
  const hrModules = Object.entries(access).some(([k, v]) => !NON_HR_MODULES.includes(k as ModuleKey) && v !== "none");
  const allowed = (to: string) => {
    if (!isSuper && SUPER_ADMIN_PAGES.some((p) => to === p || to.startsWith(`${p}/`))) return false;
    if (to === "/admin" && !hrModules) return false;
    const m = moduleForPath(to);
    if (m && EDIT_PAGES.includes(to)) return canChange(access[m]);
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
          {/* Phones get the slide-in menu; desktop gets the sidebar style chosen in Menu settings. */}
          <SideNav groups={groups} desktop={false} />
          <AppNav groups={groups} />
        </>
      }
    >
      {allowed(pathname) ? <Outlet /> : pathname === "/admin" && groups[0] ? <Navigate to={groups[0].items[0]!.children?.[0]?.to ?? groups[0].items[0]!.to} replace /> : <NoAccess />}
    </RolePage>
  );
}
