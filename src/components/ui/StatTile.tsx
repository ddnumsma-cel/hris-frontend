import type { ReactNode } from "react";
import clsx from "clsx";

type DeltaTone = "good" | "warn" | "crit" | "neutral";

const toneClasses: Record<DeltaTone, string> = {
  good: "text-good",
  warn: "text-warning",
  crit: "text-critical",
  neutral: "text-ink-2",
};

export function StatTile({
  label,
  value,
  delta,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  tone?: DeltaTone;
  icon?: ReactNode;
}) {
  return (
    <div data-slot="stat" className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3 shadow-sm sm:gap-1.5 sm:p-4">
      <span data-slot="stat-label" className="text-[0.7rem] font-semibold text-ink-2 sm:text-xs">{label}</span>
      <span data-slot="stat-value" className="font-display font-num text-lg font-semibold sm:text-2xl">{value}</span>
      {delta && (
        <span data-slot="stat-delta" className={clsx("flex items-center gap-1 text-[0.7rem] font-semibold sm:text-xs", toneClasses[tone])}>
          {icon}
          {delta}
        </span>
      )}
    </div>
  );
}
