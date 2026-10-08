// Onboarding > Trainings: every training assigned across the company, read-only. Partners assign
// and track their team's trainings in their own workspace.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { fetchAllTrainingRecords } from "@/lib/api";
import type { TrainingRecord, TrainingStatus } from "@/lib/types";
import { LoadError, Pill } from "../corehr/ui";
import { Choice, SearchBox, SimpleTable, Toolbar, type Col } from "../timekeeping/common";

const TONE: Record<TrainingStatus, "neutral" | "warn" | "good"> = { "Not started": "neutral", "In progress": "warn", Completed: "good" };

export function TrainingsPage() {
  const query = useQuery({ queryKey: ["admin", "trainings"], queryFn: fetchAllTrainingRecords });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data ?? [])
      .filter((t) => (status === "all" || t.status === status) && (!q || `${t.employeeName} ${t.course}`.toLowerCase().includes(q)))
      .sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate));
  }, [query.data, search, status]);
  if (query.isError) return <LoadError onRetry={() => query.refetch()} />;
  const done = (query.data ?? []).filter((t) => t.status === "Completed").length;
  const cols: Col<TrainingRecord>[] = [
    { header: "Employee", cell: (t) => <span className="font-medium">{t.employeeName}</span> },
    { header: "Training", cell: (t) => t.course },
    { header: "Due", cell: (t) => t.dueDate },
    { header: "Status", cell: (t) => <Pill tone={TONE[t.status]}>{t.status}</Pill> },
  ];
  return (
    <>
      <ContentHead title="Trainings" subtitle={query.data ? `${done} of ${query.data.length} trainings completed.` : "Trainings assigned across the company."} />
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search employee or training" />
        <Choice label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, ...(["Not started", "In progress", "Completed"] as const).map((s) => ({ value: s, label: s }))]} />
      </Toolbar>
      <SimpleTable rows={rows} rowKey={(t) => t.id} cols={cols} loading={query.isLoading} empty="No trainings match." />
    </>
  );
}
