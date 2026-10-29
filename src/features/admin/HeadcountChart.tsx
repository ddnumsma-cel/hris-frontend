import type { Employee, OfficeHeadcount } from "@/lib/types";

// One colour per office, shared by the split bar and the office tiles.
const officeColors = ["var(--color-cat-1)", "var(--color-cat-2)", "var(--color-cat-3)", "var(--color-cat-4)"];

/**
 * Where the workforce sits: one bar split by office, then a tile per office with its
 * headcount and share of staff. The tiles stretch to fill whatever height the card has.
 */
export function HeadcountChart({ data }: { data: OfficeHeadcount[] }) {
  const total = data.reduce((sum, o) => sum + o.count, 0);
  const share = (count: number) => (total ? Math.round((count / total) * 100) : 0);

  return (
    <div className="flex h-full min-h-36 flex-col gap-4">
      <div
        role="img"
        aria-label={data.map((o) => `${o.office} ${o.count}`).join(", ")}
        className="flex h-3 w-full gap-1 overflow-hidden rounded-[var(--radius-pill)]"
      >
        {data.map((o, i) => (
          <span
            key={o.office}
            className="h-full first:rounded-l-[var(--radius-pill)] last:rounded-r-[var(--radius-pill)]"
            style={{ flexGrow: o.count, flexBasis: 0, background: officeColors[i % officeColors.length] }}
          />
        ))}
      </div>

      <ul className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
        {data.map((o, i) => (
          <li
            key={o.office}
            className="flex min-h-20 flex-col justify-between gap-3 rounded-[var(--radius-control)] bg-surface-2 p-3"
          >
            <span className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: officeColors[i % officeColors.length] }} />
              {o.office}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="font-num text-2xl leading-none font-semibold text-ink">{o.count}</span>
              <span className="font-num text-xs text-ink-2">{share(o.count)}% of staff</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Headcount per department: one bar split by department, then a two-column list with each
 * department's count and share. Rows stretch to fill whatever height the card has.
 */
export function DepartmentSplit({ data }: { data: { name: string; count: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const share = (count: number) => (total ? Math.round((count / total) * 100) : 0);
  const color = (i: number) => officeColors[i % officeColors.length];
  // The last row of each column has no divider under it.
  const lastRow = Math.ceil(data.length / 2) - 1;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-2">By department</span>
        <span className="text-xs text-ink-2">Share of staff</span>
      </div>
      <div
        role="img"
        aria-label={data.map((d) => `${d.name} ${d.count}`).join(", ")}
        className="flex h-3 w-full gap-1 overflow-hidden rounded-[var(--radius-pill)]"
      >
        {data.map((d, i) => (
          <span
            key={d.name}
            className="h-full first:rounded-l-[var(--radius-pill)] last:rounded-r-[var(--radius-pill)]"
            style={{ flexGrow: d.count, flexBasis: 0, background: color(i) }}
          />
        ))}
      </div>
      <ul className="grid flex-1 auto-rows-[minmax(40px,1fr)] grid-cols-1 gap-x-8 sm:grid-cols-2">
        {data.map((d, i) => (
          <li
            key={d.name}
            className={`flex items-center gap-2 ${Math.floor(i / 2) < lastRow ? "border-b border-[var(--line)]" : ""}`}
          >
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: color(i) }} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{d.name}</span>
            <span className="font-num text-sm font-semibold text-ink">{d.count}</span>
            <span className="font-num w-10 text-right text-xs text-ink-2">{share(d.count)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The five newest hires as overlapping avatars, and who joined most recently. Information only.
 * Hire dates arrive already formatted ("Oct 3, 2026"), so they're parsed only to sort.
 */
export function RecentlyJoined({ employees, hireDates }: { employees: Employee[]; hireDates: Record<string, string> }) {
  const time = (id: string) => new Date(hireDates[id] ?? "").getTime() || 0;
  const recent = employees
    .filter((e) => hireDates[e.id])
    .sort((a, b) => time(b.id) - time(a.id))
    .slice(0, 5);
  const newest = recent[0];
  if (!newest) return null;
  const joined = hireDates[newest.id];

  return (
    <div className="flex flex-col items-end gap-2 text-right">
      <span className="text-[13px] font-medium text-ink-2">Recently joined</span>
      <div className="flex -space-x-2" aria-hidden="true">
        {recent.map((e) => (
          <span
            key={e.id}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[image:var(--grad-avatar)] text-[11px] font-semibold text-[var(--on-accent)] ring-2 ring-[var(--surface-raised)]"
          >
            {e.initials}
          </span>
        ))}
      </div>
      <span className="sr-only">Newest hires: {recent.map((e) => e.name).join(", ")}.</span>
      <p className="text-xs text-ink-2">
        <span className="font-medium text-ink">{newest.name}</span> joined {joined}
      </p>
    </div>
  );
}
