import { Redirect } from 'expo-router';
import { homeOf } from '~/nav';
import { useSession } from '~/session';

/** The app opens on the role's Home, like the website. */
export default function Index() {
  const { user } = useSession();
  return user ? <Redirect href={homeOf(user.workspace) as never} /> : null;
}
