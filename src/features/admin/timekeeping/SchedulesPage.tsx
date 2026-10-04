import { useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { getRoster, listShifts, setDayShift, setUsualShift, type RosterCell, type RosterRow } from "@/lib/timekeeping/api";
import { addDays, toIsoDate, weekday } from "@/lib/timekeeping/compute";
import { useOfficeFilter } from "../OfficeFilterContext";
import { useActor } from "../corehr/format";
import { ErrorNote, LoadError } from "../corehr/ui";
import { Choice, Name, SearchBox, SimpleTable, Toolbar, type Col } from "./common";
import { hhmm, shortDate, tkKeys } from "./format";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const mondayOf = (d: string) => addDays(d, -((weekday(d) + 6) % 7));

/** Change one person's schedule for one day, or their usual shift. */
function DayDialog({ row, cell, onClose }: { row: RosterRow; cell: RosterCell; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const shiftsQuery = useQuery({ queryKey: tkKeys.shifts, queryFn: listShifts });
  const shifts = (shiftsQuery.data ?? []).filter((s) => s.active);
  const [value, setValue] = useState(cell.changed ? (cell.kind === "rest" ? "rest" : (cell.shiftId ?? "usual")) : "usual");
  const [usual, setUsual] = useState(row.person.usualShiftId ?? "");
  const done = (msg: string) => {
    queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
    toast.show(msg);
    onClose();
  };
  const saveDay = useMutation({ mutationFn: () => setDayShift(row.person.id, cell.date, value === "usual" ? null : value, actor), onSuccess: () => done(`${row.person.name}'s ${shortDate(cell.date)} updated.`) });
  const saveUsual = useMutation({ mutationFn: () => setUsualShift([row.person.id], usual || null, actor), onSuccess: () => done(`${row.person.name}'s usual shift updated.`) });
  return (
    <Dialog open onClose={onClose} title={`${row.person.name} · ${shortDate(cell.date)}`}>
      <div className="flex flex-col gap-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold">This day only</h3>
          <div className="flex gap-2">
            <select aria-label="Schedule for this day" className="h-10 flex-1 rounded-lg border border-border bg-surface px-3 text-sm" value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="usual">Usual schedule</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({hhmm(s.start)} – {hhmm(s.end)})
                </option>
              ))}
              <option value="rest">Rest day</option>
            </select>
            <Button onClick={() => saveDay.mutate()} disabled={saveDay.isPending}>
              Save
            </Button>
          </div>
          <ErrorNote error={saveDay.error} />
        </section>
        <section className="border-t border-border pt-4">
          <h3 className="mb-2 text-sm font-semibold">Usual shift (every week)</h3>
          <div className="flex gap-2">
            <select aria-label="Usual shift" className="h-10 flex-1 rounded-lg border border-border bg-surface px-3 text-sm" value={usual} onChange={(e) => setUsual(e.target.value)}>
              <option value="">No shift</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({hhmm(s.start)} – {hhmm(s.end)})
                </option>
              ))}
            </select>
            <Button variant="ghost" onClick={() => saveUsual.mutate()} disabled={saveUsual.isPending}>
              Save
            </Button>
          </div>
          <ErrorNote error={saveUsual.error} />
        </section>
      </div>
    </Dialog>
  );
}

/** Who works which shift, week by week. */
export function SchedulesPage() {
  const { office } = useOfficeFilter();
  const today = toIsoDate(new Date());
  const [week, setWeek] = useState(mondayOf(today));
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [editing, setEditing] = useState<{ row: RosterRow; cell: RosterCell } | null>(null);
  const rosterQuery = useQuery({ queryKey: tkKeys.roster(week), queryFn: () => getRoster(week) });
  const all = (rosterQuery.data ?? []).filter((r) => office === "All offices" || r.person.branch === office);
  const departments = [...new Map(all.map((r) => [r.person.departmentId, r.person.departmentName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const q = query.trim().toLowerCase();
  const rows = all.filter((r) => (!department || r.person.departmentId === department) && (!q || r.person.name.toLowerCase().includes(q)));
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const warnings = rows.filter((r) => r.longRun);

  if (rosterQuery.isError) return <LoadError onRetry={() => rosterQuery.refetch()} />;

  const cols: Col<RosterRow>[] = [
    { header: "Employee", cell: (r) => <Name name={r.person.name} sub={r.person.departmentName} /> },
    ...days.map(
      (d, i): Col<RosterRow> => ({
        header: `${DAYS[weekday(d)]} ${new Date(`${d}T12:00:00`).getDate()}${d === today ? " (today)" : ""}`,
        cell: (r) => {
          const c = r.cells[i]!;
          return (
            <button
              type="button"
              onClick={() => setEditing({ row: r, cell: c })}
              aria-label={`${r.person.name}, ${shortDate(c.date)}: ${c.label}. Click to change.`}
              className={clsx("w-full rounded-md px-2 py-1 text-left text-xs hover:ring-1 hover:ring-ink-3", c.kind === "work" ? "bg-surface-2 font-medium" : c.kind === "leave" ? "text-cat-1" : "text-ink-3")}
            >
              {c.kind === "work" ? c.label : c.kind === "rest" ? "Rest" : c.kind === "leave" ? "Leave" : c.kind === "holiday" ? "Holiday" : "—"}
              {c.changed && " *"}
            </button>
          );
        },
      }),
    ),
  ];

  return (
    <>
      <ContentHead title="Schedules" subtitle="Each employee's shift for the week. Click a day to change it (* = changed for that day only)." />
      <Toolbar>
        <div className="flex items-center rounded-lg border border-border bg-surface">
          <button type="button" aria-label="Previous week" onClick={() => setWeek(addDays(week, -7))} className="flex h-8 w-8 items-center justify-center text-ink-2 hover:text-ink">
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <span className="px-2 text-xs font-medium">
            {shortDate(week)} – {shortDate(addDays(week, 6))}
          </span>
          <button type="button" aria-label="Next week" onClick={() => setWeek(addDays(week, 7))} className="flex h-8 w-8 items-center justify-center text-ink-2 hover:text-ink">
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
        {week !== mondayOf(today) && (
          <Button size="sm" variant="ghost" onClick={() => setWeek(mondayOf(today))}>
            This week
          </Button>
        )}
        <SearchBox value={query} onChange={setQuery} />
        <Choice label="Department" value={department} onChange={setDepartment} options={[{ value: "", label: "All departments" }, ...departments.map(([id, name]) => ({ value: id, label: name }))]} />
      </Toolbar>
      {warnings.length > 0 && (
        <p role="alert" className="rounded-lg bg-warning-tint px-4 py-2.5 text-sm">
          <span className="font-semibold">No rest day:</span> {warnings.map((r) => `${r.person.name} (${r.longRun!.length} days in a row)`).join(", ")}. The law requires a rest day after six days of work.
        </p>
      )}
      <SimpleTable rows={rows} rowKey={(r) => r.person.id} cols={cols} loading={rosterQuery.isLoading} empty="No employees match." />
      {editing && <DayDialog row={editing.row} cell={editing.cell} onClose={() => setEditing(null)} />}
    </>
  );
}
