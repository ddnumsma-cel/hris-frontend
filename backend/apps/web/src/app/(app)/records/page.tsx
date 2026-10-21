'use client';

import { unwrap } from '@msma/api-client';
import {
  addDays,
  type DocumentType,
  documentType,
  formatDate,
  manilaToday,
  RECORDS_FILTERS,
} from '@msma/shared';
import { ChevronLeft, ChevronRight, Download, Printer, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChecklistStatusBadge, CompletenessBar } from '@/components/file201';
import { ErrorNote, PageHeader, Segmented } from '@/components/page-header';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select, Skeleton } from '@/components/ui/form';
import { api } from '@/lib/api';
import { useOrgFilters, useRecords, useRecordsSummary } from '@/lib/queries';
import { cn, downloadCsv } from '@/lib/utils';

type Filter = (typeof RECORDS_FILTERS)[number];
const FILTER_LABELS: Record<Filter, string> = {
  ALL: 'Everyone',
  INCOMPLETE: 'Missing documents',
  EXPIRED: 'Expired',
  EXPIRING: 'Expiring soon',
  COMPLETE: 'Complete',
};
const PAGE_SIZE = 25;

function Tile({
  label,
  value,
  note,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  tone?: 'danger' | 'warning' | 'success';
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-xl border bg-card p-4 text-left transition-colors hover:bg-bg',
        active ? 'border-accent ring-1 ring-accent' : 'border-border',
      )}
    >
      <p className="text-sm text-muted">{label}</p>
      <p
        className={cn(
          'num mt-1 text-2xl font-semibold',
          tone === 'danger' && 'text-danger',
          tone === 'warning' && 'text-warning',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </button>
  );
}

