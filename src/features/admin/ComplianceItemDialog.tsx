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
  const [periodCovered, setPeriodCovered] = useState(existing?.periodCovered ?? "");
  const [amount, setAmount] = useState(existing?.amount !== undefined ? String(existing.amount) : "");
  const [referenceNo, setReferenceNo] = useState(existing?.referenceNo ?? "");

  const parsedAmount = amount.trim() === "" ? undefined : Number(amount.replace(/,/g, ""));
  const amountInvalid = parsedAmount !== undefined && (!Number.isFinite(parsedAmount) || parsedAmount < 0);

  const mutation = useMutation({
    mutationFn: () => {
      const input = {
        filing: filing.trim(),
        agency,
        due: due.trim(),
        periodCovered: periodCovered.trim() || undefined,
        amount: parsedAmount,
        referenceNo: referenceNo.trim() || undefined,
      };
      return existing ? updateComplianceItem(existing.id, input) : createComplianceItem(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "compliance-calendar"] });
      onClose();
      onSubmitted();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!filing.trim() || !due.trim() || amountInvalid) return;
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
        <input id="comp-due" required className={inputClass} placeholder="e.g. Oct 30, 2026" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="comp-period" className={labelClass}>
            Period covered
          </label>
          <input
            id="comp-period"
            className={inputClass}
            placeholder="e.g. September 2026"
            value={periodCovered}
            onChange={(e) => setPeriodCovered(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="comp-amount" className={labelClass}>
            Amount (₱)
          </label>
          <input
            id="comp-amount"
            inputMode="decimal"
            className={inputClass}
            placeholder="e.g. 18,375.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={amountInvalid}
            aria-describedby={amountInvalid ? "comp-amount-error" : undefined}
          />
          {amountInvalid && (
            <p id="comp-amount-error" className="mt-1 text-xs text-critical">
              Enter the amount in pesos, e.g. 18,375.00.
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="comp-reference" className={labelClass}>
          Reference no. <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <input
          id="comp-reference"
          className={inputClass}
          placeholder="e.g. PRN / eFPS ref"
          value={referenceNo}
          onChange={(e) => setReferenceNo(e.target.value)}
        />
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
