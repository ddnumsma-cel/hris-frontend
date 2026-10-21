'use client';

import { cutoffFor, formatLongDate, manilaParts, manilaToday } from '@msma/shared';
import { useState } from 'react';
import {
  KpiCards,
  LivePunches,
  PayrollCard,
  PendingApprovals,
  PresentBySite,
  Terminals,
} from '@/components/dashboard/sections';
import { TodoCard } from '@/components/dashboard/todo';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { type Decision, DecisionDialog } from '@/components/decision-dialog';
import { ErrorNote, PageHeader, Segmented } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/form';
import { canApprove, canSeePayroll, useAuth } from '@/lib/auth';
import { useApprovals, useDashboard, useOrgFilters, useRecordsSummary } from '@/lib/queries';

function greeting() {
  const h = manilaParts(new Date()).hour;
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const SHORT_SITE: Record<string, string> = {
  'HQ Cebu City': 'HQ Cebu City',
  'Mandaue branch': 'Mandaue',
  'Lapu-Lapu branch': 'Lapu-Lapu',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [site, setSite] = useState<string>('ALL');
  const filters = useOrgFilters();
  const dashboard = useDashboard(site === 'ALL' ? undefined : site);
  const approver = canApprove(user?.role);
  const pending = useApprovals('PENDING', undefined, {
    enabled: approver,
    refetchInterval: 10_000,
  });
  const reviews201 = user?.role === 'HR_ADMIN' || user?.role === 'SYSTEM_ADMIN';
  const records = useRecordsSummary(site === 'ALL' ? undefined : site, reviews201);
  const [decision, setDecision] = useState<Decision>(null);
  const today = manilaToday();
  const firstName = user?.displayName.split(' ')[0] ?? '';
  const isManager = user?.role === 'MANAGER';

  const siteOptions = [
    { value: 'ALL', label: 'All sites' },
    ...(filters.data?.sites ?? []).map((s) => ({
      value: s.id,
      label: SHORT_SITE[s.name] ?? s.name,
    })),
  ];
  const d = dashboard.data;
  const pendingItems = (pending.data?.items ?? []).filter(
    (a) => site === 'ALL' || !d || d.presentBySite.some((s) => s.siteName === a.employee.siteName),
  );

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle={`${formatLongDate(today)} · cutoff ${cutoffFor(today).label}`}
        actions={
          !isManager && (
            <Segmented
              label="Filter by site"
              value={site}
              options={siteOptions}
              onChange={setSite}
            />
          )
        }
      />

      {dashboard.error && !d && (
        <ErrorNote message={dashboard.error.message} onRetry={() => dashboard.refetch()} />
      )}

      {!d && !dashboard.error && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {d && (
        <div className="space-y-4">
          <TodoCard
            dashboard={d}
            records={reviews201 ? records.data : undefined}
            canApprove={approver}
            canSeePayroll={canSeePayroll(user?.role)}
          />
          <KpiCards kpis={d.kpis} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Attendance rate, last 14 working days</CardTitle>
                <p className="num text-xs text-muted">
                  {site === 'ALL' ? 'All sites' : siteOptions.find((o) => o.value === site)?.label}{' '}
                  · avg{' '}
                  {(d.trend.reduce((a, t) => a + t.rate, 0) / Math.max(1, d.trend.length)).toFixed(
                    1,
                  )}
                  %
                </p>
              </CardHeader>
              <CardContent>
                <TrendChart data={d.trend} />
              </CardContent>
            </Card>
            <PresentBySite sites={d.presentBySite} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <LivePunches punches={d.latestPunches} updatedAt={d.generatedAt} />
            </div>
            <div className="lg:col-span-2">
              {approver ? (
                <PendingApprovals
                  items={pendingItems.slice(0, 5)}
                  total={d.kpis.pendingApprovals}
                  onDecide={(item, dec) => setDecision({ item, decision: dec })}
                />
              ) : (
                <Terminals devices={d.devices} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {d.payroll && (
              <div className={approver ? 'lg:col-span-3' : 'lg:col-span-5'}>
                <PayrollCard payroll={d.payroll} />
              </div>
            )}
            {approver && (
              <div className={d.payroll ? 'lg:col-span-2' : 'lg:col-span-5'}>
                <Terminals devices={d.devices} />
              </div>
            )}
          </div>
        </div>
      )}

      <DecisionDialog value={decision} onClose={() => setDecision(null)} />
    </>
  );
}
