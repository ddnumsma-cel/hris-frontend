import { Outlet } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav } from "@/components/layout/SideNav";
import { BuildingIcon, ClockIcon, FolderIcon, GridIcon, UsersIcon } from "@/components/icons";

export function AdminLayout() {
  return (
    <RolePage
      sidenav={
        <SideNav
          groups={[
            {
              title: "Organization",
              items: [{ label: "Overview", to: "/admin", end: true, icon: <GridIcon /> }],
            },
            {
              title: "Core HR",
              items: [
                { label: "People", to: "/admin/people", icon: <UsersIcon /> },
                { label: "Company", to: "/admin/company", icon: <BuildingIcon /> },
                { label: "Documents", to: "/admin/documents", icon: <FolderIcon /> },
              ],
            },
            {
              title: "Time & Attendance",
              items: [
                {
                  label: "Timekeeping & Attendance",
                  to: "/admin/timekeeping",
                  icon: <ClockIcon />,
                  children: [
                    { label: "Shifts", to: "/admin/timekeeping/shifts" },
                    { label: "Schedules", to: "/admin/timekeeping/schedules" },
                    { label: "Attendance logs", to: "/admin/timekeeping/logs" },
                    { label: "Overtime", to: "/admin/timekeeping/overtime" },
                    { label: "Undertime", to: "/admin/timekeeping/undertime" },
                    { label: "Tardiness", to: "/admin/timekeeping/tardiness" },
                  ],
                },
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
