import { lazy, Suspense, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LockIcon, PersonIcon } from "@/components/icons";
import { endedForInactivity, idleMinutes, signIn, signInWithGoogleEmail, type SignInResult } from "@/lib/admin/auth";
import { GoogleButton } from "@/components/ui/GoogleButton";
import { isGoogleConfigured, signInWithGoogle } from "@/lib/googleAuth";
import type { Registered } from "./RegisterDialog";
import { getCredentials } from "@/lib/credentials";
import { backendOn } from "@/lib/backend/client";
import { BACKEND_DEMO_ACCOUNTS, backendSignIn } from "@/lib/backend/auth";
import { serverMode } from "@/lib/http";
import { landingPath } from "@/features/settings/landing";
import { settingsFor } from "@/lib/settings/store";
import { useAuth } from "./AuthContext";
import { LoginHero } from "./LoginHero";
import { Constellation } from "./Constellation";

/** [name, username, password] of the workbook sample employees; development only (see below). */
const SAMPLE_LOGINS = import.meta.env.DEV
  ? [
      ["Liza Estrada", "liza.estrada", "Sample-Estrada-2026!"],
      ["Katrina Enriquez", "katrina.enriquez", "Sample-Enriquez-2026!"],
      ["Victor Mangubat", "victor.mangubat", "Sample-Mangubat-2026!"],
      ["Albert John Panganiban", "albertjohn.panganiban", "Sample-Panganiban-2026!"],
      ["Irene Lopez", "irene.lopez", "Sample-Lopez-2026!"],
    ]
  : [];

const RegisterDialog = lazy(() => import("./RegisterDialog").then((m) => ({ default: m.RegisterDialog })));

