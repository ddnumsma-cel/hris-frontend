import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { StatTile } from "@/components/ui/StatTile";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastContext";
import { CheckIcon, DownloadIcon, EditIcon, SearchIcon, SearchXIcon, WalletIcon } from "@/components/icons";
import {
  approvePayrollEntries,
  fetchPayrollCutoff,
  fetchPayrollRegister,
  releaseApprovedPayroll,
  revertPayrollEntry,
  type PayrollRegisterRow,
} from "@/lib/api";
import { downloadTextFile, toCsv } from "@/lib/download";
import { formatPHP, formatPHPCompact } from "@/lib/format";
import { computePayroll } from "@/lib/payroll";
import type { PayrollEntryStatus } from "@/lib/types";
import { EditPayrollEntryDialog } from "./EditPayrollEntryDialog";

const statusVariant: Record<PayrollEntryStatus, ChipVariant> = {
  Draft: "neutral",
  Approved: "warn",
  Released: "good",
};

type StatusFilter = "All statuses" | PayrollEntryStatus;

const REGISTER_KEY = ["manager", "payroll-register"];

export function ManagerPayroll() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All statuses");
  const [editingRow, setEditingRow] = useState<PayrollRegisterRow | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);

  const registerQuery = useQuery({ queryKey: REGISTER_KEY, queryFn: fetchPayrollRegister });
  const cutoffQuery = useQuery({ queryKey: ["manager", "payroll-cutoff"], queryFn: fetchPayrollCutoff });
  const cutoff = cutoffQuery.data;

  const rows = useMemo(
    () => (registerQuery.data ?? []).map((row) => ({ ...row, pay: computePayroll(row.entry) })),
    [registerQuery.data],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          gross: acc.gross + r.pay.gross,
          deductions: acc.deductions + r.pay.totalDeductions,
          net: acc.net + r.pay.net,
        }),
        { gross: 0, deductions: 0, net: 0 },
      ),
    [rows],
  );

  const drafts = rows.filter((r) => r.entry.status === "Draft");
  const approved = rows.filter((r) => r.entry.status === "Approved");
  const released = rows.filter((r) => r.entry.status === "Released");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (statusFilter === "All statuses" || r.entry.status === statusFilter) &&
        (!q ||
          r.employee.name.toLowerCase().includes(q) ||
          r.employee.department.toLowerCase().includes(q) ||
          r.employee.id.toLowerCase().includes(q)),
    );
  }, [rows, search, statusFilter]);

  const approveMutation = useMutation({
    mutationFn: approvePayrollEntries,
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: REGISTER_KEY });
      toast.show(ids.length === 1 ? "Pay approved." : `${ids.length} pay entries approved.`);
    },
  });

  const revertMutation = useMutation({
    mutationFn: revertPayrollEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REGISTER_KEY }),
  });

  const releaseMutation = useMutation({
    mutationFn: releaseApprovedPayroll,
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: REGISTER_KEY });
      queryClient.invalidateQueries({ queryKey: ["employee", "payslips"] });
      setConfirmRelease(false);
      toast.show(`Payroll released to ${count} employee${count === 1 ? "" : "s"}. Payslips are now available.`);
    },
  });

  function exportRegister() {
    const csv = toCsv(
      rows.map((r) => ({
        "Employee ID": r.employee.id,
        Name: r.employee.name,
        Department: r.employee.department,
        Office: r.employee.office,
        "Basic pay": r.pay.basicPay.toFixed(2),
        Overtime: r.pay.overtimePay.toFixed(2),
        Allowances: r.pay.allowance.toFixed(2),
        Gross: r.pay.gross.toFixed(2),
        SSS: r.pay.sss.toFixed(2),
        PhilHealth: r.pay.philHealth.toFixed(2),
        "Pag-IBIG": r.pay.pagIbig.toFixed(2),
        "Withholding tax": r.pay.withholdingTax.toFixed(2),
        "Other deductions": r.pay.otherDeductions.toFixed(2),
        "Net pay": r.pay.net.toFixed(2),
        Status: r.entry.status,
      })),
    );
    downloadTextFile(`payroll-register-${cutoff?.payslipId ?? "cutoff"}.csv`, csv, "text/csv");
  }

  const busy = approveMutation.isPending || revertMutation.isPending || releaseMutation.isPending;

  function renderRowActions(row: PayrollRegisterRow) {
    if (row.entry.status === "Released") return <span className="text-xs text-ink-3">Paid</span>;
    return (
      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => setEditingRow(row)}
          className="flex items-center gap-1 font-semibold text-ink-2 hover:text-ink"
        >
          <EditIcon className="h-3.5 w-3.5" />
          Edit
        </button>
        {row.entry.status === "Draft" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => approveMutation.mutate([row.employee.id])}
            className="flex items-center gap-1 font-semibold text-brand-ink disabled:opacity-50"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            Approve
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => revertMutation.mutate(row.employee.id)}
            className="font-semibold text-ink-2 hover:text-ink disabled:opacity-50"
          >
            Undo approval
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <ContentHead
        title="Payroll"
        subtitle={cutoff ? `Cutoff ${cutoff.label} · Pay date ${cutoff.payDate}` : "Company payroll register"}
        actions={
          <>
            <Button variant="ghost" icon={<DownloadIcon className="h-3.75 w-3.75" />} onClick={exportRegister} disabled={rows.length === 0}>
              Export CSV
            </Button>
            <Button
              variant="ghost"
              icon={<CheckIcon className="h-3.75 w-3.75" />}
              disabled={drafts.length === 0 || busy}
              onClick={() => approveMutation.mutate(drafts.map((r) => r.employee.id))}
            >
              Approve all drafts ({drafts.length})
            </Button>
            <Button
              icon={<WalletIcon className="h-3.75 w-3.75" />}
              disabled={approved.length === 0 || busy}
              onClick={() => setConfirmRelease(true)}
            >
              Release payroll ({approved.length})
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3.5">
        <StatTile
          label="Staff on payroll"
          value={rows.length}
          delta={`${released.length} released · ${approved.length} approved · ${drafts.length} draft`}
        />
        <StatTile label="Total gross pay" value={formatPHPCompact(totals.gross)} delta="this cutoff" />
        <StatTile label="Total deductions" value={formatPHPCompact(totals.deductions)} delta="statutory, tax & loans" />
        <StatTile label="Net payout" value={formatPHPCompact(totals.net)} tone="good" delta="to be credited" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 sm:max-w-xs sm:flex-1">
          <SearchIcon className="h-3.5 w-3.5 text-ink-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, department, ID…"
            aria-label="Search payroll register"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by payroll status"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        >
          {(["All statuses", "Draft", "Approved", "Released"] as const).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {!registerQuery.isLoading && filtered.length === 0 && (
        <Card>
          <EmptyState icon={<SearchXIcon />} title="No employees match these filters" />
        </Card>
      )}

      {/* Mobile: card list */}
      <div className="flex flex-col gap-2.5 sm:hidden">
        {filtered.map((r) => (
          <Card key={r.employee.id} className="p-3.5">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <MiniAvatar initials={r.employee.initials} />
                <div>
                  <div className="text-sm font-bold">{r.employee.name}</div>
                  <div className="text-xs text-ink-2">{r.employee.position}</div>
                </div>
              </div>
              <Chip variant={statusVariant[r.entry.status]}>{r.entry.status}</Chip>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-x-3 text-xs">
              <div>
                <dt className="text-ink-3">Gross</dt>
                <dd className="font-num mt-0.5 font-semibold">{formatPHP(r.pay.gross)}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Deductions</dt>
                <dd className="font-num mt-0.5 font-semibold text-critical">{formatPHP(r.pay.totalDeductions)}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Net</dt>
                <dd className="font-num mt-0.5 font-bold">{formatPHP(r.pay.net)}</dd>
              </div>
            </dl>
            <div className="mt-3 border-t border-border pt-2.5">
              {renderRowActions(r)}
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop: register table */}
      {(registerQuery.isLoading || filtered.length > 0) && (
        <Card className="hidden sm:block">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.82rem]">
              <thead>
                <tr>
                  {["Employee", "Basic", "Overtime", "Allowances", "Gross", "Deductions", "Net pay", "Status", ""].map((h, i) => (
                    <th
                      key={h || "actions"}
                      className={`border-b border-border px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-wider text-ink-3 ${
                        i >= 1 && i <= 6 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registerQuery.isLoading && <SkeletonRows columns={9} />}
                {filtered.map((r) => (
                  <tr key={r.employee.id}>
                    <td className="border-b border-border px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <MiniAvatar initials={r.employee.initials} />
                        <div>
                          <div className="whitespace-nowrap">{r.employee.name}</div>
                          <div className="text-xs text-ink-2">{r.employee.department}</div>
                        </div>
                      </div>
                    </td>
                    <td className="font-num border-b border-border px-4 py-2.5 text-right">{formatPHP(r.pay.basicPay)}</td>
                    <td className="font-num border-b border-border px-4 py-2.5 text-right">{formatPHP(r.pay.overtimePay)}</td>
                    <td className="font-num border-b border-border px-4 py-2.5 text-right">{formatPHP(r.pay.allowance)}</td>
                    <td className="font-num border-b border-border px-4 py-2.5 text-right">{formatPHP(r.pay.gross)}</td>
                    <td className="font-num border-b border-border px-4 py-2.5 text-right text-critical">
                      {formatPHP(r.pay.totalDeductions)}
                    </td>
                    <td className="font-num border-b border-border px-4 py-2.5 text-right font-bold">{formatPHP(r.pay.net)}</td>
                    <td className="border-b border-border px-4 py-2.5">
                      <Chip variant={statusVariant[r.entry.status]}>{r.entry.status}</Chip>
                    </td>
                    <td className="border-b border-border px-4 py-2.5">
                      {renderRowActions(r)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="font-bold">
                    <td className="px-4 py-2.5">Total ({filtered.length})</td>
                    <td colSpan={3} />
                    <td className="font-num px-4 py-2.5 text-right">{formatPHP(filtered.reduce((s, r) => s + r.pay.gross, 0))}</td>
                    <td className="font-num px-4 py-2.5 text-right text-critical">
                      {formatPHP(filtered.reduce((s, r) => s + r.pay.totalDeductions, 0))}
                    </td>
                    <td className="font-num px-4 py-2.5 text-right">{formatPHP(filtered.reduce((s, r) => s + r.pay.net, 0))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs text-ink-3">
        Statutory contributions and withholding tax are estimated with simplified SSS, PhilHealth, Pag-IBIG and BIR
        semi-monthly rules. Allowances are treated as non-taxable.
      </p>

      <EditPayrollEntryDialog
        row={editingRow}
        onClose={() => setEditingRow(null)}
        onSaved={() => toast.show("Pay updated. Approve it again before releasing.")}
      />

      <ConfirmDialog
        open={confirmRelease}
        title="Release payroll?"
        message={`This credits ${formatPHP(approved.reduce((s, r) => s + r.pay.net, 0))} net pay to ${approved.length} employee${
          approved.length === 1 ? "" : "s"
        } for ${cutoff?.label ?? "this cutoff"} and publishes their payslips. Released entries can no longer be edited.`}
        confirmLabel="Release payroll"
        pendingLabel="Releasing…"
        isPending={releaseMutation.isPending}
        onConfirm={() => releaseMutation.mutate()}
        onClose={() => setConfirmRelease(false)}
      />
    </>
  );
}
