import type { ReactNode } from "react";
import clsx from "clsx";
import { Link } from "react-router-dom";
import { ArrowRightIcon, SearchIcon } from "@/components/icons";
import { filterSearchClass } from "./format";

/** List on the left, the selected item on the right, filling the window below the page title.
 * On phones it shows one side at a time: the list, or the detail with a back link. */
export function SplitView({ list, detail, showDetail }: { list: ReactNode; detail: ReactNode; showDetail: boolean }) {
  return (
    <div className="grid h-[calc(100dvh-10.75rem)] min-h-[30rem] overflow-hidden rounded-xl border border-border bg-surface shadow-sm md:grid-cols-[19rem_minmax(0,1fr)] lg:grid-cols-[21rem_minmax(0,1fr)]">
      <div className={clsx("min-h-0 flex-col border-border md:flex md:border-r", showDetail ? "hidden" : "flex")}>{list}</div>
      <div className={clsx("no-scrollbar min-h-0 overflow-y-auto md:block", showDetail ? "block" : "hidden")}>{detail}</div>
    </div>
  );
}

/** Search box plus optional filters, pinned above the list. */
export function ListToolbar({ query, onQuery, placeholder, children }: { query: string; onQuery: (q: string) => void; placeholder: string; children?: ReactNode }) {
  return (
    <div className="flex flex-none flex-col gap-2 border-b border-border p-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
        <input type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={filterSearchClass} />
      </div>
      {children && <div className="flex gap-1.5">{children}</div>}
    </div>
  );
}

export function ListBody({ children, label }: { children: ReactNode; label: string }) {
  return (
    <nav aria-label={label} className="no-scrollbar min-h-0 flex-1 overflow-y-auto py-1">
      {children}
    </nav>
  );
}

export function ListGroup({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="pb-1">
      <p className="flex items-center justify-between gap-2 px-4 pt-3 pb-1 text-xs font-semibold text-ink-2">
        <span className="truncate">{title}</span>
        {meta && <span className="flex-none text-[0.7rem] font-normal text-ink-3">{meta}</span>}
      </p>
      <ul>{children}</ul>
    </div>
  );
}

/** One selectable row: title, a quieter line under it, and something small on the right. */
export function ListRow({
  to,
  onClick,
  active,
  title,
  meta,
  trailing,
  leading,
  muted,
  indent = 0,
}: {
  to?: string;
  onClick?: () => void;
  active: boolean;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  leading?: ReactNode;
  muted?: boolean;
  indent?: number;
}) {
  const body = (
    <>
      <span aria-hidden="true" className={clsx("absolute inset-y-1 left-0 w-0.5 rounded-full transition-colors", active ? "bg-ink" : "bg-transparent")} />
      {leading}
      <span className="min-w-0 flex-1">
        <span className={clsx("block truncate text-[0.84rem]", active ? "font-semibold text-ink" : "font-medium text-ink")}>{title}</span>
        {meta && <span className="block truncate text-[0.72rem] text-ink-3">{meta}</span>}
      </span>
      {trailing && <span className="flex-none text-[0.72rem] text-ink-2">{trailing}</span>}
    </>
  );
  const cls = clsx("relative mx-1.5 flex items-center gap-2.5 rounded-md py-2 pr-3 transition-colors", active ? "bg-surface-2" : "hover:bg-surface-2/60", muted && "opacity-55");
  const style = { paddingLeft: `${0.75 + indent * 1}rem` };
  return (
    <li>
      {to ? (
        <Link to={to} aria-current={active ? "true" : undefined} className={cls} style={style}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} aria-current={active ? "true" : undefined} className={clsx(cls, "w-[calc(100%-0.75rem)] text-left")} style={style}>
          {body}
        </button>
      )}
    </li>
  );
}

export function ListEmpty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-xs text-ink-3">{children}</p>;
}

/** Header of the right-hand pane: title, a line of context, actions, and a back link on phones. */
export function DetailHeader({ title, subtitle, actions, back, leading }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { to?: string; onClick?: () => void; label: string }; leading?: ReactNode }) {
  return (
    <div className="border-b border-border px-5 py-4 sm:px-6">
      {back &&
        (back.to ? (
          <Link to={back.to} className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 hover:text-ink md:hidden">
            <ArrowRightIcon className="h-3.5 w-3.5 rotate-180" />
            {back.label}
          </Link>
        ) : (
          <button type="button" onClick={back.onClick} className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 hover:text-ink md:hidden">
            <ArrowRightIcon className="h-3.5 w-3.5 rotate-180" />
            {back.label}
          </button>
        ))}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        {leading}
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-lg font-semibold tracking-[-0.01em]">{title}</h2>
          {subtitle && <div className="mt-0.5 text-xs text-ink-2">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** A titled block inside the detail pane, separated by a hairline rather than a card. */
export function DetailSection({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("border-b border-border px-5 py-4 last:border-0 sm:px-6", className)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Quiet text button for section actions ("Edit", "Manage"). */
export function TextAction({ onClick, children, to }: { onClick?: () => void; children: ReactNode; to?: string }) {
  const cls = "text-xs font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline";
  return to ? (
    <Link to={to} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/** Placeholder for the right pane before anything is selected. */
export function DetailPlaceholder({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-sm font-semibold text-ink-2">{title}</p>
      {children && <div className="max-w-sm text-xs text-ink-3">{children}</div>}
    </div>
  );
}

/** Plain status word with a small colored dot: quieter than a filled pill. */
export function StatusText({ tone, children }: { tone: "good" | "warn" | "crit" | "neutral" | "info"; children: ReactNode }) {
  const dot = { good: "bg-good", warn: "bg-warning", crit: "bg-critical", neutral: "bg-ink-3", info: "bg-cat-1" }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-ink-2">
      <span aria-hidden="true" className={clsx("h-1.5 w-1.5 flex-none rounded-full", dot)} />
      {children}
    </span>
  );
}
