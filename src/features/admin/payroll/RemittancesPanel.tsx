import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastContext";
import { EditIcon, PlusIcon, ShieldIcon } from "@/components/icons";
import { deleteComplianceItem, fetchComplianceCalendar, updateComplianceStatus } from "@/lib/api";
import { getEffectiveCompliance } from "@/lib/automation";
import { formatPHP } from "@/lib/format";
import type { ComplianceItem } from "@/lib/types";
import { ComplianceItemDialog } from "../ComplianceItemDialog";
import { COMPLIANCE_KEY } from "./useRemittancesDue";

const statusVariant: Record<ComplianceItem["status"], ChipVariant> = {
  Filed: "good",
  "Due soon": "warn",
  Overdue: "crit",
};

const thClass = "border-b border-border px-4 py-2.5 text-left text-xs font-medium tracking-[0.01em] text-ink-3";
const tdClass = "border-b border-border px-4 py-2.5";

/** SSS, PhilHealth, Pag-IBIG and BIR filings for the payroll team (moved here from the old Compliance page). */
export function RemittancesPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ComplianceItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ComplianceItem | null>(null);
  const complianceQuery = useQuery({ queryKey: COMPLIANCE_KEY, queryFn: fetchComplianceCalendar });

  const fileMutation = useMutation({
    mutationFn: (id: string) => updateComplianceStatus(id, "Filed"),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: COMPLIANCE_KEY });
      toast.show(`${item.agency} ${item.filing.toLowerCase()} marked filed.`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteComplianceItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMPLIANCE_KEY });
      toast.show("Filing removed.");
      setDeletingItem(null);
    },
  });

  const filings = useMemo(
    () => (complianceQuery.data ?? []).map((item) => ({ item, ...getEffectiveCompliance(item) })),
    [complianceQuery.data],
  );

  function openAdd() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEdit(item: ComplianceItem) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="text-xs text-ink-3">Remittance amounts come from the approved payroll run.</p>
        <Button size="sm" icon={<PlusIcon className="h-3.5 w-3.5" />} onClick={openAdd}>
          Add filing
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[0.82rem]">
          <thead>
            <tr>
              <th className={thClass}>Filing</th>
              <th className={thClass}>Agency</th>
              <th className={thClass}>Period</th>
              <th className={`${thClass} text-right`}>Amount</th>
              <th className={thClass}>Due</th>
              <th className={thClass}>Status</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {complianceQuery.isLoading && <SkeletonRows columns={7} />}
            {!complianceQuery.isLoading && filings.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState icon={<ShieldIcon />} title="No filings yet" description="Add the first SSS, PhilHealth, Pag-IBIG or BIR filing." />
                </td>
              </tr>
            )}
            {filings.map(({ item, status, note }) => (
              <tr key={item.id}>
                <td className={tdClass}>
                  <div>{item.filing}</div>
                  {item.referenceNo && <div className="text-xs text-ink-3">Ref. {item.referenceNo}</div>}
                </td>
                <td className={tdClass}>{item.agency}</td>
                <td className={`${tdClass} whitespace-nowrap`}>{item.periodCovered ?? "—"}</td>
                <td className={`${tdClass} font-num whitespace-nowrap text-right`}>
                  {item.amount !== undefined ? formatPHP(item.amount) : "—"}
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>{item.due}</td>
                <td className={tdClass}>
                  <Chip variant={statusVariant[status]}>
                    {status === "Filed" ? "Filed" : (note ?? status)}
                  </Chip>
                </td>
                <td className={tdClass}>
                  <div className="flex items-center justify-end gap-3 whitespace-nowrap text-xs font-semibold">
                    {status !== "Filed" && (
                      <button
                        type="button"
                        disabled={fileMutation.isPending}
                        onClick={() => fileMutation.mutate(item.id)}
                        className="text-brand-ink disabled:opacity-50"
                      >
                        Mark filed
                      </button>
                    )}
                    <button type="button" onClick={() => openEdit(item)} className="flex items-center gap-1 text-ink-2 hover:text-ink">
                      <EditIcon className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button type="button" onClick={() => setDeletingItem(item)} className="text-critical">
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ComplianceItemDialog
        open={dialogOpen}
        existing={editingItem}
        onClose={() => setDialogOpen(false)}
        onSubmitted={() => toast.show(editingItem ? "Filing updated." : "Filing added.")}
      />

      <ConfirmDialog
        open={deletingItem !== null}
        title="Remove filing"
        message={`Remove "${deletingItem?.filing}" (${deletingItem?.agency})? This can't be undone.`}
        confirmLabel="Remove filing"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingItem!.id)}
        onClose={() => setDeletingItem(null)}
      />
    </>
  );
}
