import { Outlet } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { RailNav } from "@/components/layout/RailNav";
import { SideNav, type SideNavGroup } from "@/components/layout/SideNav";
import {
  CalendarIcon,
  ClockIcon,
  FileIcon,
  FolderIcon,
  GraduationCapIcon,
  GridIcon,
  ReceiptIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";

const GROUPS: SideNavGroup[] = [
  {
    title: "My workspace",
    items: [
      { label: "Overview", short: "Home", to: "/employee", end: true, icon: <GridIcon /> },
      { label: "My leave", short: "Leave", to: "/employee/leave", icon: <CalendarIcon /> },
      { label: "My attendance", short: "Time", to: "/employee/attendance", icon: <ClockIcon /> },
      { label: "Payslips", to: "/employee/payslips", icon: <WalletIcon /> },
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

export function EmployeeLayout() {
  return (
    <RolePage
      sidenav={
        <>
          {/* Phones get the slide-in menu; desktop gets the icon rail. */}
          <SideNav groups={GROUPS} desktop={false} />
          <RailNav groups={GROUPS} />
        </>
      }
    >
      <Outlet />
    </RolePage>
  );
}
