import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DownloadIcon } from "@/components/icons";
import { admin } from "@/lib/admin/store";
import { myName, myPayslips, type MyPayslip } from "@/lib/ess/api";
import { formatPHP } from "@/lib/format";
import { escapeHtml, openPrintDocument } from "@/lib/printDocument";
import { LoadError, Pill } from "../admin/corehr/ui";
import { duration } from "../admin/timekeeping/format";

/** The attendance behind the pay: hours are net of the automatic, unpaid lunch break. */
function timeLines(p: MyPayslip): [string, string][] {
  const t = p.line.time;
  return [
    ["Days present", String(t.present)],
    ["Hours worked", t.workedMinutes ? duration(t.workedMinutes) : "—"],
    ["Lunch breaks (unpaid, automatic)", t.lunchBreaks ? `${t.lunchBreaks} · ${duration(t.lunchMinutes)}` : "—"],
    ["Late", t.lateMinutes ? duration(t.lateMinutes) : "None"],
    ["Undertime", t.undertimeMinutes ? duration(t.undertimeMinutes) : "None"],
    ["Absences", t.absent ? String(t.absent) : "None"],
    ...(t.overtimeMinutes ? [["Approved overtime", duration(t.overtimeMinutes)] as [string, string]] : []),
  ];
}

function lines(p: MyPayslip) {
  const l = p.line;
  return {
    earnings: [
      ["Basic pay", l.basic],
      ...(l.overtime ? [["Overtime", l.overtime] as const] : []),
      ...(l.premiums ? [["Holiday and night pay", l.premiums] as const] : []),
      ...(l.deductions ? [["Less absences, lates and undertime", -l.deductions] as const] : []),
    ] as [string, number][],
    deductions: [
      ["SSS", l.sssEe],
      ["PhilHealth", l.phEe],
      ["Pag-IBIG", l.piEe],
      ["Withholding tax", l.tax],
    ] as [string, number][],
  };
}

function printSlip(p: MyPayslip) {
  const { earnings, deductions } = lines(p);
  const row = ([k, v]: [string, number]) => `<tr><td>${escapeHtml(k)}</td><td class="num">${escapeHtml(formatPHP(v))}</td></tr>`;
  const totalDed = deductions.reduce((n, [, v]) => n + v, 0);
  openPrintDocument(
    `Payslip ${p.period.label}`,
    `<div class="doc-header"><div class="doc-brand">${escapeHtml(admin.settings.companyName)}</div><div class="doc-title"><h1>Payslip</h1><p>${escapeHtml(p.period.label)}</p></div></div>
     <div class="meta-grid"><div><span class="meta-label">Employee</span><span class="meta-value">${escapeHtml(myName())}</span></div><div><span class="meta-label">Department</span><span class="meta-value">${escapeHtml(p.line.person.department)}</span></div></div>
     <table><thead><tr><th>Earnings</th><th class="num">Amount</th></tr></thead><tbody>${earnings.map(row).join("")}<tr class="total-row"><td>Gross pay</td><td class="num">${escapeHtml(formatPHP(p.line.gross))}</td></tr></tbody></table>
     <table style="margin-top:20px"><thead><tr><th>Deductions</th><th class="num">Amount</th></tr></thead><tbody>${deductions.map(row).join("")}<tr class="total-row"><td>Total deductions</td><td class="num">${escapeHtml(formatPHP(totalDed))}</td></tr></tbody></table>
     <table style="margin-top:20px"><thead><tr><th>Time &amp; attendance</th><th class="num"></th></tr></thead><tbody>${timeLines(p).map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td class="num">${escapeHtml(v)}</td></tr>`).join("")}</tbody></table>
     <table style="margin-top:20px"><tbody><tr class="total-row"><td>Take-home pay</td><td class="num">${escapeHtml(formatPHP(p.line.net))}</td></tr></tbody></table>
     <p class="doc-footer">${p.released ? "Released" : "Preview: this cut-off hasn't ended, so the final amount may change."} Generated ${escapeHtml(new Date().toLocaleString("en-PH"))}.</p>`,
  );
}

function Row({ k, v, strong }: { k: string; v: number; strong?: boolean }) {
  return (
    <div className={clsx("flex justify-between py-1.5 text-sm", strong && "font-semibold")}>
      <span className={strong ? "" : "text-ink-2"}>{k}</span>
      <span className="font-num">{formatPHP(v)}</span>
    </div>
  );
}

function Breakdown({ p }: { p: MyPayslip }) {
  const { earnings, deductions } = lines(p);
  const totalDed = deductions.reduce((n, [, v]) => n + v, 0);
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-ink-2">Take-home pay · {p.period.label}</div>
          <div className="mt-1 font-display text-3xl font-semibold">{formatPHP(p.line.net)}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => printSlip(p)}>
          <DownloadIcon className="h-3.5 w-3.5" /> Print or save as PDF
        </Button>
      </div>
      {!p.released && <p className="mt-2 rounded-lg bg-warning-tint px-3 py-2 text-xs text-ink-2">This cut-off is still running, so this is a preview. The final amount may change.</p>}
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">Earnings</h3>
          {earnings.map(([k, v]) => (
            <Row key={k} k={k} v={v} />
          ))}
          <div className="mt-1 border-t border-border pt-1">
            <Row k="Gross pay" v={p.line.gross} strong />
          </div>
        </div>
        <div>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">Deductions</h3>
          {deductions.map(([k, v]) => (
            <Row key={k} k={k} v={v} />
          ))}
          <div className="mt-1 border-t border-border pt-1">
            <Row k="Total deductions" v={totalDed} strong />
          </div>
        </div>
      </div>
      <div className="mt-6">
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">Time &amp; attendance</h3>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {timeLines(p).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-border/60 py-1.5 text-sm">
              <span className="text-ink-2">{k}</span>
              <span className="font-num">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-auto pt-4 text-xs text-ink-3">Hours worked leave out the unpaid lunch break, which is recorded automatically from your shift. Government contributions are split across the two cut-offs of each month. Questions about your pay? Ask HR.</p>
    </section>
  );
}

export function EmployeePayslips() {
  const slips = useQuery({ queryKey: ["ess", "payslips"], queryFn: myPayslips, staleTime: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (slips.isError) return <LoadError onRetry={() => slips.refetch()} />;
  const list = slips.data ?? [];
  const selected = list.find((s) => s.period.id === selectedId) ?? list.find((s) => s.released) ?? list[0];

  return (
    <>
      <ContentHead title="Payslips" subtitle="Your pay for each cut-off: what you earned, what was deducted, and what you take home." />
      {slips.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : list.length === 0 ? (
        <p className="text-sm text-ink-3">No payslips yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <ul className="flex flex-col gap-2" aria-label="Cut-offs">
            {list.map((s) => (
              <li key={s.period.id}>
                <button
                  type="button"
                  aria-pressed={s === selected}
                  onClick={() => setSelectedId(s.period.id)}
                  className={clsx("flex w-full items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors", s === selected ? "border-ink bg-surface" : "border-border bg-surface hover:border-ink-3")}
                >
                  <span>
                    <span className="block text-sm font-semibold">{s.period.label}</span>
                    <span className="font-num block text-sm text-ink-2">{formatPHP(s.line.net)}</span>
                  </span>
                  <Pill tone={s.released ? "good" : "warn"}>{s.released ? "Released" : "Preview"}</Pill>
                </button>
              </li>
            ))}
          </ul>
          {selected && <Breakdown p={selected} />}
        </div>
      )}
    </>
  );
}
