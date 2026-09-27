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
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <span className="text-xs font-semibold text-ink-2">{label}</span>
      <span className="font-display font-num text-2xl font-bold">{value}</span>
      {delta && (
        <span className={clsx("flex items-center gap-1 text-xs font-semibold", toneClasses[tone])}>
          {icon}
          {delta}
        </span>
      )}
    </div>
  );
}
