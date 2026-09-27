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
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3 shadow-sm sm:gap-1.5 sm:p-4">
      <span className="text-[0.7rem] font-semibold text-ink-2 sm:text-xs">{label}</span>
      <span className="font-display font-num text-lg font-bold sm:text-2xl">{value}</span>
      {delta && (
        <span className={clsx("flex items-center gap-1 text-[0.7rem] font-semibold sm:text-xs", toneClasses[tone])}>
          {icon}
          {delta}
        </span>
      )}
    </div>
  );
}
