import { lazy, Suspense, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LockIcon, PersonIcon } from "@/components/icons";
import { endedForInactivity, idleMinutes, signIn } from "@/lib/admin/auth";
import { getCredentials } from "@/lib/credentials";
import { landingPath } from "@/features/settings/landing";
import { settingsFor } from "@/lib/settings/store";
import { useAuth } from "./AuthContext";
import { LoginHero } from "./LoginHero";

const RegisterDialog = lazy(() => import("./RegisterDialog").then((m) => ({ default: m.RegisterDialog })));

/** Fields on the navy page: see-through white with a sky edge when focused. */
const fieldClass = "flex items-center gap-2 rounded-[var(--radius-pill)] border border-white/15 bg-white/[0.08] px-4 py-2.5 transition-colors focus-within:border-[var(--sky)] focus-within:bg-white/[0.12]";
const inputClass = "w-full bg-transparent text-sm text-white outline-none placeholder:text-white/45";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => (endedForInactivity() ? `You were signed out after ${idleMinutes()} minutes without activity. Please sign in again.` : null));
  const [registerOpen, setRegisterOpen] = useState(false);

  // Already signed in (e.g. a remembered session) — skip the form entirely.
  if (user) return <Navigate to={`/${user.role}`} replace />;

  function attemptLogin(u: string, p: string) {
    const result = signIn(u, p);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    login(result.workspace, result.account);
    // Their chosen landing page (Settings > Appearance), or the workspace Home.
    navigate(landingPath(result.workspace, settingsFor(result.account.id).appearance.landing), { replace: true });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    attemptLogin(username, password);
  }

  function quickFill(u: string, p: string) {
    setUsername(u);
    setPassword(p);
    setError(null);
  }

  return (
    // One navy page: the welcome panel on the left, the sign-in card in dark glass on the right.
    <>
    {/* Outside the panel: the panel's children are layered for the glow, which would undo position: fixed. */}
    <ThemeToggle className="fixed right-4 top-4 z-50 border border-white/15 bg-white/10 text-white hover:bg-white/15" />
    <div className="login-hero grid min-h-screen grid-cols-1 bg-brand-dark text-white lg:grid-cols-2">

      <LoginHero />

      <div className="flex items-center justify-center px-4 py-6 lg:py-10">
        <div className="panel-enter w-full max-w-md rounded-[var(--radius-panel)] border border-white/15 bg-white/[0.06] shadow-[0_24px_60px_-24px_color-mix(in_srgb,black_60%,transparent)] backdrop-blur-[var(--blur-panel)]">
          <div className="p-8">
            <div className="mb-6 text-center">
              <div className="font-display text-2xl font-semibold">Sign in</div>
              <div className="mt-1 text-sm text-white/65">Sign in with your MSMA account</div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="login-username" className="mb-1.5 ml-4 block text-xs font-medium text-white/70">
                  Username
                </label>
                <div className={fieldClass}>
                  <PersonIcon className="h-4 w-4 flex-none text-white/50" />
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError(null);
                    }}
                    placeholder="Enter your username"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 ml-4 block text-xs font-medium text-white/70">
                  Password
                </label>
                <div className={fieldClass}>
                  <LockIcon className="h-4 w-4 flex-none text-white/50" />
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="Enter your password"
                    className={inputClass}
                  />
                </div>
                {error && <p className="mt-2 rounded-[var(--radius-control)] border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white">{error}</p>}
              </div>

              <Button type="submit" className="h-11 w-full justify-center rounded-[var(--radius-pill)]">
                Sign in
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-white/70">
              New hire?{" "}
              <button type="button" onClick={() => setRegisterOpen(true)} className="font-semibold text-[var(--sky)] underline-offset-2 hover:underline">
                Register your account
              </button>
            </p>

            {/* Demo logins stay out of sight unless someone opens them. */}
            <details className="mt-5 rounded-[var(--radius-dropdown)] bg-white/5 px-3.5 py-3 text-xs">
              <summary className="cursor-pointer font-semibold text-white/70 select-none">Demo accounts — tap to fill</summary>
              <div className="mt-1.5 flex flex-col gap-1">
                {getCredentials().filter((c) => c.listed !== false).map((c) => (
                  <button key={c.username} type="button" onClick={() => quickFill(c.username, c.password)} className="flex items-center justify-between rounded-md px-1.5 py-1 text-left transition-colors hover:bg-white/10">
                    <span className="text-white/70">{c.label}</span>
                    <span className="font-num text-white/50">
                      {c.username} / {c.password}
                    </span>
                  </button>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>

    </div>
    {registerOpen && (
      <Suspense fallback={null}>
        <RegisterDialog open={registerOpen} onClose={() => setRegisterOpen(false)} />
      </Suspense>
    )}
    </>
  );
}
