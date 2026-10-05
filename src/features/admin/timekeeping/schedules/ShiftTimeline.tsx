import { useState } from "react";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Skeleton } from "@/components/ui/Skeleton";
import { weekday } from "@/lib/timekeeping/compute";
import { Initials, LoadError } from "../../corehr/ui";
import { hhmm, shortDate } from "../format";
import { DayDialog } from "./DayDialog";
import { DAYS, todayIso, useShifts, useWeek, type Editing } from "./shared";
import { WeekBar } from "./WeekBar";

const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];
const toH = (t: string) => Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60;

/** Option D: one day on a 24-hour clock. Each shift is a bar, so gaps and overlaps are easy to spot. */
export function ShiftTimeline({ switcher }: { switcher: React.ReactNode }) {
  const w = useWeek();
  const s = useShifts();
  const today = todayIso();
  const [dayIndex, setDayIndex] = useState(() => Math.max(0, w.days.indexOf(today)));
  const [editing, setEditing] = useState<Editing>(null);
  if (w.query_.isError) return <LoadError onRetry={() => w.query_.refetch()} />;
  const i = Math.min(dayIndex, 6);
  const rows = [...w.rows].sort((a, b) => {
    const sa = s.shifts.find((x) => x.id === a.cells[i]?.shiftId);
    const sb = s.shifts.find((x) => x.id === b.cells[i]?.shiftId);
    return (a.cells[i]?.kind === "work" ? 0 : 1) - (b.cells[i]?.kind === "work" ? 0 : 1) || (sa?.start ?? "99").localeCompare(sb?.start ?? "99") || a.person.name.localeCompare(b.person.name);
  });
  // People on duty at each hour, for the coverage strip.
  const coverage = Array.from({ length: 24 }, (_, h) =>
    rows.filter((r) => {
      const c = r.cells[i];
      const sh = s.shifts.find((x) => x.id === c?.shiftId);
      if (c?.kind !== "work" || !sh) return false;
      const a = toH(sh.start);
      const b = toH(sh.end) <= a ? toH(sh.end) + 24 : toH(sh.end);
      return (h + 0.5 >= a && h + 0.5 < b) || (b > 24 && h + 0.5 < b - 24);
    }).length,
  );
  const peak = Math.max(1, ...coverage);

  return (
    <>
      {switcher}
      <ContentHead title="Schedules" subtitle="Each person's shift on a 24-hour clock. Pick a day, then click a bar to change that person's day." />
      <WeekBar w={w} />
      <div role="tablist" aria-label="Day" className="flex flex-wrap gap-1.5">
        {w.days.map((d, k) => (
          <button key={d} type="button" role="tab" aria-selected={k === i} onClick={() => setDayIndex(k)} className={clsx("rounded-full border px-3.5 py-1.5 text-sm font-medium", k === i ? "border-ink bg-ink text-surface" : "border-border bg-surface text-ink-2 hover:border-ink-3")}>
            {DAYS[weekday(d)]} {Number(d.slice(8))}
            {d === today && <span className={clsx("ml-1 text-xs", k === i ? "text-surface/70" : "text-ink-3")}>today</span>}
          </button>
        ))}
      </div>
      {w.query_.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid grid-cols-[13rem_1fr] border-b border-border text-xs text-ink-3">
            <div className="px-4 py-2 font-medium text-ink-2">{shortDate(w.days[i]!)}</div>
            <div className="relative h-full">
              {HOURS.map((h) => (
                <span key={h} className={clsx("absolute top-2 whitespace-nowrap", h > 0 && "-translate-x-1/2")} style={{ left: `${(h / 24) * 100}%` }}>
                  {h === 0 ? "12 AM" : h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`}
                </span>
              ))}
            </div>
          </div>
          <div className="no-scrollbar max-h-[calc(100dvh-28rem)] overflow-y-auto">
            {rows.map((r) => {
              const c = r.cells[i]!;
              const sh = s.shifts.find((x) => x.id === c.shiftId);
              const a = sh ? toH(sh.start) : 0;
              const b = sh ? (toH(sh.end) <= a ? 24 : toH(sh.end)) : 0;
              const spill = sh && toH(sh.end) <= a ? toH(sh.end) : 0;
              const bar = (from: number, to: number, key: string) => (
                <button key={key} type="button" onClick={() => setEditing({ row: r, cell: c })} title={`${sh?.name} · ${hhmm(sh!.start)}–${hhmm(sh!.end)}`} className={clsx("absolute top-1.5 bottom-1.5 flex items-center overflow-hidden rounded-lg px-2 text-xs font-medium hover:ring-2 hover:ring-ink-3/40", s.tone(c.shiftId))} style={{ left: `${(from / 24) * 100}%`, width: `${((to - from) / 24) * 100}%` }}>
                  <span className="truncate">
                    {sh?.name} · {hhmm(sh!.start)}–{hhmm(sh!.end)}
                  </span>
                </button>
              );
              return (
                <div key={r.person.id} className="grid grid-cols-[13rem_1fr] border-b border-border last:border-0">
                  <div className="flex items-center gap-2.5 px-4 py-1.5">
                    <Initials initials={r.person.initials} size="sm" />
                    <span className="truncate text-sm font-medium" title={r.person.departmentName}>
                      {r.person.name}
                    </span>
                  </div>
                  <div className="relative h-11" style={{ backgroundImage: "linear-gradient(to right, var(--color-border) 1px, transparent 1px)", backgroundSize: `${100 / 8}% 100%` }}>
                    {c.kind === "work" && sh ? (
                      <>
                        {bar(a, b, "main")}
                        {spill > 0 && bar(0, spill, "spill")}
                      </>
                    ) : (
                      <button type="button" onClick={() => setEditing({ row: r, cell: c })} className="absolute inset-y-1.5 left-1 flex items-center rounded-lg px-2 text-xs text-ink-3 hover:bg-surface-2">
                        {c.kind === "rest" ? "Rest day" : c.kind === "leave" ? "On leave" : c.kind === "holiday" ? "Holiday" : "No shift"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-[13rem_1fr] border-t border-border bg-surface-2/50">
            <div className="px-4 py-2 text-xs font-medium text-ink-2">People on duty</div>
            <div className="flex items-end gap-px px-px py-1.5">
              {coverage.map((n, h) => (
                <div key={h} className="flex flex-1 flex-col items-center justify-end" title={`${n} on duty at ${h}:00`}>
                  <div className={clsx("w-full rounded-sm", n === 0 ? "bg-critical/30" : "bg-ink/70")} style={{ height: `${Math.max(3, (n / peak) * 22)}px` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {editing && <DayDialog row={editing.row} cell={editing.cell} onClose={() => setEditing(null)} />}
    </>
  );
}
