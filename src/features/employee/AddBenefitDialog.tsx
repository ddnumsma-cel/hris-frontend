import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { addEmployeeBenefit } from "@/lib/api";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

export function AddBenefitDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [memberId, setMemberId] = useState("");

  const mutation = useMutation({
    mutationFn: addEmployeeBenefit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "benefits"] });
      setName("");
      setProvider("");
      setMemberId("");
      onClose();
      onSubmitted();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !provider.trim() || !memberId.trim()) return;
    mutation.mutate({ name: name.trim(), provider: provider.trim(), memberId: memberId.trim() });
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add a benefit or dependent">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="benefit-name" className={labelClass}>
            Benefit name
          </label>
          <input
            id="benefit-name"
            required
            className={inputClass}
            placeholder="e.g. HMO — Dependent"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="benefit-provider" className={labelClass}>
            Provider
          </label>
          <input
            id="benefit-provider"
            required
            className={inputClass}
            placeholder="e.g. Maxicare"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="benefit-member-id" className={labelClass}>
            Member ID / note
          </label>
          <input
            id="benefit-member-id"
            required
            className={inputClass}
            placeholder="e.g. Dependent: Maria Dela Cruz (Daughter)"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          />
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
