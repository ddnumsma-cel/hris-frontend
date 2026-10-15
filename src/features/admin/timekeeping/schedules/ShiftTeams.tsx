import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { RecentMoves } from "./RecentMoves";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { setUsualShift, type TkPerson } from "@/lib/timekeeping/api";
import type { ShiftTemplate } from "@/lib/timekeeping/types";
import { useCan } from "@/lib/useCan";
import { useActor } from "../../corehr/format";
import { ErrorNote, Initials, LoadError } from "../../corehr/ui";
import { Choice, PAGE_SIZE, SearchBox, Toolbar } from "../common";
import { hhmm } from "../format";
import { DAYS, useShifts, useWeek } from "./shared";

const NONE = "none";
const ALL = "all";

const hoursOf = (sh: ShiftTemplate) => `${hhmm(sh.start)}–${hhmm(sh.end)}`;
// Days off in week order, Monday first ("Sat, Sun").
const offOf = (sh: ShiftTemplate) =>
  [...sh.restDays]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => DAYS[d])
    .join(", ") || "none";
const plural = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

/** What a move changes for people who are all on `from`, in plain words. */
function changes(from: ShiftTemplate | undefined, to: ShiftTemplate): string {
  if (!from) return `They'll work ${hoursOf(to)}, off ${offOf(to)}.`;
  const parts: string[] = [];
  if (from.start !== to.start) parts.push(`start at ${hhmm(to.start)} instead of ${hhmm(from.start)}`);
  if (from.end !== to.end) parts.push(`finish at ${hhmm(to.end)} instead of ${hhmm(from.end)}`);
  if (offOf(from) !== offOf(to)) parts.push(`have ${offOf(to)} off instead of ${offOf(from)}`);
  if (!parts.length) return "Their hours and days off stay the same.";
  return `They'll ${parts.join(", ")}.`;
}

/**
 * Who works which shift: shift cards that filter the list, a table to tick people,
 * and a side panel that moves everyone ticked to another shift in one go.
 */
