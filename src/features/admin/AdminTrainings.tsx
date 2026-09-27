import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { StatTile } from "@/components/ui/StatTile";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastContext";
import { GraduationCapIcon, SearchIcon, SearchXIcon } from "@/components/icons";
import { AssignTrainingDialog } from "@/components/shared/AssignTrainingDialog";
import { deleteTrainingRecord, fetchAllTrainingRecords } from "@/lib/api";
import { formatToday } from "@/lib/format";
import { employeeDirectory } from "@/lib/mockData";
import type { TrainingRecord, TrainingStatus } from "@/lib/types";

const statusVariant: Record<TrainingStatus, ChipVariant> = {
  "Not started": "neutral",
  "In progress": "warn",
  Completed: "good",
};

export function AdminTrainings() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<TrainingRecord | null>(null);
  const trainingsQuery = useQuery({ queryKey: ["admin", "all-trainings"], queryFn: fetchAllTrainingRecords });
  const records = useMemo(() => trainingsQuery.data ?? [], [trainingsQuery.data]);
  const completed = records.filter((r) => r.status === "Completed").length;
  const completionRate = records.length ? Math.round((completed / records.length) * 100) : 0;
  const courses = new Set(records.map((r) => r.course));

  const deleteMutation = useMutation({
    mutationFn: deleteTrainingRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "all-trainings"] });
      toast.show("Training record removed.");
      setDeletingRecord(null);
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) => r.employeeName.toLowerCase().includes(q) || r.course.toLowerCase().includes(q) || r.status.toLowerCase().includes(q),
    );
  }, [records, search]);

  return (
    <>
      <ContentHead
        title="Training & Development"
        subtitle={formatToday()}
        actions={
          <Button icon={<GraduationCapIcon className="h-3.75 w-3.75" />} onClick={() => setAssignOpen(true)}>
            Assign training
          </Button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <StatTile label="Company-wide completion" value={`${completionRate}%`} tone="good" />
        <StatTile label="Active courses" value={courses.size} />
        <StatTile label="Assignments completed" value={`${completed} / ${records.length}`} />
      </div>

      <Card>
        <CardHeader title="Training records" meta="All employees" />
        <div className="border-b border-border px-4 pb-3.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 sm:max-w-xs">
            <SearchIcon className="h-3.5 w-3.5 text-ink-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee, course, status…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
            />
          </div>
        </div>
        {!trainingsQuery.isLoading && filtered.length === 0 && (
          <EmptyState
            icon={<SearchXIcon />}
            title={`No training records match "${search}"`}
            description="Try a different employee, course or status."
          />
        )}

        {(trainingsQuery.isLoading || filtered.length > 0) && (
          <>
            {/* Mobile: card list */}
            <div className="flex flex-col gap-2.5 p-3.5 sm:hidden">
              {trainingsQuery.isLoading &&
                Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-14 w-full rounded-lg" />)}
              {filtered.map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-3.5">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <MiniAvatar initials={r.employeeInitials} />
                      <div>
                        <div className="text-sm font-bold">{r.employeeName}</div>
                        <div className="text-xs text-ink-2">{r.course}</div>
                      </div>
                    </div>
                    <Chip variant={statusVariant[r.status]}>{r.status}</Chip>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-xs">
                    <span className="text-ink-3">Due {r.dueDate}</span>
                    <button type="button" onClick={() => setDeletingRecord(r)} className="font-semibold text-critical">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[0.82rem]">
                <thead>
                  <tr>
                    {["Employee", "Course", "Due", "Status", ""].map((h) => (
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
                  {trainingsQuery.isLoading && <SkeletonRows columns={5} />}
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="border-b border-border px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <MiniAvatar initials={r.employeeInitials} />
                          {r.employeeName}
                        </div>
                      </td>
                      <td className="border-b border-border px-4 py-2.5">{r.course}</td>
                      <td className="border-b border-border px-4 py-2.5">{r.dueDate}</td>
                      <td className="border-b border-border px-4 py-2.5">
                        <Chip variant={statusVariant[r.status]}>{r.status}</Chip>
                      </td>
                      <td className="border-b border-border px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => setDeletingRecord(r)}
                          className="font-semibold text-critical"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <AssignTrainingDialog
        open={assignOpen}
        employees={employeeDirectory}
        invalidateKey={["admin", "all-trainings"]}
        onClose={() => setAssignOpen(false)}
        onSubmitted={() => toast.show("Training assigned.")}
      />

      <ConfirmDialog
        open={deletingRecord !== null}
        title="Remove training record"
        message={`Remove "${deletingRecord?.course}" for ${deletingRecord?.employeeName}? This can't be undone.`}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingRecord!.id)}
        onClose={() => setDeletingRecord(null)}
      />
    </>
  );
}
