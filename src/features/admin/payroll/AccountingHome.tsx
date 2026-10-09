import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatToday } from "@/lib/format";
import { listClaims } from "@/lib/reimbursements/api";
import { listFinalPay } from "@/lib/pay/finalpay";
import { listLoans } from "@/lib/pay/loans";
import { listPayDetails } from "@/lib/pay/details";
import { listRuns } from "@/lib/pay/runs";
import { periodsFor, REPORTS } from "@/lib/reports/api";
import { useWho } from "@/lib/useCan";
import { AdminOverview } from "../AdminOverview";
import { Pill } from "../corehr/ui";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
const orNone = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);

/** The Home each role lands on: Accounting gets payroll and payouts, everyone else the HR dashboard. */
export function AdminHome() {
  return useWho().role === "accounting" ? <AccountingHome /> : <AdminOverview />;
}

function Tile({ label, value, sub, to, tone }: { label: string; value: ReactNode; sub: ReactNode; to: string; tone?: "warn" | "good" }) {
  return (
    <Link to={to} className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--card-border)] bg-surface p-4 transition-colors hover:bg-surface-2">
      <span className="text-xs font-medium text-ink-2">{label}</span>
      <span className="font-display text-2xl font-semibold">{value}</span>
      <span className={tone === "warn" ? "text-xs text-warning" : tone === "good" ? "text-xs text-good" : "text-xs text-ink-2"}>{sub}</span>
    </Link>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-[var(--radius-card)] border border-[var(--card-border)] bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="flex flex-col divide-y divide-[var(--line)]">{children}</div>
    </section>
  );
}

