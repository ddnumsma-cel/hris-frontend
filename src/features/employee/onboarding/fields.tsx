import type { ReactNode } from "react";
import clsx from "clsx";

export const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand aria-[invalid=true]:border-critical";

/** Field label. Required fields get a red asterisk; auto-filled ones the "From ID · check this" tag. */
export function Label({
  htmlFor,
  children,
  required,
  fromId,
}: {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
  fromId?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[0.82rem] font-semibold text-ink-2">
      <span>
        {children}
        {required && (
          <span className="ml-0.5 text-critical" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </span>
      {fromId && (
        <span className="rounded-full bg-brand-tint px-2 py-px text-[0.68rem] font-semibold text-brand-ink">From ID · check this</span>
      )}
    </label>
  );
}

/** Neutral note on a field group. */
export function GroupBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[0.7rem] font-semibold text-ink-2">{children}</span>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-critical">
      {message}
    </p>
  );
}

export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-xs text-ink-3">
      {children}
    </p>
  );
}

/** Groups related fields under a small heading inside a step. */
export function FieldGroup({
  title,
  description,
  badge,
  children,
  className,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={clsx("flex flex-col gap-4", className)}>
      <legend className="mb-3 w-full border-b border-border pb-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[0.9rem] font-semibold">{title}</span>
          {badge && <GroupBadge>{badge}</GroupBadge>}
        </span>
        {description && <span className="mt-0.5 block text-xs font-normal text-ink-2">{description}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

/** Every step opens with the same title + one-line purpose. */
/** Every step opens with the same title, one-line purpose, and (when it has required fields) the legend. */
export function StepHeading({ title, description, legend = true }: { title: string; description: string; legend?: boolean }) {
  return (
    <div className="mb-6 border-b border-border pb-4">
      <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">{title}</h2>
      <p className="mt-1 text-sm text-ink-2">{description}</p>
      {legend && (
        <p className="mt-2 text-xs text-ink-2">
          <span className="text-critical" aria-hidden="true">
            *
          </span>{" "}
          Required to create the record
        </p>
      )}
    </div>
  );
}
