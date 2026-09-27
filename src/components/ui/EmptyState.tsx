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
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            backgroundImage:
              "radial-gradient(circle, color-mix(in srgb, var(--color-ink-3) 20%, transparent) 1.5px, transparent 1.5px)",
            backgroundSize: "10px 10px",
            maskImage: "radial-gradient(circle, black 50%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(circle, black 50%, transparent 72%)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            backgroundImage:
              "radial-gradient(circle at 28% 26%, color-mix(in srgb, var(--color-brand) 24%, transparent), transparent 60%)," +
              "radial-gradient(circle at 76% 78%, color-mix(in srgb, var(--color-gold) 20%, transparent), transparent 60%)",
          }}
        />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-ink-3 shadow-sm ring-1 ring-border [&>svg]:h-6 [&>svg]:w-6">
          {icon}
        </span>
      </div>
      <p className="text-sm font-semibold text-ink-2">{title}</p>
      {description && <p className="max-w-xs text-xs text-ink-3">{description}</p>}
    </div>
  );
}
