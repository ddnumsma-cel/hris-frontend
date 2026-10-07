import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { fetchJobRequisitions } from "@/lib/api";
import type { RequisitionStage } from "@/lib/types";

const stageVariant: Record<RequisitionStage, ChipVariant> = {
  Sourcing: "neutral",
  Interviewing: "warn",
  "Offer extended": "good",
};

export function RecruitmentPipeline() {
  const requisitionsQuery = useQuery({ queryKey: ["admin", "job-requisitions"], queryFn: fetchJobRequisitions });
  const totalOpenings = requisitionsQuery.data?.reduce((sum, r) => sum + r.openings, 0) ?? 0;

  return (
    <Card>
      <CardHeader
        title="Recruitment pipeline"
        meta={
          requisitionsQuery.data
            ? `${totalOpenings} openings across ${requisitionsQuery.data.length} roles`
            : undefined
        }
      />
      <ul className="flex flex-col px-4 pb-2">
        {requisitionsQuery.isLoading &&
          Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-24" />
            </li>
          ))}
        {requisitionsQuery.data?.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3 last:border-b-0">
            {/* Phones: the role gets its own line; numbers and stage sit underneath. */}
            <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
              <div className="truncate text-sm font-semibold">{r.title}</div>
              <div className="truncate text-xs text-ink-2">{r.department}</div>
            </div>
            <div className="w-16 flex-none text-right">
              <div className="font-num text-sm font-semibold">{r.openings}</div>
              <div className="text-xs text-ink-2">Openings</div>
            </div>
            <div className="w-18 flex-none text-right">
              <div className="font-num text-sm font-semibold">{r.applicants}</div>
              <div className="text-xs text-ink-2">Applicants</div>
            </div>
            <div className="ml-auto flex w-28 flex-none justify-end">
              <Chip variant={stageVariant[r.stage]}>{r.stage}</Chip>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
