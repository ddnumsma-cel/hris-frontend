import { Outlet } from "react-router-dom";
import { RolePage } from "@/components/layout/RolePage";
import { SideNav } from "@/components/layout/SideNav";
import { GridIcon } from "@/components/icons";

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
          ]}
        />
      }
    >
      <Outlet />
    </RolePage>
  );
}
