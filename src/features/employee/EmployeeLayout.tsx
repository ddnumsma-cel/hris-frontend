import { Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { NoAccess } from "@/components/layout/NoAccess";
import { filterNav, useCreateAllowed, usePageAllowed } from "@/features/admin/administration/access";
import { RolePage } from "@/components/layout/RolePage";
import { AppNav } from "@/components/layout/AppNav";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { FaceIdPrompt } from "./FaceIdPrompt";
import { SideNav, type CreateGroup, type SideNavGroup } from "@/components/layout/SideNav";
import {
  CalendarIcon,
  ClockIcon,
  LogOutIcon,
  CheckSquareIcon,
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
    title: "Workspace",
    items: [
      { label: "Home", to: "/employee", end: true, icon: <HomeIcon /> },
      { label: "Leave", to: "/employee/leave", icon: <CalendarIcon /> },
      { label: "Attendance", to: "/employee/attendance", icon: <AttendanceIcon /> },
      { label: "Payslips", to: "/employee/payslips", icon: <PayrollIcon /> },
      { label: "201 File", to: "/employee/201-file", icon: <FolderIcon /> },
      { label: "Trainings", to: "/employee/trainings", icon: <GraduationCapIcon /> },
      { label: "Company policies", short: "Policies", to: "/employee/policies", icon: <CheckSquareIcon /> },
    ],
  },
  {
    title: "Requests",
    short: "Requests",
    icon: <FileIcon />,
    items: [
      { label: "All requests", short: "Requests", to: "/employee/requests", icon: <CheckSquareIcon /> },
      { label: "Certificates", to: "/employee/certificates", icon: <FileIcon /> },
      { label: "Reimbursements", to: "/employee/reimbursements", icon: <ReceiptIcon /> },
      { label: "HMO & Benefits", to: "/employee/benefits", icon: <UsersIcon /> },
      { label: "Overtime", to: "/employee/overtime", icon: <ClockIcon /> },
      { label: "Undertime", to: "/employee/undertime", icon: <LogOutIcon /> },
    ],
  },
];

/** The sidebar's Start menu. Links with ?create=… open that page's form (see useCreateParam). */
const CREATE: CreateGroup[] = [
  {
    title: "Leave & time",
    items: [
      { label: "File leave", to: "/employee/leave?create=leave", hint: "Ask for time off" },
      { label: "View leave balance", to: "/employee/leave", hint: "See the days you have left" },
      { label: "Request overtime", to: "/employee/overtime?create=overtime", hint: "Get paid for time past your shift" },
      { label: "Request undertime", to: "/employee/undertime?create=undertime", hint: "Explain leaving before your shift ends" },
      { label: "Request attendance fix", to: "/employee/attendance?create=adjustment", hint: "Fix a missed time in or out" },
    ],
  },
  {
    title: "Requests",
    items: [
      { label: "Request certificate", to: "/employee/certificates?create=certificate", hint: "Employment, compensation and more" },
      { label: "Submit reimbursement", to: "/employee/reimbursements?create=claim", hint: "Get paid back for work expenses" },
    ],
  },
  {
    title: "Records",
    items: [
      { label: "Update my details", to: "/employee/201-file?create=details", hint: "Address, contacts and IDs" },
      { label: "Add benefit or dependent", to: "/employee/benefits?create=benefit", hint: "HMO, insurance and family" },
    ],
  },
  {
    title: "Pay & learning",
    items: [
      { label: "View payslips", to: "/employee/payslips", hint: "Your pay for each period" },
      { label: "View trainings", to: "/employee/trainings", hint: "Courses assigned to you" },
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
          <BottomTabs
            tabs={[
              { label: "Home", to: "/employee", end: true, icon: <HomeIcon /> },
              { label: "Attendance", to: "/employee/attendance", icon: <AttendanceIcon /> },
              { label: "Leave", to: "/employee/leave", icon: <CalendarIcon /> },
              { label: "Payslips", to: "/employee/payslips", icon: <PayrollIcon /> },
            ].filter((t) => allowed(t.to))}
          />
        </>
      }
    >
      {allowed(pathname) ? <Outlet /> : <NoAccess />}
      <FaceIdPrompt />
    </RolePage>
  );
}
