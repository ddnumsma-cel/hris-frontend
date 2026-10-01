import { Outlet } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav } from "@/components/layout/SideNav";
import {
  CalendarIcon,
  FileIcon,
  FolderIcon,
  GraduationCapIcon,
  GridIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";

export function EmployeeLayout() {
  return (
    <RolePage
      sidenav={
        <SideNav
          groups={[
            {
              title: "Getting started",
              items: [{ label: "Onboarding", to: "/employee/onboarding", icon: <UserPlusIcon /> }],
            },
            {
              title: "My workspace",
              items: [
                { label: "Overview", to: "/employee", end: true, icon: <GridIcon /> },
                { label: "Leave & DTR", to: "/employee/leave-dtr", icon: <CalendarIcon /> },
                { label: "Payslips", to: "/employee/payslips", icon: <WalletIcon /> },
                { label: "201 File", to: "/employee/201-file", icon: <FolderIcon /> },
                { label: "Trainings", to: "/employee/trainings", icon: <GraduationCapIcon /> },
              ],
            },
            {
              title: "Requests",
              items: [
                { label: "Certificates", to: "/employee/certificates", icon: <FileIcon /> },
                { label: "HMO & Benefits", to: "/employee/benefits", icon: <UsersIcon /> },
              ],
            },
          ]}
        />
      }
    >
      <Outlet />
    </RolePage>
  );
}
