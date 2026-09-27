import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastContext";
import { EditIcon, UserMinusIcon } from "@/components/icons";
import { deleteOffboardingCase, fetchOffboardingCases } from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { OffboardingCase, OffboardingStage } from "@/lib/types";
import { OffboardingCaseDialog } from "./OffboardingCaseDialog";

const stageVariant: Record<OffboardingStage, ChipVariant> = {
  "Resignation filed": "neutral",
  "Clearance in progress": "warn",
  "Final pay released": "good",
};

export function AdminOffboarding() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<OffboardingCase | null>(null);
  const [deletingCase, setDeletingCase] = useState<OffboardingCase | null>(null);
  const casesQuery = useQuery({ queryKey: ["admin", "offboarding"], queryFn: fetchOffboardingCases });

  const deleteMutation = useMutation({
    mutationFn: deleteOffboardingCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "offboarding"] });
      toast.show(`${deletingCase?.employeeName}'s offboarding case was removed.`);
      setDeletingCase(null);
    },
  });

  function openAdd() {
    setEditingCase(null);
    setDialogOpen(true);
  }

  function openEdit(c: OffboardingCase) {
    setEditingCase(c);
    setDialogOpen(true);
  }

  return (
    <>
      <ContentHead
        title="Offboarding"
        subtitle={formatToday()}
        actions={<Button icon={<UserMinusIcon className="h-3.75 w-3.75" />} onClick={openAdd}>Initiate offboarding</Button>}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {["Employee", "Department", "Last day", "Stage", ""].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-4 py-2.5 text-left text-[0.7rem] font-bold uppercase tracking-wider text-ink-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {casesQuery.isLoading && <SkeletonRows columns={5} />}
              {!casesQuery.isLoading && casesQuery.data?.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon={<UserMinusIcon />} title="No employees are currently offboarding" />
                  </td>
                </tr>
              )}
              {casesQuery.data?.map((c) => (
                <tr key={c.id}>
                  <td className="border-b border-border px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <MiniAvatar initials={c.employeeInitials} />
                      {c.employeeName}
                    </div>
                  </td>
                  <td className="border-b border-border px-4 py-2.5">{c.department}</td>
                  <td className="border-b border-border px-4 py-2.5">{c.lastDay}</td>
                  <td className="border-b border-border px-4 py-2.5">
                    <Chip variant={stageVariant[c.stage]}>{c.stage}</Chip>
                  </td>
                  <td className="border-b border-border px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="flex items-center gap-1 font-semibold text-ink-2 hover:text-ink"
                      >
                        <EditIcon className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingCase(c)}
                        className="font-semibold text-critical"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <OffboardingCaseDialog
        open={dialogOpen}
        existing={editingCase}
        onClose={() => setDialogOpen(false)}
        onSubmitted={() => toast.show(editingCase ? "Offboarding case updated." : "Offboarding case initiated.")}
      />

      <ConfirmDialog
        open={deletingCase !== null}
        title="Remove offboarding case"
        message={`Remove ${deletingCase?.employeeName}'s offboarding case? This can't be undone.`}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingCase!.id)}
        onClose={() => setDeletingCase(null)}
      />
    </>
  );
}
