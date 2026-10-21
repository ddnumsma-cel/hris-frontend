import type { ReactNode } from "react";
import clsx from "clsx";

/** Plain status word with a small colored dot: quieter than a filled pill. */
export function StatusText({ tone, children }: { tone: "good" | "warn" | "crit" | "neutral" | "info"; children: ReactNode }) {
  const dot = { good: "bg-good", warn: "bg-warning", crit: "bg-critical", neutral: "bg-ink-3", info: "bg-cat-1" }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-ink-2">
      <span aria-hidden="true" className={clsx("h-1.5 w-1.5 flex-none rounded-full", dot)} />
      {children}
    </span>
  );
}
