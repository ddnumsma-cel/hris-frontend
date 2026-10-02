import type { ReactNode } from "react";
import clsx from "clsx";

export const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand aria-[invalid=true]:border-critical disabled:bg-surface-2 disabled:text-ink-3";

/** Label, control and an optional hint or error under it. */
export function Field({ id, label, required, hint, error, children, className }: { id: string; label: string; required?: boolean; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[0.82rem] font-semibold text-ink-2">
        {label}
        {required && <span className="ml-0.5 text-critical" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-critical">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-ink-3">{hint}</p>
      )}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "crit" | "brand"; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap",
        tone === "neutral" && "bg-surface-2 text-ink-2",
        tone === "good" && "bg-good-tint text-good",
        tone === "warn" && "bg-warning-tint text-warning",
        tone === "crit" && "bg-critical-tint text-critical",
        tone === "brand" && "bg-brand-tint text-brand-ink",
      )}
    >
      {children}
    </span>
  );
}

/** Small label/value pair for detail panels. */
export function Detail({ label, children }: { label: string; children?: ReactNode }) {
  const empty = children === undefined || children === null || children === "";
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-1.5 text-sm">
      <dt className="text-ink-2">{label}</dt>
      <dd className={empty ? "text-ink-3" : "font-medium break-words"}>{empty ? "—" : children}</dd>
    </div>
  );
}
