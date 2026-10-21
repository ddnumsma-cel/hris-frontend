'use client';

import { unwrap } from '@msma/api-client';
import {
  type EmployeeListItem,
  EMPLOYMENT_STATUSES,
  type EmploymentStatus,
  formatDate,
  formatPHP,
  LABELS,
} from '@msma/shared';
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChecklistStatusBadge } from '@/components/file201';
import { ErrorNote, PageHeader } from '@/components/page-header';
import { DtrStatusBadge, EmploymentStatusBadge } from '@/components/status';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/form';
import { api } from '@/lib/api';
import { useEmployees, useOrgFilters } from '@/lib/queries';
import { downloadCsv } from '@/lib/utils';

const PAGE_SIZE = 25;

export default function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [siteId, setSiteId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState<EmploymentStatus | ''>('');
  const [page, setPage] = useState(1);
  const router = useRouter();
  const toast = useToast();
  const filters = useOrgFilters();

  // Debounce typing so the list doesn't refetch on every key press.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const query = {
    q: q || undefined,
    siteId: siteId || undefined,
    departmentId: departmentId || undefined,
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const employees = useEmployees(query);
  const data = employees.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const showRecords = !!data?.items.some((i) => i.record201);

  async function exportCsv() {
    try {
      const all = await unwrap(
        api.GET('/employees', { params: { query: { ...query, page: 1, pageSize: 200 } } }),
      );
      downloadCsv(
        'employees-201.csv',
        [
          'Employee no',
          'Last name',
          'First name',
          'Position',
          'Department',
          'Site',
          'Status',
          'Hire date',
          'Daily rate (PHP)',
          '201 file complete (%)',
          '201 items missing',
        ],
        all.items.map((e) => [
          e.employeeNo,
          e.lastName,
          e.firstName,
          e.position,
          e.department.name,
          e.site.name,
          LABELS.employmentStatus[e.status],
          e.hireDate,
          e.dailyRate,
          e.record201?.percent ?? '',
          e.record201?.missing ?? '',
        ]),
      );
    } catch (e) {
      toast('error', (e as Error).message);
    }
  }

  const resetPage =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={data ? `${data.total} employee${data.total === 1 ? '' : 's'}` : 'Loading…'}
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download /> Export CSV
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <label htmlFor="emp-search" className="sr-only">
              Search by name or employee number
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              id="emp-search"
              className="pl-9"
              placeholder="Search name or employee no."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            aria-label="Site"
            value={siteId}
            onChange={(e) => resetPage(setSiteId)(e.target.value)}
          >
            <option value="">All sites</option>
            {filters.data?.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Department"
            value={departmentId}
            onChange={(e) => resetPage(setDepartmentId)(e.target.value)}
          >
            <option value="">All departments</option>
            {filters.data?.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Employment status"
            value={status}
            onChange={(e) => resetPage(setStatus)(e.target.value as EmploymentStatus | '')}
          >
            <option value="">All statuses</option>
            {EMPLOYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LABELS.employmentStatus[s]}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {employees.error && (
        <ErrorNote message={employees.error.message} onRetry={() => employees.refetch()} />
      )}

      <Card className="overflow-hidden">
        <div className="relative overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead className="bg-bg text-left text-xs text-muted">
              <tr>
                <th className="font-medium">Employee no.</th>
                <th className="font-medium">Name</th>
                <th className="hidden font-medium md:table-cell">Position</th>
                <th className="hidden font-medium lg:table-cell">Department</th>
                <th className="font-medium">Site</th>
                <th className="font-medium">Status</th>
                <th className="hidden font-medium sm:table-cell">Today</th>
                {showRecords && <th className="font-medium">201 file</th>}
                <th className="hidden text-right font-medium xl:table-cell">Hired</th>
                <th className="hidden text-right font-medium md:table-cell">Daily rate</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-muted">
                    No employees match these filters.
                  </td>
                </tr>
              )}
              {data?.items.map((e) => (
                <tr
                  key={e.id}
                  className="cursor-pointer border-t border-border hover:bg-bg"
                  onClick={() => router.push(`/employees/${e.id}`)}
                >
                  <td className="num text-muted">{e.employeeNo}</td>
                  <td>
                    {/* Real button for keyboard and screen-reader users; the whole row is also clickable. */}
                    <Link
                      href={`/employees/${e.id}`}
                      className="text-left font-medium hover:underline"
                      aria-label={`Open the record of ${e.fullName}`}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {e.lastName}, {e.firstName}
                    </Link>
                  </td>
                  <td className="hidden text-muted md:table-cell">{e.position}</td>
                  <td className="hidden text-muted lg:table-cell">{e.department.name}</td>
                  <td>{e.site.name.replace(' branch', '')}</td>
                  <td>
                    <EmploymentStatusBadge status={e.status} />
                  </td>
                  <td className="hidden sm:table-cell">
                    <DtrStatusBadge status={e.todayStatus} />
                  </td>
                  {showRecords && (
                    <td>
                      <Record201Cell brief={e.record201} />
                    </td>
                  )}
                  <td className="hidden text-right text-muted xl:table-cell">
                    {formatDate(e.hireDate)}
                  </td>
                  <td className="num hidden text-right md:table-cell">{formatPHP(e.dailyRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm">
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft /> Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pages}
              aria-label="Next page"
            >
              Next <ChevronRight />
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}

/** Plain summary of the 201 file: "Complete", "2 missing", "1 expired". */
function Record201Cell({ brief }: { brief: EmployeeListItem['record201'] }) {
  if (!brief) return <span className="text-muted">-</span>;
  if (brief.expired) return <ChecklistStatusBadge status="EXPIRED" />;
  if (brief.missing)
    return (
      <span className="inline-flex items-center gap-1.5">
        <ChecklistStatusBadge status="MISSING" />
        <span className="num text-xs text-muted">{brief.missing}</span>
      </span>
    );
  if (brief.expiring) return <ChecklistStatusBadge status="EXPIRING" />;
  return <ChecklistStatusBadge status="ON_FILE" />;
}
