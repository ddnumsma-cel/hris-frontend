import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { DownloadIcon } from "@/components/icons";
import { admin } from "@/lib/admin/store";
import { downloadTextFile, toCsv } from "@/lib/download";
import { listYearEnd, type Form2316 } from "@/lib/pay/yearend";
import { escapeHtml, openPrintDocument } from "@/lib/printDocument";
import { LoadError, Pill } from "../corehr/ui";
import { Choice, Name, SearchBox, SimpleTable, Toolbar } from "../timekeeping/common";

const peso = (n: number) => `${n < 0 ? "−" : ""}₱${Math.abs(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

function print2316(forms: Form2316[], year: number) {
  const company = admin.settings.companyName;
  const page = (f: Form2316) => {
    const row = (label: string, v: number | string) => `<tr><td>${escapeHtml(label)}</td><td class="num">${escapeHtml(typeof v === "number" ? peso(v) : v)}</td></tr>`;
    return `<section style="page-break-after:always">
      <div class="doc-header"><div class="doc-brand">${escapeHtml(company)}</div><div class="doc-title"><h1>BIR Form 2316</h1><p>Certificate of Compensation Payment / Tax Withheld · ${year}</p></div></div>
      <div class="meta-grid">
        <div><span class="meta-label">Employee</span><span class="meta-value">${escapeHtml(f.name)}</span></div>
        <div><span class="meta-label">TIN</span><span class="meta-value">${escapeHtml(f.tin || "Missing")}</span></div>
        <div><span class="meta-label">Position</span><span class="meta-value">${escapeHtml(f.position)}</span></div>
        <div><span class="meta-label">Period</span><span class="meta-value">${escapeHtml(`${shortDate(f.from)} to ${shortDate(f.to)}`)}</span></div>
        <div><span class="meta-label">Address</span><span class="meta-value">${escapeHtml(f.address || "—")}</span></div>
      </div>
      <table><tbody>
        ${row("Gross compensation", f.gross)}
        ${row("Less non-taxable: 13th month and other benefits (up to ₱90,000)", -f.thirteenthExempt)}
        ${row("Less non-taxable: SSS, PhilHealth and Pag-IBIG (employee share)", -f.contributions)}
        <tr class="total-row"><td>Taxable compensation</td><td class="num">${escapeHtml(peso(f.taxable))}</td></tr>
        ${row("Tax due", f.taxDue)}
        ${row("Tax withheld", f.withheld)}
        <tr class="total-row"><td>${f.adjustment >= 0 ? "Over-withheld (refund to employee)" : "Under-withheld (to collect)"}</td><td class="num">${escapeHtml(peso(Math.abs(f.adjustment)))}</td></tr>
      </tbody></table>
      ${f.estimated ? `<p class="doc-footer">${f.estimated} of ${f.cutoffs} cutoffs are estimated from the salary on file because they have no approved payroll run yet. Issue the final form after the December run.</p>` : ""}
      <p class="cert-body" style="margin-top:36px">_______________________________<br>Authorized representative, ${escapeHtml(company)}</p>
      <p class="cert-body">_______________________________<br>${escapeHtml(f.name)}, employee</p>
    </section>`;
  };
  openPrintDocument(forms.length === 1 ? `BIR 2316 ${forms[0]!.name}` : `BIR 2316 ${year}`, forms.map(page).join(""));
}

/** Payroll → Year-end BIR forms: 2316 per employee and the alphalist for 1604-C. */
export function YearEndPage() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [query, setQuery] = useState("");
  const list = useQuery({ queryKey: ["payroll", "year-end", year], queryFn: () => listYearEnd(year), staleTime: 0 });
  if (list.isError) return <LoadError onRetry={() => list.refetch()} />;
  const all = list.data ?? [];
  const q = query.trim().toLowerCase();
  const rows = all.filter((f) => !q || `${f.name} ${f.employeeId}`.toLowerCase().includes(q));
  const refunds = all.filter((f) => f.adjustment > 0).reduce((n, f) => n + f.adjustment, 0);
  const collect = all.filter((f) => f.adjustment < 0).reduce((n, f) => n - f.adjustment, 0);
  const estimated = all.some((f) => f.estimated > 0);

  const alphalist = () =>
    downloadTextFile(
      `alphalist-1604c-${year}.csv`,
      toCsv(
        all.map((f, i) => ({
          Seq: i + 1,
          TIN: f.tin,
          "Employee name": f.name,
          "Period from": f.from,
          "Period to": f.to,
          "Gross compensation": f.gross.toFixed(2),
          "13th month & other benefits (non-taxable)": f.thirteenthExempt.toFixed(2),
          "SSS, PhilHealth, Pag-IBIG (non-taxable)": f.contributions.toFixed(2),
          "Taxable compensation": f.taxable.toFixed(2),
          "Tax due": f.taxDue.toFixed(2),
          "Tax withheld": f.withheld.toFixed(2),
          "Over/(under) withheld": f.adjustment.toFixed(2),
        })),
      ),
      "text/csv",
    );

  return (
    <>
      <ContentHead
        title="Year-end BIR forms"
        subtitle="BIR 2316 for each employee and the alphalist for the annual 1604-C, from the year's payroll runs."
        actions={
          <span className="flex gap-2">
            <Button variant="ghost" disabled={!all.length} onClick={() => print2316(all, year)}>
              Print all 2316
            </Button>
            <Button icon={<DownloadIcon className="h-4 w-4" />} disabled={!all.length} onClick={alphalist}>
              Download alphalist
            </Button>
          </span>
        }
      />
      <Toolbar>
        <Choice label="Year" value={String(year)} onChange={(v) => setYear(Number(v))} options={[thisYear, thisYear - 1].map((y) => ({ value: String(y), label: String(y) }))} />
        <SearchBox value={query} onChange={setQuery} />
        <span className="text-sm text-ink-2">
          Refunds {peso(refunds)} · to collect {peso(collect)}
        </span>
      </Toolbar>
      {estimated && <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs text-warning">Cutoffs without an approved payroll run are estimated from the salary on file, so these are projections until the December run is approved. The year-end tax adjustment is usually settled in that run.</p>}
      <SimpleTable<Form2316>
        rows={rows}
        rowKey={(f) => f.employeeId}
        loading={list.isLoading}
        empty="No one was paid in this year."
        cols={[
          { header: "Employee", cell: (f) => <Name name={f.name} sub={f.tin ? `TIN ${f.tin}` : "No TIN"} /> },
          { header: "Gross", align: "right", cell: (f) => <span className="font-num">{peso(f.gross)}</span> },
          { header: "Taxable", align: "right", cell: (f) => <span className="font-num">{peso(f.taxable)}</span> },
          { header: "Tax due", align: "right", cell: (f) => <span className="font-num">{peso(f.taxDue)}</span> },
          { header: "Withheld", align: "right", cell: (f) => <span className="font-num">{peso(f.withheld)}</span> },
          {
            header: "Adjustment",
            align: "right",
            cell: (f) => (Math.abs(f.adjustment) < 0.01 ? <span className="text-ink-3">—</span> : <Pill tone={f.adjustment > 0 ? "good" : "warn"}>{f.adjustment > 0 ? `Refund ${peso(f.adjustment)}` : `Collect ${peso(-f.adjustment)}`}</Pill>),
          },
          {
            header: "",
            align: "right",
            cell: (f) => (
              <Button size="sm" variant="ghost" onClick={() => print2316([f], year)}>
                2316
              </Button>
            ),
          },
        ]}
      />
    </>
  );
}
