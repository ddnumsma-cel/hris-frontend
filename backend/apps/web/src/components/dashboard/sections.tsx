'use client';

import {
  type ApprovalItem,
  type DashboardSummary,
  formatAgo,
  formatDate,
  formatPHP,
  formatTime,
  LABELS,
} from '@msma/shared';
import { AlertTriangle, CircleCheck, CircleX } from 'lucide-react';
import Link from 'next/link';
import { ApprovalTypeBadge, PunchStatusBadge } from '@/components/status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ---------- KPI cards ----------

export function KpiCards({ kpis }: { kpis: DashboardSummary['kpis'] }) {
  const cards = [
    { label: 'Headcount', value: kpis.headcount, hint: 'Active employees' },
    { label: 'Present today', value: kpis.present, hint: 'Clocked in today', tone: 'text-accent' },
    {
      label: 'Late',
      value: kpis.late,
      hint: 'Past shift start + 5 min grace',
      tone: 'text-warning',
    },
    {
      label: 'Absent',
      value: kpis.absent,
      hint: 'No punch, no approved leave',
      tone: 'text-danger',
    },
    { label: 'On leave', value: kpis.onLeave, hint: 'Approved leave today' },
    {
      label: 'Pending approvals',
      value: kpis.pendingApprovals,
      hint: 'Leave, overtime, undertime, time adjustments',
      href: '/approvals',
    },
  ];
  return (
    <section
      aria-label="Today at a glance"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
    >
      {cards.map((c) => {
        const body = (
          <Card
            className={cn('h-full px-4 py-3.5', c.href && 'transition-colors hover:border-accent')}
          >
            <p className="text-sm text-muted">{c.label}</p>
            <p className={cn('num mt-1 text-[1.75rem] font-semibold leading-none', c.tone)}>
              {c.value}
            </p>
            <p className="mt-2 text-xs text-muted">{c.hint}</p>
          </Card>
        );
        return c.href ? (
          <Link key={c.label} href={c.href} className="rounded-xl">
            {body}
          </Link>
        ) : (
          <div key={c.label}>{body}</div>
        );
      })}
    </section>
  );
}

// ---------- Present by site ----------

