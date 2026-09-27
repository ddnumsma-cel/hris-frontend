import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { updateCompanyAsset, type UpdateAssetInput } from "@/lib/api";
import { employeeDirectory } from "@/lib/mockData";
import type { AssetStatus, CompanyAsset } from "@/lib/types";

const assetTypes = ["Laptop", "Company ID", "Access Card", "Company Phone", "Monitor"];
const assetStatuses: AssetStatus[] = ["Issued", "Returned", "Under repair"];

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

function EditAssetForm({
  asset,
  onClose,
  onSubmitted,
}: {
  asset: CompanyAsset;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState(asset.type);
  const [assetTag, setAssetTag] = useState(asset.assetTag);
  const [employeeId, setEmployeeId] = useState(
    employeeDirectory.find((e) => e.name === asset.assignedToName)?.id ?? employeeDirectory[0]?.id ?? "",
  );
  const [status, setStatus] = useState<AssetStatus>(asset.status);

  const mutation = useMutation({
    mutationFn: (input: UpdateAssetInput) => updateCompanyAsset(asset.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "assets"] });
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
      status,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <div>
        <label htmlFor="edit-asset-type" className={labelClass}>
          Asset type
        </label>
        <select id="edit-asset-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
          {assetTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="edit-asset-tag" className={labelClass}>
          Asset tag
        </label>
        <input
          id="edit-asset-tag"
          required
          className={inputClass}
          value={assetTag}
          onChange={(e) => setAssetTag(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="edit-asset-employee" className={labelClass}>
          Assigned to
        </label>
        <select
          id="edit-asset-employee"
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

      <div>
        <label htmlFor="edit-asset-status" className={labelClass}>
          Status
        </label>
        <select
          id="edit-asset-status"
          className={inputClass}
          value={status}
          onChange={(e) => setStatus(e.target.value as AssetStatus)}
        >
          {assetStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
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

export function EditAssetDialog({
  asset,
  onClose,
  onSubmitted,
}: {
  asset: CompanyAsset | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  return (
    <Dialog open={asset !== null} onClose={onClose} title="Edit asset">
      {asset && <EditAssetForm key={asset.id} asset={asset} onClose={onClose} onSubmitted={onSubmitted} />}
    </Dialog>
  );
}
