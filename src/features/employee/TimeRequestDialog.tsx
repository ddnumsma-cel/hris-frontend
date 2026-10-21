import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { fileMyTimeRequest } from "@/lib/ess/api";
import type { DayRow } from "@/lib/timekeeping/api";
import { inputClass } from "../admin/corehr/format";
import { ErrorNote, Field } from "../admin/corehr/ui";
import { duration, shortDate } from "../admin/timekeeping/format";
import { ApproverNote } from "./ApproverNote";

export type Ask = { kind: "overtime" | "undertime"; day?: DayRow };

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
  const [picked, setPicked] = useState<number | null>(null);
  const minutes = picked ?? max;
  const [reason, setReason] = useState("");
  const send = useMutation({
    mutationFn: () => fileMyTimeRequest({ date: day!.date, type: ask.kind, minutes, reason }),
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
          <Button loading={send.isPending} succeeded={send.isSuccess} disabled={!day || send.isPending} onClick={() => send.mutate()}>
            Send to approver
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <ApproverNote kind={ask.kind} />
        {choices && (
          choices.length ? (
            <Field id="a-day" label="Day">
              <select id="a-day" className={inputClass} value={day?.date ?? ""} onChange={(e) => (setDate(e.target.value), setPicked(null))}>
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
        {day && (
          <>
            <p className="text-sm text-ink-2">
              {shortDate(day.date)}: {ask.kind === "overtime" ? `you worked ${duration(max)} past your shift.` : `you left ${duration(max)} before your shift ended.`}{" "}
              {ask.kind === "overtime" ? "It's paid as overtime once your approver approves it." : "Approval excuses it; the time is still unpaid."}
            </p>
            {ask.kind === "overtime" && (
              <Field id="a-min" label="Minutes to claim" hint={`Up to ${max} minutes.`}>
                <input id="a-min" type="number" min={1} max={max} className={inputClass} value={minutes} onChange={(e) => setPicked(e.target.valueAsNumber)} />
              </Field>
            )}
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
