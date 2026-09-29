import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { GraduationCapIcon } from "@/components/icons";
import { fetchMyTrainingRecords, updateTrainingStatus } from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { TrainingStatus } from "@/lib/types";

const statusVariant: Record<TrainingStatus, ChipVariant> = {
  "Not started": "neutral",
  "In progress": "warn",
  Completed: "good",
};

export function EmployeeTrainings() {
  const queryClient = useQueryClient();
  const trainingsQuery = useQuery({ queryKey: ["employee", "trainings"], queryFn: fetchMyTrainingRecords });

  const mutation = useMutation({
    mutationFn: (id: string) => updateTrainingStatus(id, "Completed"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee", "trainings"] }),
  });

  return (
    <>
      <ContentHead title="Trainings" subtitle={formatToday()} />

      <Card>
        <CardHeader title="My trainings" meta="Compliance & upskilling" />
        <CardBody className="flex flex-col gap-3">
          {trainingsQuery.data?.length === 0 && (
            <EmptyState icon={<GraduationCapIcon />} title="No trainings assigned right now" />
          )}
          {trainingsQuery.data?.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2.5">
              <div>
                <div className="text-[0.85rem] font-semibold">{t.course}</div>
                <div className="text-xs text-ink-2">Due {t.dueDate}</div>
              </div>
              <div className="flex items-center gap-2.5">
                <Chip variant={statusVariant[t.status]}>{t.status}</Chip>
                {t.status !== "Completed" && (
                  <button
                    type="button"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate(t.id)}
                    className="text-xs font-semibold text-brand-ink disabled:opacity-50"
                  >
                    Mark completed
                  </button>
                )}
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
