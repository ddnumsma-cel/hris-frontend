import { useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import type { Holiday } from "@/lib/holidays";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const at = (iso: string) => new Date(`${iso}T12:00:00`);
const isLocal = (h: Holiday) => !!h.offices?.length;

/** Filled colour for a holiday: red regular, amber special, blue local. */
// Text uses --on-accent: white on the deep light-mode fills, dark on the pale dark-mode ones.
const FILL = (h: Holiday) => (isLocal(h) ? "bg-cat-1" : h.type === "regular" ? "bg-critical" : "bg-warning") + " text-[var(--on-accent)]";
const typeLabel = (h: Holiday) => (isLocal(h) ? `Local · ${h.offices!.join(", ")}` : h.type === "regular" ? "Regular holiday" : "Special non-working day");

// ---------- B: one month, large ----------

export function MonthView({ year, holidays, onYear }: { year: number; holidays: Holiday[]; onYear: (y: number) => void }) {
  const now = new Date();
  const [month, setMonth] = useState(year === now.getFullYear() ? now.getMonth() : 0);
  const go = (delta: number) => {
    const m = month + delta;
    if (m < 0) (onYear(year - 1), setMonth(11));
    else if (m > 11) (onYear(year + 1), setMonth(0));
    else setMonth(m);
  };
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array.from({ length: first }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const today = todayIso();
  const inMonth = holidays.filter((h) => h.date.startsWith(`${year}-${pad(month + 1)}`));
  const upcoming = holidays.filter((h) => h.date >= today).slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <Button size="sm" variant="ghost" aria-label="Previous month" onClick={() => go(-1)}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <h3 className="font-display text-lg font-semibold">
            {MONTHS[month]} {year}
          </h3>
          <Button size="sm" variant="ghost" aria-label="Next month" onClick={() => go(1)}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </header>
        <div className="grid grid-cols-7 border-b border-border text-center text-[0.7rem] font-semibold text-ink-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <span key={d} className="py-2">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const date = d ? `${year}-${pad(month + 1)}-${pad(d)}` : "";
            const hs = d ? holidays.filter((h) => h.date === date) : [];
            const weekend = i % 7 === 0 || i % 7 === 6;
            return (
              <div key={i} className={clsx("flex min-h-24 flex-col gap-1 border-r border-b border-surface-2 p-2 [&:nth-child(7n)]:border-r-0", !d && "bg-surface-2/40", weekend && d && "bg-surface-2/30")}>
                {d && (
                  <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full text-xs", date === today ? "bg-ink font-semibold text-surface" : "text-ink-2")}>{d}</span>
                )}
                {hs.map((h) => (
                  <span key={h.name} title={`${h.name} · ${typeLabel(h)}`} className={clsx("truncate rounded-md px-2 py-1 text-[0.7rem] leading-tight font-semibold", FILL(h))}>
                    {h.name}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold">In {MONTHS[month]}</h3>
          {inMonth.length === 0 ? (
            <p className="text-xs text-ink-2">No holidays this month.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {inMonth.map((h) => (
                <li key={h.name + h.date} className="flex items-center gap-3">
                  <span className={clsx("flex h-9 w-9 flex-none items-center justify-center rounded-lg text-sm font-bold", FILL(h))}>{at(h.date).getDate()}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{h.name}</span>
                    <span className="block text-[0.7rem] text-ink-2">{typeLabel(h)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold">Coming up</h3>
          {upcoming.length === 0 ? (
            <p className="text-xs text-ink-2">No more holidays this year.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {upcoming.map((h) => (
                <li key={h.name + h.date} className="flex items-baseline justify-between gap-2">
                  <span className="truncate">{h.name}</span>
                  <span className="flex-none text-xs text-ink-2">{at(h.date).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
