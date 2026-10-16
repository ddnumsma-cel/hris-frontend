import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { fileMyTimeRequest } from "@/lib/ess/api";
import type { DayRow } from "@/lib/timekeeping/api";
import { inputClass } from "../admin/corehr/format";
import { ErrorNote, Field } from "../admin/corehr/ui";
import { duration, shortDate } from "../admin/timekeeping/format";
import { fmtTime } from "@/lib/preferences";
import { ApproverNote } from "./ApproverNote";

export type Ask = { kind: "overtime" | "undertime"; day?: DayRow };

/** A moment as the browser's local "yyyy-mm-ddThh:mm", the value a date-and-time field takes. */
const local = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
/** Overtime can only fall between the end of the shift (or the time-in on a day off) and the time-out. */
const otWindow = (d: DayRow) => {
  const from = d.kind === "work" && d.shiftEnd !== undefined ? d.shiftEnd : d.timeIn ? new Date(d.timeIn.at).getTime() : undefined;
  const to = d.timeOut ? new Date(d.timeOut.at).getTime() : undefined;
  return from !== undefined && to !== undefined && to > from ? { from, to } : undefined;
};

/** The days (last 2 weeks) the employee can still file overtime or undertime for. */
export function fileableDays(kind: Ask["kind"], days: DayRow[], filed: (date: string, type: string) => boolean) {
  return days.filter((d) => (kind === "overtime" ? d.extraMinutes > 0 : d.undertimeMinutes > 0 && !d.undertimeExcused) && !filed(d.date, kind));
}

/**
 * Filing overtime or undertime. From a day's row the day is fixed; from the Request overtime /
 * Request undertime buttons (or the Create menu) the person picks one of the days they can file.
 * It goes straight to their approver; HR only sees it once it's approved.
 */
export function TimeRequestDialog({ ask, choices, onClose }: { ask: Ask; choices?: DayRow[]; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(ask.day?.date ?? choices?.[0]?.date ?? "");
  const day = choices?.find((d) => d.date === date) ?? ask.day;
  const max = day ? (ask.kind === "overtime" ? day.extraMinutes : day.undertimeMinutes) : 0;
  const [reason, setReason] = useState("");
  // Overtime: start and end date-and-time, prefilled with the whole time past the shift.
  const ot = ask.kind === "overtime";
  const first = ask.day ?? choices?.[0];
  const firstWindow = first ? otWindow(first) : undefined;
  const [start, setStart] = useState(firstWindow ? local(firstWindow.from) : "");
  const [end, setEnd] = useState(firstWindow ? local(firstWindow.to) : "");
  const otDay = ot ? (ask.day && ask.day.date === start.slice(0, 10) ? ask.day : choices?.find((d) => d.date === start.slice(0, 10))) : undefined;
  const window = otDay ? otWindow(otDay) : undefined;
  const startMs = start ? new Date(start).getTime() : NaN;
  const endMs = end ? new Date(end).getTime() : NaN;
  const otMinutes = Math.round((endMs - startMs) / 60_000);
  const otProblem = !ot
    ? null
    : !start || !end
      ? "Choose the start and end date and time"
      : !otDay || !window
        ? "Choose a start date you worked past your shift and haven't filed yet"
        : !(otMinutes > 0)
          ? "The end must be after the start"
          : startMs < window.from || endMs > window.to
            ? `Your overtime that day is between ${fmtTime(new Date(window.from).toISOString())} and ${fmtTime(new Date(window.to).toISOString())}`
            : null;
  const minutes = ot ? otMinutes : max;
  const send = useMutation({
    mutationFn: () => fileMyTimeRequest(ot ? { date: start.slice(0, 10), type: "overtime", minutes, reason, start, end } : { date: day!.date, type: ask.kind, minutes, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ess"] });
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      toast.show("Sent to your approver. You'll be notified when it's decided.");
      onClose();
    },
  });
  const title = ask.kind === "overtime" ? "Request overtime" : "Request undertime";

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={(ot ? !!otProblem : !day) || send.isPending} onClick={() => send.mutate()}>
            Send to approver
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <ApproverNote kind={ask.kind} />
        {!ot && choices && (
          choices.length ? (
            <Field id="a-day" label="Day">
              <select id="a-day" className={inputClass} value={day?.date ?? ""} onChange={(e) => setDate(e.target.value)}>
                {choices.map((d) => (
                  <option key={d.date} value={d.date}>
                    {shortDate(d.date)} · {duration(ask.kind === "overtime" ? d.extraMinutes : d.undertimeMinutes)} {ask.kind === "overtime" ? "past your shift" : "early"}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <p className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-sm text-ink-2">
              {ask.kind === "overtime" ? "No day in the last 2 weeks has time past your shift that isn't filed yet." : "No day in the last 2 weeks has an early time-out that isn't filed yet."} If your time-out is wrong, use Request time adjustment instead.
            </p>
          )
        )}
        {ot && (
          <>
            {choices && !choices.length && !ask.day && (
              <p className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-sm text-ink-2">No day in this period has time past your shift that isn't filed yet. If your time-out is wrong, use Request time adjustment instead.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="a-start" label="Start" required>
                <DateTimeField id="a-start" value={start} onChange={setStart} />
              </Field>
              <Field id="a-end" label="End" required>
                <DateTimeField id="a-end" value={end} onChange={setEnd} min={start} invalid={!!otProblem && !!start && !!end} />
              </Field>
            </div>
            <p className={otProblem && start && end ? "text-sm text-critical" : "text-sm text-ink-2"}>
              {otProblem && start && end ? otProblem : otMinutes > 0 ? `Total: ${duration(otMinutes)}. Paid as overtime once your approver approves it.` : ""}
            </p>
            <Field id="a-why" label="Reason" required>
              <input id="a-why" className={inputClass} value={reason} placeholder="e.g. Client deadline" onChange={(e) => setReason(e.target.value)} />
            </Field>
          </>
        )}
        {!ot && day && (
          <>
            <p className="text-sm text-ink-2">
              {shortDate(day.date)}: {ask.kind === "overtime" ? `you worked ${duration(max)} past your shift.` : `you left ${duration(max)} before your shift ended.`}{" "}
              {ask.kind === "overtime" ? "It's paid as overtime once your approver approves it." : "Approval excuses it; the time is still unpaid."}
            </p>
            <Field id="a-why" label="Reason" required>
              <input id="a-why" className={inputClass} value={reason} placeholder={ask.kind === "overtime" ? "e.g. Client deadline" : "e.g. Doctor's appointment"} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </>
        )}
        <ErrorNote error={send.error} />
      </div>
    </Dialog>
  );
}
