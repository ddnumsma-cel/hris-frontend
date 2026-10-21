import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { CheckIcon, GraduationCapIcon } from "@/components/icons";
import { fetchMyTrainingRecords, updateMyTrainingStatus } from "@/lib/api";
import type { TrainingRecord } from "@/lib/types";

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

/** "Thu, Oct 15". */
const shortDay = (due: string) => {
  const d = new Date(due);
  return Number.isNaN(d.getTime()) ? due : d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
};

/** The employee's assigned trainings as a checklist, soonest due first: tick one off when it's done. */
export function EmployeeTrainings() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const trainingsQuery = useQuery({ queryKey: ["employee", "trainings"], queryFn: fetchMyTrainingRecords });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "In progress" | "Completed" }) => updateMyTrainingStatus(id, status),
    onSuccess: (_r, v) => {
      queryClient.invalidateQueries({ queryKey: ["employee", "trainings"] });
      queryClient.invalidateQueries({ queryKey: ["employee", "my-trainings"] });
      toast.show(v.status === "Completed" ? "Marked as completed." : "Marked as in progress.");
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't save that.", "critical"),
  });
  const busy = mutation.isPending;

  const rows = [...(trainingsQuery.data ?? [])].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const done = rows.filter((t) => t.status === "Completed").length;

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
        <section className={clsx(panel, "overflow-hidden")}>
          <header className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-4">
            <h2 className="text-sm font-semibold">Your training checklist</h2>
            <span className="text-xs text-ink-2">
              {done} of {rows.length} done
            </span>
          </header>
          <ul>
            {rows.map((t) => {
              const isDone = t.status === "Completed";
              const note = dueNote(t);
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-4 border-t border-[var(--line)] px-5 py-4 first:border-t-0">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isDone}
                    aria-label={isDone ? `${t.course} is completed` : `Mark ${t.course} completed`}
                    disabled={isDone || busy}
                    onClick={() => mutation.mutate({ id: t.id, status: "Completed" })}
                    className={clsx(
                      "flex h-6 w-6 flex-none items-center justify-center rounded-[var(--radius-logo)] border-2 transition-colors",
                      isDone ? "border-transparent bg-good text-[var(--on-accent)]" : "border-[var(--line-strong)] hover:border-[var(--accent)]",
                    )}
                  >
                    {isDone && <CheckIcon className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1 basis-48">
                    <div className={clsx("text-[15px] font-semibold", isDone && "text-ink-3 line-through")}>{t.course}</div>
                    <div className={clsx("text-xs", note.className)}>
                      Due {shortDay(t.dueDate)} · {note.text}
                    </div>
                  </div>
                  {t.status === "In progress" && <Chip variant="warn">In progress</Chip>}
                  {t.status === "Not started" && (
                    <Button loading={mutation.isPending} succeeded={mutation.isSuccess} size="sm" variant="ghost" disabled={busy || mutation.isPending} onClick={() => mutation.mutate({ id: t.id, status: "In progress" })}>
                      Start
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