export default function RecordsPage() {
  const router = useRouter();
  const toast = useToast();
  const filters = useOrgFilters();
  const [siteId, setSiteId] = useState('');
  const [filter, setFilter] = useState<Filter>('INCOMPLETE');
  const [missingType, setMissingType] = useState<DocumentType | ''>('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const summary = useRecordsSummary(siteId || undefined);
  const query = {
    siteId: siteId || undefined,
    filter,
    missingType: missingType || undefined,
    q: q || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const list = useRecords(query);
  const s = summary.data;
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;
  const choose = (f: Filter, type: DocumentType | '' = '') => {
    setFilter(f);
    setMissingType(type);
    setPage(1);
  };

  async function exportCsv() {
    try {
      const all = await unwrap(
        api.GET('/records', { params: { query: { ...query, page: 1, pageSize: 200 } } }),
      );
      downloadCsv(
        `201-files-${manilaToday()}.csv`,
        [
          'Employee no',
          'Name',
          'Site',
          'Position',
          'Complete (%)',
          'Missing',
          'Expired',
          'Expiring soon',
          'Missing documents',
          'Next expiry',
          'Expires on',
        ],
        all.items.map((r) => [
          r.employeeNo,
          r.fullName,
          r.siteName,
          r.position,
          r.summary.percent,
          r.summary.missing,
          r.summary.expired,
          r.summary.expiring,
          r.missingTypes.map((t) => documentType(t).label).join('; '),
          r.nextExpiry ? documentType(r.nextExpiry.type).label : '',
          r.nextExpiry?.expiresOn ?? '',
        ]),
      );
    } catch (e) {
      toast('error', (e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="201 files"
        subtitle="Who still needs documents, and which documents expire soon"
        actions={
          <>
            <Select
              aria-label="Site"
              value={siteId}
              onChange={(e) => (setSiteId(e.target.value), setPage(1))}
            >
              <option value="">All sites</option>
              {filters.data?.sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={exportCsv}>
              <Download /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
          </>
        }
      />

      {summary.error && (
        <ErrorNote message={summary.error.message} onRetry={() => summary.refetch()} />
      )}
      {!s && !summary.error && <Skeleton className="mb-4 h-24 rounded-xl" />}
      {s && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Tile
            label="Complete 201 files"
            value={`${s.complete} of ${s.employees}`}
            note={`${Math.round((s.complete / Math.max(1, s.employees)) * 100)}% of employees`}
            tone="success"
            onClick={() => choose('COMPLETE')}
            active={filter === 'COMPLETE'}
          />
          <Tile
            label="Missing documents"
            value={s.incomplete}
            note="employees"
            tone="danger"
            onClick={() => choose('INCOMPLETE')}
            active={filter === 'INCOMPLETE' && !missingType}
          />
          <Tile
            label="Expired documents"
            value={s.withExpired}
            note="employees"
            tone="danger"
            onClick={() => choose('EXPIRED')}
            active={filter === 'EXPIRED'}
          />
          <Tile
            label="Expiring in 30 days"
            value={s.expiringSoon}
            note="documents to renew"
            tone="warning"
            onClick={() => choose('EXPIRING')}
            active={filter === 'EXPIRING'}
          />
          <Tile
            label="No biometric consent"
            value={s.withoutBiometricConsent}
            note="needed before time clock enrollment"
            tone={s.withoutBiometricConsent ? 'danger' : 'success'}
            onClick={() => choose('INCOMPLETE', 'BIOMETRIC_CONSENT')}
            active={missingType === 'BIOMETRIC_CONSENT'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card className="mb-3 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <Segmented
                label="Show"
                value={filter}
                options={RECORDS_FILTERS.map((f) => ({ value: f, label: FILTER_LABELS[f] }))}
                onChange={(f) => choose(f)}
              />
              <div className="relative min-w-52 flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                  aria-hidden
                />
                <Input
                  aria-label="Search name or employee number"
                  className="pl-9"
                  placeholder="Search name or employee no."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            {missingType && (
              <p className="mt-2 text-sm">
                Only employees missing <strong>{documentType(missingType).label}</strong>.{' '}
                <button className="text-accent underline" onClick={() => setMissingType('')}>
                  Show all
                </button>
              </p>
            )}
          </Card>

          {list.error && <ErrorNote message={list.error.message} onRetry={() => list.refetch()} />}
          <Card className="overflow-hidden">
            <div className="relative overflow-x-auto">
              <table className="data-table w-full text-sm">
                <thead className="bg-bg text-left text-xs text-muted">
                  <tr>
                    <th className="font-medium">Employee</th>
                    <th className="hidden font-medium md:table-cell">Site</th>
                    <th className="font-medium">Complete</th>
                    <th className="font-medium">What is missing or expiring</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data?.items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-muted">
                        No employees in this list.
                      </td>
                    </tr>
                  )}
                  {list.data?.items.map((r) => (
                    <tr
                      key={r.employeeId}
                      className="cursor-pointer border-t border-border align-top hover:bg-bg"
                      onClick={() => router.push(`/employees/${r.employeeId}?tab=201`)}
                    >
                      <td>
                        <Link
                          href={`/employees/${r.employeeId}?tab=201`}
                          className="font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.fullName}
                        </Link>
                        <p className="num text-xs text-muted">
                          {r.employeeNo} · {r.position}
                        </p>
                      </td>
                      <td className="hidden md:table-cell">{r.siteName.replace(' branch', '')}</td>
                      <td>
                        <CompletenessBar {...r.summary} compact />
                      </td>
                      <td>
                        <ul className="space-y-1">
                          {r.missingTypes.slice(0, 3).map((t) => (
                            <li key={t} className="flex flex-wrap items-center gap-2">
                              <ChecklistStatusBadge status="MISSING" /> {documentType(t).label}
                            </li>
                          ))}
                          {r.missingTypes.length > 3 && (
                            <li className="text-xs text-muted">
                              and {r.missingTypes.length - 3} more
                            </li>
                          )}
                          {r.nextExpiry && r.nextExpiry.expiresOn <= addDays(manilaToday(), 30) && (
                            <li className="flex flex-wrap items-center gap-2">
                              <ChecklistStatusBadge
                                status={
                                  r.nextExpiry.expiresOn < manilaToday() ? 'EXPIRED' : 'EXPIRING'
                                }
                                expiresOn={r.nextExpiry.expiresOn}
                              />
                              {documentType(r.nextExpiry.type).label}
                            </li>
                          )}
                          {r.missingTypes.length === 0 &&
                            (!r.nextExpiry ||
                              r.nextExpiry.expiresOn > addDays(manilaToday(), 30)) && (
                              <li className="text-success">Nothing needed</li>
                            )}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm">
              <span className="text-muted">
                {list.data
                  ? `${list.data.total} employee${list.data.total === 1 ? '' : 's'} · page ${page} of ${pages}`
                  : 'Loading…'}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= pages}
                >
                  Next <ChevronRight />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Renewals due</CardTitle>
              <span className="text-xs text-muted">expired or within 30 days</span>
            </CardHeader>
            <CardContent>
              {s && s.renewals.length === 0 && (
                <p className="text-sm text-muted">Nothing to renew.</p>
              )}
              <ul className="divide-y divide-border text-sm">
                {s?.renewals.slice(0, 12).map((r) => (
                  <li
                    key={`${r.employeeId}-${r.type}`}
                    className="flex items-start justify-between gap-3 py-2"
                  >
                    <span className="min-w-0">
                      <Link
                        href={`/employees/${r.employeeId}?tab=201`}
                        className="font-medium hover:underline"
                      >
                        {r.employeeName}
                      </Link>
                      <span className="block text-xs text-muted">
                        {documentType(r.type).label} · {r.siteName.replace(' branch', '')}
                      </span>
                    </span>
                    <ChecklistStatusBadge status={r.status} expiresOn={r.expiresOn} />
                  </li>
                ))}
              </ul>
              {s && s.renewals.length > 12 && (
                <button
                  className="mt-2 text-sm text-accent underline"
                  onClick={() => choose('EXPIRING')}
                >
                  See all in the list
                </button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Most often missing</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {s?.topMissing.map((m) => (
                  <li key={m.type}>
                    <button
                      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1 text-left hover:bg-bg"
                      onClick={() => choose('INCOMPLETE', m.type)}
                    >
                      <span>{documentType(m.type).label}</span>
                      <span className="num font-semibold">{m.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Complete files by site</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {s?.bySite.map((b) => {
                const pct = Math.round((b.complete / Math.max(1, b.employees)) * 100);
                return (
                  <div key={b.siteName}>
                    <div className="flex justify-between text-sm">
                      <span>{b.siteName}</span>
                      <span className="num text-muted">
                        {b.complete} of {b.employees} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-border/70" aria-hidden>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <p className="text-xs text-muted">As of {formatDate(manilaToday())}.</p>
        </div>
      </div>
    </>
  );
}
