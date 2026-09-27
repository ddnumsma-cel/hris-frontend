import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { updateCertificateRequest } from "@/lib/api";
import { certificateTypes } from "@/lib/schemas";
import type { CertificateRequest } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

function EditForm({
  request,
  onClose,
  onSubmitted,
}: {
  request: CertificateRequest;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState(request.type);
  const [purpose, setPurpose] = useState(request.purpose);

  const mutation = useMutation({
    mutationFn: () => updateCertificateRequest(request.id, { type, purpose: purpose.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "certificate-requests"] });
      queryClient.invalidateQueries({ queryKey: ["employee", "certificate-requests"] });
      onClose();
      onSubmitted();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!purpose.trim()) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <div>
        <label htmlFor="edit-cert-type" className={labelClass}>
          Type
        </label>
        <select id="edit-cert-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
          {certificateTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="edit-cert-purpose" className={labelClass}>
          Purpose
        </label>
        <input id="edit-cert-purpose" required className={inputClass} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </div>

      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export function EditCertificateRequestDialog({
  request,
  onClose,
  onSubmitted,
}: {
  request: CertificateRequest | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  return (
    <Dialog open={request !== null} onClose={onClose} title="Edit certificate request">
      {request && <EditForm key={request.id} request={request} onClose={onClose} onSubmitted={onSubmitted} />}
    </Dialog>
  );
}
