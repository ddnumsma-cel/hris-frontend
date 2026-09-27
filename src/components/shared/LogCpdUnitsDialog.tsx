import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { updateCpdUnits } from "@/lib/api";
import type { ProfessionalLicense } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

export function LogCpdUnitsDialog({
  license,
  onClose,
  onSubmitted,
}: {
  license: ProfessionalLicense | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const [units, setUnits] = useState("");

  const mutation = useMutation({
    mutationFn: (cpdUnitsEarned: number) => updateCpdUnits(license!.id, cpdUnitsEarned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "professional-license"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "professional-licenses"] });
      setUnits("");
      onClose();
      onSubmitted();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const additional = Number(units);
    if (!license || !Number.isFinite(additional) || additional <= 0) return;
    mutation.mutate(license.cpdUnitsEarned + additional);
  }

  return (
    <Dialog open={license !== null} onClose={onClose} title="Log CPD units">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <p className="text-xs text-ink-2">
          {license && (
            <>
              Currently {license.cpdUnitsEarned} of {license.cpdUnitsRequired} units for this cycle (ends{" "}
              {license.cycleEndDate}).
            </>
          )}
        </p>
        <div>
          <label htmlFor="cpd-units" className={labelClass}>
            Units completed (e.g. from a seminar or CPD-accredited course)
          </label>
          <input
            id="cpd-units"
            type="number"
            min={1}
            step={1}
            required
            className={inputClass}
            placeholder="e.g. 5"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
          />
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
