'use client';

import { formatDate, formatDateRange, manilaToday } from '@msma/shared';
import { Download, Printer, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ErrorNote, PageHeader } from '@/components/page-header';
import { RequestStatusBadge } from '@/components/status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select, Skeleton } from '@/components/ui/form';
import { useAuth } from '@/lib/auth';
import { useLeaveOverview, useOrgFilters } from '@/lib/queries';
import { downloadCsv } from '@/lib/utils';

const TYPES = [
  { code: 'VL', label: 'Vacation' },
  { code: 'SL', label: 'Sick' },
  { code: 'SIL', label: 'Service incentive' },
] as const;

/** Who is away in the next 30 days, and how many leave days everyone has left this year. */
export default function LeavePage() {
  const { user } = useAuth();
  const filters = useOrgFilters();
  const [siteId, setSiteId] = useState('');
  const [search, setSearch] = useState('');
  const overview = useLeaveOverview(siteId || undefined);
  const data = overview.data;
  const today = manilaToday();

  const balances = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.balances ?? []).filter(
      (b) => !q || b.employee.fullName.toLowerCase().includes(q),
    );
  }, [data, search]);
  const awayToday = (data?.upcoming ?? []).filter(
    (r) => r.status === 'APPROVED' && r.startDate <= today && r.endDate >= today,
  ).length;
  const pending = (data?.upcoming ?? []).filter((r) => r.status === 'PENDING').length;

  const exportCsv = () =>
    downloadCsv(
      `leave-balances-${today}.csv`,
      ['Name', 'Site', ...TYPES.map((t) => `${t.label} leave left (days)`)],
      balances.map((b) => [
        b.employee.fullName,
        b.employee.siteName,
        ...TYPES.map((t) => b.remaining[t.code] ?? ''),
      ]),
    );

  return (
    <>
      <PageHeader
        title="Leave"
        subtitle={
          user?.role === 'MANAGER'
            ? 'Who in your team is away soon, and their leave days left'
            : 'Who is away in the next 30 days, and leave days left this year'
        }
        actions={
          <>
            {user?.role !== 'MANAGER' && (
              <Select aria-label="Site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                <option value="">All sites</option>
                {filters.data?.sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </Select>
            )}
            <Button variant="outline" onClick={exportCsv} disabled={!data}>
              <Download /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
          </>
        }
      />

      {overview.error && (
        <ErrorNote message={overview.error.message} onRetry={() => overview.refetch()} />
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted">On leave today</p>
          <p className="num mt-1 text-2xl font-semibold">{data ? awayToday : '…'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Leave in the next 30 days</p>
          <p className="num mt-1 text-2xl font-semibold">{data ? data.upcoming.length : '…'}</p>
        </Card>
        <Link href="/approvals" className="rounded-xl border border-border bg-card p-4 hover:bg-bg">
          <p className="text-sm text-muted">Waiting for a decision</p>
          <p className="num mt-1 text-2xl font-semibold text-warning">{data ? pending : '…'}</p>
          <p className="mt-0.5 text-xs text-muted">Open Approvals to decide</p>
        </Link>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Who is away</CardTitle>
          {data && <p className="text-sm text-muted">{formatDateRange(data.from, data.to)}</p>}
        </CardHeader>
        <CardContent>
          {!data && !overview.error && <Skeleton className="h-24" />}
          {data?.upcoming.length === 0 && (
            <p className="text-sm text-muted">Nobody has leave in the next 30 days.</p>
          )}
          {!!data?.upcoming.length && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Employee</th>
                    <th className="py-2 pr-4 font-medium">Site</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Dates</th>
                    <th className="py-2 pr-4 text-right font-medium">Days</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcoming.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-2 pr-4">
                        <Link href={`/employees/${r.employee.id}`} className="hover:underline">
                          {r.employee.fullName}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-muted">{r.employee.siteName}</td>
                      <td className="py-2 pr-4">{r.leaveTypeName}</td>
                      <td className="py-2 pr-4">
                        {r.startDate === r.endDate
                          ? formatDate(r.startDate)
                          : formatDateRange(r.startDate, r.endDate)}
                      </td>
                      <td className="num py-2 pr-4 text-right">{r.days}</td>
                      <td className="py-2">
                        <RequestStatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Leave days left this year</CardTitle>
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted" />
            <Input
              aria-label="Search name"
              placeholder="Search name"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {!data && !overview.error && <Skeleton className="h-48" />}
          {data && (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Employee</th>
                    <th className="py-2 pr-4 font-medium">Site</th>
                    {TYPES.map((t) => (
                      <th key={t.code} className="py-2 pr-4 text-right font-medium">
                        {t.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => (
                    <tr key={b.employee.id} className="border-t border-border">
                      <td className="py-2 pr-4">
                        <Link href={`/employees/${b.employee.id}`} className="hover:underline">
                          {b.employee.fullName}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-muted">{b.employee.siteName}</td>
                      {TYPES.map((t) => (
                        <td key={t.code} className="num py-2 pr-4 text-right">
                          {b.remaining[t.code] ?? '–'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {balances.length === 0 && <p className="py-4 text-sm text-muted">No match.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
