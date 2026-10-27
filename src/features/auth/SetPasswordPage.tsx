import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LockIcon } from "@/components/icons";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { admin, saveAdmin } from "@/lib/admin/store";
import { changeMyPassword, minPasswordLength } from "@/lib/settings/api";
import { landingPath } from "@/features/settings/landing";
import { settingsFor, settingsKeyFor } from "@/lib/settings/store";
import { useAuth } from "./AuthContext";
import { LoginHero } from "./LoginHero";
import { Constellation } from "./Constellation";

// Same look as the sign-in card (LoginPage).
const fieldClass = "flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--login-line)] bg-[var(--login-field)] px-4 py-2.5 transition-colors focus-within:border-[var(--sky)] focus-within:bg-[var(--login-field-focus)]";
const inputClass = "w-full bg-transparent text-sm text-[var(--login-ink)] outline-none placeholder:text-[var(--login-ink-3)]";

/** Does the signed-in account still have a temporary password (new login or a reset)? */
export function mustChangePassword(accountId: string | undefined) {
  return !!accountId && !!admin.accounts.find((a) => a.id === accountId)?.mustChangePassword;
}

/**
 * First sign-in with a temporary password: they choose their own before anything else (ProtectedRoute sends every
 * workspace page here until they do), then go to their Home page.
 */
export function SetPasswordPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  const home = landingPath(user.role, settingsFor(settingsKeyFor(user)).appearance.landing);
  if (!mustChangePassword(user.accountId)) return <Navigate to={home} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!current) return setError("Enter the temporary password you just signed in with.");
    if (next.length < minPasswordLength()) return setError(`Use at least ${minPasswordLength()} characters.`);
    if (next !== again) return setError("The two new passwords don't match.");
    if (next === current) return setError("Choose a password different from the temporary one.");
    setSaving(true);
    try {
      await changeMyPassword(user!, current, next);
      saveAdmin({ ...admin, accounts: admin.accounts.map((a) => (a.id === user!.accountId ? { ...a, mustChangePassword: false } : a)) });
      navigate(home, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your password. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, autoComplete: string, placeholder: string) => (
    <div>
      <label htmlFor={id} className="mb-1.5 ml-4 block text-xs font-medium text-[var(--login-ink-2)]">
        {label}
      </label>
      <div className={fieldClass}>
        <LockIcon className="h-4 w-4 flex-none text-[var(--login-ink-3)]" />
        <input
          id={id}
          type="password"
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => {
            set(e.target.value);
            setError(null);
          }}
          placeholder={placeholder}
          className={inputClass}
        />
      </div>
    </div>
  );

  return (
    <>
      <ThemeToggle className="fixed right-4 top-4 z-50 border border-[var(--login-line)] bg-[var(--login-card)] text-[var(--login-ink)] hover:bg-[var(--login-field-focus)]" />
      <div className="login-hero relative grid min-h-screen grid-cols-1 bg-[var(--login-bg)] text-[var(--login-ink)] lg:grid-cols-2">
        <Constellation className="login-constellation" />
        <LoginHero />
        <div className="flex items-center justify-center px-4 py-6 lg:py-10">
          <div className="panel-enter w-full max-w-md rounded-[var(--radius-panel)] border border-[var(--login-line)] bg-[var(--login-panel)] shadow-[0_24px_60px_-24px_var(--login-shadow)] backdrop-blur-[var(--blur-panel)]">
            <div className="p-8">
              <div className="mb-6 text-center">
                <div className="font-display text-2xl font-semibold">Choose your password</div>
                <div className="mt-1 text-sm text-[var(--login-ink-2)]">Welcome, {user.name}. You signed in with a temporary password; set your own to continue.</div>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {field("sp-current", "Temporary password", current, setCurrent, "current-password", "The password you just signed in with")}
                {field("sp-next", "New password", next, setNext, "new-password", `At least ${minPasswordLength()} characters`)}
                {next && <PasswordStrength password={next} id="sp-strength" />}
                {field("sp-again", "New password again", again, setAgain, "new-password", "Type it once more")}
                {error && <p className="rounded-[var(--radius-control)] border border-[var(--login-line)] bg-[var(--login-card)] px-3 py-2 text-xs font-medium text-[var(--login-ink)]">{error}</p>}
                <Button type="submit" loading={saving} disabled={saving} className="h-11 w-full justify-center rounded-[var(--radius-pill)]">
                  Save and continue
                </Button>
                <button type="button" onClick={logout} className="text-center text-xs font-medium text-[var(--login-ink-2)] hover:underline">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
