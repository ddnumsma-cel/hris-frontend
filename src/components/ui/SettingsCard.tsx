import type { ReactNode } from "react";
import clsx from "clsx";

/** Title and one-line description at the top of a settings section. */
export function SettingsHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="font-display text-xl font-semibold tracking-[-0.01em]">{title}</h1>
      <p className="text-[13px] text-ink-2">{description}</p>
    </div>
  );
}

/** A card of related settings: an optional heading, then rows separated by hairlines. */
export function SettingsCard({ title, description, children, tone }: { title?: string; description?: string; children: ReactNode; tone?: "danger" }) {
  return (
    <section
      className={clsx(
        "rounded-[var(--radius-card)] border bg-surface",
        tone === "danger" ? "border-[color-mix(in_srgb,var(--danger)_35%,transparent)]" : "border-[var(--card-border)]",
      )}
    >
      {(title || description) && (
        <div className="flex flex-col gap-1 border-b border-[var(--line)] px-5 py-4">
          {title && <h2 className={clsx("text-sm font-semibold", tone === "danger" && "text-critical")}>{title}</h2>}
          {description && <p className="text-[13px] text-ink-2">{description}</p>}
        </div>
      )}
      <div className="divide-y divide-[var(--line)]">{children}</div>
    </section>
  );
}

/**
 * One setting: label and optional help on the left, the control on the right (stacked on
 * phones). `htmlFor` ties the label to the control; `error` shows under the help text.
 */
export function SettingsRow({
  label,
  htmlFor,
  help,
  error,
  children,
  stacked,
}: {
  label: string;
  htmlFor?: string;
  help?: ReactNode;
  error?: string;
  children: ReactNode;
  /** Put the control under the label (for wide controls like tables). */
  stacked?: boolean;
}) {
  const labelEl = htmlFor ? (
    <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
      {label}
    </label>
  ) : (
    <span className="text-[13px] font-medium text-ink">{label}</span>
  );
  return (
    <div className={clsx("flex gap-3 px-5 py-4", stacked ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-8")}>
      <div className="flex min-w-0 flex-col gap-1 sm:max-w-[45%]">
        {labelEl}
        {help && <p className="text-xs text-ink-2">{help}</p>}
        {error && (
          <p role="alert" className="text-xs font-medium text-critical">
            {error}
          </p>
        )}
      </div>
      <div className={clsx("min-w-0", stacked ? "w-full" : "sm:w-72 sm:flex-none sm:text-right [&>*]:sm:ml-auto")}>{children}</div>
    </div>
  );
}
