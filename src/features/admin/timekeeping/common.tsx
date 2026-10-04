import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { Skeleton } from "@/components/ui/Skeleton";
import { SearchIcon } from "@/components/icons";
import { filterSearchClass, filterSelectClass } from "../corehr/format";

export const PAGE_SIZE = 8;

export interface Col<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
}

/** Plain table with 8 rows per page and Previous / Next. */
export function SimpleTable<T>({ cols, rows, rowKey, empty, loading }: { cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string; empty: string; loading?: boolean }) {
  const [page, setPage] = useState(0);
  // A new filter result starts again from the first page.
  const [seen, setSeen] = useState(rows.length);
  if (seen !== rows.length) {
    setSeen(rows.length);
    setPage(0);
  }
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="no-scrollbar overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/60 text-left text-xs text-ink-2">
              {cols.map((c) => (
                <th key={c.header} scope="col" className={clsx("px-4 py-2.5 font-medium whitespace-nowrap", c.align === "right" && "text-right")}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={cols.length} className="p-4">
                  <Skeleton className="h-40 w-full" />
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="px-4 py-10 text-center text-sm text-ink-3">
                  {empty}
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr key={rowKey(r)} className="border-b border-border last:border-0">
                  {cols.map((c) => (
                    <td key={c.header} className={clsx("px-4 py-2.5 whitespace-nowrap", c.align === "right" && "text-right")}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-ink-2">
        <span>{rows.length ? `${current * PAGE_SIZE + 1}–${Math.min(rows.length, current * PAGE_SIZE + PAGE_SIZE)} of ${rows.length}` : "0 results"}</span>
        <span className="flex gap-1.5">
          <button type="button" onClick={() => setPage(current - 1)} disabled={current === 0} className="h-8 rounded-lg border border-border px-3 font-medium enabled:hover:border-ink-3 disabled:opacity-40">
            Previous
          </button>
          <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} className="h-8 rounded-lg border border-border px-3 font-medium enabled:hover:border-ink-3 disabled:opacity-40">
            Next
          </button>
        </span>
      </div>
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function SearchBox({ value, onChange, placeholder = "Search employee" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-56">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={filterSearchClass} />
    </div>
  );
}

export function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={filterSelectClass}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Tab-like buttons above a table, e.g. Pending / Approved / Declined. */
export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-border">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)} className={clsx("-mb-px border-b-2 px-3 py-2 text-sm font-medium", value === o.value ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink")}>
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 text-xs text-ink-3">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Name({ name, sub }: { name: string; sub?: string }) {
  return (
    <span className="block">
      <span className="block font-medium">{name}</span>
      {sub && <span className="block text-xs text-ink-3">{sub}</span>}
    </span>
  );
}
