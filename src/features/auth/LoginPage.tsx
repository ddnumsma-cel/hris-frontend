import { lazy, Suspense, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CalendarIcon, FingerprintIcon, LockIcon, OrgChartIcon, PersonIcon, ShieldIcon } from "@/components/icons";
import { demoCredentials, findCredential } from "@/lib/credentials";
import { useAuth } from "./AuthContext";

const RegisterDialog = lazy(() => import("./RegisterDialog").then((m) => ({ default: m.RegisterDialog })));

const highlights = [
  { icon: <CalendarIcon className="h-4.5 w-4.5" />, text: "Leave, payroll and DTR in one place" },
  { icon: <FingerprintIcon className="h-4.5 w-4.5" />, text: "Biometric onsite and remote face-scan attendance" },
  { icon: <OrgChartIcon className="h-4.5 w-4.5" />, text: "Org-wide visibility for HR and Partners" },
  { icon: <ShieldIcon className="h-4.5 w-4.5" />, text: "Role-based access for Employee, Partner and HR" },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  // Already signed in (e.g. a remembered session) — skip the form entirely.
  if (user) return <Navigate to={`/${user.role}`} replace />;

  function attemptLogin(u: string, p: string) {
    const credential = findCredential(u, p);
    if (!credential) {
      setError("Incorrect username or password.");
      return;
    }
    login(credential.role);
    navigate(`/${credential.role}`, { replace: true });
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
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <ThemeToggle className="fixed right-4 top-4 z-50 border border-border bg-surface text-ink-2 shadow-sm hover:bg-surface-2" />

      <div className="flex flex-col justify-center bg-brand-dark px-6 py-6 text-white sm:px-10 lg:px-16 lg:py-12">
        <div className="mx-auto flex w-full max-w-md flex-col gap-8">
          <div className="flex items-center gap-2.5">
            <img src="/brand/msma-mark.png" alt="MSMA" className="h-9 w-auto" />
            <div className="font-display text-lg font-extrabold">MSMA</div>
            <p className="ml-1 text-sm text-white/70 lg:hidden">People operations for MSMA Group</p>
          </div>

          <div className="hidden lg:block">
            <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
              People operations for MSMA Group
            </h1>
            <p className="mt-3 text-[0.95rem] text-white/70">
              Leave, payroll, attendance, recruitment and compliance — one workspace for every role in the firm.
            </p>
          </div>

          <ul className="hidden flex-col gap-3.5 lg:flex">
            {highlights.map((h) => (
              <li key={h.text} className="flex items-center gap-3 text-sm text-white/85">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/10">
                  {h.icon}
                </span>
                {h.text}
              </li>
            ))}
          </ul>

          <span className="hidden w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70 lg:inline-flex">
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#8fc93f]" />
            Demo environment · sample data
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center bg-bg px-4 py-6 lg:py-10">
        <div className="login-card panel-enter w-full max-w-md rounded-2xl border border-border p-6 text-ink shadow-lg sm:p-7">
          <div className="mb-6">
            <div className="font-display text-lg font-extrabold">Sign in</div>
            <div className="text-xs text-ink-2">Sign in with your MSMA account</div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-username" className="mb-1 block text-xs font-semibold text-ink-2">
                Username
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 transition-colors focus-within:border-brand">
                <PersonIcon className="h-4 w-4 flex-none text-ink-3" />
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
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1 block text-xs font-semibold text-ink-2">
                Password
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 transition-colors focus-within:border-brand">
                <LockIcon className="h-4 w-4 flex-none text-ink-3" />
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
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
                />
              </div>
              {error && <p className="mt-1 text-xs font-medium text-critical">{error}</p>}
            </div>

            <Button type="submit" className="w-full justify-center">
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-ink-2">
            New hire?{" "}
            <button
              type="button"
              onClick={() => setRegisterOpen(true)}
              className="font-semibold text-brand-ink underline-offset-2 hover:underline"
            >
              Register your account
            </button>
          </p>

          <div className="mt-5 rounded-lg border border-dashed border-border bg-surface-2 px-3.5 py-3 text-xs">
            <div className="mb-1.5 font-semibold text-ink-2">Demo accounts — tap to fill</div>
            <div className="flex flex-col gap-1">
              {demoCredentials.map((c) => (
                <button
                  key={c.username}
                  type="button"
                  onClick={() => quickFill(c.username, c.password)}
                  className="flex items-center justify-between rounded-md px-1.5 py-1 text-left transition-colors hover:bg-surface"
                >
                  <span className="text-ink-2">{c.label}</span>
                  <span className="font-num text-ink-3">
                    {c.username} / {c.password}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {registerOpen && (
        <Suspense fallback={null}>
          <RegisterDialog open={registerOpen} onClose={() => setRegisterOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
