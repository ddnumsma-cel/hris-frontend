import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { createComplianceItem, updateComplianceItem } from "@/lib/api";
import type { ComplianceItem } from "@/lib/types";

const agencies: ComplianceItem["agency"][] = ["SSS", "PhilHealth", "Pag-IBIG", "BIR"];

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

function ComplianceForm({
  existing,
  onClose,
  onSubmitted,
}: {
  existing: ComplianceItem | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const [filing, setFiling] = useState(existing?.filing ?? "");
  const [agency, setAgency] = useState<ComplianceItem["agency"]>(existing?.agency ?? "SSS");
  const [due, setDue] = useState(existing?.due ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      existing
        ? updateComplianceItem(existing.id, { filing: filing.trim(), agency, due: due.trim() })
        : createComplianceItem({ filing: filing.trim(), agency, due: due.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "compliance-calendar"] });
      onClose();
      onSubmitted();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!filing.trim() || !due.trim()) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <div>
        <label htmlFor="comp-filing" className={labelClass}>
          Filing
        </label>
        <input
          id="comp-filing"
          required
          className={inputClass}
          placeholder="e.g. Monthly contribution remittance"
          value={filing}
          onChange={(e) => setFiling(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="comp-agency" className={labelClass}>
          Agency
        </label>
        <select
          id="comp-agency"
          className={inputClass}
          value={agency}
          onChange={(e) => setAgency(e.target.value as ComplianceItem["agency"])}
        >
          {agencies.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="comp-due" className={labelClass}>
          Due
        </label>
        <input id="comp-due" required className={inputClass} placeholder="e.g. Oct 10" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>

      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : existing ? "Save changes" : "Add filing"}
        </Button>
      </div>
    </form>
  );
}

export function ComplianceItemDialog({
  open,
  existing,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  existing: ComplianceItem | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={existing ? "Edit filing" : "Add filing"}>
      <ComplianceForm key={existing?.id ?? "new"} existing={existing} onClose={onClose} onSubmitted={onSubmitted} />
    </Dialog>
  );
}
