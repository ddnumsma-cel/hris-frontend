import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { StatTile } from "@/components/ui/StatTile";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastContext";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  DownloadIcon,
  FileIcon,
  RefreshIcon,
  SearchIcon,
  SearchXIcon,
} from "@/components/icons";
import {
  approveAndReleasePayroll,
  fetchOffboardingCases,
  fetchPayrollRegister,
  fetchPayrollRun,
  thirteenthMonthAccrued,
  type PayrollRegisterRow,
} from "@/lib/api";
import { downloadTextFile, toCsv } from "@/lib/download";
import { formatPHP, todayIso } from "@/lib/format";
import { computePayroll, payrollVariance, type PayrollComputation } from "@/lib/payroll";
import { openPrintDocument } from "@/lib/printDocument";
import { EditPayrollEntryDialog } from "@/features/manager/EditPayrollEntryDialog";
import { useOfficeFilter } from "./OfficeFilterContext";
import { PayrollExplainDialog } from "./payroll/PayrollExplainDialog";
import { RemittancesPanel } from "./payroll/RemittancesPanel";
import { useRemittancesDue } from "./payroll/useRemittancesDue";

// Shared with the Partner's payroll page, so edits there and here stay in step.
const REGISTER_KEY = ["manager", "payroll-register"];
const RUN_KEY = ["admin", "payroll-run"];

type Tab = "register" | "remittances" | "thirteenth" | "final-pay";

type Row = PayrollRegisterRow & { pay: PayrollComputation; variance: string | null };

const pesoWhole = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

function varianceFor(row: PayrollRegisterRow): string | null {
  const variance = payrollVariance(row.entry);
  return variance && `${row.employee.name}: ${variance}`;
}

function money(n: number) {
  return n === 0 ? "—" : formatPHP(n);
}

const thClass = "border-b border-border px-3 py-2.5 text-xs font-medium tracking-[0.01em] text-ink-3";
const tdClass = "border-b border-border px-3 py-2.5";