function Row({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 text-[13px]">
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        {sub && <div className="text-xs text-ink-2">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/** Last month's remittances, due this month. Deadlines are the usual ones; yours depend on your employer number and filing method. */
async function remittances() {
  const period = periodsFor("month")[1]!;
  const next = new Date(`${period.to}T12:00:00`);
  next.setDate(next.getDate() + 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const end = new Date(y, next.getMonth() + 1, 0).getDate();
  const due = { tax: `${y}-${m}-10`, philhealth: `${y}-${m}-15`, pagibig: `${y}-${m}-15`, sss: `${y}-${m}-${end}` };
  const label = { tax: "BIR 1601-C withholding tax", sss: "SSS contributions", philhealth: "PhilHealth contributions", pagibig: "Pag-IBIG contributions" };
  const rows = await Promise.all(
    (["tax", "sss", "philhealth", "pagibig"] as const).map(async (id) => {
      const def = REPORTS.find((r) => r.id === id)!;
      const r = await def.run(period, "All offices");
      return { id, name: label[id], due: due[id], amount: Number(r.summary[0]?.value ?? 0) };
    }),
  );
  return { month: period.label, rows: rows.sort((a, b) => a.due.localeCompare(b.due)) };
}

/** Accounting's Home: this cutoff's payroll, claims to pay, remittances due and data to fix. */
export function AccountingHome() {
  const runs = useQuery({ queryKey: ["payroll", "runs"], queryFn: () => orNone(listRuns()) });
  const claims = useQuery({ queryKey: ["reimbursements", "claims"], queryFn: () => orNone(listClaims()) });
  const loans = useQuery({ queryKey: ["payroll", "loans"], queryFn: () => orNone(listLoans()) });
  const details = useQuery({ queryKey: ["payroll", "pay-details"], queryFn: () => orNone(listPayDetails()) });
  const finalPay = useQuery({ queryKey: ["payroll", "final-pay"], queryFn: () => orNone(listFinalPay()) });
  const remit = useQuery({ queryKey: ["payroll", "remittances"], queryFn: remittances });

  const cutoff = periodsFor("cutoff")[0]!;
  const run = runs.data?.find((r) => r.from === cutoff.from);
  const toApprove = (claims.data ?? []).filter((c) => c.status === "endorsed");
  const toPay = (claims.data ?? []).filter((c) => c.status === "approved" && !c.paidAt);
  const running = (loans.data ?? []).filter((l) => l.balance > 0);
  const missingGov = (details.data ?? []).filter((p) => p.missing.length > 0);
  const missingBank = (details.data ?? []).filter((p) => !p.bank);
  const openFinal = (finalPay.data ?? []).filter((f) => !f.released);
  const sum = (xs: { amount: number }[]) => xs.reduce((n, x) => n + x.amount, 0);
  const loading = runs.isLoading || claims.isLoading;

  return (
    <div className="flex flex-col gap-4">
      <ContentHead title="Payroll & payouts" subtitle={formatToday()} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <Tile
              label={`Payroll · ${cutoff.label}`}
              value={run ? (run.status === "approved" ? "Approved" : "Draft") : "Not started"}
              sub={run ? `${run.lines.length} people · ${peso(run.lines.reduce((n, l) => n + l.net, 0))} take-home` : "Start the run once attendance is in"}
              tone={run?.status === "approved" ? "good" : "warn"}
              to="/admin/payroll/runs"
            />
            <Tile label="Claims to approve" value={toApprove.length} sub={toApprove.length ? `${peso(sum(toApprove))} approved by managers` : "Nothing waiting"} tone={toApprove.length ? "warn" : undefined} to="/admin/requests/reimbursement" />
            <Tile label="Claims to pay out" value={toPay.length} sub={toPay.length ? `${peso(sum(toPay))} · with the next payroll unless paid by transfer` : "All paid"} to="/admin/requests/reimbursement" />
            <Tile label="Loans running" value={running.length} sub={running.length ? `${peso(running.reduce((n, l) => n + Math.min(l.installment, l.balance), 0))} off the next run` : "None"} to="/admin/payroll/loans" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title={`Remittances due · for ${remit.data?.month ?? "last month"}`} action={<Link to="/admin/reports/statutory" className="text-[13px] font-medium text-brand-ink hover:underline">Government reports</Link>}>
          {remit.isLoading ? (
            <div className="p-5">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            remit.data?.rows.map((r) => <Row key={r.id} title={r.name} sub={`Due ${shortDate(r.due)}`} right={<span className="font-num font-semibold">{peso(r.amount)}</span>} />)
          )}
          <p className="px-5 py-3 text-xs text-ink-3">Usual deadlines. Yours depend on your employer number and whether you file online.</p>
        </Panel>

        <Panel title="To fix before payday">
          <Row title="Missing government numbers" sub={missingGov.length ? missingGov.slice(0, 3).map((p) => `${p.name} (${p.missing.join(", ")})`).join(" · ") : "Everyone has TIN, SSS, PhilHealth and Pag-IBIG"} right={missingGov.length ? <Pill tone="warn">{missingGov.length}</Pill> : <Pill tone="good">OK</Pill>} />
          <Row title="No bank account" sub={missingBank.length ? `${missingBank.map((p) => p.name).slice(0, 3).join(", ")}${missingBank.length > 3 ? "…" : ""}: pay by check or cash, or ask HR to add it` : "Everyone can be paid by transfer"} right={missingBank.length ? <Pill tone="warn">{missingBank.length}</Pill> : <Pill tone="good">OK</Pill>} />
          <Row title="Final pay to release" sub={openFinal.length ? openFinal.map((f) => `${f.name} (last day ${shortDate(f.lastDay)})`).join(" · ") : "No one leaving"} right={openFinal.length ? <Pill tone="warn">{openFinal.length}</Pill> : <Pill tone="good">OK</Pill>} />
          <div className="flex flex-wrap gap-3 px-5 py-3 text-[13px]">
            <Link to="/admin/payroll/pay-details" className="font-medium text-brand-ink hover:underline">
              Pay details
            </Link>
            <Link to="/admin/payroll/final-pay" className="font-medium text-brand-ink hover:underline">
              Final pay
            </Link>
            <Link to="/admin/payroll/payouts" className="font-medium text-brand-ink hover:underline">
              Bank file & journal
            </Link>
            <Link to="/admin/payroll/year-end" className="font-medium text-brand-ink hover:underline">
              Year-end BIR forms
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
