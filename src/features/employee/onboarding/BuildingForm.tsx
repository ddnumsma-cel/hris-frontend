import { useEffect, useState } from "react";
import clsx from "clsx";
import { CheckIcon } from "@/components/icons";

const TOTAL_MS = 1500;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The short "building your form" moment after the choice modal. Each line is something real
 * that changed because of their answers. About 1.5 s, skippable, and static under reduced motion.
 */
export function BuildingForm({ lines, onDone }: { lines: string[]; onDone: () => void }) {
  const reduced = prefersReducedMotion();
  const [done, setDone] = useState(reduced ? lines.length : 0);

  useEffect(() => {
    if (reduced) {
      const t = window.setTimeout(onDone, 600);
      return () => window.clearTimeout(t);
    }
    const step = TOTAL_MS / lines.length;
    const timers = lines.map((_, i) => window.setTimeout(() => setDone(i + 1), step * (i + 1)));
    const finish = window.setTimeout(onDone, TOTAL_MS + 300);
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(finish);
    };
    // Runs once per building screen; lines are fixed while it's showing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finished = done >= lines.length;
  const pct = Math.round((done / lines.length) * 100);

  return (
    <div className="mx-auto w-full max-w-lg py-6 sm:py-10">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">{finished ? "Your form is ready" : "Building your form…"}</h2>
        <p className="mt-1 text-sm text-ink-2">Only the sections that apply to you.</p>

        <div
          className="mt-5 h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Building your form"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </div>

        <ul className="mt-5 flex flex-col gap-2.5">
          {lines.map((line, i) => {
            const state = i < done ? "done" : i === done ? "active" : "waiting";
            return (
              <li key={line} className={clsx("flex items-center gap-2.5 text-sm transition-colors", state === "waiting" ? "text-ink-3" : "text-ink")}>
                <span
                  className={clsx(
                    "flex h-5 w-5 flex-none items-center justify-center rounded-full border transition-colors",
                    state === "done" ? "border-good bg-good text-white" : state === "active" ? "border-brand" : "border-border",
                  )}
                  aria-hidden="true"
                >
                  {state === "done" && <CheckIcon className="h-3 w-3" strokeWidth={3} />}
                  {state === "active" && <span className="h-2 w-2 rounded-full bg-brand motion-safe:animate-pulse" />}
                </span>
                {line}
              </li>
            );
          })}
        </ul>

        <p className="sr-only" aria-live="polite">
          {finished ? "Your form is ready" : ""}
        </p>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onDone} className="rounded-full px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
            {finished ? "Continue" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}
