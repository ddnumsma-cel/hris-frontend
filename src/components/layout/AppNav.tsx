import { useAuth } from "@/features/auth/AuthContext";
import { FullNav } from "./FullNav";
import { useNavPrefs } from "./navPrefs";
import { RailNav } from "./RailNav";
import { useSidebarCollapsed } from "./sidebarState";
import type { CreateGroup, SideNavGroup } from "./SideNav";

/** The desktop sidebar: the full sidebar when expanded, the compact icon rail when collapsed
 *  (one saved state, see sidebarState). `create` adds the Create menu to both. */
export function AppNav({ groups, create }: { groups: SideNavGroup[]; create?: CreateGroup[] }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useNavPrefs(user?.accountId ?? user?.role ?? "guest");
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  return collapsed ? (
    <RailNav groups={groups} create={create} prefs={prefs} setPrefs={setPrefs} onExpand={() => setCollapsed(false)} />
  ) : (
    <FullNav groups={groups} create={create} prefs={prefs} setPrefs={setPrefs} onCollapse={() => setCollapsed(true)} />
  );
}
