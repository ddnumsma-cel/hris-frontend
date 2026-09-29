import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { DownloadIcon, SearchXIcon } from "@/components/icons";
import { fetchTeamReport } from "@/lib/api";
import { downloadTextFile, toCsv } from "@/lib/download";
import { reportTeamMembers, type ReportRow, type ReportStatus } from "@/lib/reportsData";
import { useRowsThatFit } from "@/lib/useRowsThatFit";
import { getReportDefinition, reportDefinitions, type ReportColumn } from "./reportDefinitions";

const PAGE_SIZE = 10;
// The mock records cover September 2026, so the period opens on that month.
const DEFAULT_FROM = "2026-09-01";
const DEFAULT_TO = "2026-09-30";

const statusVariant: Record<ReportStatus, ChipVariant> = {
  Approved: "good",
  Pending: "warn",
  Declined: "crit",
};

const fieldClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";

const dateFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });

function formatDate(iso: string) {
  return dateFormat.format(new Date(`${iso}T00:00:00`));
}

function Cell({ column, row }: { column: ReportColumn; row: ReportRow }) {
  const value = row[column.key];
  switch (column.kind) {
    case "employee":
      return (
        <div className="flex items-center gap-2.5">
          <MiniAvatar initials={row.initials} />
          <span className="whitespace-nowrap">{row.employee}</span>
        </div>
      );
    case "date":
      return <span className="whitespace-nowrap">{formatDate(String(value))}</span>;
    case "status":
      return row.status ? <Chip variant={statusVariant[row.status]}>{row.status}</Chip> : null;
    case "number":
      return (
        <span className="font-num tabular-nums">
          {value}
          {column.unit && <span className="ml-0.5 text-ink-3">{column.unit}</span>}
        </span>
      );
    default:
      return <>{value}</>;
  }
}

export function ManagerReportPage() {
  const { reportId } = useParams();
  const definition = getReportDefinition(reportId);
  if (!definition) return <Navigate to={`/manager/reports/${reportDefinitions[0].id}`} replace />;
  // Keyed so filters and paging start fresh when switching between reports.
  return <ReportView key={definition.id} reportId={definition.id} />;
}

function ReportView({ reportId }: { reportId: string }) {
  const definition = getReportDefinition(reportId)!;
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);
  const [member, setMember] = useState("All team members");
  const [status, setStatus] = useState<"All statuses" | ReportStatus>("All statuses");
  const [page, setPage] = useState(1);
  const tableCardRef = useRef<HTMLDivElement>(null);

  const reportQuery = useQuery({
    queryKey: ["manager", "report", definition.id],
    queryFn: () => fetchTeamReport(definition.id),
  });
  const pageSize = useRowsThatFit(tableCardRef, PAGE_SIZE, reportQuery.isLoading);

  const filtered = useMemo(
    () =>
      (reportQuery.data ?? [])
        .filter((row) => (!from || row.date >= from) && (!to || row.date <= to))
        .filter((row) => member === "All team members" || row.employee === member)
        .filter((row) => status === "All statuses" || row.status === status)
        .sort((a, b) => b.date.localeCompare(a.date) || a.employee.localeCompare(b.employee)),
    [reportQuery.data, from, to, member, status],
  );

  const summary = definition.summarize(filtered);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const isFiltered = from !== DEFAULT_FROM || to !== DEFAULT_TO || member !== "All team members" || status !== "All statuses";
  const periodLabel = from && to ? `${formatDate(from)} – ${formatDate(to)}` : "All dates";

  function updateFilter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function resetFilters() {
    setFrom(DEFAULT_FROM);
    setTo(DEFAULT_TO);
    setMember("All team members");
    setStatus("All statuses");
    setPage(1);
  }

  function exportCsv() {
    const csv = toCsv(
      filtered.map((row) =>
        Object.fromEntries(definition.columns.map((c) => [c.header, row[c.key] ?? ""])) as Record<string, string | number>,
      ),
    );
    downloadTextFile(`${definition.id}-report-${from || "start"}-to-${to || "end"}.csv`, csv, "text/csv");
  }

  return (
    <>
      <ContentHead
        title={`${definition.label} Report`}
        subtitle={`${definition.description} · ${periodLabel}`}
        actions={
          <Button
            variant="ghost"
            icon={<DownloadIcon className="h-3.75 w-3.75" />}
            disabled={filtered.length === 0}
            onClick={exportCsv}
          >
            Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1 text-[0.7rem] font-bold uppercase tracking-wider text-ink-3">
          From
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => updateFilter(setFrom)(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-[0.7rem] font-bold uppercase tracking-wider text-ink-3">
          To
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => updateFilter(setTo)(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-[0.7rem] font-bold uppercase tracking-wider text-ink-3">
          Team member
          <select value={member} onChange={(e) => updateFilter(setMember)(e.target.value)} className={fieldClass}>
            <option>All team members</option>
            {reportTeamMembers.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        {definition.hasStatus && (
          <label className="flex flex-col gap-1 text-[0.7rem] font-bold uppercase tracking-wider text-ink-3">
            Status
            <select
              value={status}
              onChange={(e) => updateFilter(setStatus)(e.target.value as typeof status)}
              className={fieldClass}
            >
              <option>All statuses</option>
              <option>Approved</option>
              <option>Pending</option>
              <option>Declined</option>
            </select>
          </label>
        )}
        {isFiltered && (
          <button
            type="button"
            onClick={resetFilters}
            className="px-1 py-2 text-sm font-bold text-brand-ink hover:underline"
          >
            Reset filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((tile) => (
          <StatTile
            key={tile.label}
            label={tile.label}
            value={reportQuery.isLoading ? "—" : tile.value}
            delta={reportQuery.isLoading ? undefined : tile.hint}
            tone={tile.tone}
          />
        ))}
      </div>

      {!reportQuery.isLoading && filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchXIcon />}
            title={`No ${definition.label.toLowerCase()} records for this period`}
            description="Try widening the date range or clearing the filters."
          />
        </Card>
      ) : (
        <>
          <Card ref={tableCardRef} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.82rem]">
                <thead>
                  <tr>
                    {definition.columns.map((c) => (
                      <th
                        key={c.key}
                        className={clsx(
                          "whitespace-nowrap border-b border-border bg-surface px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-ink-3",
                          c.kind === "number" ? "text-right" : "text-left",
                        )}
                      >
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportQuery.isLoading && <SkeletonRows columns={definition.columns.length} rows={5} />}
                  {pageRows.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-surface-2/60">
                      {definition.columns.map((c) => (
                        <td
                          key={c.key}
                          className={clsx(
                            "border-b border-border px-4 py-2.5",
                            c.kind === "number" && "text-right",
                          )}
                        >
                          <Cell column={c} row={row} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {filtered.length > pageSize && (
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </>
  );
}
