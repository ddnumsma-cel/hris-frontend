import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { confirmBenefitEnrollment, fetchEmployeeBenefits } from "@/lib/api";
import type { BenefitStatus } from "@/lib/types";

const statusVariant: Record<BenefitStatus, ChipVariant> = {
  Active: "good",
  Pending: "warn",
  "Not enrolled": "neutral",
};

export function BenefitsCard() {
  const queryClient = useQueryClient();
  const benefitsQuery = useQuery({ queryKey: ["employee", "benefits"], queryFn: fetchEmployeeBenefits });

  const mutation = useMutation({
    mutationFn: confirmBenefitEnrollment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee", "benefits"] }),
  });

  return (
    <Card>
      <CardHeader title="HMO & government benefits" meta="Member records" />
      <CardBody className="flex flex-col gap-3">
        {benefitsQuery.data?.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-2.5">
            <div>
              <div className="text-[0.85rem] font-semibold">{b.name}</div>
              <div className="text-xs text-ink-2">
                {b.provider} · {b.memberId}
              </div>
            </div>
            {b.status === "Pending" ? (
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(b.id)}
                className="text-xs font-semibold text-brand-ink disabled:opacity-50"
              >
                Confirm enrollment
              </button>
            ) : (
              <Chip variant={statusVariant[b.status]}>{b.status}</Chip>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
