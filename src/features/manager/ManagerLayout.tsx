import { Outlet } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav, type CreateGroup } from "@/components/layout/SideNav";
import { reportDefinitions } from "./reports/reportDefinitions";
import {
  AlertTriangleIcon,
  BarChartIcon,
  CalendarIcon,
  CheckSquareIcon,
  ClockIcon,
  FlagIcon,
  GraduationCapIcon,
  HomeIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";

/** The sidebar's Create menu. Links with ?create=… open that page's form (see useCreateParam). */
const CREATE: CreateGroup[] = [
  {
    title: "Team",
    items: [
      { label: "Approve leave", to: "/manager/approvals" },
      { label: "Approve attendance", to: "/manager/attendance-approvals" },
      { label: "Check team attendance", to: "/manager/attendance" },
      { label: "View team calendar", to: "/manager/calendar" },
    ],
  },
  {
    title: "Development",
    items: [
      { label: "Assign training", to: "/manager/trainings?create=training" },
      { label: "Review performance", to: "/manager/performance" },
      { label: "File a case", to: "/manager/cases?create=case" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "Review payroll", to: "/manager/payroll" },
      { label: "View workforce alerts", to: "/manager/workforce" },
      { label: "View reports", to: "/manager/reports" },
    ],
  },
];

export function ManagerLayout() {
  return (
    <RolePage
      sidenav={
        <SideNav
          create={CREATE}
          groups={[
            {
              title: "Team",
              items: [
                { label: "Home", to: "/manager", end: true, icon: <HomeIcon /> },
                { label: "Approvals", to: "/manager/approvals", icon: <CheckSquareIcon /> },
                { label: "Team Calendar", to: "/manager/calendar", icon: <CalendarIcon /> },
                {
                  label: "Attendance",
                  to: "/manager/attendance",
                  icon: <ClockIcon />,
                  children: [
                    { label: "Team Attendance", to: "/manager/attendance", end: true },
                    { label: "Attendance Approvals", to: "/manager/attendance-approvals" },
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
