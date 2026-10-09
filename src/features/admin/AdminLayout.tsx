import { Navigate, Outlet, useLocation } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav, type CreateGroup, type SideNavGroup } from "@/components/layout/SideNav";
import {
  CalendarIcon,
  AttendanceIcon,
  BuildingIcon,
  FolderIcon,
  HomeIcon,
  MaintenanceIcon,
  MapPinIcon,
  OnboardingIcon,
  OrgChartIcon,
  PayrollIcon,
  ReceiptIcon,
  ReportsIcon,
  ShieldIcon,
  SlidersIcon,
  UsersIcon,
} from "@/components/icons";
import { AppNav } from "@/components/layout/AppNav";
import { REQUEST_TYPES } from "@/lib/requests/types";
import { NoAccess } from "@/components/layout/NoAccess";
import { filterNav, useCreateAllowed, usePageAllowed } from "./administration/access";

const GROUPS: SideNavGroup[] = [
  {
    title: "Organization",
    short: "Home",
    items: [{ label: "Home", to: "/admin", end: true, icon: <HomeIcon /> }],
  },
  {
    title: "Maintenance",
    short: "Maintenance",
    icon: <MaintenanceIcon />,
    items: [
      { label: "People", to: "/admin/maintenance/people", icon: <UsersIcon /> },
      { label: "Departments", to: "/admin/maintenance/departments", icon: <BuildingIcon /> },
      { label: "Locations", to: "/admin/maintenance/locations", icon: <MapPinIcon /> },
      { label: "Org chart", to: "/admin/maintenance/org-chart", icon: <OrgChartIcon /> },
      { label: "Documents", to: "/admin/maintenance/documents", icon: <FolderIcon /> },
      {
        label: "Leave",
        to: "/admin/maintenance/leave",
        icon: <CalendarIcon />,
        children: [
          { label: "Overview", to: "/admin/maintenance/leave/overview" },
          { label: "Requests", to: "/admin/maintenance/leave/requests" },
          { label: "Balances", to: "/admin/maintenance/leave/balances" },
          { label: "Leave types", to: "/admin/maintenance/leave/types" },
        ],
      },
      { label: "Rules", to: "/admin/maintenance/rules", icon: <SlidersIcon /> },
    ],
  },
  {
    title: "Attendance",
    short: "Attendance",
    items: [
      {
        label: "Attendance",
        to: "/admin/timekeeping",
        icon: <AttendanceIcon />,
        children: [
          { label: "Shifts", to: "/admin/timekeeping/shifts" },
          { label: "Schedules", to: "/admin/timekeeping/schedules" },
          { label: "Remote work days", to: "/admin/timekeeping/remote" },
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
        icon: <PayrollIcon />,
        children: [
          { label: "Payroll runs", to: "/admin/payroll/runs" },
          { label: "Pay details", to: "/admin/payroll/pay-details" },
          { label: "Loans & deductions", to: "/admin/payroll/loans" },
          { label: "Final pay", to: "/admin/payroll/final-pay" },
          { label: "Payouts & journal", to: "/admin/payroll/payouts" },
          { label: "Year-end BIR forms", to: "/admin/payroll/year-end" },
          { label: "Government reports", to: "/admin/reports/statutory" },
          { label: "Government contributions", to: "/admin/payroll/contributions" },
        ],
      },
    ],
  },
  {
    title: "Onboarding",
    short: "Onboarding",
    items: [
      {
        label: "Onboarding",
        to: "/admin/onboarding",
        icon: <OnboardingIcon />,
        children: [{ label: "Trainings", to: "/admin/onboarding/trainings" }],
      },
    ],
  },
  {
    title: "Reports",
    short: "Reports",
    items: [
      {
        label: "Reports",
        to: "/admin/reports",
        icon: <ReportsIcon />,
        children: [
          { label: "Attendance logs", to: "/admin/reports/attendance-logs" },
          { label: "Overtime", to: "/admin/reports/overtime" },
          { label: "Undertime", to: "/admin/reports/undertime" },
          { label: "Time adjustments", to: "/admin/reports/time-adjustments" },
          { label: "Tardiness", to: "/admin/reports/tardiness" },
          { label: "HR reports", to: "/admin/reports/hr" },
          { label: "Attendance", to: "/admin/reports/attendance" },
          { label: "Payroll report", to: "/admin/reports/payroll" },
          { label: "Management", to: "/admin/reports/management" },
        ],
      },
    ],
  },
  {
    title: "Requests",
    short: "Requests",
    items: [
      {
        label: "Requests",
        to: "/admin/requests",
        icon: <ReceiptIcon />,
        // One page per request type (lib/requests/types.ts).
        children: REQUEST_TYPES.map((t) => ({ label: t.label, to: `/admin/requests/${t.id}` })),
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
          { label: "Audit trail", to: "/admin/administration/audit" },
          { label: "System settings", to: "/admin/administration/settings" },
          { label: "Subscription & seats", to: "/admin/administration/subscription" },
        ],
      },
    ],
  },
];

