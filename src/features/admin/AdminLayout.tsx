import { Outlet } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav } from "@/components/layout/SideNav";
import { BuildingIcon, FolderIcon, GridIcon, UsersIcon } from "@/components/icons";

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
          ]}
        />
      }
    >
      <Outlet />
    </RolePage>
  );
}
