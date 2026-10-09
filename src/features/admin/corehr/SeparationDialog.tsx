import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { cancelSeparation, recordSeparation, SEPARATION_REASONS } from "@/lib/corehr/api";
import { inputClass, useActor } from "./format";
import { ErrorNote, Field } from "./ui";

/** HR records that someone is leaving: last day, reason, and a note. */
export function SeparationDialog({ employeeId, name, onClose }: { employeeId: string; name: string; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const [d, setD] = useState({ lastDay: new Date().toISOString().slice(0, 10), reason: "", note: "" });
  const save = useMutation({
    mutationFn: () => recordSeparation(employeeId, d, actor),
    onSuccess: (e) => {
      queryClient.invalidateQueries();
      toast.show(e.job.status === "Separated" ? `${name} is now separated. Their login is closed and Accounting has a final pay case.` : `Recorded. ${name} stays active until their last day; Accounting has a final pay case.`);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Record separation · ${name}`}
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={save.isPending} onClick={() => save.mutate()}>
            Record separation
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="sep-last" label="Last day" hint="The last day they work or are paid for.">
            <input id="sep-last" type="date" className={inputClass} value={d.lastDay} onChange={(e) => setD({ ...d, lastDay: e.target.value })} />
          </Field>
          <Field id="sep-why" label="Reason">
            <select id="sep-why" className={inputClass} value={d.reason} onChange={(e) => setD({ ...d, reason: e.target.value })}>
              <option value="">Choose</option>
              {SEPARATION_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="sep-note" label="Note" hint="Optional, e.g. resignation letter received Oct 1.">
          <textarea id="sep-note" rows={2} className={inputClass} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
        </Field>
        <ul className="list-disc pl-5 text-xs text-ink-2">
          <li>Until the last day they stay active. After it, they're off payroll and headcount and can't sign in.</li>
          <li>Accounting gets a final pay case right away.</li>
          <li>Recorded in their employment history. You can cancel it if the resignation is withdrawn.</li>
        </ul>
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}

/** Undo a separation recorded by mistake, or a withdrawn resignation. */
export function useCancelSeparation(employeeId: string, name: string) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelSeparation(employeeId, actor),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.show(`Separation cancelled. ${name} is active again. Turn their login back on in Users if it was closed.`);
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't cancel it.", "critical"),
  });
}