export function PresentBySite({ sites }: { sites: DashboardSummary['presentBySite'] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Present today by site</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {sites.map((s) => {
            const pct = s.scheduled ? Math.round((s.present / s.scheduled) * 100) : 0;
            return (
              <li key={s.siteId}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{s.siteName}</span>
                  <span className="num text-muted">
                    <span className="font-semibold text-fg">{s.present}</span> / {s.scheduled}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg"
                  role="meter"
                  aria-valuenow={s.present}
                  aria-valuemin={0}
                  aria-valuemax={s.scheduled}
                  aria-label={`${s.siteName}: ${s.present} of ${s.scheduled} present`}
                >
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-5 text-xs text-muted">Scheduled excludes rest days and approved leave.</p>
      </CardContent>
    </Card>
  );
}

// ---------- Live punches ----------

export function LivePunches({
  punches,
  updatedAt,
}: {
  punches: DashboardSummary['latestPunches'];
  updatedAt: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            Live punches
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted">
            Refreshes every 10 seconds · updated {formatTime(updatedAt)}
          </p>
        </div>
      </CardHeader>
      <div className="relative overflow-x-auto">
        <table className="data-table w-full text-sm" aria-label="Latest punches">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-border">
              <th className="font-medium">Time</th>
              <th className="font-medium">Employee</th>
              <th className="font-medium">Site</th>
              <th className="hidden font-medium sm:table-cell">Method</th>
              <th className="font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {punches.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted">
                  No punches yet today.
                </td>
              </tr>
            )}
            {punches.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className={cn('num', p.kind === 'IN' && p.lateMinutes > 0 && 'text-warning')}>
                  {formatTime(p.punchedAt)}
                </td>
                <td className="font-medium">{p.employeeName}</td>
                <td className="text-muted">{p.siteName.replace(' branch', '')}</td>
                <td className="hidden text-muted sm:table-cell">{LABELS.verifyMode[p.method]}</td>
                <td>
                  <PunchStatusBadge kind={p.kind} lateMinutes={p.lateMinutes} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------- Pending approvals ----------

export function PendingApprovals({
  items,
  total,
  onDecide,
}: {
  items: ApprovalItem[];
  total: number;
  onDecide: (item: ApprovalItem, decision: 'approve' | 'reject') => void;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Pending approvals</CardTitle>
        <Link href="/approvals" className="text-xs text-accent hover:underline">
          {total} waiting · view all
        </Link>
      </CardHeader>
      <ul className="divide-y divide-border px-2 pb-2">
        {items.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted">
            Nothing to approve. All caught up.
          </li>
        )}
        {items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <ApprovalTypeBadge type={a.type} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.employee.fullName}</p>
              <p className="truncate text-xs text-muted" title={a.detail}>
                {a.detail}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDecide(a, 'reject')}
                aria-label={`Reject ${a.employee.fullName}'s request`}
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => onDecide(a, 'approve')}
                aria-label={`Approve ${a.employee.fullName}'s request`}
              >
                Approve
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------- Payroll cutoff ----------

const STEPS = ['Draft', 'Computed', 'Reviewed', 'Approved', 'Locked'];

export function PayrollCard({ payroll }: { payroll: NonNullable<DashboardSummary['payroll']> }) {
  const current = 1; // preview is computed from live DTRs
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Payroll: {payroll.label} cutoff</CardTitle>
          <p className="mt-0.5 text-xs text-warning">SAMPLE: rates not yet verified</p>
        </div>
        <p className="text-right text-xs text-muted">
          Pay date {formatDate(payroll.payDate)}
          <br />
          {payroll.employees} employees
        </p>
      </CardHeader>
      <CardContent>
        <ol className="mb-5 grid grid-cols-5 gap-1.5" aria-label="Payroll run status">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === current ? 'step' : undefined}>
              <div className={cn('h-1.5 rounded-full', i <= current ? 'bg-accent' : 'bg-border')} />
              <p
                className={cn(
                  'mt-1.5 text-xs',
                  i === current ? 'font-semibold text-fg' : 'text-muted',
                )}
              >
                {s}
              </p>
            </li>
          ))}
        </ol>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">Gross pay</dt>
            <dd className="num text-lg font-semibold">{formatPHP(payroll.gross)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Deductions (SSS, PhilHealth, Pag-IBIG, tax)</dt>
            <dd className="num text-lg font-semibold">{formatPHP(payroll.deductions)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Net pay</dt>
            <dd className="num text-lg font-semibold text-accent">{formatPHP(payroll.net)}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
          <p
            className={cn(
              'flex items-center gap-1.5',
              payroll.openIssues ? 'text-warning' : 'text-muted',
            )}
          >
            {payroll.openIssues > 0 && <AlertTriangle className="size-4" aria-hidden />}
            {payroll.openIssues > 0
              ? `${payroll.openIssues} DTR${payroll.openIssues === 1 ? '' : 's'} with a missing time-out in this cutoff`
              : 'No open DTR issues in this cutoff'}
          </p>
          <Link href="/payroll" className="font-medium text-accent hover:underline">
            Review run
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Biometric terminals ----------

export function Terminals({ devices }: { devices: DashboardSummary['devices'] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Biometric terminals</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-2">
          {devices.map((d) => (
            <li key={d.serial} className="flex items-start gap-2.5">
              {d.online ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <CircleX className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">{d.name}</p>
                <p className={cn('text-xs', d.online ? 'text-muted' : 'text-danger')}>
                  {d.online ? 'Online' : 'Offline'} ·{' '}
                  {d.lastSeenAt ? `synced ${formatAgo(d.lastSeenAt)}` : 'never synced'}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          Offline terminals keep recording punches and upload them when the connection returns.
        </p>
      </CardContent>
    </Card>
  );
}
