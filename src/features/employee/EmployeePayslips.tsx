import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DownloadIcon } from "@/components/icons";
import { myLeave, myName, myPayslips, type MyPayslip } from "@/lib/ess/api";
import { my2316, myBank, myLoans } from "@/lib/ess/more";
import { print2316 } from "../admin/payroll/YearEndPage";
import { printWorkbookPayslip } from "./workbookPayslip";
import { formatPHP } from "@/lib/format";
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

/** Laid out like the workbook's payslip (PS_MSMA_v7): every addition under gross pay (transport and
 * other allowances too), and absences, contributions, loans, tax and cash advance under deductions. */
function lines(p: MyPayslip) {
  const l = p.line;
  const dm = l.pay?.deMinimis ?? 0;
  const nt = l.pay?.otherNonTaxable ?? 0;
  const earnings: [string, number][] = [
    ["Basic pay", Math.round((l.basic - dm - nt) * 100) / 100],
    ["De-minimis benefits", dm],
    ["Other non taxable / Exempt compensation", nt],
    ["Holiday and premium pay", l.premiums],
    ["Overtime pay and OT meal allowance", l.overtime],
    ["Transportation allowance", l.pay?.transportAllowance ?? 0],
    ...p.items.filter((i) => i.amount > 0).map((i) => [i.label, i.amount] as [string, number]),
  ];
  const deductions: [string, number][] = [
    ["Absences, lates and undertime", l.deductions],
    ["SSS contribution", l.sssEe],
    ["Pag-IBIG contribution", l.piEe],
    ["PhilHealth contribution", l.phEe],
    ["Withholding tax on compensation", l.tax],
    // Loan installments, cash advance and other deductions, under their own names.
    ...p.items.filter((i) => i.amount < 0).map((i) => [i.label, -i.amount] as [string, number]),
  ];
  return { earnings, deductions, gross: Math.round(earnings.reduce((n, [, v]) => n + v, 0) * 100) / 100 };
}

/** Prepared by / Approved by / Received by, as on the workbook's payslip. */
const signers = (p: MyPayslip): [string, string, string][] => [
  ["Prepared by", p.preparedBy || "", "Payroll Officer"],
  ["Approved by", p.approvedBy || "", "Approving Officer"],
  ["Received by", myName(), "Signature over printed name"],
];

function Row({ k, v, strong }: { k: string; v: number; strong?: boolean }) {
  return (
    <div className={clsx("flex justify-between py-1.5 text-sm", strong && "font-semibold")}>
      <span className={strong ? "" : "text-ink-2"}>{k}</span>
      <span className="font-num">{formatPHP(v)}</span>
    </div>
  );
}

function Breakdown({ p, vacationDays }: { p: MyPayslip; vacationDays?: number }) {
  const { earnings, deductions, gross } = lines(p);
  const totalDed = deductions.reduce((n, [, v]) => n + v, 0);
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-ink-2">Take-home pay · {p.period.label}</div>
          <div className="mt-1 font-display text-3xl font-semibold">{formatPHP(p.line.net)}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => printWorkbookPayslip(p, vacationDays)}>
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
            <Row k="Gross pay" v={gross} strong />
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
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {signers(p).map(([k, name, role]) => (
          <div key={k} className="text-sm">
            <div className="text-xs text-ink-2">{k}:</div>
            <div className="mt-6 border-t border-border pt-1 font-medium">{name || "\u00a0"}</div>
            <div className="text-xs text-ink-3">{role}</div>
          </div>
        ))}
      </div>
      {vacationDays !== undefined && <p className="mt-4 text-sm text-ink-2">No. of vacation days = <span className="font-num font-semibold text-ink">{vacationDays}</span></p>}
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
    </section>
  );
}

/** Below the payslips: where pay goes, running loans, and the year's BIR 2316. */
function PayExtras() {
  const bank = useQuery({ queryKey: ["ess", "bank"], queryFn: myBank });
  const loans = useQuery({ queryKey: ["ess", "loans"], queryFn: myLoans });
  const year = new Date().getFullYear();
  const [formYear, setFormYear] = useState(year);
  const form = useQuery({ queryKey: ["ess", "2316", formYear], queryFn: () => my2316(formYear) });
  const masked = (n: string) => {
    const d = n.replace(/\D/g, "");
    return d.length > 4 ? `•••• ${d.slice(-4)}` : n;
  };
  const card = "flex flex-col gap-3 rounded-xl border border-border bg-surface p-5";
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className={card}>
        <h2 className="text-sm font-semibold">Where your pay goes</h2>
        {bank.data ? (
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">Bank</dt>
              <dd className="font-medium">{bank.data.bank}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">Account name</dt>
              <dd className="truncate font-medium">{bank.data.accountName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">Account number</dt>
              <dd className="font-num font-medium">{masked(bank.data.accountNumber)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-ink-2">{bank.isLoading ? "Loading…" : "No bank account on file yet, so your pay is released by check or cash."}</p>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold">Loans</h2>
        {(loans.data ?? []).length === 0 ? (
          <p className="text-sm text-ink-2">{loans.isLoading ? "Loading…" : "No loans or deductions from your pay."}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {loans.data!.map((l) => {
              const pct = l.principal ? Math.round((l.paid / l.principal) * 100) : 0;
              return (
                <li key={l.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{l.kind}</span>
                    <span className="text-xs text-ink-2">{l.status}</span>
                  </div>
                  <div className="text-xs text-ink-2">
                    {l.reference} · {formatPHP(l.installment)} per cutoff
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-ink-2">
                    <span>Paid {formatPHP(l.paid)}</span>
                    <span className="font-medium text-ink">Balance {formatPHP(l.balance)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">BIR 2316</h2>
          <select aria-label="Year" value={formYear} onChange={(e) => setFormYear(Number(e.target.value))} className="rounded-[var(--radius-control)] border border-border bg-surface px-2 py-1 text-xs">
            {[year, year - 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        {form.data ? (
          <>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Gross compensation</dt>
                <dd className="font-num">{formatPHP(form.data.gross)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Tax withheld</dt>
                <dd className="font-num">{formatPHP(form.data.withheld)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">{form.data.adjustment >= 0 ? "Refund due to you" : "Still to be withheld"}</dt>
                <dd className="font-num font-medium">{formatPHP(Math.abs(form.data.adjustment))}</dd>
              </div>
            </dl>
            <Button size="sm" variant="ghost" className="mt-auto self-start" onClick={() => print2316([form.data!], formYear)}>
              <DownloadIcon className="h-3.5 w-3.5" /> Print or save as PDF
            </Button>
          </>
        ) : (
          <p className="text-sm text-ink-2">{form.isLoading ? "Loading…" : `No pay recorded for ${formYear}.`}</p>
        )}
      </section>
    </div>
  );
}

export function EmployeePayslips() {
  const slips = useQuery({ queryKey: ["ess", "payslips"], queryFn: myPayslips, staleTime: 0 });
  const leave = useQuery({ queryKey: ["ess", "leave"], queryFn: myLeave });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (slips.isError) return <LoadError onRetry={() => slips.refetch()} />;
  const list = slips.data ?? [];
  const selected = list.find((s) => s.period.id === selectedId) ?? list.find((s) => s.released) ?? list[0];
  // "No. of vacation days" on the payslip: their VL/SL days left this leave year (sheet SIL).
  const vacationDays = leave.data?.credits.available;

  return (
    <>
      <ContentHead title="Payslips" />
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
          {selected && <Breakdown p={selected} vacationDays={vacationDays} />}
        </div>
      )}
      <PayExtras />
    </>
  );
}
