import { Link } from "react-router-dom";
import { LockIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/AuthContext";

/** Shown when someone opens a page their role can't use (the API refuses it too). */
export function NoAccess() {
  const { user } = useAuth();
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-6 py-16 text-center">
      <LockIcon className="h-6 w-6 text-ink-3" />
      <h1 className="font-display text-lg font-semibold">You don't have access to this page</h1>
      <p className="max-w-md text-sm text-ink-2">Your role doesn't include this page. If you need it for your work, ask your Super Admin to update your role.</p>
      <Link to={`/${user?.role ?? ""}`} className="text-sm font-medium text-brand hover:underline">
        Go to your home page
      </Link>
    </div>
  );
}
