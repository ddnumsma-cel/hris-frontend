import type { ReactNode } from "react";
import clsx from "clsx";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnimatedNumber } from "./AnimatedNumber";

/*
 * Layout pieces for the overview dashboards. They only arrange and style
 * content handed to them; the palette and card styling come from `.dash` and
 * the per-page `.bento-*` grid templates in index.css.
 */

/** Places a child into a named area of the page's bento grid. */
export function BentoArea({ area, className, children }: { area: string; className?: string; children: ReactNode }) {
  return (
    <div className={clsx("min-w-0", className)} style={{ gridArea: area }}>
      {children}
    </div>
  );
}

/** Large headline card: big number + label on the left, optional legend on the right, content below. */
export function BentoHero({
  title,
  value,
  label,
  legend,
  action,
  children,
}: {
  title: string;
  value: ReactNode;
  label?: ReactNode;
  legend?: { color: string; label: string }[];
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-ink-2">{title}</div>
          <div className="dash-hero-value font-num mt-1">
            {typeof value === "string" || typeof value === "number" ? <AnimatedNumber value={value} /> : value}
          </div>
          {label && <div className="mt-1 text-[13px] text-ink-2">{label}</div>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {action}
          {legend && (
            <div className="flex flex-wrap justify-end gap-3 text-xs text-ink-2">
              {legend.map((item) => (
                <span key={item.label} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 px-5 pb-5 pt-4">{children}</div>
    </Card>
  );
}

/** Vertical stack of KPI tiles that fills its grid area. */
export function KpiStack({ children }: { children: ReactNode }) {
  return <div className="dash-kpi-stack">{children}</div>;
}

/** Icon-above-label action tile; tiles sit in a row that scrolls sideways on small screens. */
export function QuickActionTile({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="dash-tile">
      <span className="dash-tile-icon">{icon}</span>
      <span className="dash-tile-label">{label}</span>
    </button>
  );
}

export function QuickActionRow({ children }: { children: ReactNode }) {
  return <div className="dash-tile-row no-scrollbar">{children}</div>;
}

/** List row: square icon/avatar, title with muted subtitle, right-aligned value with muted status. */
export function ListRow({
  leading,
  title,
  subtitle,
  value,
  status,
  positive,
  trailing,
  footer,
}: {
  leading: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  status?: ReactNode;
  positive?: boolean;
  trailing?: ReactNode;
  /** Extra line under the subtitle, e.g. a status badge in a narrow column. */
  footer?: ReactNode;
}) {
  return (
    <div className={clsx("dash-row", footer && "items-start")}>
      <span className="dash-row-leading">{leading}</span>
      <div className="min-w-0 flex-1">
        <div className={clsx("text-sm font-medium", footer ? "line-clamp-2" : "truncate")}>{title}</div>
        {subtitle && <div className="truncate text-xs text-ink-2">{subtitle}</div>}
        {footer && <div className="mt-1.5">{footer}</div>}
      </div>
      {(value !== undefined || status) && (
        <div className="flex-none text-right">
          {value !== undefined && (
            <div className={clsx("font-num text-sm font-semibold", positive && "text-good")}>{value}</div>
          )}
          {status && <div className="text-xs text-ink-2">{status}</div>}
        </div>
      )}
      {trailing && <div className="flex-none">{trailing}</div>}
    </div>
  );
}

/** Placeholder rows shaped like ListRow while a list is loading. */
export function ListRowSkeletons({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="dash-row">
          <Skeleton className="h-9 w-9 flex-none" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </>
  );
}

/** Thick horizontal progress bar with start/end captions underneath. */
export function ProgressMeter({
  percent,
  start,
  end,
}: {
  percent: number;
  start?: ReactNode;
  end?: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="dash-meter" role="presentation">
        <span style={{ width: `${clamped}%` }} />
      </div>
      {(start || end) && (
        <div className="font-num mt-2 flex justify-between gap-3 text-xs text-ink-2">
          <span>{start}</span>
          <span>{end}</span>
        </div>
      )}
    </div>
  );
}

/** Muted one-line message for a card with nothing to show. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-2 text-[13px] text-ink-2">{children}</p>;
}
