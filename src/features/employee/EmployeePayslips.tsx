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
    ["Lunch (unpaid)", t.lunchBreaks ? `${t.lunchBreaks} · ${duration(t.lunchMinutes)}` : "—"],
    ["Late (not deducted)", t.lateMinutes ? duration(t.lateMinutes) : "None"],
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
      ...(l.deductions ? [["Less absences and undertime", -l.deductions] as const] : []),
    ] as [string, number][],
    deductions: [
      ["SSS", l.sssEe],
      ["PhilHealth", l.phEe],
      ["Pag-IBIG", l.piEe],
      ["Withholding tax", l.tax],
    ] as [string, number][],
  };
}

/** The printed payslip, in the app's look: navy header, brand green, Lexend. One page. */
const SLIP_STYLES = `
  @page { size: A4; margin: 0; }
  body { padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
  .slip { max-width: 760px; margin: 0 auto; padding: 36px 40px 28px; }
  .hero { background: #0e1835; color: #fff; border-radius: 18px; padding: 24px 26px; display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
  .co { display: flex; gap: 14px; align-items: center; }
  .co { gap: 16px; }
  .co img { height: 44px; width: auto; display: block; }
  .co-text { border-left: 1px solid rgba(255,255,255,.18); padding-left: 16px; }
  .co-name { font-size: 18px; font-weight: 700; }
  .co-sub { font-size: 10.5px; color: #b9bfd2; margin-top: 2px; }
  .tag { display: inline-block; background: #bfe36b; color: #0e1835; font-size: 10px; font-weight: 700; letter-spacing: .14em; padding: 4px 10px; border-radius: 999px; }
  .period { text-align: right; }
  .period-label { font-size: 16px; font-weight: 600; margin-top: 8px; }
  .period-sub { font-size: 10.5px; color: #b9bfd2; margin-top: 2px; }
  .who { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 18px 2px 0; }
  .label { font-size: 9.5px; text-transform: uppercase; letter-spacing: .08em; color: #7d8496; font-weight: 600; }
  .value { font-size: 12.5px; font-weight: 600; margin-top: 3px; }
  .net { margin-top: 18px; display: grid; grid-template-columns: 1.3fr 1fr 1fr; border: 1px solid #dde1d6; border-radius: 16px; overflow: hidden; }
  .net > div { padding: 16px 18px; }
  .net .main { background: #eef4dc; }
  .net .main .amt { font-size: 28px; font-weight: 700; color: #3f6212; letter-spacing: -.01em; }
  .net .amt { font-size: 17px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .net > div + div { border-left: 1px solid #dde1d6; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 18px; }
  .card { border: 1px solid #dde1d6; border-radius: 16px; padding: 14px 16px 10px; }
  .card h2 { margin: 0 0 6px; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
  .dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }
  .card table { margin: 0; }
  .card td { font-size: 12px; padding: 7px 0; border-bottom: 1px solid #eceee7; }
  .card tr:last-child td { border-bottom: 0; }
  .card .tot td { font-weight: 700; border-top: 2px solid #12172a; border-bottom: 0; padding-top: 9px; }
  .minus { color: #a82c2c; }
  .time { margin-top: 18px; border: 1px solid #dde1d6; border-radius: 16px; padding: 14px 16px; }
  .time h2 { margin: 0 0 10px; font-size: 12px; font-weight: 700; }
  .chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .chip { background: #f4f5f0; border-radius: 10px; padding: 9px 11px; }
  .chip .value { font-size: 13px; }
  .er { margin-top: 14px; font-size: 10.5px; color: #4c5568; }
  .foot { margin-top: 22px; padding-top: 12px; border-top: 1px solid #dde1d6; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #7d8496; gap: 16px; }
  .foot img { height: 16px; }
`;

function printSlip(p: MyPayslip) {
  const { earnings, deductions } = lines(p);
  const l = p.line;
  const s = admin.settings;
  const origin = window.location.origin;
  const money = (v: number) => escapeHtml(v < 0 ? `−${formatPHP(-v)}` : formatPHP(v));
  const row = ([k, v]: [string, number]) => `<tr><td>${escapeHtml(k)}</td><td class="num${v < 0 ? " minus" : ""}">${money(v)}</td></tr>`;
  const totalDed = deductions.reduce((n, [, v]) => n + v, 0);
  const employerShare = l.sssEr + l.ec + l.phEr + l.piEr;
  const coSub = [s.address, s.tin && `TIN ${s.tin}`].filter(Boolean).join(" · ");
  openPrintDocument(
    `Payslip ${p.period.label} · ${myName()}`,
    `<style>${SLIP_STYLES}</style>
     <div class="slip">
       <div class="hero">
         <div class="co">
           <img src="${origin}/brand/msma-mark.png" alt="">
           <div class="co-text"><div class="co-name">${escapeHtml(s.companyName)}</div>${coSub ? `<div class="co-sub">${escapeHtml(coSub)}</div>` : ""}</div>
         </div>
         <div class="period">
           <span class="tag">PAYSLIP</span>
           <div class="period-label">${escapeHtml(p.period.label)}</div>
           <div class="period-sub">${p.released ? "Released" : "Preview · may still change"}</div>
         </div>
       </div>

       <div class="who">
         <div><div class="label">Employee</div><div class="value">${escapeHtml(myName())}</div></div>
         <div><div class="label">Employee ID</div><div class="value">${escapeHtml(l.person.id)}</div></div>
         <div><div class="label">Position</div><div class="value">${escapeHtml(l.person.position || "—")}</div></div>
         <div><div class="label">Department</div><div class="value">${escapeHtml(l.person.department)}</div></div>
       </div>

       <div class="net">
         <div class="main"><div class="label">Take-home pay</div><div class="amt">${money(l.net)}</div></div>
         <div><div class="label">Gross pay</div><div class="amt">${money(l.gross)}</div></div>
         <div><div class="label">Total deductions</div><div class="amt">${money(totalDed)}</div></div>
       </div>

       <div class="cols">
         <div class="card">
           <h2><span class="dot" style="background:#4d7c0f"></span>Earnings</h2>
           <table><tbody>${earnings.map(row).join("")}<tr class="tot"><td>Gross pay</td><td class="num">${money(l.gross)}</td></tr></tbody></table>
         </div>
         <div class="card">
           <h2><span class="dot" style="background:#d03b3b"></span>Deductions</h2>
           <table><tbody>${deductions.map(row).join("")}<tr class="tot"><td>Total deductions</td><td class="num">${money(totalDed)}</td></tr></tbody></table>
         </div>
       </div>

       <div class="time">
         <h2>Time &amp; attendance</h2>
         <div class="chips">${timeLines(p).map(([k, v]) => `<div class="chip"><div class="label">${escapeHtml(k)}</div><div class="value">${escapeHtml(v)}</div></div>`).join("")}</div>
       </div>

       ${employerShare > 0 ? `<p class="er">Your employer also paid ${money(employerShare)} for you this cut-off: SSS ${money(l.sssEr + l.ec)}, PhilHealth ${money(l.phEr)}, Pag-IBIG ${money(l.piEr)}.</p>` : ""}

       <div class="foot">
         <span>System-generated payslip, no signature needed. Questions about your pay? ${escapeHtml(s.contactEmail ? `Email ${s.contactEmail}.` : "Ask HR.")}<br>Printed ${escapeHtml(new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }))}</span>
         <img src="${origin}/brand/heyhr-wordmark.svg" alt="heyhr">
       </div>
     </div>`,
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
        <p className="text-sm text-ink-3">No payslips yet. They appear here once payroll for a cutoff is approved.</p>
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
