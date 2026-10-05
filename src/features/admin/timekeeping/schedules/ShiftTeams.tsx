import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { setUsualShift, type TkPerson } from "@/lib/timekeeping/api";
import { useActor } from "../../corehr/format";
import { Initials, LoadError } from "../../corehr/ui";
import { SearchBox, Toolbar } from "../common";
import { hhmm } from "../format";
import { DAYS, useShifts, useWeek } from "./shared";

/** One column per shift; everyone sits under their usual shift. Move someone with one click. */
export function ShiftTeams() {
  const w = useWeek();
  const s = useShifts();
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const [moving, setMoving] = useState<string | null>(null);
  const move = useMutation({
    mutationFn: ({ p, shiftId }: { p: TkPerson; shiftId: string | null }) => setUsualShift([p.id], shiftId, actor),
    onSuccess: (_, { p, shiftId }) => {
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      toast.show(`${p.name} is now on ${s.shifts.find((x) => x.id === shiftId)?.name ?? "no usual shift"}.`);
      setMoving(null);
    },
  });
  if (w.query_.isError) return <LoadError onRetry={() => w.query_.refetch()} />;
  const people = w.rows.map((r) => r.person);
  const columns = s.shifts.map((sh) => ({ id: sh.id as string | null, sh }));

  return (
    <>
      <ContentHead title="Schedules" subtitle="Everyone's usual shift. Click Move on a person to put them on another shift. Flexible time has no fixed start: people work 8 hours any time between 7 AM and 7 PM." />
      <Toolbar>
        <SearchBox value={w.query} onChange={w.setQuery} />
      </Toolbar>
      {w.query_.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map(({ id, sh }) => {
            const list = people.filter((p) => (p.usualShiftId ?? null) === id);
            return (
              <section key={id ?? "none"} className="flex max-h-[calc(100dvh-20rem)] min-h-64 flex-col rounded-2xl border border-border bg-surface">
                <header className="flex-none border-b border-border px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span className={clsx("h-2.5 w-2.5 rounded-full", sh ? s.dot(sh.id) : "border border-dashed border-ink-3")} />
                      {sh?.name ?? "No usual shift"}
                    </span>
                    <span className="rounded-full bg-surface-2 px-2 text-xs font-semibold text-ink-2">{list.length}</span>
                  </div>
                  {sh && (
                    <div className="mt-1 text-xs text-ink-3">
                      {sh.flexible ? `Any ${sh.requiredHours ?? 8} hours, ${hhmm(sh.start)}–${hhmm(sh.end)}` : `${hhmm(sh.start)}–${hhmm(sh.end)}`} · off {sh.restDays.map((d) => DAYS[d]).join(", ") || "none"}
                    </div>
                  )}
                </header>
                <ul className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2">
                  {list.length === 0 && <li className="py-6 text-center text-xs text-ink-3">No one</li>}
                  {list.map((p) => (
                    <li key={p.id} className="rounded-xl border border-border px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <Initials initials={p.initials} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span className="block truncate text-[0.7rem] text-ink-3">{p.departmentName}</span>
                        </span>
                        <button type="button" onClick={() => setMoving(moving === p.id ? null : p.id)} className="flex-none rounded-full border border-border px-2 py-0.5 text-[0.7rem] font-medium text-ink-2 hover:border-ink-3">
                          Move
                        </button>
                      </div>
                      {moving === p.id && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {columns
                            .filter((c) => c.id !== id)
                            .map((c) => (
                              <button key={c.id ?? "none"} type="button" disabled={move.isPending} onClick={() => move.mutate({ p, shiftId: c.id })} className={clsx("rounded-full px-2 py-0.5 text-[0.7rem] font-medium", c.sh ? s.tone(c.sh.id) : "bg-surface-2 text-ink-2")}>
                                {c.sh?.name ?? "No shift"}
                              </button>
                            ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
