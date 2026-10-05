import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { CheckIcon, XIcon } from "@/components/icons";
import type { Tone } from "./format";

/** Label above a control, with a hint or an error below it. */
export function Field({
  id,
  label,
  required,
  hint,
  error,
  className,
  badge,
  children,
}: {
  id: string;
  label: string;
  badge?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={clsx("min-w-0", className)}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-ink-2">
        {label}
        {required && (
          <span className="ml-0.5 text-critical" aria-hidden="true">
            *
          </span>
        )}
        {badge}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-critical">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>
      )}
    </div>
  );
}

const toneClass: Record<Tone, string> = {
  good: "bg-good-tint text-good",
  warn: "bg-warning-tint text-warning",
  crit: "bg-critical-tint text-critical",
  info: "bg-[color-mix(in_srgb,var(--color-cat-1)_14%,transparent)] text-cat-1",
  neutral: "bg-surface-2 text-ink-2",
};

/** Small status pill with a leading dot. */
export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap", toneClass[tone], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export function Initials({ initials, size = "md" }: { initials: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "flex flex-none items-center justify-center rounded-full bg-brand-tint font-semibold text-brand-ink",
        size === "sm" && "h-7 w-7 text-[0.65rem]",
        size === "md" && "h-9 w-9 text-xs",
        size === "lg" && "h-16 w-16 text-lg",
      )}
    >
      {initials}
    </span>
  );
}

/** A filter toggle that reads as a chip. */
export function FilterChip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
        active ? "border-ink bg-ink text-surface" : "border-border bg-surface text-ink-2 hover:border-ink-3 hover:text-ink",
      )}
    >
      {children}
      {count !== undefined && <span className={clsx("font-num rounded-full px-1.5 text-[0.65rem]", active ? "bg-surface/20" : "bg-surface-2")}>{count}</span>}
    </button>
  );
}

/** Right-hand sheet for details and edits that keep the page in view. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Callers pass inline handlers; keep the latest without re-running the focus effect.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  // Drawn on <body> so a transformed or clipped parent can't trap it.
  return createPortal(
    <div className="overlay-enter fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="drawer-enter flex h-full w-full max-w-lg flex-col border-l border-border bg-surface shadow-xl outline-none"
      >
        <div className="flex flex-none items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold tracking-[-0.01em]">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-ink-2">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-none justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg bg-critical-tint px-3 py-2 text-sm text-critical">
      {(error as Error).message}
    </p>
  );
}

/** Small label above its value, so several facts fit on one row. */
export function Detail({ label, children, wide }: { label: string; children?: ReactNode; wide?: boolean }) {
  const empty = children === undefined || children === null || children === "";
  return (
    <div className={clsx("min-w-0 py-1.5", wide && "col-span-2")}>
      <dt className="text-[0.7rem] leading-4 text-ink-3">{label}</dt>
      <dd className={clsx("mt-0.5 text-sm leading-5 break-words", empty ? "text-ink-3" : "text-ink")} title={empty ? "Not provided" : undefined}>
        {empty ? "—" : children}
      </dd>
    </div>
  );
}

/** Grid for Detail items: 2 across on phones, up to 4 on wide screens. */
export const detailGrid = "grid grid-cols-2 gap-x-6 sm:grid-cols-3 xl:grid-cols-4";

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center">
      <p className="text-sm font-semibold">Couldn't load this.</p>
      <button type="button" onClick={onRetry} className="mt-2 text-sm font-medium text-brand-ink underline underline-offset-2">
        Try again
      </button>
    </div>
  );
}

/** Progress across a multi-step form: dots joined by a dotted line, labels underneath.
 * Any step already reached can be revisited; new steps open once the current one is valid. */
export function Stepper({ steps, current, furthest = current, onSelect }: { steps: string[]; current: number; furthest?: number; onSelect: (i: number) => void }) {
  return (
    <nav aria-label="Progress">
      <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((label, i) => {
          const active = i === current;
          // Any step already reached can be jumped to, forwards or back.
          const reachable = !active && i <= furthest;
          const done = reachable && i < furthest;
          const go = () => reachable && onSelect(i);
          return (
            <li key={label} className="min-w-0">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={go}
                  disabled={!reachable}
                  aria-current={active ? "step" : undefined}
                  aria-label={`Step ${i + 1}: ${label}${done ? " (done)" : ""}`}
                  className={clsx(
                    "flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 transition-[background-color,border-color,transform] enabled:hover:scale-110",
                    active && "step-pop border-ink bg-surface",
                    done && "border-ink bg-ink text-surface",
                    reachable && !done && "border-ink bg-surface",
                    !active && !reachable && "border-border bg-surface",
                  )}
                >
                  {active && <span className="h-2 w-2 rounded-full bg-ink" />}
                  {done && <CheckIcon className="h-3 w-3" />}
                </button>
                {i < steps.length - 1 && (
                  <span aria-hidden="true" className="relative mx-2 h-0.5 flex-1">
                    <span className="absolute inset-0 border-t-2 border-dotted border-border" />
                    <span className={clsx("step-line absolute inset-0 origin-left border-t-2 border-dotted border-ink/70", i + 1 <= furthest ? "scale-x-100" : "scale-x-0")} />
                  </span>
                )}
              </div>
              <button
                type="button"
                tabIndex={-1}
                onClick={go}
                disabled={!reachable}
                className={clsx(
                  "mt-2.5 block max-w-full truncate pr-2 text-left text-[0.82rem] enabled:hover:text-ink enabled:hover:underline enabled:hover:underline-offset-4",
                  active ? "font-semibold text-ink" : reachable ? "text-ink-2" : "text-ink-3",
                  !active && "hidden sm:block",
                )}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
