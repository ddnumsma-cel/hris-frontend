import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { approvalPath } from "@/lib/admin/api";
import { cancelRequest, decideRequest, fileLeave, fmtCredits, fmtDays, isoToday, listTypes, people, previewRequest, type FileInput, type RequestRow } from "@/lib/leave/api";
import { inputClass, useActor } from "../corehr/format";
import { Detail, ErrorNote, Field, Pill } from "../corehr/ui";
import { shortDate } from "../timekeeping/format";
import { dateRange, leaveKeys, num, STATUS, useLeaveRefresh } from "./format";

/** The File leave form: works out the days and the balance as you type. */
export function FileLeaveDialog({ onClose, employeeId = "" }: { onClose: () => void; employeeId?: string }) {
  const toast = useToast();
  const actor = useActor();
  const refresh = useLeaveRefresh();
  const typesQuery = useQuery({ queryKey: leaveKeys.types, queryFn: listTypes });
  const [staff] = useState(people);
  const today = isoToday();
  const [form, setForm] = useState<FileInput>({ employeeId, typeId: "vl", start: today, end: today, reason: "" });
  const [approveNow, setApproveNow] = useState(false);
  const [tried, setTried] = useState(false);
  const set = (patch: Partial<FileInput>) => setForm((f) => ({ ...f, ...patch }));
  const single = form.start === form.end;
  const preview = previewRequest({ ...form, halfDay: single ? form.halfDay : undefined });
  const file = useMutation({
    mutationFn: () => fileLeave({ ...form, halfDay: single ? form.halfDay : undefined }, actor, approveNow),
    onSuccess: () => {
      refresh();
      toast.show(approveNow ? "Leave filed and approved." : "Leave filed. It's now waiting for approval.");
      onClose();
    },
  });
  const after = preview.credits ? preview.credits.available - 1 : null;
  const types = (typesQuery.data ?? []).filter((t) => t.active);

  return (
    <Dialog
      open
      onClose={onClose}
      title="File leave"
      dismissOnBackdrop={false}
      footer={
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={approveNow} onChange={(e) => setApproveNow(e.target.checked)} />
            Already approved by their manager
          </label>
          <span className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={file.isPending}
              onClick={() => {
                setTried(true);
                if (!preview.errors.length && form.reason.trim()) file.mutate();
              }}
            >
              {approveNow ? "File and approve" : "Send for approval"}
            </Button>
          </span>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field id="fl-emp" label="Employee" required className="col-span-2">
          <select id="fl-emp" className={inputClass} value={form.employeeId} onChange={(e) => set({ employeeId: e.target.value })}>
            <option value="">Choose an employee</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.departmentName}
              </option>
            ))}
          </select>
        </Field>
        <Field id="fl-type" label="Leave type" required className="col-span-2">
          <select id="fl-type" className={inputClass} value={form.typeId} onChange={(e) => set({ typeId: e.target.value })}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="fl-start" label="Start date" required>
          <input id="fl-start" type="date" className={inputClass} value={form.start} onChange={(e) => set({ start: e.target.value, end: form.end < e.target.value ? e.target.value : form.end })} />
        </Field>
        <Field id="fl-end" label="End date" required>
          <input id="fl-end" type="date" className={inputClass} min={form.start} value={form.end} onChange={(e) => set({ end: e.target.value })} />
        </Field>
        {single && (
          <div className="col-span-2 flex gap-1.5 text-sm" role="radiogroup" aria-label="How long">
            {(
              [
                [undefined, "Whole day"],
                ["am", "Morning only"],
                ["pm", "Afternoon only"],
              ] as const
            ).map(([v, label]) => (
              <button key={label} type="button" role="radio" aria-checked={form.halfDay === v} onClick={() => set({ halfDay: v })} className={clsx("h-8 rounded-full border px-3 font-medium", form.halfDay === v ? "border-ink bg-ink text-bg" : "border-border text-ink-2 hover:border-ink-3")}>
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="col-span-2 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-3 text-sm">
          <div>
            <div className="text-xs text-ink-2">Duration</div>
            <div className="font-semibold">{fmtDays(preview.days)}</div>
          </div>
          <div>
            <div className="text-xs text-ink-2">Available now</div>
            <div className="font-semibold">{preview.credits ? fmtCredits(preview.credits.available) : preview.balance?.unlimited ? "Unpaid" : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-ink-2">Left after this</div>
            <div className={clsx("font-semibold", after !== null && after < 0 && "text-critical")}>{after === null ? (preview.balance?.unlimited ? "Unpaid" : "—") : fmtCredits(after)}</div>
          </div>
          {(preview.notes.length > 0 || (tried && preview.errors.length > 0)) && (
            <ul className="col-span-3 flex flex-col gap-0.5 border-t border-border pt-2 text-xs">
              {tried && preview.errors.map((e) => <li key={e} className="text-critical">{e}</li>)}
              {preview.notes.map((n) => <li key={n} className="text-ink-2">{n}</li>)}
            </ul>
          )}
        </div>

        <Field id="fl-why" label="Reason" required className="col-span-2" error={tried && !form.reason.trim() ? "Give a short reason" : undefined}>
          <input id="fl-why" className={inputClass} value={form.reason} placeholder="e.g. Family trip" onChange={(e) => set({ reason: e.target.value })} />
        </Field>
        <Field id="fl-file" label="Supporting document" className="col-span-2" hint="Medical certificate, death certificate, Solo Parent ID and the like.">
          <input id="fl-file" type="file" className="block w-full text-sm text-ink-2 file:mr-3 file:h-8 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:text-sm file:font-medium" onChange={(e) => set({ attachment: e.target.files?.[0]?.name })} />
        </Field>
        <div className="col-span-2">
          <ErrorNote error={file.error} />
        </div>
      </div>
    </Dialog>
  );
}

/** Everything about one request, with Approve / Reject or Cancel. */
export function RequestDialog({ r, onClose, startWith }: { r: RequestRow; onClose: () => void; startWith?: "reject" }) {
  const toast = useToast();
  const actor = useActor();
  const refresh = useLeaveRefresh();
  const [mode, setMode] = useState<"view" | "reject" | "cancel">(startWith ?? "view");
  const [note, setNote] = useState("");
  const done = (msg: string) => {
    refresh();
    toast.show(msg);
    onClose();
  };
  const decide = useMutation({ mutationFn: (approve: boolean) => decideRequest(r.id, approve, note, actor), onSuccess: (x) => done(x.status === "approved" ? `Approved ${r.person.name}'s leave.` : "Rejected.") });
  const cancel = useMutation({ mutationFn: () => cancelRequest(r.id, note, actor), onSuccess: () => done("Leave cancelled. The days are back in their balance.") });
  const canCancel = r.status === "approved" && r.start > isoToday();
  const busy = decide.isPending || cancel.isPending;

  const footer =
    mode === "view" ? (
      <div className="flex justify-end gap-2">
        {canCancel && (
          <Button variant="ghost" onClick={() => setMode("cancel")}>
            Cancel this leave
          </Button>
        )}
        {r.status === "pending" ? (
          <>
            <Button variant="ghost" onClick={() => setMode("reject")}>
              Reject
            </Button>
            <Button disabled={busy} onClick={() => decide.mutate(true)}>
              Approve
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    ) : (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => (startWith ? onClose() : setMode("view"))}>
          Back
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => (mode === "reject" ? decide.mutate(false) : cancel.mutate())}>
          {mode === "reject" ? "Reject" : "Cancel leave"}
        </Button>
      </div>
    );

  return (
    <Dialog open onClose={onClose} title={mode === "reject" ? `Reject ${r.person.name}'s leave?` : mode === "cancel" ? `Cancel ${r.person.name}'s leave?` : `${r.type.name}: ${r.person.name}`} footer={footer}>
      {mode === "view" ? (
        <div className="grid grid-cols-2 gap-x-6">
          <Detail label="Status">
            <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
          </Detail>
          <Detail label="Dates">
            {dateRange(r.start, r.end)}
            {r.halfDay && ` (${r.halfDay === "am" ? "morning" : "afternoon"})`}
          </Detail>
          <Detail label="Days">{num(r.days)}</Detail>
          <Detail label="Department">{r.person.departmentName || "—"}</Detail>
          <Detail label="Reason" wide>
            {r.type.confidential ? "Confidential. Only HR can see the details." : r.reason}
          </Detail>
          <Detail label="Supporting document">{r.attachment ?? "None"}</Detail>
          <Detail label="Filed">
            {shortDate(r.filedAt)} by {r.filedBy}
          </Detail>
          {r.decidedBy && (
            <Detail label={r.status === "cancelled" ? "Cancelled" : "Decided"}>
              {shortDate(r.decidedAt!)} by {r.decidedBy}
            </Detail>
          )}
          {r.note && <Detail label="Note">{r.note}</Detail>}
          <Detail label="Approval steps" wide>
            {approvalPath("leave", r.employeeId, r.days)
              .map((p) => `${p.step}: ${p.who}`)
              .join(" → ") || "HR"}
          </Detail>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-2">
            {r.type.name}, {dateRange(r.start, r.end)} ({fmtDays(r.days)}).{mode === "cancel" && " The days go back to their balance."}
          </p>
          <Field id="rq-note" label="Reason" required hint="The employee will see this.">
            <textarea id="rq-note" autoFocus rows={3} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      )}
      <ErrorNote error={decide.error ?? cancel.error} />
    </Dialog>
  );
}
