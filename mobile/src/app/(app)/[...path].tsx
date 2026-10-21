// Every page lives at the website's own address (/employee/leave, /admin/maintenance/people, …), so links,
// notifications and the Start menu use the same paths. The page shown comes from the screen registry; addresses
// the role may not open show No access, as on the website.

import { usePathname } from 'expo-router';
import { NoAccess, Placeholder } from '~/screens/common';
import { screenFor } from '~/screens/registry';
import { itemFor, navFor, pageAllowed } from '~/nav';
import { useSession, useWho } from '~/session';

export default function Page() {
  const path = usePathname();
  const { user } = useSession();
  const who = useWho();
  if (!user) return null;
  // Each workspace has its own addresses; the HR workspace also checks each page's access rule.
  const prefix = user.workspace === 'employee' ? '/employee' : user.workspace === 'manager' ? '/manager' : '/admin';
  if (!path.startsWith(prefix) || !pageAllowed(who, path)) return <NoAccess />;
  const Screen = screenFor(path);
  if (Screen) return <Screen />;
  return <Placeholder title={itemFor(navFor(user.workspace, who), path)?.label ?? 'This page'} />;
}
