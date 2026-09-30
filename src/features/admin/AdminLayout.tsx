import { Outlet } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav } from "@/components/layout/SideNav";
import {
  BarChartIcon,
  CalendarIcon,
  GraduationCapIcon,
  GridIcon,
  SearchIcon,
  SettingsIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";

export function AdminLayout() {
  return (
    <RolePage
      sidenav={
        <SideNav
          groups={[
            {
              title: "Core HR",
              items: [
                { label: "Overview", to: "/admin", end: true, icon: <GridIcon /> },
                {
                  label: "Employees",
                  to: "/admin/employees",
                  icon: <UsersIcon />,
                  children: [
                    { label: "Directory", to: "/admin/directory" },
                    { label: "Org Chart", to: "/admin/org-chart" },
                    { label: "Employee Relations", to: "/admin/cases" },
                    { label: "Certificate Requests", to: "/admin/certificates" },
                  ],
                },
              ],
            },
            {
              title: "Recruitment & Onboarding",
              items: [
                { label: "Recruitment", to: "/admin/recruitment", icon: <SearchIcon /> },
                {
                  label: "On & Offboarding",
                  to: "/admin/lifecycle",
                  icon: <UserPlusIcon />,
                  children: [
                    { label: "Onboarding", to: "/admin/onboarding" },
                    { label: "Offboarding", to: "/admin/offboarding" },
                    { label: "Assets", to: "/admin/assets" },
                  ],
                },
              ],
            },
            {
              title: "Workforce",
              items: [
                { label: "Leave", to: "/admin/leave", icon: <CalendarIcon /> },
                { label: "Payroll Runs", to: "/admin/payroll-runs", icon: <WalletIcon /> },
                { label: "Training & Development", to: "/admin/trainings", icon: <GraduationCapIcon /> },
              ],
            },
            {
              title: "Reports & Administration",
              items: [
                { label: "Reports", to: "/admin/reports", icon: <BarChartIcon /> },
                { label: "Settings", to: "/admin/settings", icon: <SettingsIcon /> },
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
