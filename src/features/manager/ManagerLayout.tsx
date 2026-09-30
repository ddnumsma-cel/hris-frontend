import { Outlet } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav } from "@/components/layout/SideNav";
import { reportDefinitions } from "./reports/reportDefinitions";
import {
  AlertTriangleIcon,
  BarChartIcon,
  CheckSquareIcon,
  ClockIcon,
  FlagIcon,
  GraduationCapIcon,
  GridIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";

export function ManagerLayout() {
  return (
    <RolePage
      sidenav={
        <SideNav
          groups={[
            {
              title: "Team",
              items: [
                { label: "Overview", to: "/manager", end: true, icon: <GridIcon /> },
                {
                  label: "Approvals",
                  to: "/manager/approvals-group",
                  icon: <CheckSquareIcon />,
                  children: [
                    { label: "Leave & Requests", to: "/manager/approvals" },
                    { label: "Attendance Corrections", to: "/manager/attendance-approvals" },
                  ],
                },
                {
                  label: "Attendance",
                  to: "/manager/attendance-group",
                  icon: <ClockIcon />,
                  children: [
                    { label: "Team Attendance", to: "/manager/attendance", end: true },
                    { label: "Team Calendar", to: "/manager/calendar" },
                  ],
                },
                { label: "Workforce Intelligence", to: "/manager/workforce", icon: <AlertTriangleIcon /> },
              ],
            },
            {
              title: "Development",
              items: [
                { label: "Performance", to: "/manager/performance", icon: <UsersIcon /> },
                { label: "Trainings", to: "/manager/trainings", icon: <GraduationCapIcon /> },
                { label: "Employee Relations", to: "/manager/cases", icon: <FlagIcon /> },
              ],
            },
            {
              title: "Company",
              items: [
                { label: "Payroll", to: "/manager/payroll", icon: <WalletIcon /> },
                {
                  label: "Reports",
                  to: "/manager/reports",
                  icon: <BarChartIcon />,
                  children: reportDefinitions.map((r) => ({ label: r.label, to: `/manager/reports/${r.id}` })),
                },
                { label: "Settings", to: "/manager/settings", icon: <SettingsIcon /> },
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
