'use client';

import { LABELS } from '@msma/shared';
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  CircleHelp,
  Clock,
  FolderCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Send,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { canApprove, canSeePayroll, useAuth } from '@/lib/auth';
import { useApprovals } from '@/lib/queries';
import { cn, initials } from '@/lib/utils';
import { Dialog, SheetContent } from './ui/dialog';

const reviews201 = (role?: string) => role === 'HR_ADMIN' || role === 'SYSTEM_ADMIN';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Users;
  show?: (role?: string, isEmployee?: boolean) => boolean;
  badge?: boolean;
  soon?: boolean;
}

/** Grouped by what people come to do, in plain words. "Soon" pages are labelled so nobody is surprised. */
const NAV: { group: string | null; items: NavItem[] }[] = [
  {
    group: null,
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/approvals', label: 'Approvals', icon: CheckSquare, show: canApprove, badge: true },
      {
        href: '/my-requests',
        label: 'My requests',
        icon: Send,
        show: (_role, isEmployee) => !!isEmployee,
      },
    ],
  },
  {
    group: 'People',
    items: [
      { href: '/employees', label: 'Employees', icon: Users },
      { href: '/records', label: '201 files', icon: FolderCheck, show: reviews201 },
      { href: '/leave', label: 'Leave', icon: CalendarDays, show: canApprove },
    ],
  },
  {
    group: 'Pay',
    items: [{ href: '/payroll', label: 'Payroll', icon: Wallet, show: canSeePayroll }],
  },
  {
    group: 'Coming soon',
    items: [
      { href: '/attendance', label: 'Attendance', icon: Clock, soon: true },
      { href: '/reports', label: 'Reports', icon: BarChart3, soon: true },
    ],
  },
  {
    group: null,
    items: [
      { href: '/help', label: 'Help & glossary', icon: CircleHelp },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const approvals = useApprovals('PENDING', undefined, {
    enabled: canApprove(user?.role),
    refetchInterval: 30_000,
  });
  const pending = approvals.data?.total ?? 0;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-text">
      <div className="flex items-center gap-3 px-5 pt-5 pb-6">
        <div className="grid size-9 place-items-center rounded-lg bg-[#0e6b63] font-bold text-white">
          M
        </div>
        <div>
          <p className="font-semibold leading-tight">MSMA HRIS</p>
          <p className="text-xs text-sidebar-muted">Cebu City</p>
        </div>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-4 overflow-y-auto px-3">
        {NAV.map((g, gi) => {
          const items = g.items.filter((n) => !n.show || n.show(user?.role, !!user?.employeeId));
          if (!items.length) return null;
          return (
            <div key={gi} className="space-y-0.5">
              {g.group && (
                <p className="px-3 pb-1 text-[0.6875rem] font-semibold tracking-wide text-sidebar-muted uppercase">
                  {g.group}
                </p>
              )}
              {items.map((n) => {
                const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-white/10 font-medium text-white'
                        : 'text-sidebar-text/80 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <n.icon className="size-4" aria-hidden />
                    <span className="flex-1">{n.label}</span>
                    {n.soon && (
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[0.625rem] text-sidebar-muted">
                        Soon
                      </span>
                    )}
                    {n.badge && pending > 0 && (
                      <span
                        className="rounded-full bg-[#b45309] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-white"
                        aria-label={`${pending} pending`}
                      >
                        {pending}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      {user && (
        <div className="m-3 flex items-center gap-3 rounded-lg bg-white/5 p-3">
          <div className="grid size-9 place-items-center rounded-full bg-white/15 text-sm font-semibold">
            {initials(user.displayName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.displayName}</p>
            <p className="text-xs text-sidebar-muted">{LABELS.role[user.role]}</p>
          </div>
          <button
            onClick={logout}
            className="rounded p-1.5 text-sidebar-muted hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="no-print fixed inset-y-0 left-0 hidden w-60 lg:block">
        <SidebarContent />
      </aside>
      <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 lg:hidden">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger className="rounded-md p-2 hover:bg-bg" aria-label="Open menu">
            <Menu className="size-5" />
          </DialogPrimitive.Trigger>
          <SheetContent side="left" aria-describedby={undefined}>
            <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Dialog>
        <span className="font-semibold">MSMA HRIS</span>
      </header>
      <main className="print-full mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:py-7">
        {children}
      </main>
    </div>
  );
}
