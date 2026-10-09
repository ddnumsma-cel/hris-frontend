import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DownloadIcon } from "@/components/icons";
import { downloadTextFile, toCsv } from "@/lib/download";
import { escapeHtml, openPrintDocument } from "@/lib/printDocument";
import { admin } from "@/lib/admin/store";
import { periodsFor, REPORTS, type Category, type ReportDef, type ReportResult } from "@/lib/reports/api";
import { useOfficeFilter } from "../OfficeFilterContext";
import { FilterChip, LoadError } from "../corehr/ui";
import { Choice, SearchBox, SimpleTable, Toolbar, type Col } from "../timekeeping/common";
import { formatValue } from "./format";

const COPY: Record<Category, { title: string; subtitle: string }> = {
  hr: { title: "HR reports", subtitle: "Employee lists, headcount, movements and leave. Download or print any report." },
  attendance: { title: "Attendance reports", subtitle: "Attendance, lates and overtime, from the time logs." },
  payroll: { title: "Payroll reports", subtitle: "Pay per cut-off, worked out from salaries and attendance." },
  statutory: { title: "Government reports", subtitle: "SSS, PhilHealth, Pag-IBIG, BIR tax and 13th month, ready for remittance." },
  management: { title: "Management reports", subtitle: "Turnover, attendance and costs by department, for decisions." },
};

function printReport(def: ReportDef, periodLabel: string, office: string, result: ReportResult) {
  const columns = result.columns.filter((c) => c.only !== "screen");
  const head = columns.map((c) => `<th class="${c.kind && c.kind !== "text" ? "num" : ""}">${escapeHtml(c.label)}</th>`).join("");
  const body = result.rows.map((r) => `<tr>${columns.map((c) => `<td class="${c.kind && c.kind !== "text" ? "num" : ""}">${escapeHtml(formatValue(r[c.key] ?? "", c.kind))}</td>`).join("")}</tr>`).join("");
  const meta = result.summary.map((s) => `<div><span class="meta-label">${escapeHtml(s.label)}</span><span class="meta-value">${escapeHtml(formatValue(s.value, s.kind))}</span></div>`).join("");
  openPrintDocument(
    def.name,
    `<div class="doc-header"><div class="doc-brand">${escapeHtml(admin.settings.companyName)}</div><div class="doc-title"><h1>${escapeHtml(def.name)}</h1><p>${escapeHtml(periodLabel)} · ${escapeHtml(office)}</p></div></div>
     <div class="meta-grid">${meta}</div>
     <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
     ${result.note ? `<p class="doc-footer">${escapeHtml(result.note)}</p>` : ""}
     <p class="doc-footer">Generated ${escapeHtml(new Date().toLocaleString("en-PH"))}</p>`,
  );
}

function ReportBody({ def }: { def: ReportDef }) {
  const { office } = useOfficeFilter();
  const periods = periodsFor(def.period);
  const [periodId, setPeriodId] = useState(periods[0]!.id);
  const [query, setQuery] = useState("");
  const period = periods.find((p) => p.id === periodId) ?? periods[0]!;
  const result = useQuery({ queryKey: ["reports", def.id, period.id, office], queryFn: () => def.run(period, office), staleTime: 0 });

  if (result.isError) return <LoadError onRetry={() => result.refetch()} />;

  const data = result.data;
  const first = data?.columns[0]?.key;
  const q = query.trim().toLowerCase();
  const rows = (data?.rows ?? []).filter((r) => !q || String(r[first!] ?? "").toLowerCase().includes(q));
  const cols: Col<Record<string, string | number>>[] = (data?.columns ?? []).filter((c) => c.only !== "file").map((c, i) => ({
    header: c.label,
    align: c.kind && c.kind !== "text" ? "right" : undefined,
    cell: (r) => <span className={i === 0 ? "font-medium" : c.kind === "money" ? "font-num" : undefined}>{formatValue(r[c.key] ?? "", c.kind)}</span>,
  }));
  const fileName = `${def.name} ${period.label}`.replace(/[^\w]+/g, "-").toLowerCase();

  const download = () => {
    if (!data) return;
    const csv = toCsv(data.rows.map((r) => Object.fromEntries(data.columns.filter((c) => c.only !== "screen").map((c) => [c.label, r[c.key] ?? ""]))));
    downloadTextFile(`${fileName}.csv`, csv, "text/csv");
  };

  return (
    <>
      <Toolbar>
        {def.period !== "none" && <Choice label="Period" value={period.id} onChange={setPeriodId} options={periods.map((p) => ({ value: p.id, label: p.label }))} />}
        <SearchBox value={query} onChange={setQuery} placeholder={`Search ${data?.columns[0]?.label.toLowerCase() ?? ""}`} />
        <span className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" disabled={!data} onClick={() => data && printReport(def, period.label, office, data)}>
            Print
          </Button>
          <Button size="sm" disabled={!data} onClick={download}>
            <DownloadIcon className="h-3.5 w-3.5" /> Download CSV
          </Button>
        </span>
      </Toolbar>
      <div className="flex flex-wrap items-stretch gap-2">
        {result.isLoading
          ? <Skeleton className="h-14 w-full" />
          : data?.summary.map((s) => (
              <div key={s.label} className="min-w-36 rounded-xl border border-border bg-surface px-3.5 py-2">
                <div className="text-xs text-ink-2">{s.label}</div>
                <div className="font-display text-lg font-semibold">{formatValue(s.value, s.kind)}</div>
              </div>
            ))}
        {data?.note && <p className="flex max-w-md flex-1 items-center text-xs text-ink-3">{data.note}</p>}
      </div>
      <SimpleTable rows={rows} rowKey={(r) => JSON.stringify(r)} cols={cols} loading={result.isLoading} empty="Nothing to show for this period." />
    </>
  );
}

export function ReportPage({ category }: { category: Category }) {
  const [params, setParams] = useSearchParams();
  const reports = REPORTS.filter((r) => r.category === category);
  const def = reports.find((r) => r.id === params.get("report")) ?? reports[0]!;
  const copy = COPY[category];

  return (
    <>
      <ContentHead title={copy.title} subtitle={copy.subtitle} />
      <div className="flex flex-col gap-1.5">
        {reports.length > 1 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="group" aria-label="Report">
          {reports.map((r) => (
            <FilterChip key={r.id} active={r.id === def.id} onClick={() => setParams({ report: r.id }, { replace: true })}>
              {r.name}
            </FilterChip>
          ))}
        </div>
        )}
        <p className="text-sm text-ink-2">{def.description}</p>
      </div>
      <ReportBody key={def.id} def={def} />
    </>
  );
}

export const HrReportsPage = () => <ReportPage category="hr" />;
export const AttendanceReportsPage = () => <ReportPage category="attendance" />;
export const PayrollReportsPage = () => <ReportPage category="payroll" />;
export const StatutoryReportsPage = () => <ReportPage category="statutory" />;
export const ManagementReportsPage = () => <ReportPage category="management" />;
