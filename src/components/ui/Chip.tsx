import type { ReactNode } from "react";
import clsx from "clsx";

export type ChipVariant = "good" | "warn" | "crit" | "neutral";

const variantClasses: Record<ChipVariant, string> = {
  good: "bg-good-tint text-good",
  warn: "bg-warning-tint text-warning",
  crit: "bg-critical-tint text-critical",
  neutral: "bg-surface-2 text-ink-2",
};

export function Chip({ variant, children }: { variant: ChipVariant; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        variantClasses[variant],
      )}
    >
      {children}
    </span>
  );
}
