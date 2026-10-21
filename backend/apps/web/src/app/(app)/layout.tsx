'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Shell } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { useAuth, WEB_ROLES } from '@/lib/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted" role="status">
        Loading…
      </div>
    );
  }

  if (!(WEB_ROLES as readonly string[]).includes(user.role)) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="max-w-sm rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold">Please use the mobile app</h1>
          <p className="mt-2 text-sm text-muted">
            The web dashboard is for HR, payroll and managers. Employees can clock in, file leave
            and see payslips in the MSMA HRIS app.
          </p>
          <Button className="mt-5" variant="outline" onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return <Shell>{children}</Shell>;
}
