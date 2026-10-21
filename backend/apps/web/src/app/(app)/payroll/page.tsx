'use client';

import {
  addDays,
  cutoffFor,
  formatDate,
  formatPHP,
  manilaToday,
  type PayrollPreviewLine,
} from '@msma/shared';
import { AlertTriangle, Download, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ErrorNote, PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, Skeleton } from '@/components/ui/form';
import { useOrgFilters, usePayrollPreview } from '@/lib/queries';
import { downloadCsv } from '@/lib/utils';

const MONEY_COLUMNS: { key: keyof PayrollPreviewLine; label: string; strong?: boolean }[] = [
  { key: 'basicPay', label: 'Basic' },
  { key: 'overtimePay', label: 'Overtime' },
  { key: 'nightDiffPay', label: 'Night diff' },
  { key: 'holidayPay', label: 'Holiday' },
  { key: 'lateUndertimeDeduction', label: 'Late / Undertime' },
  { key: 'grossPay', label: 'Gross', strong: true },
  { key: 'sss', label: 'SSS' },
  { key: 'philhealth', label: 'PhilHealth' },
  { key: 'pagibig', label: 'Pag-IBIG' },
  { key: 'withholdingTax', label: 'Tax' },
  { key: 'totalDeductions', label: 'Deductions', strong: true },
  { key: 'netPay', label: 'Net pay', strong: true },
];

function recentCutoffs() {
  const current = cutoffFor(manilaToday());
  const previous = cutoffFor(addDays(current.from, -1));
  const older = cutoffFor(addDays(previous.from, -1));
  return [current, previous, older];
}

export default function PayrollPage() {
  const cutoffs = useMemo(recentCutoffs, []);
  const [cutoff, setCutoff] = useState(cutoffs[0].code);
  const [siteId, setSiteId] = useState('');
  const filters = useOrgFilters();
  const preview = usePayrollPreview(cutoff, siteId || undefined);
  const p = preview.data;

  const columnTotal = (key: keyof PayrollPreviewLine) =>
    // Sum centavos as integers: exact, no float drift.
    (
      (p?.lines ?? []).reduce(
        (sum, l) => sum + BigInt(String(l[key]).replace('.', '')),
        BigInt(0),
      ) as bigint
    )
      .toString()
      .replace(/(\d{2})$/, '.$1')
      .padStart(4, '0');

  function exportCsv() {
    if (!p) return;
    downloadCsv(
      `payroll-preview-${p.cutoff}.csv`,
      [
        'Employee no',
        'Name',
        'Site',
        'Daily rate',
        'Days paid',
        ...MONEY_COLUMNS.map((c) => c.label),
      ],
      p.lines.map((l) => [
        l.employeeNo,
        l.fullName,
        l.siteName,
        l.dailyRate,
        l.daysPaid,
        ...MONEY_COLUMNS.map((c) => String(l[c.key])),
      ]),
    );
  }

  return (
    <>
      <PageHeader
        title="Payroll preview"
        subtitle={
          p
            ? `${p.label} · ${p.totals.employees} employees · overtime is paid only when approved`
            : 'Loading…'
        }
        actions={
          <>
            <Select
              aria-label="Cutoff"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              className="w-44"
            >
              {cutoffs.map((c, i) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                  {i === 0 ? ' (current)' : ''}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Site"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="w-44"
            >
              <option value="">All sites</option>
              {filters.data?.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={exportCsv} disabled={!p}>
              <Download /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!p}>
              <Printer /> Print
            </Button>
          </>
        }
      />

      <div
        className="mb-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-warning"
        role="note"
      >
        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold">SAMPLE: rates not yet verified</p>
          <p className="mt-0.5">
            {p?.notice.replace(/^SAMPLE: rates not yet verified\.\s*/, '') ??
              'This preview uses approximate SSS, PhilHealth, Pag-IBIG and withholding tax tables. Do not use it for actual payroll.'}
          </p>
          {p && (
            <p className="mt-2 flex flex-wrap gap-1.5">
              {p.rates.map((r) => (
                <Badge key={r.name} tone={r.verified ? 'success' : 'warning'} title={r.source}>
                  {r.name.replace('_', ' ')} · {r.verified ? 'verified' : 'not verified'} · from{' '}
                  {formatDate(r.effectiveFrom)}
                </Badge>
              ))}
            </p>
          )}
        </div>
      </div>

      {preview.error && (
        <ErrorNote message={preview.error.message} onRetry={() => preview.refetch()} />
      )}

      {p && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Card className="px-4 py-3.5">
            <p className="text-sm text-muted">Gross pay</p>
            <p className="num mt-1 text-xl font-semibold">{formatPHP(p.totals.gross)}</p>
          </Card>
          <Card className="px-4 py-3.5">
            <p className="text-sm text-muted">Total deductions</p>
            <p className="num mt-1 text-xl font-semibold">{formatPHP(p.totals.deductions)}</p>
          </Card>
          <Card className="px-4 py-3.5">
            <p className="text-sm text-muted">Net pay</p>
            <p className="num mt-1 text-xl font-semibold text-accent">{formatPHP(p.totals.net)}</p>
          </Card>
        </div>
      )}

      {!p && !preview.error && <Skeleton className="h-96 rounded-xl" />}

      {p && (
        <Card className="overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="data-table w-full text-sm">
              <thead className="sticky top-0 z-10 bg-bg text-left text-xs text-muted">
                <tr>
                  <th className="sticky left-0 bg-bg font-medium">Employee</th>
                  <th className="font-medium">Site</th>
                  <th className="text-right font-medium">Days</th>
                  {MONEY_COLUMNS.map((c) => (
                    <th key={c.key} className="text-right font-medium whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.lines.map((l) => (
                  <tr key={l.employeeId} className="border-t border-border">
                    <td className="sticky left-0 bg-card whitespace-nowrap">
                      <p className="font-medium">{l.fullName}</p>
                      <p className="num text-xs text-muted">
                        {l.employeeNo} · {formatPHP(l.dailyRate)}/day
                      </p>
                    </td>
                    <td className="whitespace-nowrap text-muted">
                      {l.siteName.replace(' branch', '')}
                    </td>
                    <td className="num text-right">{l.daysPaid}</td>
                    {MONEY_COLUMNS.map((c) => (
                      <td
                        key={c.key}
                        className={`num text-right whitespace-nowrap ${c.strong ? 'font-semibold' : ''} ${c.key === 'netPay' ? 'text-accent' : ''}`}
                      >
                        {formatPHP(String(l[c.key]))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-bg font-semibold">
                <tr className="border-t-2 border-border">
                  <td className="sticky left-0 bg-bg">Total ({p.lines.length})</td>
                  <td />
                  <td />
                  {MONEY_COLUMNS.map((c) => (
                    <td key={c.key} className="num text-right whitespace-nowrap">
                      {formatPHP(columnTotal(c.key))}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
