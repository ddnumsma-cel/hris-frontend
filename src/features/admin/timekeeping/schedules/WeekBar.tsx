import { Button } from "@/components/ui/Button";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { addDays } from "@/lib/timekeeping/compute";
import { Choice, SearchBox, Toolbar } from "../common";
import { shortDate } from "../format";
import { mondayOf, todayIso, type useWeek } from "./shared";

/** Week picker, search and department filter shared by the schedule layouts. */
export function WeekBar({ w, filters = true }: { w: ReturnType<typeof useWeek>; filters?: boolean }) {
  const thisWeek = mondayOf(todayIso());
  return (
    <Toolbar>
      <div className="flex items-center rounded-full border border-border bg-surface">
        <button type="button" aria-label="Previous week" onClick={() => w.setWeek(addDays(w.week, -7))} className="flex h-8 w-8 items-center justify-center text-ink-2 hover:text-ink">
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <span className="px-1 text-xs font-medium whitespace-nowrap">
          {shortDate(w.week)} – {shortDate(addDays(w.week, 6))}
        </span>
        <button type="button" aria-label="Next week" onClick={() => w.setWeek(addDays(w.week, 7))} className="flex h-8 w-8 items-center justify-center text-ink-2 hover:text-ink">
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
      {w.week !== thisWeek && (
        <Button size="sm" variant="ghost" onClick={() => w.setWeek(thisWeek)}>
          This week
        </Button>
      )}
      {filters && (
        <>
          <SearchBox value={w.query} onChange={w.setQuery} />
          <Choice label="Department" value={w.department} onChange={w.setDepartment} options={[{ value: "", label: "All departments" }, ...w.departments.map(([id, name]) => ({ value: id, label: name }))]} />
        </>
      )}
    </Toolbar>
  );
}

export function RestWarning({ w }: { w: ReturnType<typeof useWeek> }) {
  const warnings = w.rows.filter((r) => r.longRun);
  if (!warnings.length) return null;
  return (
    <p role="alert" className="rounded-lg bg-warning-tint px-4 py-2.5 text-sm">
      <span className="font-semibold">No rest day:</span> {warnings.map((r) => `${r.person.name} (${r.longRun!.length} days in a row)`).join(", ")}. The law requires a rest day after six days of work.
    </p>
  );
}
