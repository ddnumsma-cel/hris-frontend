import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-ink-3 [&>svg]:h-6 [&>svg]:w-6">
        {icon}
      </span>
      <p className="text-sm font-semibold text-ink-2">{title}</p>
      {description && <p className="max-w-xs text-xs text-ink-3">{description}</p>}
    </div>
  );
}
