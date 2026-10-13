import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { DownloadIcon } from "@/components/icons";
import { downloadTextFile, toCsv } from "@/lib/download";
import { bankFile, journalByDepartmentFor, journalFor, listPayoutRuns, type BankLine } from "@/lib/pay/exports";
import { LoadError, Pill } from "../corehr/ui";
import { Choice, Name, SimpleTable, Tabs, Toolbar } from "../timekeeping/common";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const slug = (s: string) => s.replace(/[^\w]+/g, "-").toLowerCase();

function BankTab({ runId, label }: { runId: string; label: string }) {
  const q = useQuery({ queryKey: ["payroll", "bank-file", runId], queryFn: () => bankFile(runId) });
  const [bank, setBank] = useState("all");
  const all = q.data ?? [];
  const banks = [...new Set(all.filter((r) => r.accountNumber).map((r) => r.bank || "Other bank"))].sort();
  const rows = bank === "all" ? all : bank === "cash" ? all.filter((r) => !r.accountNumber) : all.filter((r) => r.accountNumber && (r.bank || "Other bank") === bank);
  const missing = rows.filter((r) => !r.accountNumber);
  const ready = rows.filter((r) => r.accountNumber);
  const download = () =>
    downloadTextFile(
      `${bank === "all" ? "bank-transfer" : `${slug(bank)}-payroll`}-${slug(label)}.csv`,
      toCsv(ready.map((r) => ({ "Employee ID": r.employeeId, Name: r.name, Bank: r.bank, "Account name": r.accountName, "Account number": r.accountNumber.replace(/\D/g, ""), Amount: r.amount.toFixed(2) }))),
      "text/csv",
    );
  return (
    <>
      <Toolbar>
        <Choice
          label="Bank"
          value={bank}
          onChange={setBank}
          options={[
            { value: "all", label: `All banks (${all.length})` },
            ...banks.map((b) => ({ value: b, label: `${b} (${all.filter((r) => r.accountNumber && (r.bank || "Other bank") === b).length})` })),
            { value: "cash", label: `Cash or check (${all.filter((r) => !r.accountNumber).length})` },
          ]}
        />
        <span className="text-sm text-ink-2">
          {ready.length} transfers · {peso(ready.reduce((n, r) => n + r.amount, 0))}
          {missing.length ? ` · ${missing.length} without a bank account (pay them by check or cash)` : ""}
        </span>
        <span className="ml-auto">
          <Button size="sm" icon={<DownloadIcon className="h-4 w-4" />} disabled={!ready.length} onClick={download}>
            {bank === "all" || bank === "cash" ? "Download bank file" : `Download ${bank} list`}
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
    </>
  );
}

function DepartmentJournalTable({ runId, label }: { runId: string; label: string }) {
  const q = useQuery({ queryKey: ["payroll", "journal-dept", runId], queryFn: () => journalByDepartmentFor(runId) });
  const data = q.data ?? { departments: [], rows: [] };
  const download = () =>
    downloadTextFile(
      `journal-by-department-${slug(label)}.csv`,
      toCsv(data.rows.map((r) => ({ Account: r.account, Side: r.side === "debit" ? "Debit" : "Credit", ...Object.fromEntries(data.departments.map((d) => [d, r.amounts[d] ? r.amounts[d]!.toFixed(2) : ""])), Total: r.total.toFixed(2) }))),
      "text/csv",
    );
  return (
    <>
      <Toolbar>
        <span className="text-sm text-ink-2">Each department's share of the entry. Every column balances on its own.</span>
        <span className="ml-auto">
          <Button size="sm" icon={<DownloadIcon className="h-4 w-4" />} disabled={!data.rows.length} onClick={download}>
            Download by department
          </Button>
        </span>
      </Toolbar>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--card-border)] bg-surface">
        <table className="w-full text-[13px]">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left">Account</th>
              {data.departments.map((d) => (
                <th key={d} className="px-4 py-3 text-right whitespace-nowrap">
                  {d}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={data.departments.length + 2} className="px-4 py-6 text-center text-ink-2">
                  Loading…
                </td>
              </tr>
            )}
            {data.rows.map((r) => (
              <tr key={r.account + r.side} className="border-t border-[var(--line)]">
                <td className={r.side === "credit" ? "py-3 pr-4 pl-12" : "px-4 py-3 font-medium"}>{r.account}</td>
                {data.departments.map((d) => (
                  <td key={d} className="font-num px-4 py-3 text-right whitespace-nowrap">
                    {r.amounts[d] ? `${r.side === "credit" ? "(" : ""}${peso(r.amounts[d]!)}${r.side === "credit" ? ")" : ""}` : ""}
                  </td>
                ))}
                <td className="font-num px-4 py-3 text-right font-medium whitespace-nowrap">{`${r.side === "credit" ? "(" : ""}${peso(r.total)}${r.side === "credit" ? ")" : ""}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-3">Credits are shown in brackets.</p>
    </>
  );
}

function JournalTab({ runId, label }: { runId: string; label: string }) {
  const [view, setView] = useState<"company" | "department">("company");
  return (
    <>
      <Toolbar>
        <Choice
          label="View"
          value={view}
          onChange={(v) => setView(v as typeof view)}
          options={[
            { value: "company", label: "Whole company" },
            { value: "department", label: "By department" },
          ]}
        />
      </Toolbar>
      {view === "company" ? <CompanyJournal runId={runId} label={label} /> : <DepartmentJournalTable runId={runId} label={label} />}
    </>
  );
}

function CompanyJournal({ runId, label }: { runId: string; label: string }) {
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
      <ContentHead title="Payouts & journal" />
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
