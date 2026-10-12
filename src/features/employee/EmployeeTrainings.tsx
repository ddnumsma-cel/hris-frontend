import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { GraduationCapIcon } from "@/components/icons";
import { fetchMyTrainingRecords, updateTrainingStatus } from "@/lib/api";
import type { TrainingRecord, TrainingStatus } from "@/lib/types";

const statusVariant: Record<TrainingStatus, ChipVariant> = {
  "Not started": "neutral",
  "In progress": "warn",
  Completed: "good",
};

const panel = "rounded-[var(--radius-card)] border border-[var(--card-border)] bg-surface";

/** Whole days from today to the due date (negative = overdue). */
function daysLeft(due: string) {
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

/** "3 days left", "Due today", "2 days overdue" or "Done", with its color. */
function dueNote(t: TrainingRecord): { text: string; className: string } {
  if (t.status === "Completed") return { text: "Done", className: "text-good" };
  const n = daysLeft(t.dueDate);
  if (n === null) return { text: `Due ${t.dueDate}`, className: "text-ink-2" };
  if (n < 0) return { text: `${-n} ${n === -1 ? "day" : "days"} overdue`, className: "text-critical" };
  return { text: n === 0 ? "Due today" : `${n} ${n === 1 ? "day" : "days"} left`, className: n <= 7 ? "text-warning" : "text-ink-2" };
}

/** The employee's assigned trainings, soonest due first, each with its due date as a calendar tile. */
export function EmployeeTrainings() {
  const queryClient = useQueryClient();
  const trainingsQuery = useQuery({ queryKey: ["employee", "trainings"], queryFn: fetchMyTrainingRecords });

  const mutation = useMutation({
    mutationFn: (id: string) => updateTrainingStatus(id, "Completed"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee", "trainings"] }),
  });

  const rows = [...(trainingsQuery.data ?? [])].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <>
      <ContentHead title="Trainings" />

      {trainingsQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <div className={panel}>
          <EmptyState icon={<GraduationCapIcon />} title="No trainings assigned right now" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((t) => {
            const d = new Date(t.dueDate);
            const valid = !Number.isNaN(d.getTime());
            const note = dueNote(t);
            return (
              <section key={t.id} className={clsx(panel, "flex flex-wrap items-center gap-x-5 gap-y-3 p-4")}>
                <div className="flex w-16 flex-none flex-col items-center rounded-[var(--radius-control)] bg-surface-2 py-2">
                  <span className="text-[11px] font-semibold tracking-[0.1em] text-brand-ink uppercase">{valid ? d.toLocaleDateString("en-PH", { month: "short" }) : "Due"}</span>
                  <span className="text-2xl leading-tight font-semibold">{valid ? d.getDate() : "—"}</span>
                </div>
                <div className="min-w-0 flex-1 basis-48">
                  <div className="text-[15px] font-semibold">{t.course}</div>
                  <div className={clsx("text-xs", note.className)}>{note.text}</div>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <Chip variant={statusVariant[t.status]}>{t.status}</Chip>
                  {t.status !== "Completed" && (
                    <Button size="sm" variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate(t.id)}>
                      Mark completed
                    </Button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
