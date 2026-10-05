import { useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { PlusIcon } from "@/components/icons";
import { listPeople, listShifts, saveShift } from "@/lib/timekeeping/api";
import { isOvernight, shiftHours } from "@/lib/timekeeping/compute";
import type { ShiftTemplate } from "@/lib/timekeeping/types";
import { inputClass } from "../corehr/format";
import { ErrorNote, Field, LoadError } from "../corehr/ui";
import { SimpleTable } from "./common";
import { addMinutes, hhmm, tkKeys } from "./format";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ShiftDialog({ shift, onClose }: { shift?: ShiftTemplate; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [v, setV] = useState(shift ?? { name: "", start: "08:00", end: "17:00", breakMinutes: 60, breakStart: "12:00", graceMinutes: 10, restDays: [0, 6] });
  const save = useMutation({
    mutationFn: () => saveShift(v),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      toast.show(`${s.name} saved.`);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={shift ? `Edit ${shift.name}` : "Add a shift"}
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save shift
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field id="s-name" label="Shift name" required hint="For example: Day shift, Night shift.">
          <input id="s-name" autoFocus className={inputClass} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="s-start" label="Starts" required>
            <input id="s-start" type="time" className={inputClass} value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} />
          </Field>
          <Field id="s-end" label="Ends" required hint={v.end <= v.start ? "Ends the next morning." : undefined}>
            <input id="s-end" type="time" className={inputClass} value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} />
          </Field>
          <Field id="s-lunch" label="Lunch starts" hint={v.breakMinutes > 0 ? "Lunch out and in are recorded automatically." : "No lunch break on this shift."}>
            <input id="s-lunch" type="time" disabled={!(v.breakMinutes > 0)} className={inputClass} value={v.breakStart} onChange={(e) => setV({ ...v, breakStart: e.target.value })} />
          </Field>
          <Field id="s-break" label="Lunch break (minutes, unpaid)">
            <input id="s-break" type="number" min={0} max={120} step={15} className={inputClass} value={v.breakMinutes} onChange={(e) => setV({ ...v, breakMinutes: e.target.valueAsNumber })} />
          </Field>
          <Field id="s-grace" label="Late after (minutes)" hint="Grace period">
            <input id="s-grace" type="number" min={0} max={30} className={inputClass} value={v.graceMinutes} onChange={(e) => setV({ ...v, graceMinutes: e.target.valueAsNumber })} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-ink-2">Rest days</legend>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => {
              const on = v.restDays.includes(i);
              return (
                <button key={d} type="button" aria-pressed={on} onClick={() => setV({ ...v, restDays: on ? v.restDays.filter((x) => x !== i) : [...v.restDays, i].sort() })} className={clsx("h-9 w-12 rounded-lg border text-xs font-medium", on ? "border-ink bg-ink text-surface" : "border-border text-ink-2 hover:border-ink-3")}>
                  {d}
                </button>
              );
            })}
          </div>
        </fieldset>
        <ErrorNote error={save.error} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/** The shift types the company uses. */
export function ShiftsPage() {
  const shiftsQuery = useQuery({ queryKey: tkKeys.shifts, queryFn: listShifts });
  const peopleQuery = useQuery({ queryKey: tkKeys.people, queryFn: listPeople });
  const [editing, setEditing] = useState<ShiftTemplate | "new" | null>(null);
  const users = (id: string) => (peopleQuery.data ?? []).filter((p) => p.usualShiftId === id).length;

  if (shiftsQuery.isError) return <LoadError onRetry={() => shiftsQuery.refetch()} />;

  return (
    <>
      <ContentHead
        title="Shifts"
        subtitle="The shift types your company uses. Lateness, undertime and overtime are measured against these."
        actions={
          <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setEditing("new")}>
            Add shift
          </Button>
        }
      />
      <SimpleTable
        rows={shiftsQuery.data ?? []}
        rowKey={(s) => s.id}
        loading={shiftsQuery.isLoading}
        empty="No shifts yet. Add your first shift."
        cols={[
          { header: "Shift", cell: (s) => <span className="font-medium">{s.name}</span> },
          { header: "Time", cell: (s) => `${hhmm(s.start)} – ${hhmm(s.end)}${isOvernight(s) ? " (next day)" : ""}` },
          { header: "Working hours", cell: (s) => `${shiftHours(s)} h` },
          { header: "Lunch break", cell: (s) => (s.breakMinutes > 0 ? `${hhmm(s.breakStart)} – ${hhmm(addMinutes(s.breakStart, s.breakMinutes))}` : "None") },
          { header: "Late after", cell: (s) => `${s.graceMinutes} min` },
          { header: "Rest days", cell: (s) => s.restDays.map((d) => DAYS[d]).join(", ") },
          { header: "Employees", cell: (s) => users(s.id) },
          {
            header: "",
            align: "right",
            cell: (s) => (
              <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                Edit
              </Button>
            ),
          },
        ]}
      />
      {editing && <ShiftDialog shift={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