/**
 * The rail's Create menu, laid out like an accounting app's "+ New": a column per area, each
 * item an action ("Add employee", "Run payroll"). Blank forms carry ?create=… (read by useCreateParam, which opens the form);
 * the rest go to the page where that task is done.
 */
const CREATE: CreateGroup[] = [
  {
    title: "People",
    items: [
      { label: "Add employee", to: "/admin/maintenance/people/new" },
      { label: "Post announcement", to: "/admin?create=announcement" },
      { label: "Update reporting lines", to: "/admin/maintenance/org-chart", action: "edit" },
      { label: "Review documents", to: "/admin/maintenance/documents", action: "edit" },
    ],
  },
  {
    title: "Attendance",
    items: [
      { label: "Add shift", to: "/admin/timekeeping/shifts?create=shift" },
      { label: "Assign schedules", to: "/admin/timekeeping/schedules", action: "edit" },
      { label: "Declare remote work day", to: "/admin/timekeeping/remote?create=remote-day" },
      { label: "Add missing time", to: "/admin/reports/attendance-logs", action: "edit" },
      { label: "Review time adjustments", to: "/admin/reports/time-adjustments", action: "approve" },
      { label: "Approve overtime", to: "/admin/reports/overtime", action: "approve" },
      { label: "Send lateness notice", to: "/admin/reports/tardiness", action: "edit" },
    ],
  },
  {
    title: "Leave & requests",
    items: [
      { label: "File leave", to: "/admin/maintenance/leave/requests?create=leave", action: "create" },
      { label: "Add leave type", to: "/admin/maintenance/leave/types?create=leave-type" },
      { label: "Adjust leave balances", to: "/admin/maintenance/leave/balances", action: "edit" },
      { label: "Approve leave", to: "/admin/maintenance/leave/requests", action: "approve" },
      { label: "Review reimbursements", to: "/admin/requests/reimbursement" },
    ],
  },
  {
    title: "Payroll",
    items: [
      { label: "Run payroll", to: "/admin/payroll/runs?create=payroll-run" },
      { label: "Update contribution rates", to: "/admin/payroll/contributions?create=contribution-rates" },
      { label: "View payroll report", to: "/admin/reports/payroll" },
      { label: "View government reports", to: "/admin/reports/statutory" },
    ],
  },
  {
    title: "Other",
    items: [
      { label: "Add user", to: "/admin/administration/users?create=user" },
      { label: "Edit approval workflows", to: "/admin/maintenance/rules", action: "edit" },
      { label: "View HR report", to: "/admin/reports/hr" },
      { label: "View attendance report", to: "/admin/reports/attendance" },
    ],
  },
];

const AUDIT = "/admin/administration/audit";

/**
 * When Audit trail is the only System page a role may open (HR, Accounting), an "Admin" module
 * holding just a log is misleading: list Audit trail under Reports instead.
 */
function auditUnderReports(groups: SideNavGroup[]): SideNavGroup[] {
  const system = groups.find((g) => g.title === "System");
  const pages = system?.items.flatMap((i) => i.children ?? [i]) ?? [];
  if (!system || pages.length !== 1 || pages[0]!.to !== AUDIT) return groups;
  const audit = { label: "Audit trail", to: AUDIT };
  const rest = groups.filter((g) => g !== system);
  const reports = rest.find((g) => g.title === "Reports");
  if (!reports) return [...rest, { title: "Reports", short: "Reports", items: [{ label: "Audit trail", to: AUDIT, icon: <ReportsIcon /> }] }];
  return rest.map((g) => (g === reports ? { ...g, items: g.items.map((i, n) => (n === 0 && i.children ? { ...i, children: [...i.children, audit] } : i)) } : g));
}

export function AdminLayout() {
  const { pathname } = useLocation();
  // What this role may open comes from the access matrix (lib/permissions.ts).
  const allowed = usePageAllowed();
  const createAllowed = useCreateAllowed();
  const groups = auditUnderReports(filterNav(GROUPS, allowed));
  // Only the create actions this role may use.
  const create = CREATE.map((g) => ({ ...g, items: g.items.filter((i) => createAllowed(i.to, i.action, i.feature)) })).filter((g) => g.items.length > 0);

  return (
    <RolePage
      sidenav={
        <>
          {/* Phones get the slide-in menu; desktop gets the sidebar style chosen in Menu settings. */}
          <SideNav groups={groups} desktop={false} />
          <AppNav groups={groups} create={create} />
        </>
      }
    >
      {allowed(pathname) ? <Outlet /> : pathname === "/admin" && groups[0] ? <Navigate to={groups[0].items[0]!.children?.[0]?.to ?? groups[0].items[0]!.to} replace /> : <NoAccess />}
    </RolePage>
  );
}
