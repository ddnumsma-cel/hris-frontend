import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { regularize } from "@/lib/corehr/api";
import { inputClass, useActor } from "./format";
import { ErrorNote, Field } from "./ui";

/** HR regularizes someone on probation or a fixed term: the date they became regular and a note. */
export function RegularizeDialog({ employeeId, name, from, dateHired, onClose }: { employeeId: string; name: string; from: string; dateHired: string; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  // Probation is up to 6 months: suggest the day it ends, or today if that has passed.
  const sixMonths = (() => {
    if (!dateHired) return "";
    const d = new Date(`${dateHired}T12:00:00`);
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 10);
  })();
  const today = new Date().toISOString().slice(0, 10);
  const [d, setD] = useState({ date: sixMonths && sixMonths < today ? sixMonths : today, note: "" });
  const save = useMutation({
    mutationFn: () => regularize(employeeId, d, actor),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.show(`${name} is now a regular employee. They've been notified.`);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Regularize · ${name}`}
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!d.date || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Regularize"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">
          {from} → <span className="font-semibold text-ink">Regular</span>. From this date they file paid leave from their VL/SL credits, and Leave without pay is no longer offered to them.
        </p>
        <Field id="rg-date" label="Regular from" required hint={sixMonths ? `Six months after hire: ${new Date(`${sixMonths}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}.` : undefined}>
          <input id="rg-date" type="date" className={inputClass} min={dateHired || undefined} value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
        </Field>
        <Field id="rg-note" label="Note" hint="Optional, e.g. passed the performance review. Only HR sees it.">
          <input id="rg-note" className={inputClass} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
        </Field>
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}
