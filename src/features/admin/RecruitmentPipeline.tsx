import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
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
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[0.82rem]">
          <thead>
            <tr>
              {["Role", "Department", "Openings", "Applicants", "Stage"].map((h) => (
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
            {requisitionsQuery.data?.map((r) => (
              <tr key={r.id}>
                <td className="border-b border-border px-4 py-2.5 font-semibold">{r.title}</td>
                <td className="border-b border-border px-4 py-2.5">{r.department}</td>
                <td className="font-num border-b border-border px-4 py-2.5">{r.openings}</td>
                <td className="font-num border-b border-border px-4 py-2.5">{r.applicants}</td>
                <td className="border-b border-border px-4 py-2.5">
                  <Chip variant={stageVariant[r.stage]}>{r.stage}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
