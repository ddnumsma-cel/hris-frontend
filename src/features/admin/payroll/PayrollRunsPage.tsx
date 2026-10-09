import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { AlertTriangleIcon, ChevronLeftIcon, DownloadIcon, LockIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { downloadTextFile, toCsv } from "@/lib/download";
import type { PayLine } from "@/lib/reports/api";
import { addAdjustment, approveRun, createRun, deleteRun, getRun, listRuns, openCutoffs, refreshRun, removeAdjustment, runWarnings, type PayrollRun } from "@/lib/pay/runs";
import { useCan } from "@/lib/useCan";
import { inputClass, useActor } from "../corehr/format";
import { Drawer, ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { SimpleTable } from "../timekeeping/common";
import { useCreateParam } from "@/lib/useCreateParam";

const KEY = ["payroll", "runs"] as const;
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sum = (lines: PayLine[], f: (l: PayLine) => number) => Math.round(lines.reduce((n, l) => n + f(l), 0) * 100) / 100;
const when = (iso: string) => new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim() : `${m}m`);

function StatusPill({ run }: { run: PayrollRun }) {
  return run.status === "approved" ? <Pill tone="good">Approved · locked</Pill> : <Pill tone="warn">Draft</Pill>;
}

// ---- List ----

function NewRunDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cutoffs = useQuery({ queryKey: [...KEY, "open"], queryFn: openCutoffs });
  const [id, setId] = useState("");
  const create = useMutation({
    mutationFn: () => createRun(cutoffs.data!.find((c) => c.id === id)!, actor),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: KEY });
      toast.show(`Payroll for ${run.label} computed from attendance.`);
      navigate(`/admin/payroll/runs/${run.id}`);
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="New payroll run"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!id || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Computing…" : "Compute payroll"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">Pay is computed from each employee&#39;s attendance in the cutoff: absences and AWOL, unpaid leave, undertime, approved overtime, holiday and night pay, then government contributions and tax. You review it before approving.</p>
        {cutoffs.data && cutoffs.data.length === 0 ? (
          <p className="text-sm text-ink-2">Every recent cutoff already has a run.</p>
        ) : (
          <Field id="nr-cut" label="Cutoff">
            <select id="nr-cut" className={inputClass} value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">Choose a cutoff</option>
              {cutoffs.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <ErrorNote error={create.error} />
      </div>
    </Dialog>
  );
}

export function PayrollRunsPage() {
  const canEdit = useCan("create", "payrollRuns");
  const runs = useQuery({ queryKey: KEY, queryFn: listRuns, staleTime: 0 });
  const [adding, setAdding] = useState(false);
  useCreateParam("payroll-run", () => setAdding(true));
  if (runs.isError) return <LoadError onRetry={() => runs.refetch()} />;
  return (
    <>
      <ContentHead
        title="Payroll runs"
        subtitle="One run per cutoff, computed from attendance. Review it, add adjustments, then approve to lock it and release the payslips."
        actions={
          canEdit ? (
            <Button icon={<PlusIcon className="h-3.75 w-3.75" />} onClick={() => setAdding(true)}>
              New payroll run
            </Button>
          ) : undefined
        }
      />
      {!canEdit && <p className="text-xs text-ink-2">View only. Accounting prepares and approves payroll.</p>}
      <SimpleTable
        rows={runs.data ?? []}
        rowKey={(r) => r.id}
        loading={runs.isLoading}
        empty={canEdit ? "No payroll runs yet. Start one for the latest cutoff." : "No payroll runs yet."}
        cols={[
          { header: "Cutoff", cell: (r) => <Link to={`/admin/payroll/runs/${r.id}`} className="font-medium hover:underline">{r.label}</Link> },
          { header: "Status", cell: (r) => <StatusPill run={r} /> },
          { header: "Employees", cell: (r) => r.lines.length },
          { header: "Gross pay", align: "right", cell: (r) => <span className="font-num">{peso(sum(r.lines, (l) => l.gross))}</span> },
          { header: "Take-home", align: "right", cell: (r) => <span className="font-num font-semibold">{peso(sum(r.lines, (l) => l.net))}</span> },
          { header: "Approved", cell: (r) => <span className="text-ink-2">{r.approvedAt ? `${when(r.approvedAt)} · ${r.approvedBy}` : "—"}</span> },
        ]}
      />
      {adding && <NewRunDialog onClose={() => setAdding(false)} />}
    </>
  );
}

// ---- One run ----

function Breakdown({ run, line, canEdit, onClose }: { run: PayrollRun; line: PayLine; canEdit: boolean; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const p = line.pay;
  const draft = run.status === "draft" && canEdit;
  const adjustments = run.adjustments[line.person.id] ?? [];
  // Loan installments and approved reimbursements, added by the run itself.
  const auto = run.auto?.[line.person.id] ?? [];
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [taxable, setTaxable] = useState(true);
  const [reason, setReason] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  const add = useMutation({
    mutationFn: () => addAdjustment(run.id, line.person.id, { label, amount: Number(amount), taxable, reason }, actor),
    onSuccess: () => {
      refresh();
      setLabel("");
      setAmount("");
      setReason("");
      toast.show("Adjustment added. Pay recomputed.");
    },
  });
  const remove = useMutation({ mutationFn: (adjId: string) => removeAdjustment(run.id, line.person.id, adjId), onSuccess: refresh });

  const rows: { label: string; detail?: string; amount: number; kind?: "minus" | "plus" | "total" }[] = [
    { label: "Basic pay", detail: p.basic === line.person.salary / 2 ? `Half of ${peso(line.person.salary)}` : "Workdays employed in this cutoff", amount: p.basic },
    ...(p.absentDays ? [{ label: `Absent ${p.absentDays} ${p.absentDays === 1 ? "day" : "days"}`, detail: `${p.absentDays} × ${peso(p.daily)}${p.awolDays ? ` · ${p.awolDays} AWOL` : ""}`, amount: -p.absentDeduction, kind: "minus" as const }] : []),
    ...(p.unpaidLeaveDays ? [{ label: "Unpaid leave", detail: `${p.unpaidLeaveDays} × ${peso(p.daily)}`, amount: -p.unpaidLeaveDeduction, kind: "minus" as const }] : []),
    ...(p.undertimeMinutes ? [{ label: "Undertime", detail: `${p.undertimeMinutes} min × ${peso(p.hourly / 60)}`, amount: -p.undertimeDeduction, kind: "minus" as const }] : []),
    ...(p.overtimeMinutes ? [{ label: "Approved overtime", detail: mins(p.overtimeMinutes), amount: p.overtimePay, kind: "plus" as const }] : []),
    ...(p.premiumMinutes ? [{ label: "Rest day & holiday pay", detail: mins(p.premiumMinutes), amount: p.premiumPay, kind: "plus" as const }] : []),
    ...(p.nightMinutes ? [{ label: "Night differential", detail: `${mins(p.nightMinutes)} × 10%`, amount: p.nightPay, kind: "plus" as const }] : []),
    ...(p.taxableAdjustments ? [{ label: "Taxable adjustments", amount: p.taxableAdjustments, kind: "plus" as const }] : []),
    { label: "Gross pay", amount: p.gross, kind: "total" },
    { label: "SSS", amount: -p.sssEe, kind: "minus" },
    { label: "PhilHealth", amount: -p.phEe, kind: "minus" },
    { label: "Pag-IBIG", amount: -p.piEe, kind: "minus" },
    { label: "Withholding tax", detail: `On ${peso(p.taxable)} taxable`, amount: -p.tax, kind: "minus" },
    ...(p.nonTaxableAdjustments ? [{ label: "Non-taxable adjustments", amount: p.nonTaxableAdjustments, kind: "plus" as const }] : []),
    { label: "Take-home pay", amount: p.net, kind: "total" },
  ];

  return (
    <Drawer open onClose={onClose} title={line.person.name} subtitle={`${line.person.position} · ${line.person.department} · ${run.label}`}>
      <div className="flex flex-col gap-5">
        <p className="text-xs text-ink-2">
          Daily rate {peso(p.daily)} ({peso(line.person.salary)} × 12 ÷ 261) · hourly {peso(p.hourly)} · present {p.present} {p.present === 1 ? "day" : "days"}
        </p>
        {p.awolDates.length > 0 && (
          <p className="flex items-start gap-2 rounded-lg bg-critical-tint px-3 py-2 text-xs text-critical">
            <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 flex-none" />
            AWOL on {p.awolDates.join(", ")}: absent 3 or more workdays in a row.
          </p>
        )}
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={r.kind === "total" ? "border-t-2 border-border font-semibold" : "border-t border-surface-2"}>
                <td className="py-2">
                  {r.label}
                  {r.detail && <span className="block text-xs font-normal text-ink-2">{r.detail}</span>}
                </td>
                <td className={`font-num py-2 text-right ${r.kind === "minus" ? "text-critical" : r.kind === "plus" ? "text-good" : ""}`}>{r.amount < 0 ? `−${peso(-r.amount)}` : peso(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {auto.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Loans and reimbursements</h3>
            {auto.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{a.label}</div>
                  <div className="truncate text-xs text-ink-2">{a.reason}</div>
                </div>
                <span className={`font-num ${a.amount < 0 ? "text-critical" : "text-good"}`}>{a.amount < 0 ? `−${peso(-a.amount)}` : peso(a.amount)}</span>
              </div>
            ))}
            <p className="text-xs text-ink-3">Added automatically from Loans & deductions and approved reimbursements. Part of the non-taxable adjustments above.</p>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Adjustments</h3>
          {adjustments.length === 0 && <p className="text-xs text-ink-2">None. Use these for allowances, bonuses or corrections from an earlier cutoff. Loans go in Loans & deductions.</p>}
          {adjustments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {a.label} <span className="text-xs font-normal text-ink-2">· {a.taxable ? "taxable" : "non-taxable"}</span>
                </div>
                <div className="truncate text-xs text-ink-2">{a.reason}</div>
              </div>
              <span className={`font-num ${a.amount < 0 ? "text-critical" : "text-good"}`}>{a.amount < 0 ? `−${peso(-a.amount)}` : peso(a.amount)}</span>
              {draft && (
                <button type="button" aria-label={`Remove ${a.label}`} onClick={() => remove.mutate(a.id)} className="rounded-md p-1 text-ink-2 hover:bg-surface hover:text-critical">
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {draft && (
            <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field id="adj-label" label="What">
                  <input id="adj-label" className={inputClass} value={label} placeholder="e.g. Rice allowance" onChange={(e) => setLabel(e.target.value)} />
                </Field>
                <Field id="adj-amount" label="Amount (₱)" hint="Negative to deduct, e.g. -500">
                  <input id="adj-amount" type="number" step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
                </Field>
              </div>
              <Field id="adj-reason" label="Reason">
                <input id="adj-reason" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <label className="flex items-center gap-2 text-xs text-ink-2">
                <input type="checkbox" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} /> Taxable (counts toward withholding tax)
              </label>
              <ErrorNote error={add.error} />
              <Button size="sm" className="self-start" disabled={add.isPending} onClick={() => add.mutate()}>
                Add adjustment
              </Button>
            </div>
          )}
        </section>
      </div>
    </Drawer>
  );
}

function ApproveDialog({ run, onClose }: { run: PayrollRun; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const warnings = runWarnings(run);
  const approve = useMutation({
    mutationFn: () => approveRun(run.id, actor),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.show(`Payroll for ${run.label} approved. Payslips are released.`);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Approve payroll for ${run.label}?`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={<LockIcon className="h-3.75 w-3.75" />} disabled={approve.isPending} onClick={() => approve.mutate()}>
            Approve and lock
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <p>
          {run.lines.length} employees · take-home <span className="font-semibold">{peso(sum(run.lines, (l) => l.net))}</span>
        </p>
        <p className="text-ink-2">Pay is recomputed one last time from the latest attendance, then locked. Employees see their payslips right away. Later corrections go into the next run as adjustments.</p>
        {warnings.length > 0 && (
          <ul className="flex flex-col gap-1.5 rounded-lg bg-warning-tint px-3 py-2 text-xs">
            {warnings.map((w) => (
              <li key={w} className="flex gap-2">
                <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 flex-none text-warning" />
                {w}
              </li>
            ))}
          </ul>
        )}
        <ErrorNote error={approve.error} />
      </div>
    </Dialog>
  );
}

export function PayrollRunPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const actor = useActor();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = useCan("edit", "payrollRuns");
  const canFinal = useCan("final", "payrollRuns");
  const canDelete = useCan("delete", "payrollRuns");
  const run = useQuery({ queryKey: [...KEY, id], queryFn: () => getRun(id), staleTime: 0 });
  const [openId, setOpenId] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const refresh = useMutation({
    mutationFn: () => refreshRun(id),
    onSuccess: () => (queryClient.invalidateQueries({ queryKey: KEY }), toast.show("Recomputed from the latest attendance.")),
  });
  const remove = useMutation({
    mutationFn: () => deleteRun(id, actor),
    onSuccess: () => (queryClient.invalidateQueries({ queryKey: KEY }), navigate("/admin/payroll/runs")),
  });

  if (run.isError) return <LoadError onRetry={() => run.refetch()} />;
  const r = run.data;
  if (!r) return <Skeleton className="h-96 w-full" />;
  const lines = [...r.lines].sort((a, b) => a.person.name.localeCompare(b.person.name));
  const open = lines.find((l) => l.person.id === openId);
  const draft = r.status === "draft";
  const warnings = draft ? runWarnings(r) : [];

  const exportCsv = () =>
    downloadTextFile(
      `payroll-${r.from}-to-${r.to}.csv`,
      toCsv(
        lines.map((l) => ({
          Employee: l.person.name,
          Department: l.person.department,
          "Basic pay": l.pay.basic,
          "Absent days": l.pay.absentDays,
          "AWOL days": l.pay.awolDays,
          "Late min (not deducted)": l.pay.lateMinutes,
          "Undertime min": l.pay.undertimeMinutes,
          Deductions: l.deductions,
          Overtime: l.pay.overtimePay,
          "Holiday & rest day": l.pay.premiumPay,
          "Night diff": l.pay.nightPay,
          Adjustments: Math.round((l.pay.taxableAdjustments + l.pay.nonTaxableAdjustments) * 100) / 100,
          Gross: l.gross,
          SSS: l.sssEe,
          PhilHealth: l.phEe,
          "Pag-IBIG": l.piEe,
          Tax: l.tax,
          "Take-home": l.net,
        })),
      ),
      "text/csv",
    );

  const tiles = [
    { label: "Employees", value: String(lines.length) },
    { label: "Gross pay", value: peso(sum(lines, (l) => l.gross)) },
    { label: "Contributions (employee)", value: peso(sum(lines, (l) => l.pay.contributions)) },
    { label: "Tax withheld", value: peso(sum(lines, (l) => l.tax)) },
    { label: "Take-home pay", value: peso(sum(lines, (l) => l.net)) },
    { label: "Company contributions", value: peso(sum(lines, (l) => l.sssEr + l.ec + l.phEr + l.piEr)) },
  ];

  return (
    <>
      <Link to="/admin/payroll/runs" className="-mb-3 inline-flex items-center gap-1 self-start text-xs font-medium text-ink-2 hover:text-ink">
        <ChevronLeftIcon className="h-3.5 w-3.5" /> Payroll runs
      </Link>
      <ContentHead
        title={`Payroll · ${r.label}`}
        subtitle={draft ? `Draft, computed ${when(r.computedAt)} from attendance.` : `Approved and locked ${when(r.approvedAt!)} by ${r.approvedBy}.`}
        actions={
          <>
            <Button variant="ghost" icon={<DownloadIcon className="h-3.75 w-3.75" />} onClick={exportCsv}>
              Export
            </Button>
            {draft && canEdit && (
              <>
                <Button variant="ghost" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
                  Recompute
                </Button>
                {canDelete && (
                  <Button variant="ghost" icon={<TrashIcon className="h-3.75 w-3.75" />} disabled={remove.isPending} onClick={() => window.confirm(`Delete the draft run for ${r.label}?`) && remove.mutate()}>
                    Delete
                  </Button>
                )}
              </>
            )}
            {draft && canFinal && (
              <Button icon={<LockIcon className="h-3.75 w-3.75" />} onClick={() => setApproving(true)}>
                Approve
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill run={r} />
        {!canEdit && <span className="text-xs text-ink-2">View only.</span>}
      </div>
      {warnings.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-2xl bg-warning-tint px-4 py-3 text-sm">
          {warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-none text-warning" />
              {w}
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-surface p-4">
            <div className="text-xs font-semibold text-ink-2">{t.label}</div>
            <div className="font-num mt-1 text-lg font-semibold">{t.value}</div>
          </div>
        ))}
      </div>
      <SimpleTable
        rows={lines}
        rowKey={(l) => l.person.id}
        empty="No one with a salary was employed in this cutoff."
        cols={[
          { header: "Employee", cell: (l) => <button type="button" onClick={() => setOpenId(l.person.id)} className="text-left font-medium hover:underline">{l.person.name}<span className="block text-xs font-normal text-ink-2">{l.person.department}</span></button> },
          { header: "Present", cell: (l) => l.pay.present },
          {
            header: "Absent",
            cell: (l) => (
              <span className="flex items-center gap-1.5">
                {l.pay.absentDays || "—"}
                {l.pay.awolDays > 0 && <Pill tone="crit">AWOL {l.pay.awolDays}</Pill>}
              </span>
            ),
          },
          { header: "Undertime", cell: (l) => <span className="text-ink-2">{l.pay.undertimeMinutes ? mins(l.pay.undertimeMinutes) : "—"}</span> },
          { header: "Late", cell: (l) => <span className="text-ink-3" title="On record only; late isn't deducted">{l.pay.lateMinutes ? mins(l.pay.lateMinutes) : "—"}</span> },
          { header: "OT & premiums", align: "right", cell: (l) => <span className="font-num">{peso(l.pay.overtimePay + l.pay.premiumPay + l.pay.nightPay)}</span> },
          { header: "Gross", align: "right", cell: (l) => <span className="font-num">{peso(l.gross)}</span> },
          { header: "Deductions", align: "right", cell: (l) => <span className="font-num text-ink-2">{peso(l.pay.contributions + l.tax)}</span> },
          { header: "Take-home", align: "right", cell: (l) => <span className="font-num font-semibold">{peso(l.net)}</span> },
          { header: "", align: "right", cell: (l) => <Button size="sm" variant="ghost" onClick={() => setOpenId(l.person.id)}>Details</Button> },
        ]}
      />
      {open && <Breakdown run={r} line={open} canEdit={canEdit} onClose={() => setOpenId(null)} />}
      {approving && <ApproveDialog run={r} onClose={() => setApproving(false)} />}
    </>
  );
}