/** Fields: see-through on the navy page (dark), white on the pale page (light), with a sky edge when focused. */
const fieldClass = "flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--login-line)] bg-[var(--login-field)] px-4 py-2.5 transition-colors focus-within:border-[var(--sky)] focus-within:bg-[var(--login-field-focus)]";
const inputClass = "w-full bg-transparent text-sm text-[var(--login-ink)] outline-none placeholder:text-[var(--login-ink-3)]";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => (endedForInactivity() ? `You were signed out after ${idleMinutes()} minutes without activity. Please sign in again.` : null));
  const [registerOpen, setRegisterOpen] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Already signed in (e.g. a remembered session) — skip the form entirely.
  if (user) return <Navigate to={`/${user.role}`} replace />;

  async function attemptLogin(u: string, p: string) {
    // The MSMA backend checks the email and password when connected; otherwise the HeyHR server or the in-browser accounts do.
    finish(backendOn() ? await backendSignIn(u, p) : await signIn(u, p));
  }

  function finish(result: SignInResult) {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    login(result.workspace, result.account);
    // Their chosen landing page (Settings > Appearance), or the workspace Home.
    navigate(landingPath(result.workspace, settingsFor(result.account.id).appearance.landing), { replace: true });
  }

  // People who registered with Google sign in with it (their Google email is their username).
  async function googleLogin() {
    setGoogleBusy(true);
    try {
      finish(signInWithGoogleEmail((await signInWithGoogle()).email));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in didn't finish");
    } finally {
      setGoogleBusy(false);
    }
  }

  // Straight in after registering: with their new password, or with Google.
  function signInRegistered(r: Registered) {
    if (r.password) attemptLogin(r.username, r.password);
    else void googleLogin();
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
    // One page (navy in dark mode, pale in light): the welcome panel on the left, the sign-in card in dark glass on the right.
    <>
    {/* Outside the panel: the panel's children are layered for the glow, which would undo position: fixed. */}
    <ThemeToggle className="fixed right-4 top-4 z-50 border border-[var(--login-line)] bg-[var(--login-card)] text-[var(--login-ink)] hover:bg-[var(--login-field-focus)]" />
    <div className="login-hero relative grid min-h-screen grid-cols-1 bg-[var(--login-bg)] text-[var(--login-ink)] lg:grid-cols-2">
      {/* Drifting constellation behind everything on the page; the columns (z-index 1, .login-hero > *) sit above it. */}
      <Constellation className="login-constellation" />

      <LoginHero />

      <div className="flex items-center justify-center px-4 py-6 lg:py-10">
        <div className="panel-enter w-full max-w-md rounded-[var(--radius-panel)] border border-[var(--login-line)] bg-[var(--login-panel)] shadow-[0_24px_60px_-24px_var(--login-shadow)] backdrop-blur-[var(--blur-panel)]">
          <div className="p-8">
            <div className="mb-6 text-center">
              <div className="font-display text-2xl font-semibold">Sign in</div>
              <div className="mt-1 text-sm text-[var(--login-ink-2)]">Sign in with your MSMA account</div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="login-username" className="mb-1.5 ml-4 block text-xs font-medium text-[var(--login-ink-2)]">
                  Username or email
                </label>
                <div className={fieldClass}>
                  <PersonIcon className="h-4 w-4 flex-none text-[var(--login-ink-3)]" />
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError(null);
                    }}
                    placeholder="Enter your username or email"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 ml-4 block text-xs font-medium text-[var(--login-ink-2)]">
                  Password
                </label>
                <div className={fieldClass}>
                  <LockIcon className="h-4 w-4 flex-none text-[var(--login-ink-3)]" />
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
                {error && <p className="mt-2 rounded-[var(--radius-control)] border border-[var(--login-line)] bg-[var(--login-card)] px-3 py-2 text-xs font-medium text-[var(--login-ink)]">{error}</p>}
              </div>

              <Button type="submit" className="h-11 w-full justify-center rounded-[var(--radius-pill)]">
                Sign in
              </Button>
            </form>

            {/* The HR server has no Google sign-in or self-registration yet. */}
            {isGoogleConfigured() && !backendOn() && (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center gap-3 text-xs text-[var(--login-ink-3)]">
                  <span className="h-px flex-1 bg-[var(--login-line)]" />
                  or
                  <span className="h-px flex-1 bg-[var(--login-line)]" />
                </div>
                <GoogleButton onClick={googleLogin} loading={googleBusy} />
              </div>
            )}

            {!backendOn() && (
              <p className="mt-4 text-center text-xs text-[var(--login-ink-2)]">
                New hire?{" "}
                <button type="button" onClick={() => setRegisterOpen(true)} className="font-semibold text-[var(--login-link)] underline-offset-2 hover:underline">
                  Register your account
                </button>
              </p>
            )}

            {/* Demo logins stay out of sight unless someone opens them. */}
            {!serverMode && (<details className="mt-5 rounded-[var(--radius-dropdown)] bg-[var(--login-hover)] px-3.5 py-3 text-xs">
              <summary className="cursor-pointer font-semibold text-[var(--login-ink-2)] select-none">Demo accounts — tap to fill</summary>
              <div className="mt-1.5 flex flex-col gap-1">
                {(backendOn() ? BACKEND_DEMO_ACCOUNTS : getCredentials().filter((c) => c.listed !== false)).map((c) => (
                  <button key={c.username} type="button" onClick={() => quickFill(c.username, c.password)} className="flex items-center justify-between rounded-md px-1.5 py-1 text-left transition-colors hover:bg-[var(--login-hover)]">
                    <span className="text-[var(--login-ink-2)]">{c.label}</span>
                    <span className="font-num text-[var(--login-ink-3)]">
                      {c.username} / {c.password}
                    </span>
                  </button>
                ))}
              </div>
            </details>)}
            {/* The payroll workbook's sample employees (database/tools/sample_logins_and_attendance.ts).
                Only in local development (npm run dev); a production build never shows passwords here. */}
            {serverMode && import.meta.env.DEV && (<details className="mt-5 rounded-[var(--radius-dropdown)] bg-[var(--login-hover)] px-3.5 py-3 text-xs">
              <summary className="cursor-pointer font-semibold text-[var(--login-ink-2)] select-none">Sample employees — tap to fill</summary>
              <div className="mt-1.5 flex flex-col gap-1">
                {SAMPLE_LOGINS.map(([name, u, p]) => (
                  <button key={u} type="button" onClick={() => quickFill(u, p)} className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-[var(--login-hover)]">
                    <span className="text-[var(--login-ink-2)]">{name}</span>
                    <span className="font-num text-[var(--login-ink-3)]">{u}</span>
                  </button>
                ))}
              </div>
            </details>)}
          </div>
        </div>
      </div>

    </div>
    {registerOpen && (
      <Suspense fallback={null}>
        <RegisterDialog open={registerOpen} onClose={() => setRegisterOpen(false)} onSignIn={signInRegistered} />
      </Suspense>
    )}
    </>
  );
}
