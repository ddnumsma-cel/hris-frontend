// Signed in: the role's top bar, its pages, and its bottom tabs.

import { DefaultTheme, Stack, ThemeProvider as NavTheme, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { BottomBar } from '~/components/BottomBar';
import { ProfilePanel } from '~/components/MenuDrawer';
import { TopBar } from '~/components/TopBar';
import { useTheme } from '~/lib/theme';
import { homeOf, itemFor, navFor, othersGroupedFor, tabsFor } from '~/nav';
import { go } from '~/lib/go';
import { useSession, useWho } from '~/session';

/** Pages that aren't in the sidebar (forms and the clock-in screen), titled as in the app before. */
const TITLES: Record<string, string> = {
  '/search': 'Search',
  '/employee/clock': 'Clock in or out',
  '/employee/leave/new': 'File leave',
  '/employee/overtime/new': 'File overtime',
  '/employee/undertime/new': 'Leave early (undertime)',
  '/employee/attendance/fix': 'Fix my time in / out',
  '/employee/certificates/new': 'Request certificate',
  '/employee/reimbursements/new': 'Submit reimbursement',
  '/employee/my-details': 'My details',
  '/admin/approvals': 'Approvals',
};

export default function AppLayout() {
  const { c, dark, look } = useTheme();
  const { user } = useSession();
  const who = useWho();
  const path = usePathname();
  const [profile, setProfile] = useState(false);
  // Opening a page closes the profile panel.
  useEffect(() => setProfile(false), [path]);
  if (!user) return null;
  const groups = navFor(user.workspace, who);
  const home = homeOf(user.workspace);
  const tabs = tabsFor(user.role, groups);
  // Main pages: Home, the tabs and every page in the profile panel. Anything deeper gets a back arrow.
  const main = path === home || path === '/' || groups.some((g) => g.items.some((i) => i.to === path || i.children?.some((ch) => ch.to === path)));
  const title = TITLES[path] ? TITLES[path] : path === '/admin/maintenance/people/new' ? 'Add employee' : path.startsWith('/admin/maintenance/people/') || path.startsWith('/manager/people/') ? 'Employee' : path === home || path === '/' ? 'Home' : (itemFor(groups, path)?.label ?? 'MSMA HRIS');
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* The Glass wash behind every screen. */}
      <LinearGradient colors={look.wash(c, dark)} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.55 }} style={StyleSheet.absoluteFill} />
      <TopBar title={title} back={!main} onProfile={() => setProfile((o) => !o)} profileOpen={profile} />
      <View style={{ flex: 1 }}>
        {/* The navigator paints its own background; make it see-through so the Glass wash shows. */}
        <NavTheme value={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: 'transparent' } }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' }, animation: 'none' }} />
        </NavTheme>
      </View>
      <BottomBar tabs={tabs} path={path === '/' ? home : path} />
      <ProfilePanel
        open={profile}
        onClose={() => setProfile(false)}
        go={(to) => {
          setProfile(false);
          go(to);
        }}
        groups={othersGroupedFor(groups, tabs)}
        path={path}
      />
    </View>
  );
}
