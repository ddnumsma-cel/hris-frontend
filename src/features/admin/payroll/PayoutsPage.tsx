import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { DownloadIcon } from "@/components/icons";
import { downloadTextFile, toCsv } from "@/lib/download";
import { bankFile, journalFor, listPayoutRuns, type BankLine } from "@/lib/pay/exports";
import { LoadError, Pill } from "../corehr/ui";
import { Choice, Name, SimpleTable, Tabs, Toolbar } from "../timekeeping/common";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const slug = (s: string) => s.replace(/[^\w]+/g, "-").toLowerCase();

function BankTab({ runId, label }: { runId: string; label: string }) {
  const q = useQuery({ queryKey: ["payroll", "bank-file", runId], queryFn: () => bankFile(runId) });
  const rows = q.data ?? [];
  const missing = rows.filter((r) => !r.accountNumber);
  const ready = rows.filter((r) => r.accountNumber);
  const download = () =>
    downloadTextFile(
      `bank-transfer-${slug(label)}.csv`,
      toCsv(ready.map((r) => ({ "Employee ID": r.employeeId, Name: r.name, Bank: r.bank, "Account name": r.accountName, "Account number": r.accountNumber.replace(/\D/g, ""), Amount: r.amount.toFixed(2) }))),
      "text/csv",
    );
  return (
    <>
      <Toolbar>
        <span className="text-sm text-ink-2">
          {ready.length} transfers · {peso(ready.reduce((n, r) => n + r.amount, 0))}
          {missing.length ? ` · ${missing.length} without a bank account (pay them by check or cash)` : ""}
        </span>
        <span className="ml-auto">
          <Button size="sm" icon={<DownloadIcon className="h-4 w-4" />} disabled={!ready.length} onClick={download}>
            Download bank file
          </Button>
        </span>
      </Toolbar>
      <SimpleTable<BankLine>
        rows={rows}
        rowKey={(r) => r.employeeId}
        loading={q.isLoading}
        empty="No take-home pay in this run."
        cols={[
          { header: "Employee", cell: (r) => <Name name={r.name} sub={r.employeeId} /> },
          { header: "Bank", cell: (r) => r.bank || <Pill tone="warn">No bank account</Pill> },
          { header: "Account", cell: (r) => (r.accountNumber ? <Name name={r.accountNumber} sub={r.accountName} /> : <span className="text-ink-3">—</span>) },
          { header: "Take-home pay", align: "right", cell: (r) => <span className="font-num font-medium">{peso(r.amount)}</span> },
        ]}
      />
      <p className="text-xs text-ink-3">Most banks' payroll upload needs their own template; this file has the columns they ask for. HR adds missing bank accounts on the employee's 201 file.</p>
    </>
  );
}

function JournalTab({ runId, label }: { runId: string; label: string }) {
  const q = useQuery({ queryKey: ["payroll", "journal", runId], queryFn: () => journalFor(runId) });
  const rows = q.data ?? [];
  const debit = rows.reduce((n, r) => n + r.debit, 0);
  const credit = rows.reduce((n, r) => n + r.credit, 0);
  const balanced = Math.abs(debit - credit) < 0.02;
  const download = () =>
    downloadTextFile(`journal-${slug(label)}.csv`, toCsv(rows.map((r) => ({ Account: r.account, Debit: r.debit ? r.debit.toFixed(2) : "", Credit: r.credit ? r.credit.toFixed(2) : "", Memo: r.memo }))), "text/csv");
  return (
    <>
      <Toolbar>
        <span className="flex items-center gap-2 text-sm text-ink-2">
          Debits {peso(debit)} · credits {peso(credit)} {rows.length > 0 && <Pill tone={balanced ? "good" : "crit"}>{balanced ? "Balanced" : "Doesn't balance"}</Pill>}
        </span>
        <span className="ml-auto">
          <Button size="sm" icon={<DownloadIcon className="h-4 w-4" />} disabled={!rows.length} onClick={download}>
            Download journal
          </Button>
        </span>
      </Toolbar>
      {/* One entry: every line on one screen, debits first, then credits indented. */}
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--card-border)] bg-surface">
        <table className="w-full text-[13px]">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left">Account</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink-2">
                  Loading…
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.account + r.debit + r.credit} className="border-t border-[var(--line)]">
                <td className={r.credit ? "py-3 pr-4 pl-12" : "px-4 py-3 font-medium"}>{r.account}</td>
                <td className="font-num px-4 py-3 text-right">{r.debit ? peso(r.debit) : ""}</td>
                <td className="font-num px-4 py-3 text-right">{r.credit ? peso(r.credit) : ""}</td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="border-t-2 border-[var(--line-strong)] font-semibold">
                <td className="px-4 py-3">Total</td>
                <td className="font-num px-4 py-3 text-right">{peso(debit)}</td>
                <td className="font-num px-4 py-3 text-right">{peso(credit)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-3">Account names are generic; map them to your chart of accounts when importing. Employer contributions are expensed; employee shares and tax are payables until remitted.</p>
    </>
  );
}

/** Payroll → Payouts & journal: files to take out of an approved payroll run. */
export function PayoutsPage() {
  const runs = useQuery({ queryKey: ["payroll", "payout-runs"], queryFn: listPayoutRuns, staleTime: 0 });
  const [runId, setRunId] = useState("");
  const [tab, setTab] = useState<"bank" | "journal">("bank");
  if (runs.isError) return <LoadError onRetry={() => runs.refetch()} />;
  const list = runs.data ?? [];
  const run = list.find((r) => r.id === runId) ?? list[0];

  return (
    <>
      <ContentHead title="Payouts & journal" subtitle="For each approved payroll run: the bank transfer file for payday, and the journal entry for your accounting software." />
      {!runs.isLoading && !run ? (
        <p className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-ink-2">No approved payroll runs yet. Approve a run in Payroll runs first.</p>
      ) : (
        <>
          <Toolbar>
            <Choice label="Payroll run" value={run?.id ?? ""} onChange={setRunId} options={list.map((r) => ({ value: r.id, label: r.label }))} />
          </Toolbar>
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "bank", label: "Bank transfer" },
              { value: "journal", label: "Journal entry" },
            ]}
          />
          {run && (tab === "bank" ? <BankTab key={run.id} runId={run.id} label={run.label} /> : <JournalTab key={run.id} runId={run.id} label={run.label} />)}
        </>
      )}
    </>
  );
}
