import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { listShifts, setDayShift, setUsualShift, type RosterCell, type RosterRow } from "@/lib/timekeeping/api";
import { useActor } from "../../corehr/format";
import { ErrorNote } from "../../corehr/ui";
import { hhmm, shortDate, tkKeys } from "../format";

/** Change one person's schedule for one day, or their usual shift. */
export function DayDialog({ row, cell, onClose }: { row: RosterRow; cell: RosterCell; onClose: () => void }) {
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
