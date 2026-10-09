import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { PlusIcon } from "@/components/icons";
import { LOAN_KINDS, type LoanKind } from "@/lib/pay/loanStore";
import { listLoans, loanPeople, saveLoan, stopLoan, type LoanInput, type LoanRow } from "@/lib/pay/loans";
import { useCan } from "@/lib/useCan";
import { inputClass, useActor } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { Name, SearchBox, SimpleTable, Tabs, Toolbar } from "../timekeeping/common";

const KEY = ["payroll", "loans"] as const;
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

function LoanDialog({ row, onClose }: { row?: LoanRow; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [d, setD] = useState<LoanInput>(
    row ? { id: row.id, employeeId: row.employeeId, kind: row.kind, reference: row.reference, principal: row.principal, installment: row.installment, startDate: row.startDate, note: row.note ?? "" } : { employeeId: "", kind: "", reference: "", principal: 0, installment: 0, startDate: today, note: "" },
  );
  const save = useMutation({
    mutationFn: () => saveLoan(d, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.show(row ? "Loan updated. Draft payroll runs pick it up when refreshed." : "Loan added. It's deducted from every payroll run from its first cutoff.");
      onClose();
    },
  });
  const cutoffs = d.principal > 0 && d.installment > 0 ? Math.ceil(d.principal / d.installment) : 0;
  return (
    <Dialog
      open
      onClose={onClose}
      title={row ? `Edit ${row.kind}` : "Add a loan or deduction"}
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Field id="ln-emp" label="Employee">
          <select id="ln-emp" className={inputClass} value={d.employeeId} disabled={!!row} onChange={(e) => setD({ ...d, employeeId: e.target.value })}>
            <option value="">Choose the employee</option>
            {loanPeople().map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="ln-kind" label="Kind">
            <select id="ln-kind" className={inputClass} value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as LoanKind })}>
              <option value="">Choose</option>
              {LOAN_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Field>
          <Field id="ln-ref" label={d.kind === "Other deduction" ? "What it's for" : "Loan or reference number"}>
            <input id="ln-ref" className={inputClass} value={d.reference} onChange={(e) => setD({ ...d, reference: e.target.value })} />
          </Field>
          <Field id="ln-total" label="Total to deduct">
            <input id="ln-total" type="number" min={0} step="0.01" className={inputClass} value={d.principal || ""} onChange={(e) => setD({ ...d, principal: Number(e.target.value) })} />
          </Field>
          <Field id="ln-inst" label="Per cutoff" hint={cutoffs ? `${cutoffs} ${cutoffs === 1 ? "cutoff" : "cutoffs"} (about ${Math.ceil(cutoffs / 2)} ${cutoffs <= 2 ? "month" : "months"})` : "Taken from each semi-monthly pay"}>
            <input id="ln-inst" type="number" min={0} step="0.01" className={inputClass} value={d.installment || ""} onChange={(e) => setD({ ...d, installment: Number(e.target.value) })} />
          </Field>
        </div>
        <Field id="ln-start" label="First deduction" hint="Deducted from the payroll run whose cutoff includes this date, and every run after.">
          <input id="ln-start" type="date" className={inputClass} value={d.startDate} onChange={(e) => setD({ ...d, startDate: e.target.value })} />
        </Field>
        <Field id="ln-note" label="Note" hint="Optional.">
          <input id="ln-note" className={inputClass} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
        </Field>
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}

function StopDialog({ row, onClose }: { row: LoanRow; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const stop = useMutation({
    mutationFn: () => stopLoan(row.id, reason, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.show("Deductions stopped.");
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Stop deducting ${row.kind}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={stop.isPending} onClick={() => stop.mutate()}>
            Stop deductions
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">
          {row.employeeName} still owes {peso(row.balance)}. Payroll runs stop deducting it; what was already deducted stays on record.
        </p>
        <Field id="ln-why" label="Why">
          <input id="ln-why" className={inputClass} value={reason} placeholder="e.g. Paid in full at the SSS branch" onChange={(e) => setReason(e.target.value)} />
        </Field>
        <ErrorNote error={stop.error} />
      </div>
    </Dialog>
  );
}

/** Payroll → Loans & deductions. */
export function LoansPage() {
  const list = useQuery({ queryKey: KEY, queryFn: listLoans, staleTime: 0 });
  const canEdit = useCan("edit", "payrollRuns");
  const [tab, setTab] = useState<"running" | "closed">("running");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<LoanRow | "new" | null>(null);
  const [stopping, setStopping] = useState<LoanRow | null>(null);
  if (list.isError) return <LoadError onRetry={() => list.refetch()} />;

  const all = list.data ?? [];
  const running = all.filter((l) => l.balance > 0);
  const q = query.trim().toLowerCase();
  const rows = (tab === "running" ? running : all.filter((l) => l.balance <= 0)).filter((l) => !q || `${l.employeeName} ${l.kind} ${l.reference}`.toLowerCase().includes(q));
  const perCutoff = running.reduce((n, l) => n + Math.min(l.installment, l.balance), 0);

  return (
    <>
      <ContentHead
        title="Loans & deductions"
        subtitle={`SSS and Pag-IBIG loans, cash advances and company loans, deducted from each payroll run until paid.${running.length ? ` ${peso(perCutoff)} comes off the next run.` : ""}`}
        actions={
          canEdit ? (
            <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setEditing("new")}>
              Add loan
            </Button>
          ) : undefined
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "running", label: "Running", count: running.length },
          { value: "closed", label: "Paid or stopped", count: all.length - running.length },
        ]}
      />
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} placeholder="Search employee or loan" />
      </Toolbar>
      <SimpleTable<LoanRow>
        rows={rows}
        rowKey={(l) => l.id}
        loading={list.isLoading}
        empty={tab === "running" ? "No loans running." : "Nothing paid or stopped yet."}
        cols={[
          { header: "Employee", cell: (l) => <Name name={l.employeeName} sub={l.employeeId} /> },
          { header: "Loan", cell: (l) => <Name name={l.kind} sub={l.reference} /> },
          { header: "Total", align: "right", cell: (l) => <span className="font-num">{peso(l.principal)}</span> },
          { header: "Per cutoff", align: "right", cell: (l) => <span className="font-num">{peso(l.installment)}</span> },
          { header: "Paid", align: "right", cell: (l) => <span className="font-num text-ink-2">{peso(l.paid)}</span> },
          {
            header: "Balance",
            align: "right",
            cell: (l) =>
              l.balance > 0 ? (
                <span className="block text-right">
                  <span className="font-num block font-semibold">{peso(l.balance)}</span>
                  <span className="block text-xs text-ink-2">
                    {l.cutoffsLeft} {l.cutoffsLeft === 1 ? "cutoff" : "cutoffs"} left · from {shortDate(l.startDate)}
                  </span>
                </span>
              ) : (
                <Pill tone={l.status === "active" ? "good" : "neutral"}>{l.status === "active" ? "Paid" : l.status === "settled" ? "Settled in final pay" : "Stopped"}</Pill>
              ),
          },
          {
            header: "",
            align: "right",
            cell: (l) =>
              canEdit && l.balance > 0 ? (
                <span className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setStopping(l)}>
                    Stop
                  </Button>
                </span>
              ) : null,
          },
        ]}
      />
      <p className="text-xs text-ink-3">Deductions are counted as paid once the payroll run that takes them is approved. Draft runs show what they'll take.</p>
      {editing && <LoanDialog row={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {stopping && <StopDialog row={stopping} onClose={() => setStopping(null)} />}
    </>
  );
}
