import { Outlet } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav } from "@/components/layout/SideNav";
import {
  BarChartIcon,
  BriefcaseIcon,
  FileIcon,
  FlagIcon,
  GraduationCapIcon,
  GridIcon,
  OrgChartIcon,
  ShieldIcon,
  UserMinusIcon,
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
              title: "Organization",
              items: [
                { label: "Overview", to: "/admin", end: true, icon: <GridIcon /> },
                { label: "Employee Directory", to: "/admin/directory", icon: <UsersIcon /> },
                { label: "Org Chart", to: "/admin/org-chart", icon: <OrgChartIcon /> },
                { label: "Onboarding", to: "/admin/onboarding", icon: <UserPlusIcon /> },
                { label: "Offboarding", to: "/admin/offboarding", icon: <UserMinusIcon /> },
                { label: "Assets", to: "/admin/assets", icon: <BriefcaseIcon /> },
              ],
            },
            {
              title: "People Programs",
              items: [
                { label: "Training & Development", to: "/admin/trainings", icon: <GraduationCapIcon /> },
                { label: "Employee Relations", to: "/admin/cases", icon: <FlagIcon /> },
                { label: "Certificate Requests", to: "/admin/certificates", icon: <FileIcon /> },
              ],
            },
            {
              title: "Payroll & Compliance",
              items: [
                { label: "Payroll Runs", to: "/admin/payroll-runs", icon: <WalletIcon /> },
                { label: "Compliance", to: "/admin/compliance", icon: <ShieldIcon /> },
                { label: "Reports", to: "/admin/reports", icon: <BarChartIcon /> },
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
