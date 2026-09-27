import { Outlet } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav } from "@/components/layout/SideNav";
import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckSquareIcon,
  ClockIcon,
  FlagIcon,
  GraduationCapIcon,
  GridIcon,
  UsersIcon,
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
                { label: "Approvals", to: "/manager/approvals", icon: <CheckSquareIcon /> },
                { label: "Team Calendar", to: "/manager/calendar", icon: <CalendarIcon /> },
                { label: "Attendance", to: "/manager/attendance", icon: <ClockIcon /> },
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
          ]}
        />
      }
    >
      <Outlet />
    </RolePage>
  );
}
