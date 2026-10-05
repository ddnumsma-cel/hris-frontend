import { useEffect, useState } from "react";
import { CheckIcon, XIcon } from "@/components/icons";
import { accountById, consumeSignInFlag } from "@/lib/admin/auth";
import { roleOf } from "@/lib/admin/store";
import { useAuth } from "./AuthContext";

const SHOW_MS = 4500;

/** A short, friendly confirmation after signing in. Shown once per sign-in. */
export function SignInWelcome() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(consumeSignInFlag);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const leave = window.setTimeout(() => setLeaving(true), SHOW_MS);
    const gone = window.setTimeout(() => setVisible(false), SHOW_MS + 200);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(gone);
    };
  }, [visible]);

  if (!visible || !user) return null;
  const first = user.name.split(" ")[0];
  const role = roleOf(accountById(user.accountId))?.name;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const close = () => {
    setLeaving(true);
    window.setTimeout(() => setVisible(false), 200);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-100 flex justify-end px-4 sm:pr-6">
      <div role="status" aria-live="polite" className={`welcome-card pointer-events-auto relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-xl ${leaving ? "toast-leave" : "welcome-enter"}`}>
        <div className="flex items-start gap-3.5 p-4 pr-11">
          <span className="welcome-badge flex h-10 w-10 flex-none items-center justify-center rounded-full bg-good text-white">
            <CheckIcon className="h-5 w-5" strokeWidth={2.6} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Signed in successfully</p>
            <p className="mt-0.5 text-sm text-ink-2">
              {greeting}, {first}! {role ? <>You're signed in as <span className="font-medium text-ink">{role}</span>.</> : "Welcome back."}
            </p>
          </div>
        </div>
        <button type="button" onClick={close} aria-label="Dismiss" className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink">
          <XIcon className="h-4 w-4" />
        </button>
        <span className="welcome-timer absolute inset-x-0 bottom-0 h-1 origin-left bg-good" style={{ animationDuration: `${SHOW_MS}ms` }} aria-hidden="true" />
      </div>
    </div>
  );
}
