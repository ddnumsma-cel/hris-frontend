import { useAuth } from "@/features/auth/AuthContext";
import { FullNav } from "./FullNav";
import { useNavPrefs } from "./navPrefs";
import { RailNav } from "./RailNav";
import type { SideNavGroup } from "./SideNav";

/** The desktop sidebar in the style each person chose in Menu settings: compact rail or full. */
export function AppNav({ groups }: { groups: SideNavGroup[] }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useNavPrefs(user?.accountId ?? user?.role ?? "guest");
  return prefs.style === "full" ? <FullNav groups={groups} prefs={prefs} setPrefs={setPrefs} /> : <RailNav groups={groups} prefs={prefs} setPrefs={setPrefs} />;
}
