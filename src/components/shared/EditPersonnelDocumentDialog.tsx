import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/AuthContext";
import { updatePersonnelDocument } from "@/lib/api";
import type { PersonnelDocument, PersonnelDocumentStatus } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

const STATUS_OPTIONS: PersonnelDocumentStatus[] = ["Missing", "Submitted", "Verified", "Not applicable"];

export function EditPersonnelDocumentDialog({
  document,
  onClose,
  onSubmitted,
}: {
  document: PersonnelDocument | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [status, setStatus] = useState<PersonnelDocumentStatus>(document?.status ?? "Missing");
  const [idType, setIdType] = useState(document?.idType ?? "");
  const [idNumber, setIdNumber] = useState(document?.idNumber ?? "");
  const [idExpiry, setIdExpiry] = useState(document?.idExpiry ?? "");
  const [licenseNumber, setLicenseNumber] = useState(document?.licenseNumber ?? "");
  const [licenseExpiry, setLicenseExpiry] = useState(document?.licenseExpiry ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      updatePersonnelDocument(
        document!.id,
        {
          status,
          ...(document?.type === "Valid Government ID" ? { idType, idNumber, idExpiry } : {}),
          ...(document?.type === "Professional License" ? { licenseNumber, licenseExpiry } : {}),
        },
        user && (user.role === "manager" || user.role === "admin") ? { name: user.name, role: user.role } : undefined,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel", "documents"] });
      queryClient.invalidateQueries({ queryKey: ["personnel", "audit-log"] });
      onClose();
      onSubmitted();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={document !== null} onClose={onClose} title={document?.type ?? "Document"}>
      {document && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label htmlFor="doc-status" className={labelClass}>
              Status
            </label>
            <select
              id="doc-status"
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as PersonnelDocumentStatus)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {document.type === "Valid Government ID" && (
            <>
              <div>
                <label htmlFor="doc-id-type" className={labelClass}>
                  ID type
                </label>
                <input
                  id="doc-id-type"
                  className={inputClass}
                  placeholder="e.g. UMID, Passport, Driver's License"
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="doc-id-number" className={labelClass}>
                  ID number
                </label>
                <input
                  id="doc-id-number"
                  className={inputClass}
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="doc-id-expiry" className={labelClass}>
                  Expiry date
                </label>
                <input
                  id="doc-id-expiry"
                  type="date"
                  className={inputClass}
                  value={idExpiry}
                  onChange={(e) => setIdExpiry(e.target.value)}
                />
              </div>
            </>
          )}

          {document.type === "Professional License" && (
            <>
              <div>
                <label htmlFor="doc-license-number" className={labelClass}>
                  License number
                </label>
                <input
                  id="doc-license-number"
                  className={inputClass}
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="doc-license-expiry" className={labelClass}>
                  Expiry date
                </label>
                <input
                  id="doc-license-expiry"
                  type="date"
                  className={inputClass}
                  value={licenseExpiry}
                  onChange={(e) => setLicenseExpiry(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
