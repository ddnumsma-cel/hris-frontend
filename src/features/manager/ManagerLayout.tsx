import { Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { NoAccess } from "@/components/layout/NoAccess";
import { filterNav, useCreateAllowed, usePageAllowed } from "@/features/admin/administration/access";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav, type CreateGroup, type SideNavGroup } from "@/components/layout/SideNav";
import { AppNav } from "@/components/layout/AppNav";
import { reportDefinitions } from "./reports/reportDefinitions";
import {
  ReportsIcon,
  CalendarIcon,
  CheckSquareIcon,
  AttendanceIcon,
  GraduationCapIcon,
  HomeIcon,
  PayrollIcon,
} from "@/components/icons";

/** The sidebar's Create menu. Links with ?create=… open that page's form (see useCreateParam). */
const CREATE: CreateGroup[] = [
  {
    title: "Team",
    items: [
      { label: "Approve leave", to: "/manager/approvals", action: "approve", feature: "leave" },
      { label: "Approve attendance", to: "/manager/attendance-approvals", action: "approve" },
      { label: "Check team attendance", to: "/manager/attendance" },
      { label: "View team calendar", to: "/manager/calendar" },
    ],
  },
  {
    title: "Development",
    items: [
      { label: "Assign training", to: "/manager/trainings?create=training" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "Review payroll", to: "/manager/payroll" },
      { label: "View reports", to: "/manager/reports" },
    ],
  },
];

export function ManagerLayout() {
  // Pages and create links this role may use (lib/permissions.ts).
  const allowed = usePageAllowed();
  const createAllowed = useCreateAllowed();
  const { pathname } = useLocation();
  const create = CREATE.map((g) => ({ ...g, items: g.items.filter((i) => createAllowed(i.to, i.action, i.feature)) })).filter((g) => g.items.length > 0);
  return (
    <RolePage
      sidenav={
        <PartnerNav
          create={create}
          groups={filterNav([
            {
              title: "Team",
              items: [
                { label: "Home", to: "/manager", end: true, icon: <HomeIcon /> },
                { label: "Approvals", to: "/manager/approvals", icon: <CheckSquareIcon /> },
                { label: "Team Calendar", short: "Calendar", to: "/manager/calendar", icon: <CalendarIcon /> },
                {
                  label: "Attendance",
                  to: "/manager/attendance",
                  icon: <AttendanceIcon />,
                  children: [
                    { label: "Team Attendance", to: "/manager/attendance", end: true },
                    { label: "Attendance Approvals", to: "/manager/attendance-approvals" },
                  ],
                },
              ],
            },
            {
              title: "Development",
              items: [
                { label: "Trainings", to: "/manager/trainings", icon: <GraduationCapIcon /> },
              ],
            },
            {
              // Only Reports is left here, so the section carries its name (a one-module section shows its title).
              title: "Reports",
              items: [
                { label: "Payroll", to: "/manager/payroll", icon: <PayrollIcon /> },
                {
                  label: "Reports",
                  to: "/manager/reports",
                  icon: <ReportsIcon />,
                  children: reportDefinitions.map((r) => ({ label: r.label, to: `/manager/reports/${r.id}` })),
                },
              ],
            },
          ], allowed)}
        />
      }
    >
      {allowed(pathname) ? <Outlet /> : <NoAccess />}
    </RolePage>
  );
}

/** The same sidebar as the HR and Employee workspaces: the slide-in menu on phones, and on desktop
 *  the full sidebar or the compact rail (names under the icons, Pinned, Customize). */
function PartnerNav({ groups, create }: { groups: SideNavGroup[]; create: CreateGroup[] }) {
  return (
    <>
      <SideNav groups={groups} desktop={false} />
      <AppNav groups={groups} create={create} />
    </>
  );
}