export function AdminPayrollRuns() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { office } = useOfficeFilter();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab | null) ?? "register";
  const [search, setSearch] = useState("");
  const [explaining, setExplaining] = useState<PayrollRegisterRow | null>(null);
  const [editing, setEditing] = useState<PayrollRegisterRow | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);

  const registerQuery = useQuery({ queryKey: REGISTER_KEY, queryFn: fetchPayrollRegister });
  const runQuery = useQuery({ queryKey: RUN_KEY, queryFn: fetchPayrollRun });
  const offboardingQuery = useQuery({ queryKey: ["admin", "offboarding"], queryFn: fetchOffboardingCases });
  const remittancesDue = useRemittancesDue();

  const cutoff = runQuery.data?.cutoff;
  const releasedAt = runQuery.data?.releasedAt ?? null;
  const released = releasedAt !== null;
  const loading = registerQuery.isLoading || runQuery.isLoading;

  const allRows: Row[] = useMemo(
    () => (registerQuery.data ?? []).map((r) => ({ ...r, pay: computePayroll(r.entry), variance: varianceFor(r) })),
    [registerQuery.data],
  );
  const officeRows = allRows.filter((r) => office === "All offices" || r.employee.office === office);
  const q = search.trim().toLowerCase();
  const visibleRows = officeRows.filter(
    (r) => !q || r.employee.name.toLowerCase().includes(q) || r.employee.department.toLowerCase().includes(q),
  );
  const variances = allRows.filter((r) => r.variance);
  const finalPayCases = (offboardingQuery.data ?? []).filter((c) => c.stage !== "Final pay released");

  const sum = (rows: Row[], pick: (p: PayrollComputation) => number) => rows.reduce((s, r) => s + pick(r.pay), 0);
  const allNet = sum(allRows, (p) => p.net);

  const releaseMutation = useMutation({
    mutationFn: approveAndReleasePayroll,
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: REGISTER_KEY });
      queryClient.invalidateQueries({ queryKey: RUN_KEY });
      queryClient.invalidateQueries({ queryKey: ["employee", "payslips"] });
      setConfirmRelease(false);
      toast.show(`Payroll released · ${count} payslips sent.`);
    },
  });

  function setTab(next: Tab) {
    setSearchParams(next === "register" ? {} : { tab: next }, { replace: true });
  }

  function recalculate() {
    queryClient.invalidateQueries({ queryKey: REGISTER_KEY });
    toast.show("Payroll recalculated from the latest pay and timekeeping data.");
  }

  function exportRegister() {
    const csv = toCsv(
      allRows.map((r) => ({
        "Employee ID": r.employee.id,
        Name: r.employee.name,
        Department: r.employee.department,
        Office: r.employee.office,
        Basic: r.pay.basicPay.toFixed(2),
        Overtime: r.pay.overtimePay.toFixed(2),
        Allowance: r.pay.allowance.toFixed(2),
        Gross: r.pay.gross.toFixed(2),
        SSS: r.pay.sss.toFixed(2),
        PhilHealth: r.pay.philHealth.toFixed(2),
        "Pag-IBIG": r.pay.pagIbig.toFixed(2),
        "Withholding tax": r.pay.withholdingTax.toFixed(2),
        "Other deductions": r.pay.otherDeductions.toFixed(2),
        "Net pay": r.pay.net.toFixed(2),
      })),
    );
    const name = `payroll-register-${cutoff?.payslipId ?? "cutoff"}.csv`;
    downloadTextFile(name, csv, "text/csv");
    toast.show(`${name} downloaded.`);
  }

  function downloadBankFile() {
    // Column layout is a placeholder until the bank file format is set (BRD §5.3).
    const csv = toCsv(
      allRows.map((r) => ({
        "Employee ID": r.employee.id,
        Name: r.employee.name,
        "Net pay": r.pay.net.toFixed(2),
        "Pay date": cutoff?.payDate ?? "",
      })),
    );
    const name = `${(cutoff?.payrollBank ?? "bank").toLowerCase()}-payroll-${cutoff?.payslipId ?? "cutoff"}.csv`;
    downloadTextFile(name, csv, "text/csv");
    toast.show(`${name} downloaded.`);
  }

  function printPayslips() {
    const sections = allRows
      .map(
        (r) => `
        <section style="page-break-after: always">
          <h2>${r.employee.name} <small>${r.employee.id}</small></h2>
          <p>${r.employee.position} · ${r.employee.department} · ${r.employee.office}<br/>Cutoff ${cutoff?.label ?? ""} · Pay date ${cutoff?.payDate ?? ""}</p>
          <table>
            <tr><td>Basic pay</td><td>${formatPHP(r.pay.basicPay)}</td></tr>
            <tr><td>Overtime</td><td>${formatPHP(r.pay.overtimePay)}</td></tr>
            <tr><td>Allowance</td><td>${formatPHP(r.pay.allowance)}</td></tr>
            <tr><th>Gross pay</th><th>${formatPHP(r.pay.gross)}</th></tr>
            <tr><td>SSS</td><td>(${formatPHP(r.pay.sss)})</td></tr>
            <tr><td>PhilHealth</td><td>(${formatPHP(r.pay.philHealth)})</td></tr>
            <tr><td>Pag-IBIG</td><td>(${formatPHP(r.pay.pagIbig)})</td></tr>
            <tr><td>Withholding tax</td><td>(${formatPHP(r.pay.withholdingTax)})</td></tr>
            <tr><td>Other deductions</td><td>(${formatPHP(r.pay.otherDeductions)})</td></tr>
            <tr><th>Net pay</th><th>${formatPHP(r.pay.net)}</th></tr>
          </table>
        </section>`,
      )
      .join("");
    openPrintDocument(`Payslips ${cutoff?.label ?? ""}`, sections);
  }

  const steps = [
    { title: "1. Timekeeping locked", detail: cutoff?.timekeepingLockedOn ?? "—", state: "done" },
    { title: "2. Payroll computed", detail: loading ? "—" : `${allRows.length} employees`, state: "done" },
    {
      title: "3. Review & approve",
      detail: variances.length ? `${variances.length} variance${variances.length === 1 ? "" : "s"}` : "No variances",
      state: released ? "done" : "current",
    },
    { title: "4. Remittances", detail: "SSS · PhilHealth · Pag-IBIG", state: released ? "done" : "pending" },
    { title: "5. Payslips released", detail: cutoff?.payDate.replace(/, \d{4}$/, "") ?? "—", state: released ? "done" : "pending" },
  ] as const;

  const tabs: { id: Tab; label: string }[] = [
    { id: "register", label: "Register" },
    { id: "remittances", label: remittancesDue > 0 ? `Remittances · ${remittancesDue} due` : "Remittances" },
    { id: "thirteenth", label: "13th month" },
    { id: "final-pay", label: finalPayCases.length > 0 ? `Final pay · ${finalPayCases.length}` : "Final pay" },
  ];

  return (
    <>
      <ContentHead
        title="Payroll Runs"
        subtitle={cutoff ? `Cutoff ${cutoff.label} · pay date ${cutoff.payDate.replace(/, \d{4}$/, "")} · ${office}` : "Payroll"}
        actions={
          released ? (
            <>
              <span className="self-center">
                <Chip variant="good">Locked · released {releasedAt}</Chip>
              </span>
              <Button variant="ghost" icon={<DownloadIcon className="h-3.75 w-3.75" />} onClick={downloadBankFile}>
                Bank file ({cutoff?.payrollBank})
              </Button>
              <Button variant="ghost" icon={<FileIcon className="h-3.75 w-3.75" />} onClick={printPayslips}>
                Payslips PDF
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" icon={<DownloadIcon className="h-3.75 w-3.75" />} onClick={exportRegister} disabled={allRows.length === 0}>
                Export CSV
              </Button>
              <Button variant="ghost" icon={<RefreshIcon className="h-3.75 w-3.75" />} onClick={recalculate}>
                Recalculate
              </Button>
              <Button disabled={allRows.length === 0} onClick={() => setConfirmRelease(true)}>
                Approve & release payroll
              </Button>
            </>
          )
        }
      />

      <Card className="px-4 py-4 sm:px-6">
        <ol className="grid gap-4 sm:grid-cols-5">
          {steps.map((s) => (
            <li key={s.title} aria-current={s.state === "current" ? "step" : undefined}>
              <div
                // Re-keyed on state so a step that completes (e.g. on release) fills in again.
                key={s.state}
                data-motion={s.state === "pending" ? undefined : "fill"}
                className={clsx(
                  "h-1 rounded-full",
                  s.state === "done" && "bg-brand",
                  s.state === "current" && "bg-warning",
                  s.state === "pending" && "bg-surface-2",
                )}
              />
              <div className={clsx("mt-2.5 text-[0.85rem] font-semibold", s.state === "pending" && "text-ink-2")}>
                {s.title}
                <span className="sr-only">{s.state === "done" ? " (done)" : s.state === "current" ? " (in progress)" : " (not started)"}</span>
              </div>
              <div className="text-xs text-ink-3">{s.detail}</div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Staff on payroll" value={loading ? "—" : officeRows.length} delta={`Cutoff ${cutoff?.shortLabel ?? ""}`} />
        <StatTile label="Total gross pay" value={loading ? "—" : pesoWhole.format(sum(officeRows, (p) => p.gross))} delta="Basic + OT + allowances" />
        <StatTile
          label="Total deductions"
          value={loading ? "—" : pesoWhole.format(sum(officeRows, (p) => p.totalDeductions))}
          delta="Statutory, tax & loans"
          tone="crit"
        />
        <StatTile
          label="Net payout"
          value={loading ? "—" : pesoWhole.format(sum(officeRows, (p) => p.net))}
          delta={`${cutoff?.payrollBank ?? ""} payroll · ${released ? "released" : (cutoff?.payDate.replace(/, \d{4}$/, "") ?? "")}`}
          tone="good"
        />
      </div>

      {released ? (
        <div className="success-enter flex flex-wrap items-center justify-between gap-3 rounded-xl bg-good-tint px-4 py-3 text-good">
          <div className="flex items-start gap-2.5">
            <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none" />
            <div className="text-[0.85rem]">
              <div className="font-semibold">Payroll released to {allRows.length} employees</div>
              <div>Payslips are in each employee's app. Remittance files are ready for SSS, PhilHealth and Pag-IBIG.</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setTab("remittances")}>
            Go to remittances
          </Button>
        </div>
      ) : (
        variances.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl bg-warning-tint px-4 py-3 text-warning">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-none" />
            <div className="text-[0.85rem]">
              <div className="font-semibold">
                {variances.length} variance{variances.length === 1 ? "" : "s"} to review before approval
              </div>
              <div>{variances.map((r) => r.variance).join(". ")}. Check the timekeeping exceptions before releasing.</div>
            </div>
          </div>
        )
      )}

      <Card className="min-w-0">
        <CardHeader title="Payroll register" />
        <div role="tablist" aria-label="Payroll views" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border px-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                "-mb-px flex-none whitespace-nowrap border-b-2 px-3 py-3 text-[0.82rem] font-semibold transition-colors",
                tab === t.id ? "border-brand text-ink" : "border-transparent text-ink-3 hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div key={tab} className="tab-enter">
        {tab === "register" && (
          <>
            <div className="flex flex-wrap items-center gap-2.5 px-4 py-3">
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 sm:w-72">
                <SearchIcon className="h-3.5 w-3.5 text-ink-3" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or department"
                  aria-label="Search payroll register"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
                />
              </div>
              {variances.length > 0 && !released && (
                <span className="flex items-center gap-1.5 text-xs text-ink-3">
                  <span className="h-2.5 w-2.5 rounded-sm bg-gold-tint ring-1 ring-gold/40" aria-hidden="true" />
                  Highlighted rows have a variance
                </span>
              )}
            </div>

            {!registerQuery.isLoading && visibleRows.length === 0 && (
              <EmptyState icon={<SearchXIcon />} title="No employees match" description="Try another name, or switch the office filter." />
            )}

            {/* Phones: one card per employee. */}
            <ul className="flex flex-col gap-2.5 px-4 pb-4 sm:hidden">
              {visibleRows.map((r) => (
                <li key={r.employee.id} className={clsx("rounded-lg border border-border p-3", r.variance && !released && "bg-gold-tint")}>
                  <div className="flex items-center gap-2.5">
                    <MiniAvatar initials={r.employee.initials} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{r.employee.name}</div>
                      <div className="truncate text-xs text-ink-3">{r.employee.position}</div>
                    </div>
                    <button type="button" onClick={() => setExplaining(r)} className="text-xs font-semibold text-brand-ink">
                      Explain
                    </button>
                  </div>
                  <dl className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-ink-3">Gross</dt>
                      <dd className="font-num font-semibold">{formatPHP(r.pay.gross)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Deductions</dt>
                      <dd className="font-num font-semibold">{formatPHP(r.pay.totalDeductions)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Net pay</dt>
                      <dd className="font-num font-semibold">{formatPHP(r.pay.net)}</dd>
                    </div>
                  </dl>
                  {r.variance && !released && <p className="mt-2 text-xs text-warning">{r.variance}</p>}
                </li>
              ))}
            </ul>

            {(registerQuery.isLoading || visibleRows.length > 0) && (
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full border-collapse text-[0.82rem]">
                  <thead>
                    <tr>
                      <th className={`${thClass} pl-4 text-left`}>Employee</th>
                      {["Basic", "Overtime", "Allowance", "Gross", "SSS", "PhilHealth", "Pag-IBIG", "W/Tax", "Net pay"].map((h) => (
                        <th key={h} className={`${thClass} text-right`}>
                          {h}
                        </th>
                      ))}
                      <th className={`${thClass} pr-4`}>
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {registerQuery.isLoading && <SkeletonRows columns={11} />}
                    {visibleRows.map((r) => (
                      <tr key={r.employee.id} className={clsx(r.variance && !released && "bg-gold-tint")}>
                        <td className={`${tdClass} pl-4`}>
                          <div className="flex items-center gap-2.5">
                            <MiniAvatar initials={r.employee.initials} />
                            <div>
                              <div className="whitespace-nowrap">{r.employee.name}</div>
                              <div className="whitespace-nowrap text-xs text-ink-3">{r.employee.position}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`${tdClass} font-num whitespace-nowrap text-right`}>{money(r.pay.basicPay)}</td>
                        <td className={`${tdClass} font-num whitespace-nowrap text-right`}>{money(r.pay.overtimePay)}</td>
                        <td className={`${tdClass} font-num whitespace-nowrap text-right`}>{money(r.pay.allowance)}</td>
                        <td className={`${tdClass} font-num whitespace-nowrap text-right`}>{formatPHP(r.pay.gross)}</td>
                        <td className={`${tdClass} font-num whitespace-nowrap text-right`}>{formatPHP(r.pay.sss)}</td>
                        <td className={`${tdClass} font-num whitespace-nowrap text-right`}>{formatPHP(r.pay.philHealth)}</td>
                        <td className={`${tdClass} font-num whitespace-nowrap text-right`}>{formatPHP(r.pay.pagIbig)}</td>
                        <td className={`${tdClass} font-num whitespace-nowrap text-right`}>{formatPHP(r.pay.withholdingTax)}</td>
                        <td className={`${tdClass} font-num whitespace-nowrap text-right font-semibold`}>{formatPHP(r.pay.net)}</td>
                        <td className={`${tdClass} pr-4`}>
                          <button
                            type="button"
                            onClick={() => setExplaining(r)}
                            aria-label={`Explain ${r.employee.name}'s pay`}
                            className="text-xs font-semibold text-brand-ink hover:underline"
                          >
                            Explain
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {visibleRows.length > 0 && (
                    <tfoot>
                      <tr className="bg-surface-2 font-semibold">
                        <td className="px-3 py-2.5 pl-4">Total · {visibleRows.length}</td>
                        {[
                          (p: PayrollComputation) => p.basicPay,
                          (p: PayrollComputation) => p.overtimePay,
                          (p: PayrollComputation) => p.allowance,
                          (p: PayrollComputation) => p.gross,
                          (p: PayrollComputation) => p.sss,
                          (p: PayrollComputation) => p.philHealth,
                          (p: PayrollComputation) => p.pagIbig,
                          (p: PayrollComputation) => p.withholdingTax,
                          (p: PayrollComputation) => p.net,
                        ].map((pick, i) => (
                          <td key={i} className="font-num whitespace-nowrap px-3 py-2.5 text-right">
                            {formatPHP(sum(visibleRows, pick))}
                          </td>
                        ))}
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </>
        )}

        {tab === "remittances" && <RemittancesPanel />}

        {tab === "thirteenth" && <ThirteenthMonthPanel rows={officeRows} />}

        {tab === "final-pay" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.82rem]">
              <thead>
                <tr>
                  {["Employee", "Department", "Last day", "Final pay due", "Stage"].map((h) => (
                    <th key={h} className={`${thClass} text-left first:pl-4`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {finalPayCases.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState icon={<CheckCircleIcon />} title="No final pay pending" />
                    </td>
                  </tr>
                )}
                {finalPayCases.map((c) => {
                  const lastDay = new Date(c.lastDay);
                  const due = Number.isNaN(lastDay.getTime())
                    ? "—"
                    : new Date(lastDay.getTime() + 30 * 86_400_000).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });
                  return (
                    <tr key={c.id}>
                      <td className={`${tdClass} pl-4`}>
                        <div className="flex items-center gap-2.5">
                          <MiniAvatar initials={c.employeeInitials} />
                          {c.employeeName}
                        </div>
                      </td>
                      <td className={tdClass}>{c.department}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>{c.lastDay}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>{due}</td>
                      <td className={tdClass}>
                        <Link to="/admin/offboarding" className="font-semibold text-brand-ink hover:underline">
                          {c.stage}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-4 py-3 text-xs text-ink-3">Final pay is due within 30 days of separation (DOLE Labor Advisory No. 06-20).</p>
          </div>
        )}
        </div>
      </Card>

      <PayrollExplainDialog
        row={explaining}
        onClose={() => setExplaining(null)}
        onEdit={(row) => {
          setExplaining(null);
          setEditing(row);
        }}
      />

      <EditPayrollEntryDialog
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => toast.show("Pay updated. It's back to Draft until you release.")}
      />

      <Dialog
        open={confirmRelease}
        onClose={() => setConfirmRelease(false)}
        title={`Approve and release ${cutoff?.shortLabel ?? ""} payroll?`}
      >
        <p className="text-sm text-ink-2">
          This locks timekeeping and pay for {allRows.length} employees across all offices and releases{" "}
          <span className="font-semibold text-ink">{formatPHP(allNet)}</span> net pay through {cutoff?.payrollBank}.
          Payslips go to each employee's app. After release, changes need a correction run.
        </p>
        {variances.length > 0 && (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-warning-tint px-3 py-2.5 text-[0.82rem] text-warning">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-none" />
            <div>
              <div className="font-semibold">
                {variances.length} variance{variances.length === 1 ? " is" : "s are"} still flagged
              </div>
              <div>{variances.map((r) => r.employee.name).join(" and ")} overtime. Approve only if reviewed.</div>
            </div>
          </div>
        )}
        <div className="-mx-4.5 mt-4 flex justify-end gap-2 border-t border-border px-4.5 pt-3.5">
          <Button type="button" variant="ghost" onClick={() => setConfirmRelease(false)}>
            Keep reviewing
          </Button>
          <Button type="button" disabled={releaseMutation.isPending} onClick={() => releaseMutation.mutate()}>
            {releaseMutation.isPending ? "Releasing…" : "Approve & release"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function ThirteenthMonthPanel({ rows }: { rows: Row[] }) {
  const months = Number(todayIso().slice(5, 7));
  const accrued = rows.map((r) => ({ row: r, earned: r.entry.monthlyBasic * months, accrued: thirteenthMonthAccrued(r.entry.monthlyBasic) }));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[0.82rem]">
        <thead>
          <tr>
            <th className={`${thClass} pl-4 text-left`}>Employee</th>
            <th className={`${thClass} text-right`}>Monthly basic</th>
            <th className={`${thClass} text-right`}>Basic earned this year</th>
            <th className={`${thClass} pr-4 text-right`}>13th month accrued</th>
          </tr>
        </thead>
        <tbody>
          {accrued.map(({ row, earned, accrued }) => (
            <tr key={row.employee.id}>
              <td className={`${tdClass} pl-4`}>
                <div className="flex items-center gap-2.5">
                  <MiniAvatar initials={row.employee.initials} />
                  <span className="whitespace-nowrap">{row.employee.name}</span>
                </div>
              </td>
              <td className={`${tdClass} font-num text-right`}>{formatPHP(row.entry.monthlyBasic)}</td>
              <td className={`${tdClass} font-num text-right`}>{formatPHP(earned)}</td>
              <td className={`${tdClass} font-num pr-4 text-right font-semibold`}>{formatPHP(accrued)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-surface-2 font-semibold">
            <td className="px-3 py-2.5 pl-4">Total · {rows.length}</td>
            <td />
            <td className="font-num px-3 py-2.5 text-right">{formatPHP(accrued.reduce((s, a) => s + a.earned, 0))}</td>
            <td className="font-num px-3 py-2.5 pr-4 text-right">{formatPHP(accrued.reduce((s, a) => s + a.accrued, 0))}</td>
          </tr>
        </tfoot>
      </table>
      <p className="px-4 py-3 text-xs text-ink-3">
        Basic salary earned this year ÷ 12, released on or before Dec 24 (PD 851). The Payroll Processor still needs to
        confirm the formula and the treatment of salary changes (BRD §5.9.5).
      </p>
    </div>
  );
}
