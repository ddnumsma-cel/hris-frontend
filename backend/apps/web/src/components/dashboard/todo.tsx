'use client';

import {
  type DashboardSummary,
  documentType,
  formatAgo,
  formatDate,
  manilaToday,
  parseCutoff,
  type RecordsSummary,
} from '@msma/shared';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckSquare,
  ChevronRight,
  FileWarning,
  Fingerprint,
  FolderOpen,
  WifiOff,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Todo {
  key: string;
  icon: typeof Check;
  tone: 'danger' | 'warning' | 'accent';
  text: string;
  hint?: string;
  href: string;
  action: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * "Things to do today": plain sentences with one button each, so a first-time user knows what needs
 * attention without reading the charts. Items appear only for the roles that can act on them.
 */
export function TodoCard({
  dashboard,
  records,
  canApprove,
  canSeePayroll,
}: {
  dashboard: DashboardSummary;
  records: RecordsSummary | undefined;
  canApprove: boolean;
  canSeePayroll: boolean;
}) {
  const todos: Todo[] = [];
  const pending = dashboard.kpis.pendingApprovals;
  if (canApprove && pending > 0)
    todos.push({
      key: 'approvals',
      icon: CheckSquare,
      tone: 'warning',
      text: `${plural(pending, 'request')} ${pending === 1 ? 'is' : 'are'} waiting for your decision`,
      hint: 'Leave, overtime, undertime and time adjustments',
      href: '/approvals',
      action: 'Review',
    });
  if (records) {
    const renewals = records.renewals.filter((r) => r.status === 'EXPIRING').length;
    if (records.withExpired > 0)
      todos.push({
        key: 'expired',
        icon: FileWarning,
        tone: 'danger',
        text: `${plural(records.withExpired, 'employee')} ${records.withExpired === 1 ? 'has' : 'have'} an expired document`,
        hint: 'NBI or police clearance, license or ID. Ask for the renewed copy.',
        href: '/records',
        action: 'See who',
      });
    if (renewals > 0)
      todos.push({
        key: 'renewals',
        icon: CalendarClock,
        tone: 'warning',
        text: `${plural(renewals, 'document')} will expire in the next 30 days`,
        hint: 'Remind the employees to renew them',
        href: '/records',
        action: 'See list',
      });
    if (records.withoutBiometricConsent > 0)
      todos.push({
        key: 'consent',
        icon: Fingerprint,
        tone: 'danger',
        text: `${plural(records.withoutBiometricConsent, 'employee')} use${records.withoutBiometricConsent === 1 ? 's' : ''} the time clock without a signed biometric consent form`,
        hint: 'Data Privacy Act: collect and upload the consent form',
        href: '/records',
        action: 'Fix',
      });
    if (records.incomplete > 0)
      todos.push({
        key: 'incomplete',
        icon: FolderOpen,
        tone: 'accent',
        text: `${plural(records.incomplete, 'employee')} ${records.incomplete === 1 ? 'is' : 'are'} missing 201 file documents`,
        hint: records.topMissing[0]
          ? `Most often missing: ${documentType(records.topMissing[0].type).label}`
          : undefined,
        href: '/records',
        action: 'Open 201 files',
      });
  }
  for (const d of dashboard.devices.filter((x) => !x.online))
    todos.push({
      key: `device-${d.serial}`,
      icon: WifiOff,
      tone: 'warning',
      text: `The ${d.name} time clock is offline${d.lastSeenAt ? ` (last seen ${formatAgo(d.lastSeenAt)})` : ''}`,
      hint: 'Punches are kept on the device and sent when it reconnects. Check its network cable or Wi-Fi.',
      href: '/',
      action: 'OK',
    });
  if (canSeePayroll && dashboard.payroll) {
    const cutoff = parseCutoff(dashboard.payroll.cutoff);
    const today = manilaToday();
    const daysLeft = Math.round(
      (Date.parse(`${cutoff.to}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
    );
    if (daysLeft >= 0 && daysLeft <= 3)
      todos.push({
        key: 'cutoff',
        icon: Wallet,
        tone: 'accent',
        text:
          daysLeft === 0
            ? `Payroll cutoff ${dashboard.payroll.label} ends today`
            : `Payroll cutoff ${dashboard.payroll.label} ends in ${plural(daysLeft, 'day')}`,
        hint: `${plural(dashboard.payroll.openIssues, 'time record')} still missing a time-out. Pay date ${formatDate(dashboard.payroll.payDate)}.`,
        href: '/payroll',
        action: 'Open payroll',
      });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Things to do today</CardTitle>
        <span className="text-xs text-muted">
          {todos.length ? `${todos.length} item${todos.length === 1 ? '' : 's'}` : ''}
        </span>
      </CardHeader>
      <CardContent>
        {todos.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <Check className="size-4" aria-hidden /> All caught up. Nothing needs your attention
            right now.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {todos.map((t) => (
              <li key={t.key} className="flex items-center gap-3 py-2.5">
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full',
                    t.tone === 'danger' && 'bg-danger-soft text-danger',
                    t.tone === 'warning' && 'bg-warning-soft text-warning',
                    t.tone === 'accent' && 'bg-accent-soft text-accent',
                  )}
                >
                  {t.tone === 'danger' ? (
                    <AlertTriangle className="size-4" aria-hidden />
                  ) : (
                    <t.icon className="size-4" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{t.text}</span>
                  {t.hint && <span className="block text-xs text-muted">{t.hint}</span>}
                </span>
                {t.href !== '/' && (
                  <Link
                    href={t.href}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-bg"
                  >
                    {t.action} <ChevronRight className="size-4" aria-hidden />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
