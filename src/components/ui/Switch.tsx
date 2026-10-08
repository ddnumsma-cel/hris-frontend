import clsx from "clsx";

/** An on/off switch: a real button with role="switch" and aria-checked. */
export function Switch({
  checked,
  onChange,
  label,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name when there's no visible <label for={id}>. */
  label?: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-6 w-10 flex-none items-center rounded-[var(--radius-pill)] border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-transparent bg-[image:var(--grad-primary)]" : "border-[var(--line-strong)] bg-[var(--tint)]",
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "absolute top-1/2 h-4.5 w-4.5 -translate-y-1/2 rounded-full shadow-[0_1px_3px_rgba(15,23,42,0.25)] transition-[left] duration-150",
          checked ? "left-[calc(100%-1.25rem)] bg-[var(--on-accent)]" : "left-0.5 bg-[var(--field-bg)]",
        )}
      />
    </button>
  );
}
