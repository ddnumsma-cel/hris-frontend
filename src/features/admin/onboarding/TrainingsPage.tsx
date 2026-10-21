// Onboarding > Trainings: every training assigned across the company, read-only, as a timeline by
// due date (overdue first) beside the company completion ring. Partners assign and track their
// team's trainings in their own workspace.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Skeleton } from "@/components/ui/Skeleton";
import { fetchAllTrainingRecords } from "@/lib/api";
import type { TrainingRecord, TrainingStatus } from "@/lib/types";
import { Initials, LoadError, Pill } from "../corehr/ui";
import { Choice, SearchBox, Toolbar } from "../timekeeping/common";

const TONE: Record<TrainingStatus, "neutral" | "warn" | "good"> = { "Not started": "neutral", "In progress": "warn", Completed: "good" };
const STATUSES = ["Not started", "In progress", "Completed"] as const;
const DOT: Record<TrainingStatus, string> = { "Not started": "bg-ink-3", "In progress": "bg-warning", Completed: "bg-good" };

const dayMs = 86_400_000;
const startOfToday = () => new Date(new Date().toDateString()).getTime();
const isOverdue = (t: TrainingRecord) => t.status !== "Completed" && Date.parse(t.dueDate) < startOfToday();
const daysLeft = (t: TrainingRecord) => Math.round((Date.parse(t.dueDate) - startOfToday()) / dayMs);
const dueText = (t: TrainingRecord) => {
  if (t.status === "Completed") return `Due ${t.dueDate}`;
  const d = daysLeft(t);
  return d < 0 ? `${-d} ${d === -1 ? "day" : "days"} overdue` : d === 0 ? "Due today" : `Due in ${d} ${d === 1 ? "day" : "days"}`;
};

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={clsx("rounded-[var(--radius-card)] border border-[var(--card-border)] bg-surface", className)}>{children}</section>;
}

function Ring({ pct }: { pct: number }) {
  return (
    <span className="relative flex h-20 w-20 flex-none items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--color-good) ${pct * 3.6}deg, var(--color-surface-2) 0deg)` }}>
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-raised)] font-display text-lg font-semibold">{pct}%</span>
    </span>
  );
}

function TimelineView({ rows, all }: { rows: TrainingRecord[]; all: TrainingRecord[] }) {
  const done = all.filter((t) => t.status === "Completed").length;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  const overdue = rows.filter(isOverdue);
  const rest = rows.filter((t) => !isOverdue(t));
  const groups = [
    ...(overdue.length ? [{ key: "overdue", title: "Overdue", items: overdue }] : []),
    ...[...new Set(rest.map((t) => t.dueDate))].map((d) => ({ key: d, title: `Due ${d}`, items: rest.filter((t) => t.dueDate === d) })),
  ];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Card className="flex flex-col items-center gap-3 p-5 text-center">
        <Ring pct={pct} />
        <div>
          <div className="text-sm font-semibold">Company completion</div>
          <div className="text-xs text-ink-2">
            {done} of {all.length} trainings done
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 border-t border-[var(--line)] pt-3 text-xs">
          {STATUSES.map((s) => (
            <div key={s} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-ink-2">
                <span className={clsx("h-2 w-2 rounded-full", DOT[s])} />
                {s}
              </span>
              <span className="font-semibold">{all.filter((t) => t.status === s).length}</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.key}>
            <h2 className={clsx("mb-3 flex items-center gap-2 text-sm font-semibold", g.key === "overdue" && "text-critical")}>
              <span className={clsx("h-2.5 w-2.5 rounded-full", g.key === "overdue" ? "bg-critical" : "bg-brand")} />
              {g.title}
              <span className="text-xs font-normal text-ink-3">{g.items.length}</span>
            </h2>
            <ol className="flex flex-col gap-2 border-l-2 border-[var(--line-strong)] pl-5">
              {g.items.map((t) => (
                <li key={t.id}>
                  <Card className="flex items-center gap-3 px-4 py-3">
                    <Initials initials={t.employeeInitials} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{t.employeeName}</span>
                      <span className="block truncate text-xs text-ink-2">{t.course}</span>
                    </span>
                    <span className="hidden text-xs text-ink-2 sm:block">{dueText(t)}</span>
                    <Pill tone={TONE[t.status]}>{t.status}</Pill>
                  </Card>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

export function TrainingsPage() {
  const query = useQuery({ queryKey: ["admin", "trainings"], queryFn: fetchAllTrainingRecords });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const all = query.data ?? [];
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data ?? [])
      .filter((t) => (status === "all" || t.status === status) && (!q || `${t.employeeName} ${t.course}`.toLowerCase().includes(q)))
      .sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate));
  }, [query.data, search, status]);
  if (query.isError) return <LoadError onRetry={() => query.refetch()} />;
  const done = all.filter((t) => t.status === "Completed").length;

  return (
    <>
      <ContentHead title="Trainings" subtitle={query.data ? `${done} of ${query.data.length} trainings completed` : undefined} />
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search employee or training" />
        <Choice label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, ...STATUSES.map((s) => ({ value: s, label: s }))]} />
      </Toolbar>
      {query.isLoading ? (
        <Skeleton className="h-72" />
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-2">No trainings match.</Card>
      ) : (
        <TimelineView rows={rows} all={all} />
      )}
    </>
  );
}