export function ShiftTeams() {
  const w = useWeek();
  const s = useShifts();
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const canEdit = useCan("edit", "attendanceSettings");
  const [filter, setFilter] = useState<string>(ALL);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const [page, setPage] = useState(0);

  const move = useMutation({
    mutationFn: ({ ids, shiftId }: { ids: string[]; shiftId: string | null }) => setUsualShift(ids, shiftId, actor),
    onSuccess: (_, { ids, shiftId }) => {
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      const name = s.shifts.find((x) => x.id === shiftId)?.name ?? "no usual shift";
      const who = ids.length === 1 ? (everyone.find((p) => p.id === ids[0])?.name ?? "1 person") : plural(ids.length);
      toast.show(`${who} ${ids.length === 1 ? "is" : "are"} now on ${name}.`);
      setPicked(new Set());
      setTarget("");
    },
  });

  const everyone: TkPerson[] = w.all.map((r) => r.person);
  const shiftOf = (p: TkPerson) => s.shifts.find((sh) => sh.id === p.usualShiftId);
  const unassigned = everyone.filter((p) => !shiftOf(p)).length;
  const cards = [
    { id: ALL, name: "Everyone", count: everyone.length, sub: `${s.shifts.length} shifts`, dot: "bg-ink-3" },
    ...s.shifts.map((sh) => ({ id: sh.id, name: sh.name, count: everyone.filter((p) => p.usualShiftId === sh.id).length, sub: hoursOf(sh), dot: s.dot(sh.id) })),
    ...(unassigned ? [{ id: NONE, name: "No usual shift", count: unassigned, sub: "Needs a shift", dot: "border border-dashed border-ink-3" }] : []),
  ];

  const rows = w.rows
    .map((r) => r.person)
    .filter((p) => filter === ALL || (filter === NONE ? !shiftOf(p) : p.usualShiftId === filter));
  // A new filter or search starts again from the first page.
  const [seen, setSeen] = useState(`${filter}|${rows.length}`);
  if (seen !== `${filter}|${rows.length}`) {
    setSeen(`${filter}|${rows.length}`);
    setPage(0);
  }
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const chosen = everyone.filter((p) => picked.has(p.id));
  const fromIds = [...new Set(chosen.map((p) => p.usualShiftId ?? NONE))];
  const from = fromIds.length === 1 ? s.shifts.find((sh) => sh.id === fromIds[0]) : undefined;
  const options = s.shifts.filter((sh) => !(fromIds.length === 1 && sh.id === fromIds[0]));
  const to = s.shifts.find((sh) => sh.id === target);
  const allShown = rows.length > 0 && rows.every((p) => picked.has(p.id));
  const someShown = rows.some((p) => picked.has(p.id));

  const selectAll = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = someShown && !allShown;
  }, [someShown, allShown]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const p of rows) {
        if (allShown) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });

  if (w.query_.isError) return <LoadError onRetry={() => w.query_.refetch()} />;

  return (
    <>
      <ContentHead
        title="Schedules"
        subtitle={canEdit ? "Tick people, then choose their new shift." : "Who works which shift."}
        actions={
          <Link to="/admin/timekeeping/shifts" className="btn btn-secondary inline-flex items-center px-4 py-2 text-[13px] font-medium">
            Manage shifts
          </Link>
        }
      />

      <div role="tablist" aria-label="Filter by shift" className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))" }}>
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={filter === c.id}
            onClick={() => setFilter(c.id)}
            className={clsx(
              "flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors",
              filter === c.id ? "border-[var(--sky)] bg-brand-tint" : "border-border bg-surface hover:bg-[var(--card-hover)]",
            )}
          >
            <span className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
              <span className={clsx("h-2 w-2 flex-none rounded-full", c.dot)} aria-hidden="true" />
              {c.name}
            </span>
            <span className="flex items-baseline gap-1">
              <span className="text-[22px] font-semibold text-ink">{c.count}</span>
              <span className="text-xs text-ink-3">{c.count === 1 ? "person" : "people"}</span>
            </span>
            <span className="text-xs text-ink-3">{c.sub}</span>
          </button>
        ))}
      </div>

      <Toolbar>
        <SearchBox value={w.query} onChange={w.setQuery} />
        <Choice label="Department" value={w.department} onChange={w.setDepartment} options={[{ value: "", label: "All departments" }, ...w.departments.map(([value, label]) => ({ value, label }))]} />
        {canEdit && picked.size > 0 && <span className="ml-auto text-[13px] text-ink-2">{picked.size} selected</span>}
      </Toolbar>

      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-xl border border-border bg-surface">
          <div className="no-scrollbar overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-left text-xs text-ink-2">
                  {canEdit && (
                    <th scope="col" className="w-8 py-3 pr-2 pl-4">
                      <input ref={selectAll} type="checkbox" checked={allShown} onChange={toggleAll} aria-label="Select everyone in this list" />
                    </th>
                  )}
                  <th scope="col" className={clsx("py-3 pr-4 font-medium", canEdit ? "pl-2" : "pl-4")}>
                    Employee
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Shift
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Hours
                  </th>
                </tr>
              </thead>
              <tbody>
                {w.query_.isLoading ? (
                  <tr>
                    <td colSpan={canEdit ? 4 : 3} className="p-4">
                      <Skeleton className="h-60 w-full" />
                    </td>
                  </tr>
                ) : shown.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 4 : 3} className="px-4 py-12 text-center text-sm text-ink-3">
                      No one on this shift yet.
                    </td>
                  </tr>
                ) : (
                  shown.map((p) => {
                    const sh = shiftOf(p);
                    const on = picked.has(p.id);
                    return (
                      <tr key={p.id} onClick={canEdit ? () => toggle(p.id) : undefined} className={clsx("border-b border-border last:border-0", canEdit && "cursor-pointer", on ? "bg-brand-tint" : canEdit && "hover:bg-[var(--nav-hover-bg)]")}>
                        {canEdit && (
                          <td className="py-2 pr-2 pl-4" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={on} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
                          </td>
                        )}
                        <td className={clsx("py-2 pr-4", canEdit ? "pl-2" : "pl-4")}>
                          <span className="flex items-center gap-3">
                            <Initials initials={p.initials} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{p.name}</span>
                              <span className="block truncate text-xs text-ink-3">{p.departmentName}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <span className={clsx("h-2 w-2 rounded-full", sh ? s.dot(sh.id) : "border border-dashed border-ink-3")} aria-hidden="true" />
                            {sh?.name ?? "No usual shift"}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-ink-2">{sh ? `${hoursOf(sh)} · off ${offOf(sh)}` : "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-ink-2">
            <span>{rows.length ? `${current * PAGE_SIZE + 1}–${Math.min(rows.length, current * PAGE_SIZE + PAGE_SIZE)} of ${rows.length}` : "0 results"}</span>
            <span className="flex gap-2">
              <button type="button" onClick={() => setPage(current - 1)} disabled={current === 0} className="h-8 rounded-lg border border-border px-3 font-medium enabled:hover:border-ink-3 disabled:opacity-40">
                Previous
              </button>
              <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} className="h-8 rounded-lg border border-border px-3 font-medium enabled:hover:border-ink-3 disabled:opacity-40">
                Next
              </button>
            </span>
          </div>
        </div>

        {canEdit && (
          <aside aria-labelledby="move-title" className="flex w-full min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-xl border border-border bg-surface p-5 lg:sticky lg:top-[calc(var(--topbar-h,0px)+var(--page-top-h,0px))] lg:w-[360px] lg:flex-none">
            {chosen.length === 0 ? (
              <RecentMoves
                canEdit={canEdit}
                onShow={(ids) => {
                  // Tick those people again, with the list showing everyone so they're all visible.
                  setFilter(ALL);
                  setPicked(new Set(ids));
                  setTarget("");
                }}
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 id="move-title" className="text-base font-semibold">
                      Move {plural(chosen.length)}
                    </h2>
                    <p className="mt-1 text-[13px] text-ink-2">
                      {chosen
                        .slice(0, 3)
                        .map((p) => p.name)
                        .join(", ")}
                      {chosen.length > 3 && ` and ${chosen.length - 3} more`}
                    </p>
                  </div>
                  <span className="flex-none rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-ink-2">Now: {fromIds.length === 1 ? (from?.name ?? "No usual shift") : "Mixed shifts"}</span>
                </div>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-xs font-medium text-ink">New shift</legend>
                  {options.map((sh) => (
                    <label key={sh.id} className={clsx("flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border p-3", target === sh.id ? "border-[var(--sky)] bg-brand-tint" : "border-border bg-[var(--field-bg)] hover:border-ink-3")}>
                      <input type="radio" name="move-to" value={sh.id} checked={target === sh.id} onChange={() => setTarget(sh.id)} />
                      <span className={clsx("h-2 w-2 flex-none rounded-full", s.dot(sh.id))} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold">{sh.name}</span>
                        <span className="block text-xs text-ink-3">
                          {hoursOf(sh)} · off {offOf(sh)}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {to && (
                  <p className="rounded-[var(--radius-control)] bg-surface-2 p-3 text-xs leading-relaxed text-ink">
                    <b className="font-semibold">What changes: </b>
                    {changes(from, to)} Each person is notified.
                  </p>
                )}
                <ErrorNote error={move.error} />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1 justify-center"
                    onClick={() => {
                      setPicked(new Set());
                      setTarget("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button className="flex-[2] justify-center" disabled={!to || move.isPending} onClick={() => to && move.mutate({ ids: chosen.map((p) => p.id), shiftId: to.id })}>
                    {move.isPending ? "Moving…" : to ? `Move to ${to.name}` : "Pick a shift"}
                  </Button>
                </div>
              </>
            )}
          </aside>
        )}
      </div>
    </>
  );
}
