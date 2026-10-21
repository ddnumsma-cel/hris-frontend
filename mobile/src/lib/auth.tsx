// The original screens' useAuth: the backend user stored at sign-in (@/lib/backend/auth) and sign-out, now
// provided by the app's session (~/session).
import type { SessionUser } from '@msma/shared';
import { backendUser } from '@/lib/backend/auth';
import { useSession } from '~/session';

export function useAuth() {
  const { user, signOut } = useSession();
  // The backend's own login answer, kept whole (preferences included) by @/lib/backend/auth.
  const backend = user ? (backendUser() as unknown as SessionUser | null) : null;
  return { user: backend, logout: async () => signOut(), setUser: (_u: SessionUser) => undefined };
}
