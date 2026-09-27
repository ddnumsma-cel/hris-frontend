import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastContext";
import { UserPlusIcon } from "@/components/icons";
import { confirmBenefitEnrollment, fetchEmployeeBenefits, removeEmployeeBenefit } from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { BenefitStatus, EmployeeBenefit } from "@/lib/types";
import { AddBenefitDialog } from "./AddBenefitDialog";

const statusVariant: Record<BenefitStatus, ChipVariant> = {
  Active: "good",
  Pending: "warn",
  "Not enrolled": "neutral",
};

export function EmployeeBenefitsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [removingBenefit, setRemovingBenefit] = useState<EmployeeBenefit | null>(null);
  const benefitsQuery = useQuery({ queryKey: ["employee", "benefits"], queryFn: fetchEmployeeBenefits });

  const confirmMutation = useMutation({
    mutationFn: confirmBenefitEnrollment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee", "benefits"] }),
  });

  const removeMutation = useMutation({
    mutationFn: removeEmployeeBenefit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "benefits"] });
      toast.show("Benefit removed.");
      setRemovingBenefit(null);
    },
  });

  return (
    <>
      <ContentHead
        title="HMO & Benefits"
        subtitle={formatToday()}
        actions={
          <Button icon={<UserPlusIcon className="h-3.75 w-3.75" />} onClick={() => setAddOpen(true)}>
            Add benefit / dependent
          </Button>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {["Benefit", "Provider", "Member ID", "Status", ""].map((h) => (
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
              {benefitsQuery.data?.map((b) => (
                <tr key={b.id}>
                  <td className="border-b border-border px-4 py-2.5 font-semibold">{b.name}</td>
                  <td className="border-b border-border px-4 py-2.5">{b.provider}</td>
                  <td className="border-b border-border px-4 py-2.5">{b.memberId}</td>
                  <td className="border-b border-border px-4 py-2.5">
                    <Chip variant={statusVariant[b.status]}>{b.status}</Chip>
                  </td>
                  <td className="border-b border-border px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {b.status === "Pending" && (
                        <button
                          type="button"
                          disabled={confirmMutation.isPending}
                          onClick={() => confirmMutation.mutate(b.id)}
                          className="text-xs font-bold text-brand-ink disabled:opacity-50"
                        >
                          Confirm enrollment
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setRemovingBenefit(b)}
                        className="text-xs font-bold text-critical"
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

      <AddBenefitDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmitted={() => toast.show("Benefit submitted — pending confirmation.")}
      />

      <ConfirmDialog
        open={removingBenefit !== null}
        title="Remove benefit"
        message={`Remove "${removingBenefit?.name}"? This can't be undone.`}
        isPending={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate(removingBenefit!.id)}
        onClose={() => setRemovingBenefit(null)}
      />
    </>
  );
}
