import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { PlusIcon } from "@/components/icons";
import { admin } from "@/lib/admin/store";
import { computeFinalPay, finalPayPeople, listFinalPay, openFinalPay, releaseFinalPay, removeFinalPay, type FinalPayItem, type FinalPayRow } from "@/lib/pay/finalpay";
import { escapeHtml, openPrintDocument } from "@/lib/printDocument";
import { useCan } from "@/lib/useCan";
import { inputClass, useActor } from "../corehr/format";
import { Drawer, ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { Name, SimpleTable } from "../timekeeping/common";

const KEY = ["payroll", "final-pay"] as const;
const REASONS = ["Resigned", "End of contract", "Retired", "Terminated", "Redundancy", "Death", "Other"];
const peso = (n: number) => `${n < 0 ? "−" : ""}₱${Math.abs(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

function printStatement(row: FinalPayRow, items: FinalPayItem[], total: number, reference?: string) {
  const body = items.map((i) => `<tr><td>${escapeHtml(i.label)}<br><span style="color:#7d8496;font-size:11px">${escapeHtml(i.detail)}</span></td><td class="num">${escapeHtml(peso(i.amount))}</td></tr>`).join("");
  openPrintDocument(
    `Final pay ${row.name}`,
    `<div class="doc-header"><div class="doc-brand">${escapeHtml(admin.settings.companyName)}</div><div class="doc-title"><h1>Final pay computation</h1><p>${escapeHtml(row.name)} · last day ${escapeHtml(shortDate(row.lastDay))}</p></div></div>
     <div class="meta-grid"><div><span class="meta-label">Employee</span><span class="meta-value">${escapeHtml(row.name)} (${escapeHtml(row.employeeId)})</span></div><div><span class="meta-label">Position</span><span class="meta-value">${escapeHtml(row.position)}</span></div><div><span class="meta-label">Reason</span><span class="meta-value">${escapeHtml(row.reason)}</span></div><div><span class="meta-label">${reference ? "Released" : "Status"}</span><span class="meta-value">${escapeHtml(reference ?? "Draft, not released")}</span></div></div>
     <table><thead><tr><th>Item</th><th class="num">Amount</th></tr></thead><tbody>${body}<tr class="total-row"><td>Final pay</td><td class="num">${escapeHtml(peso(total))}</td></tr></tbody></table>
     <p class="cert-body" style="margin-top:40px">Received the above amount in full settlement of all claims against the company.</p>
     <p class="cert-body">_______________________________<br>${escapeHtml(row.name)}<br>Date: ______________</p>
     <p class="doc-footer">Generated ${escapeHtml(new Date().toLocaleString("en-PH"))}</p>`,
  );
}

function OpenDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const [d, setD] = useState({ employeeId: "", lastDay: new Date().toISOString().slice(0, 10), reason: "" });
  const open = useMutation({
    mutationFn: () => openFinalPay(d, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      toast.show("Final pay case opened.");
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Start final pay"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={open.isPending} onClick={() => open.mutate()}>
            Start
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">For someone whose resignation or separation HR has already accepted. HR still records the separation on their 201 file.</p>
        <Field id="fp-emp" label="Employee">
          <select id="fp-emp" className={inputClass} value={d.employeeId} onChange={(e) => setD({ ...d, employeeId: e.target.value })}>
            <option value="">Choose the employee</option>
            {finalPayPeople().map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="fp-last" label="Last day">
            <input id="fp-last" type="date" className={inputClass} value={d.lastDay} onChange={(e) => setD({ ...d, lastDay: e.target.value })} />
          </Field>
          <Field id="fp-why" label="Reason">
            <select id="fp-why" className={inputClass} value={d.reason} onChange={(e) => setD({ ...d, reason: e.target.value })}>
              <option value="">Choose</option>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
        </div>
        <ErrorNote error={open.error} />
      </div>
    </Dialog>
  );
}

function CaseDrawer({ row, onClose }: { row: FinalPayRow; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const canRelease = useCan("final", "payrollRuns");
  const [reference, setReference] = useState("");
  const live = useQuery({ queryKey: [...KEY, "compute", row.employeeId, row.lastDay], queryFn: () => computeFinalPay(row.employeeId, row.lastDay), enabled: !row.released, staleTime: 0 });
  const release = useMutation({
    mutationFn: () => releaseFinalPay(row, reference, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
      toast.show(`Final pay for ${row.name} released.`);
      onClose();
    },
  });
  const items = row.released?.items ?? live.data?.items ?? [];
  const total = row.released?.total ?? live.data?.total ?? 0;
  return (
    <Drawer open onClose={onClose} title={row.name} subtitle={`${row.position} · last day ${shortDate(row.lastDay)} · ${row.reason}`}>
      <div className="flex flex-col gap-5">
        {row.released && (
          <p className="rounded-lg bg-good-tint px-3 py-2 text-xs text-good">
            Released {shortDate(row.released.at)} by {row.released.by} · {row.released.reference}
          </p>
        )}
        {!row.released && live.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {items.map((i) => (
                <tr key={i.label + i.detail} className="border-t border-surface-2">
                  <td className="py-2">
                    {i.label}
                    <span className="block text-xs text-ink-2">{i.detail}</span>
                  </td>
                  <td className={`font-num py-2 text-right ${i.amount < 0 ? "text-critical" : ""}`}>{peso(i.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border font-semibold">
                <td className="py-2">{total < 0 ? "Employee owes" : "Final pay"}</td>
                <td className="font-num py-2 text-right">{peso(total)}</td>
              </tr>
            </tbody>
          </table>
        )}
        {live.data?.notes.map((n) => (
          <p key={n} className="text-xs text-ink-2">
            {n}
          </p>
        ))}
        <p className="text-xs text-ink-3">Unused leave up to 10 days is tax-free; 13th month and other benefits are tax-free up to ₱90,000. The Labor Code gives 30 days from the last day to release final pay.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" disabled={!items.length} onClick={() => printStatement(row, items, total, row.released?.reference)}>
            Print statement
          </Button>
        </div>
        {!row.released && canRelease && (
          <section className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <h3 className="text-sm font-semibold">Release</h3>
            <p className="text-xs text-ink-2">Locks these figures, closes the loans and marks the reimbursements paid.</p>
            <Field id="fp-ref" label="Check or transfer reference">
              <input id="fp-ref" className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <ErrorNote error={release.error} />
            <div className="flex justify-end">
              <Button disabled={release.isPending || live.isLoading} onClick={() => release.mutate()}>
                Release final pay
              </Button>
            </div>
          </section>
        )}
      </div>
    </Drawer>
  );
}

/** Payroll → Final pay. */
export function FinalPayPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: KEY, queryFn: listFinalPay, staleTime: 0 });
  const canCreate = useCan("create", "payrollRuns");
  const [opening, setOpening] = useState(false);
  const [viewing, setViewing] = useState<FinalPayRow | null>(null);
  const remove = useMutation({ mutationFn: (id: string) => removeFinalPay(id), onSuccess: () => (queryClient.invalidateQueries({ queryKey: KEY }), toast.show("Case removed.")) });
  if (list.isError) return <LoadError onRetry={() => list.refetch()} />;
  const rows = list.data ?? [];
  const open = rows.filter((r) => !r.released).length;

  return (
    <>
      <ContentHead
        title="Final pay"
        subtitle={`Last salary, unused leave, prorated 13th month and tax refund for people leaving, less loan balances.${open ? ` ${open} to release.` : ""}`}
        actions={
          canCreate ? (
            <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setOpening(true)}>
              Start final pay
            </Button>
          ) : undefined
        }
      />
      <SimpleTable<FinalPayRow>
        rows={rows}
        rowKey={(r) => r.employeeId}
        loading={list.isLoading}
        empty="No one is leaving right now."
        cols={[
          { header: "Employee", cell: (r) => <Name name={r.name} sub={r.position} /> },
          { header: "Last day", cell: (r) => shortDate(r.lastDay) },
          { header: "Reason", cell: (r) => <span className="text-ink-2">{r.reason}</span> },
          { header: "Status", cell: (r) => (r.released ? <Pill tone="good">Released · {peso(r.released.total)}</Pill> : <Pill tone="warn">To release</Pill>) },
          {
            header: "",
            align: "right",
            cell: (r) => (
              <span className="flex justify-end gap-2">
                {!r.released && r.caseId && canCreate && (
                  <Button size="sm" variant="ghost" onClick={() => window.confirm(`Remove the final pay case for ${r.name}?`) && remove.mutate(r.caseId!)}>
                    Remove
                  </Button>
                )}
                <Button size="sm" variant={r.released ? "ghost" : "primary"} onClick={() => setViewing(r)}>
                  {r.released ? "View" : "Compute"}
                </Button>
              </span>
            ),
          },
        ]}
      />
      {opening && <OpenDialog onClose={() => setOpening(false)} />}
      {viewing && <CaseDrawer row={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
