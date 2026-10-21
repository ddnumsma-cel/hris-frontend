import { Badge } from './ui/badge';

export function PageHeader({
  title,
  subtitle,
  actions,
  sample = true,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  sample?: boolean;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold sm:text-2xl">
          {title}
          {sample && <Badge tone="warning">Sample data</Badge>}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"
      role="alert"
    >
      <p className="font-medium">Could not load this page.</p>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-medium underline">
          Try again
        </button>
      )}
    </div>
  );
}

/** Segmented filter (e.g. All sites / HQ / Mandaue / Lapu-Lapu). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap rounded-lg border border-border bg-card p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={
            value === o.value
              ? 'rounded-md bg-sidebar px-3 py-1.5 text-sm font-medium text-white dark:bg-accent dark:text-on-accent'
              : 'rounded-md px-3 py-1.5 text-sm text-muted hover:text-fg'
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
