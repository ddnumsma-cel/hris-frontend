import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { fetchPerformanceReviewStatuses, fetchTeamRoster, updatePerformanceReviewStatus } from "@/lib/api";
import { formatToday } from "@/lib/format";

const statusVariant: Record<string, ChipVariant> = {
  Submitted: "good",
  Pending: "warn",
};

export function ManagerPerformance() {
  const queryClient = useQueryClient();
  const rosterQuery = useQuery({ queryKey: ["manager", "team-roster"], queryFn: fetchTeamRoster });
  const statusesQuery = useQuery({
    queryKey: ["manager", "performance-review-statuses"],
    queryFn: fetchPerformanceReviewStatuses,
  });
  const roster = rosterQuery.data ?? [];
  const statuses = statusesQuery.data ?? {};

  const toggleMutation = useMutation({
    mutationFn: ({ employeeId, status }: { employeeId: string; status: "Submitted" | "Pending" }) =>
      updatePerformanceReviewStatus(employeeId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["manager", "performance-review-statuses"] }),
  });

  const reviewsCompleted = roster.filter((m) => statuses[m.id] === "Submitted").length;
  const reviewsTotal = roster.length;
  const reviewProgressPercent = reviewsTotal === 0 ? 0 : Math.round((reviewsCompleted / reviewsTotal) * 100);

  return (
    <>
      <ContentHead title="Performance" subtitle={formatToday()} />

      <Card>
        <CardHeader title="Q3 2026 mid-year review" />
        <CardBody>
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-ink-2">Progress</span>
            <span className="font-num font-bold">{reviewProgressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full rounded-full bg-brand transition-[width]"
              style={{ width: `${reviewProgressPercent}%` }}
            />
          </div>
          <p className="mt-2.5 text-xs text-ink-3">
            {reviewsCompleted} of {reviewsTotal} self-assessments and manager reviews submitted. Deadline Oct 15,
            2026.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Review checklist" meta={`${reviewsCompleted} of ${reviewsTotal} submitted`} />
        <CardBody className="flex flex-col gap-3">
          {roster.map((member) => {
            const status = statuses[member.id] ?? "Pending";
            const next = status === "Submitted" ? "Pending" : "Submitted";
            return (
              <div key={member.id} className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <MiniAvatar initials={member.initials} />
                  <div>
                    <div className="text-[0.85rem] font-semibold">{member.name}</div>
                    <div className="text-xs text-ink-2">{member.position}</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate({ employeeId: member.id, status: next })}
                  className="disabled:opacity-60"
                >
                  <Chip variant={statusVariant[status]}>{status}</Chip>
                </button>
              </div>
            );
          })}
        </CardBody>
      </Card>
    </>
  );
}
