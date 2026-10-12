import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { BellIcon } from "@/components/icons";
import { listDocumentReminders, sendDocumentReminders, type DocumentReminder } from "@/lib/corehr/api";
import { fmtDay } from "@/lib/preferences";
import { keys, useActor } from "../format";
import { ErrorNote } from "../ui";

const remindersKey = [...keys.documents, "reminders"];
const today = () => new Date().toISOString().slice(0, 10);

function owedText(r: DocumentReminder) {
  return [r.missing.length && `${r.missing.length} missing`, r.expired.length && `${r.expired.length} expired`, r.expiring.length && `${r.expiring.length} expiring`].filter(Boolean).join(" · ");
}

/** "Notify employees" in the 201 documents toolbar. */
export function NotifyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" icon={<BellIcon className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Notify employees
      </Button>
      {open && <NotifyDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Reminds employees what they still owe for their 201 file (missing, expired or expiring
 * documents) by email, text and their notifications bell. Everyone is ticked except people
 * already reminded today.
 */
function NotifyDialog({ onClose }: { onClose: () => void }) {
  const actor = useActor();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: remindersKey, queryFn: listDocumentReminders, staleTime: 0 });
  const rows = query.data ?? [];
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const chosen = picked ?? new Set(rows.filter((r) => r.lastReminded?.slice(0, 10) !== today()).map((r) => r.employeeId));
  const [note, setNote] = useState("");
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const allOn = rows.length > 0 && chosen.size === rows.length;

  const send = useMutation({
    mutationFn: () => sendDocumentReminders([...chosen], note, actor),
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      toast.show(`Reminder sent to ${n} employee${n === 1 ? "" : "s"}.`);
      onClose();
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Notify employees"
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-3">By email and text, and in their notifications.</span>
          <span className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button icon={<BellIcon className="h-4 w-4" />} disabled={!chosen.size || send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? "Sending…" : `Send to ${chosen.size}`}
            </Button>
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-2">Remind people which 201 documents they still need to hand in or renew. Each reminder lists their own documents. Documents waiting for HR to check aren't included.</p>
        {query.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-2">No one owes documents right now.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <label className="flex h-10 cursor-pointer items-center gap-3 border-b border-border bg-surface-2 px-4 text-xs font-semibold text-ink-2">
              <input type="checkbox" checked={allOn} onChange={() => setPicked(allOn ? new Set() : new Set(rows.map((r) => r.employeeId)))} />
              {chosen.size} of {rows.length} selected
            </label>
            <ul className="max-h-72 divide-y divide-[var(--line)] overflow-y-auto">
              {rows.map((r) => {
                const remindedToday = r.lastReminded?.slice(0, 10) === today();
                return (
                  <li key={r.employeeId}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-[var(--nav-hover-bg)]">
                      <input type="checkbox" checked={chosen.has(r.employeeId)} onChange={() => toggle(r.employeeId)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.name}</span>
                        <span className="block truncate text-xs text-ink-3">{r.departmentName}</span>
                      </span>
                      <span className="flex flex-none flex-col items-end gap-1 text-xs">
                        <span className={clsx("font-medium", r.expired.length ? "text-critical" : r.missing.length ? "text-ink-2" : "text-warning")}>{owedText(r)}</span>
                        {r.lastReminded && <span className={remindedToday ? "text-warning" : "text-ink-3"}>{remindedToday ? "Reminded today" : `Last reminded ${fmtDay(r.lastReminded.slice(0, 10))}`}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="notify-note" className="text-xs font-medium text-ink">
            Add a message (optional)
          </label>
          <textarea id="notify-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please submit these by Friday so we can finish the audit." className="field w-full px-3 py-2 text-sm" />
        </div>
        <ErrorNote error={send.error} />
      </div>
    </Dialog>
  );
}
