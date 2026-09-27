import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { createCompanyAsset } from "@/lib/api";
import { employeeDirectory } from "@/lib/mockData";

const assetTypes = ["Laptop", "Company ID", "Access Card", "Company Phone", "Monitor"];

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

export function IssueAssetDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState(assetTypes[0]);
  const [assetTag, setAssetTag] = useState("");
  const [employeeId, setEmployeeId] = useState(employeeDirectory[0]?.id ?? "");

  const mutation = useMutation({
    mutationFn: createCompanyAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "assets"] });
      setAssetTag("");
      onClose();
      onSubmitted();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const employee = employeeDirectory.find((emp) => emp.id === employeeId);
    if (!employee || !assetTag.trim()) return;
    mutation.mutate({
      type,
      assetTag: assetTag.trim(),
      assignedToName: employee.name,
      assignedToInitials: employee.initials,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title="Issue asset">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="asset-type" className={labelClass}>
            Asset type
          </label>
          <select id="asset-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            {assetTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="asset-tag" className={labelClass}>
            Asset tag
          </label>
          <input
            id="asset-tag"
            required
            className={inputClass}
            placeholder="e.g. LT-0512"
            value={assetTag}
            onChange={(e) => setAssetTag(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="asset-employee" className={labelClass}>
            Assign to
          </label>
          <select
            id="asset-employee"
            className={inputClass}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            {employeeDirectory.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Issuing…" : "Issue asset"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
