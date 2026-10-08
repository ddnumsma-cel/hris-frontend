import { Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { NoAccess } from "@/components/layout/NoAccess";
import { filterNav, useCreateAllowed, usePageAllowed } from "@/features/admin/administration/access";
import { RolePage } from "@/components/layout/RolePage";
import { AppNav } from "@/components/layout/AppNav";
import { SideNav, type CreateGroup, type SideNavGroup } from "@/components/layout/SideNav";
import {
  CalendarIcon,
  AttendanceIcon,
  FileIcon,
  FolderIcon,
  GraduationCapIcon,
  HomeIcon,
  ReceiptIcon,
  UsersIcon,
  PayrollIcon,
} from "@/components/icons";

const GROUPS: SideNavGroup[] = [
  {
    title: "My workspace",
    items: [
      { label: "Home", to: "/employee", end: true, icon: <HomeIcon /> },
      { label: "My leave", short: "Leave", to: "/employee/leave", icon: <CalendarIcon /> },
      { label: "My attendance", short: "Attendance", to: "/employee/attendance", icon: <AttendanceIcon /> },
      { label: "Payslips", to: "/employee/payslips", icon: <PayrollIcon /> },
      { label: "201 File", to: "/employee/201-file", icon: <FolderIcon /> },
      { label: "Trainings", to: "/employee/trainings", icon: <GraduationCapIcon /> },
    ],
  },
  {
    title: "Requests",
    short: "Requests",
    icon: <FileIcon />,
    items: [
      { label: "Certificates", to: "/employee/certificates", icon: <FileIcon /> },
      { label: "Reimbursements", to: "/employee/reimbursements", icon: <ReceiptIcon /> },
      { label: "HMO & Benefits", to: "/employee/benefits", icon: <UsersIcon /> },
    ],
  },
];

/** The sidebar's Create menu. Links with ?create=… open that page's form (see useCreateParam). */
const CREATE: CreateGroup[] = [
  {
    title: "Leave & time",
    items: [
      { label: "File leave", to: "/employee/leave?create=leave" },
      { label: "View leave balance", to: "/employee/leave" },
      { label: "Request attendance fix", to: "/employee/attendance" },
    ],
  },
  {
    title: "Requests",
    items: [
      { label: "Request certificate", to: "/employee/certificates?create=certificate" },
      { label: "Submit reimbursement", to: "/employee/reimbursements?create=claim" },
    ],
  },
  {
    title: "My records",
    items: [
      { label: "Update my details", to: "/employee/201-file?create=details" },
      { label: "Add benefit or dependent", to: "/employee/benefits?create=benefit" },
      { label: "Log CPD units", to: "/employee/201-file?create=cpd" },
    ],
  },
  {
    title: "Pay & learning",
    items: [
      { label: "View payslips", to: "/employee/payslips" },
      { label: "View trainings", to: "/employee/trainings" },
    ],
  },
];

export function EmployeeLayout() {
  // Pages and create links this role may use (lib/permissions.ts).
  const allowed = usePageAllowed();
  const createAllowed = useCreateAllowed();
  const { pathname } = useLocation();
  const groups = filterNav(GROUPS, allowed);
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
      {allowed(pathname) ? <Outlet /> : <NoAccess />}
    </RolePage>
  );
}
