import { useState } from "react";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Skeleton } from "@/components/ui/Skeleton";
import { weekday } from "@/lib/timekeeping/compute";
import { Initials, LoadError } from "../../corehr/ui";
import { hhmm, shortDate } from "../format";
import { DayDialog } from "./DayDialog";
import { DAYS, todayIso, useShifts, useWeek, type Editing } from "./shared";
import { RestWarning, WeekBar } from "./WeekBar";

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Option F: one card per person with their week as a strip of seven days and their total hours. */
export function WeekCards({ switcher }: { switcher: React.ReactNode }) {
  const w = useWeek();
  const s = useShifts();
  const today = todayIso();
  const [editing, setEditing] = useState<Editing>(null);
  if (w.query_.isError) return <LoadError onRetry={() => w.query_.refetch()} />;

  return (
    <>
      {switcher}
      <ContentHead title="Schedules" subtitle="Everyone's week at a glance. Click a day on a card to change it." />
      <WeekBar w={w} />
      <RestWarning w={w} />
      {w.query_.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {w.rows.map((r) => {
            const usual = s.shifts.find((x) => x.id === r.person.usualShiftId);
            const minutes = r.cells.reduce((n, c) => {
              const sh = s.shifts.find((x) => x.id === c.shiftId);
              if (c.kind !== "work" || !sh) return n;
              let m = toMin(sh.end) - toMin(sh.start);
              if (m <= 0) m += 24 * 60;
              return n + m - sh.breakMinutes;
            }, 0);
            const worked = r.cells.filter((c) => c.kind === "work").length;
            return (
              <article key={r.person.id} className={clsx("rounded-2xl border bg-surface p-3.5", r.longRun ? "border-warning" : "border-border")}>
                <div className="flex items-center gap-2.5">
                  <Initials initials={r.person.initials} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{r.person.name}</div>
                    <div className="truncate text-xs text-ink-3">{usual ? `${usual.name} · ${hhmm(usual.start)}–${hhmm(usual.end)}` : "No usual shift"}</div>
                  </div>
                  <div className="flex-none text-right">
                    <div className="font-display text-base leading-none font-semibold">{Math.round(minutes / 60)}h</div>
                    <div className="text-[0.65rem] text-ink-3">{worked} days</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1">
                  {r.cells.map((c) => (
                    <button
                      key={c.date}
                      type="button"
                      onClick={() => setEditing({ row: r, cell: c })}
                      title={`${shortDate(c.date)}: ${c.label}`}
                      className={clsx("relative flex flex-col items-center rounded-lg py-1.5 text-[0.65rem] hover:ring-2 hover:ring-ink-3/40", c.kind === "work" ? s.tone(c.shiftId) : c.kind === "leave" ? "bg-surface-2 text-cat-1" : c.kind === "holiday" ? "bg-critical-tint text-critical" : "border border-dashed border-border text-ink-3", c.date === today && "ring-2 ring-ink")}
                    >
                      <span className="font-medium">{DAYS[weekday(c.date)]![0]}</span>
                      <span className="font-semibold">{c.kind === "work" ? "●" : c.kind === "rest" ? "–" : c.kind === "leave" ? "L" : c.kind === "holiday" ? "H" : "?"}</span>
                      {c.changed && <span className="absolute top-0.5 right-0.5 h-1 w-1 rounded-full bg-ink" />}
                    </button>
                  ))}
                </div>
                {r.longRun && <p className="mt-2 text-xs font-medium text-warning">{r.longRun.length} days in a row, needs a rest day</p>}
              </article>
            );
          })}
        </div>
      )}
      <p className="text-xs text-ink-3">● working · – rest · L leave · H holiday. Colours match the shift.</p>
      {editing && <DayDialog row={editing.row} cell={editing.cell} onClose={() => setEditing(null)} />}
    </>
  );
}
