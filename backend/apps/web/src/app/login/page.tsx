'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form';
import { useAuth } from '@/lib/auth';

const DEMO_ACCOUNTS = [
  { email: 'hr@msma.test', label: 'HR Admin (Princess)' },
  { email: 'payroll@msma.test', label: 'Payroll Admin (Liza)' },
  { email: 'manager@msma.test', label: 'Manager, Mandaue (Carlo)' },
];

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('hr@msma.test');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The demo password is shown only on this PC / the office network, not through `pnpm share`.
  const [onLocalNetwork, setOnLocalNetwork] = useState(false);
  useEffect(() => {
    setOnLocalNetwork(
      /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname),
    );
  }, []);

  useEffect(() => {
    if (user) router.replace('/');
  }, [user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-bg p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-[#0e6b63] text-lg font-bold text-white">
            M
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">MSMA HRIS</h1>
            <p className="text-sm text-muted">HR dashboard · Cebu City</p>
          </div>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-border bg-card p-6"
          noValidate
        >
          <h2 className="mb-4 text-base font-semibold">Sign in</h2>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Label htmlFor="password" className="mt-4">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && (
            <p
              className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger"
              role="alert"
            >
              {error}
            </p>
          )}
          <Button type="submit" className="mt-5 w-full" disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm">
          <p className="font-medium">Sample data: demo accounts</p>
          <p className="mt-1 text-muted">
            {onLocalNetwork ? (
              <>
                Password for all: <span className="num">Demo@2026</span>
              </>
            ) : (
              'Use the password you were given with the link.'
            )}
          </p>
          <ul className="mt-2 space-y-1">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  className="text-accent hover:underline"
                  onClick={() => setEmail(a.email)}
                >
                  {a.email}
                </button>{' '}
                <span className="text-muted">· {a.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
