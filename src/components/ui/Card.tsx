import type { HTMLAttributes, ReactNode, Ref } from "react";
import clsx from "clsx";

export function Card({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string; ref?: Ref<HTMLDivElement> } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="card" className={clsx("rounded-[var(--radius-card)] border border-[var(--card-border)] bg-surface", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div data-slot="card-header" className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-4 py-3.5">
      <h2 className="font-display text-sm font-semibold tracking-[-0.01em]">{title}</h2>
      {action ?? (meta && <span className="text-xs text-ink-2">{meta}</span>)}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div data-slot="card-body" className={clsx("p-4", className)}>{children}</div>;
}
