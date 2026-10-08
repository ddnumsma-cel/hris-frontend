import { useRef, type KeyboardEvent } from "react";
import clsx from "clsx";

/**
 * A row of mutually exclusive options (e.g. Light / Dark / System): a radiogroup whose
 * arrow keys move the choice, like native radio buttons.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  /** Accessible name for the group. */
  label: string;
  size?: "sm" | "md";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = options.findIndex((o) => o.value === value);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (Math.max(index, 0) + step + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="inline-flex rounded-[var(--radius-control)] border border-[var(--line-strong)] bg-[var(--tint)] p-0.5">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (index < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={clsx(
              "rounded-[7px] font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]",
              on ? "bg-[var(--field-bg)] text-ink shadow-[0_1px_3px_rgba(15,23,42,0.12)]" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
