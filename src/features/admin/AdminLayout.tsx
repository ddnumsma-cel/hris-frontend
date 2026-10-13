import { Navigate, Outlet, useLocation } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav, type CreateGroup, type SideNavGroup } from "@/components/layout/SideNav";
import {
  LockIcon,
  CalendarIcon,
  AttendanceIcon,
  BuildingIcon,
  FileIcon,
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
import { SeatNotice } from "@/features/subscription/shared";
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
      { label: "User accounts", short: "Accounts", to: "/admin/maintenance/user-accounts", icon: <LockIcon /> },
      { label: "Departments", to: "/admin/maintenance/departments", icon: <BuildingIcon /> },
      { label: "Locations", to: "/admin/maintenance/locations", icon: <MapPinIcon /> },
      { label: "Org chart", to: "/admin/maintenance/org-chart", icon: <OrgChartIcon /> },
      { label: "201 documents", short: "201 docs", to: "/admin/maintenance/documents", icon: <FolderIcon /> },
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
          { label: "Holiday calendar", to: "/admin/timekeeping/holidays" },
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
    // Grouped like Xeleqt: forms, presence, requests, payroll, others.
    items: [
      {
        label: "Forms",
        to: "/admin/reports/statutory",
        icon: <FileIcon />,
        children: [{ label: "BIR & government forms", to: "/admin/reports/statutory" }],
      },
      {
        label: "Presence",
        to: "/admin/reports/attendance-logs",
        icon: <AttendanceIcon />,
        children: [
          { label: "Attendance logs", to: "/admin/reports/attendance-logs" },
          { label: "Attendance summary", to: "/admin/reports/attendance" },
          { label: "Tardiness", to: "/admin/reports/tardiness" },
        ],
      },
      {
        label: "Request reports",
        short: "Requests",
        to: "/admin/reports/leave",
        icon: <ReceiptIcon />,
        children: [
          { label: "Leave", to: "/admin/reports/leave" },
          { label: "Overtime", to: "/admin/reports/overtime" },
          { label: "Undertime", to: "/admin/reports/undertime" },
          { label: "Time adjustments", to: "/admin/reports/time-adjustments" },
        ],
      },
      {
        label: "Payroll reports",
        short: "Payroll",
        to: "/admin/reports/payroll",
        icon: <PayrollIcon />,
        children: [{ label: "Payroll report", to: "/admin/reports/payroll" }],
      },
      {
        label: "Others",
        to: "/admin/reports/hr",
        icon: <ReportsIcon />,
        children: [
          { label: "HR reports", to: "/admin/reports/hr" },
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
          { label: "Audit trail", to: "/admin/administration/audit" },
          { label: "System settings", to: "/admin/administration/settings" },
          { label: "Email & text outbox", to: "/admin/administration/outbox" },
          { label: "Clients & Subscriptions", to: "/admin/administration/subscription" },
          { label: "Support tickets", to: "/admin/administration/support" },
        ],
      },
    ],
  },
];

/**
 * The sidebar's Start menu: a tab per area; each link is an action ("Add employee", "Run
 * payroll") with a one-line hint, and links marked `waiting` (decisions other people sent) are
 * listed under "Waiting on you" with a count. Blank forms carry ?create=… (read by useCreateParam,
 * which opens the form); the rest go to the page where that task is done.
 */
const CREATE: CreateGroup[] = [
  {
    title: "People",
    items: [
      { label: "Add employee", to: "/admin/maintenance/people/new", hint: "Start a new 201 record" },
      { label: "Post announcement", to: "/admin?create=announcement", hint: "Show news on everyone's Home page" },
      { label: "Update reporting lines", to: "/admin/maintenance/org-chart", action: "edit", hint: "Change who reports to whom" },
      { label: "Review documents", to: "/admin/maintenance/documents", action: "edit", hint: "Uploaded 201 papers to check", waiting: "documents" },
    ],
  },
  {
    title: "Attendance",
    items: [
      { label: "Add shift", to: "/admin/timekeeping/shifts?create=shift", hint: "Set working hours and breaks" },
      { label: "Assign schedules", to: "/admin/timekeeping/schedules", action: "edit", hint: "Put people on shifts" },
      { label: "Declare remote work day", to: "/admin/timekeeping/remote?create=remote-day", hint: "Let a team work from home" },
      { label: "Add missing time", to: "/admin/reports/attendance-logs", action: "edit", hint: "Fill in a forgotten time in or out" },
      { label: "Review time adjustments", to: "/admin/reports/time-adjustments", action: "approve", hint: "Corrections people asked for", waiting: "fixes" },
      { label: "Approve overtime", to: "/admin/reports/overtime", action: "approve", hint: "Overtime and undertime to decide", waiting: "time" },
      { label: "Send lateness notice", to: "/admin/reports/tardiness", action: "edit", hint: "Remind someone about tardiness" },
    ],
  },
  {
    title: "Leave & requests",
    items: [
      { label: "File leave", to: "/admin/maintenance/leave/requests?create=leave", action: "create", hint: "For yourself or someone else" },
      { label: "Add leave type", to: "/admin/maintenance/leave/types?create=leave-type", hint: "A new kind of leave and its credits" },
      { label: "Adjust leave balances", to: "/admin/maintenance/leave/balances", action: "edit", hint: "Add or take away days" },
      { label: "Approve leave", to: "/admin/maintenance/leave/requests", action: "approve", hint: "Leave requests to decide", waiting: "leave" },
      { label: "Review reimbursements", to: "/admin/requests/reimbursement", hint: "Claims to endorse or approve", waiting: "claims" },
    ],
  },
  {
    title: "Payroll",
    items: [
      { label: "Run payroll", to: "/admin/payroll/runs?create=payroll-run", hint: "Start a new pay run" },
      { label: "Update contribution rates", to: "/admin/payroll/contributions?create=contribution-rates", hint: "SSS, PhilHealth and Pag-IBIG tables" },
      { label: "View payroll report", to: "/admin/reports/payroll", hint: "Totals by period and office" },
      { label: "View government reports", to: "/admin/reports/statutory", hint: "Ready-to-file remittances" },
    ],
  },
  {
    title: "Other",
    items: [
      { label: "Add user", to: "/admin/administration/users?create=user", hint: "Give someone a login" },
      { label: "Report a problem", to: "/admin/administration/support?create=ticket", action: "create", hint: "Send a ticket to support" },
      { label: "Edit approval workflows", to: "/admin/maintenance/rules", action: "edit", hint: "Who approves what" },
      { label: "View HR report", to: "/admin/reports/hr", hint: "Head count, hires and leavers" },
      { label: "View attendance report", to: "/admin/reports/attendance", hint: "Present, absent and late" },
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
  // Under "Others"; when the role sees none of those reports, as its own "Others" entry.
  const others = reports.items.find((i) => i.label === "Others");
  const items = others ? reports.items.map((i) => (i === others ? { ...i, children: [...(i.children ?? []), audit] } : i)) : [...reports.items, { label: "Others", to: AUDIT, icon: <ReportsIcon />, children: [audit] }];
  return rest.map((g) => (g === reports ? { ...g, items } : g));
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
      {/* Only on Home: on other pages a corner card can cover a form's buttons, and the top-bar pill is always there. */}
      {pathname === "/admin" && <SeatNotice />}
      {allowed(pathname) ? <Outlet /> : pathname === "/admin" && groups[0] ? <Navigate to={groups[0].items[0]!.children?.[0]?.to ?? groups[0].items[0]!.to} replace /> : <NoAccess />}
    </RolePage>
  );
}
