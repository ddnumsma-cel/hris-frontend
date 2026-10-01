import clsx from "clsx";
import { AlertTriangleIcon, CheckIcon } from "@/components/icons";
import type { StepDef } from "./model";

export interface StepStatus {
  step: StepDef;
  filled: number;
  total: number;
  hasErrors: boolean;
  /** Visited and its required fields pass. */
  complete: boolean;
}

/** Desktop: the step list in the left column. Each step's bar fills as its fields are completed. */
export function StepList({
  statuses,
  current,
  maxVisited,
  onSelect,
}: {
  statuses: StepStatus[];
  current: number;
  maxVisited: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Onboarding steps">
      <ol className="flex flex-col gap-1">
        {statuses.map((s, i) => {
          const isCurrent = i === current;
          const reachable = i <= maxVisited;
          const percent = s.total > 0 ? Math.round((s.filled / s.total) * 100) : s.complete ? 100 : 0;
          return (
            <li key={s.step.id}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(i)}
                aria-current={isCurrent ? "step" : undefined}
                className={clsx(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  isCurrent ? "bg-surface shadow-sm ring-1 ring-border" : reachable ? "hover:bg-surface-2" : "cursor-default opacity-60",
                )}
              >
                <span
                  className={clsx(
                    "mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold",
                    s.hasErrors
                      ? "bg-critical-tint text-critical"
                      : s.complete && !isCurrent
                        ? "bg-good-tint text-good"
                        : isCurrent
                          ? "bg-brand text-white"
                          : "bg-surface-2 text-ink-2",
                  )}
                >
                  {s.hasErrors ? (
                    <AlertTriangleIcon className="h-3.5 w-3.5" aria-label="Needs fixing" />
                  ) : s.complete && !isCurrent ? (
                    <CheckIcon className="h-3.5 w-3.5" aria-label="Done" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={clsx("block text-sm", isCurrent ? "font-semibold text-ink" : "font-medium text-ink-2")}>{s.step.title}</span>
                  <span className="block text-xs text-ink-3">{s.step.summary}</span>
                  {s.total > 0 && reachable && (
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                      <span className="block h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${percent}%` }} />
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Phones: one line with the step name and a progress line. */
export function StepBar({ statuses, current }: { statuses: StepStatus[]; current: number }) {
  const s = statuses[current];
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">
          Step {current + 1} of {statuses.length} · {s.step.title}
        </span>
        {current + 1 < statuses.length && <span className="text-xs text-ink-3">Next: {statuses[current + 1].step.title}</span>}
      </div>
      <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${statuses.length}, 1fr)` }} aria-hidden="true">
        {statuses.map((st, i) => (
          <span
            key={st.step.id}
            className={clsx("h-1 rounded-full", i < current || st.complete ? "bg-brand" : i === current ? "bg-brand/50" : "bg-surface-2")}
          />
        ))}
      </div>
    </div>
  );
}
