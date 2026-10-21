import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { PlusIcon } from "@/components/icons";
import { useCan } from "@/lib/useCan";
import { fmtDay, fmtTime } from "@/lib/preferences";
import { useCreateParam } from "@/lib/useCreateParam";
import {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  STATUS_LABEL,
  closeTicket,
  fileTicket,
  listTickets,
  replyTicket,
  updateTicket,
  type Ticket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/support/store";
import { inputClass } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";

export const KEY = ["support", "tickets"] as const;
export const panel = "rounded-[var(--radius-card)] border border-[var(--card-border)] bg-surface";
export const statusTone: Record<TicketStatus, "warn" | "info" | "neutral" | "good" | "crit"> = { open: "warn", in_progress: "info", waiting: "crit", resolved: "good", closed: "neutral" };
const priorityTone: Record<TicketPriority, "neutral" | "info" | "warn" | "crit"> = { low: "neutral", normal: "info", high: "warn", urgent: "crit" };
const nice = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const when = (iso: string) => `${fmtDay(iso.slice(0, 10))} · ${fmtTime(iso)}`;

function NewTicketDialog({ onClose, onFiled }: { onClose: () => void; onFiled: (t: Ticket) => void }) {
  const [form, setForm] = useState({ subject: "", category: "Bug or error" as TicketCategory, priority: "normal" as TicketPriority, text: "" });
  const file = useMutation({ mutationFn: () => fileTicket(form), onSuccess: onFiled });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Report a problem"
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={file.isPending} succeeded={file.isSuccess} disabled={file.isPending} onClick={() => file.mutate()}>
            {file.isPending ? "Sending…" : "Send to support"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">Our support team reads every ticket and replies here. You'll see their answer in this page.</p>
        <Field id="t-subject" label="Short title" required>
          <input id="t-subject" className={inputClass} value={form.subject} placeholder="e.g. Can't print payslips" onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="t-cat" label="What it's about">
            <select id="t-cat" className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as TicketCategory })}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field id="t-pri" label="How urgent">
            <select id="t-pri" className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {nice(p)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="t-text" label="What happened" required>
          <textarea id="t-text" rows={5} className={inputClass} value={form.text} placeholder="What were you doing, what did you expect, and what happened instead?" onChange={(e) => setForm({ ...form, text: e.target.value })} />
        </Field>
        <ErrorNote error={file.error} />
      </div>
    </Dialog>
  );
}

function TicketDetail({ t, support }: { t: Ticket; support: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  const send = useMutation({ mutationFn: () => replyTicket(t.id, reply), onSuccess: () => (setReply(""), refresh()), onError: (e) => toast.show(e.message, "critical") });
  const change = useMutation({ mutationFn: (p: Parameters<typeof updateTicket>[1]) => updateTicket(t.id, p), onSuccess: refresh, onError: (e) => toast.show(e.message, "critical") });
  const close = useMutation({ mutationFn: () => closeTicket(t.id), onSuccess: () => (refresh(), toast.show("Ticket closed.")) });
  return (
    <section className={clsx(panel, "flex min-w-0 flex-col")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] p-5">
        <div className="min-w-0">
          <div className="text-xs text-ink-3">
            #{t.number} · {t.category} · filed by {t.filedBy} on {fmtDay(t.createdAt.slice(0, 10))}
          </div>
          <h2 className="mt-1 text-[15px] font-semibold">{t.subject}</h2>
          {t.page && <div className="mt-1 text-xs text-ink-3">Page: {t.page}</div>}
        </div>
        {support ? (
          <div className="flex flex-wrap gap-2">
            <select aria-label="Status" className="chip-filter h-9 px-3 text-sm" value={t.status} onChange={(e) => change.mutate({ status: e.target.value as TicketStatus })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select aria-label="Priority" className="chip-filter h-9 px-3 text-sm" value={t.priority} onChange={(e) => change.mutate({ priority: e.target.value as TicketPriority })}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {nice(p)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Pill tone={statusTone[t.status]}>{STATUS_LABEL[t.status]}</Pill>
            {t.status !== "closed" && (
              <Button loading={close.isPending} succeeded={close.isSuccess} size="sm" variant="ghost" disabled={close.isPending} onClick={() => close.mutate()}>
                Close ticket
              </Button>
            )}
          </div>
        )}
      </div>
      <ol className="flex flex-col gap-3 p-5">
        {t.messages.map((m) => (
          <li key={m.id} className={clsx("max-w-[85%] rounded-[var(--radius-card)] px-4 py-3 text-sm", m.side === "support" ? "self-start bg-surface-2" : "self-end border border-border")}>
            <div className="mb-1 text-xs text-ink-2">
              <span className="font-semibold text-ink">{m.by}</span> · {when(m.at)}
            </div>
            <p className="whitespace-pre-line">{m.text}</p>
          </li>
        ))}
      </ol>
      {t.status !== "closed" && (
        <div className="mt-auto flex flex-col gap-2 border-t border-[var(--line)] p-5">
          <label htmlFor="t-reply" className="text-xs font-medium">
            {support ? "Reply to the client" : "Add a reply"}
          </label>
          <textarea id="t-reply" rows={3} className={inputClass} value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="flex justify-end gap-2">
            {support && (
              <Button loading={send.isPending} succeeded={send.isSuccess} variant="ghost" disabled={!reply.trim() || send.isPending} onClick={() => send.mutate(undefined, { onSuccess: () => change.mutate({ status: "waiting" }) })}>
                Reply and wait for client
              </Button>
            )}
            <Button loading={send.isPending} succeeded={send.isSuccess} disabled={!reply.trim() || send.isPending} onClick={() => send.mutate()}>
              Send reply
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Support tickets. Clients (Super Admin, HR, Accounting) report problems; our System Admins see
 * every ticket, reply, and set status and priority.
 */
export function SupportPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const support = useCan("edit", "support");
  const canFile = useCan("create", "support");
  const list = useQuery({ queryKey: KEY, queryFn: listTickets, staleTime: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "all" | TicketStatus>("active");
  const [filing, setFiling] = useState(false);
  useCreateParam("ticket", () => setFiling(true));
  if (list.isError) return <LoadError onRetry={() => list.refetch()} />;

  const all = list.data ?? [];
  const rows = all.filter((t) => (filter === "all" ? true : filter === "active" ? t.status !== "closed" && t.status !== "resolved" : t.status === filter));
  const sel = rows.find((t) => t.id === selectedId) ?? rows[0];
  const count = (s: TicketStatus) => all.filter((t) => t.status === s).length;

  return (
    <>
      <ContentHead
        title="Support tickets"
        actions={
          canFile && !support ? (
            <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setFiling(true)}>
              Report a problem
            </Button>
          ) : undefined
        }
      />
      {support && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(["open", "in_progress", "waiting", "resolved"] as TicketStatus[]).map((s) => (
            <div key={s} className={clsx(panel, "p-4")}>
              <div className="text-xs text-ink-2">{STATUS_LABEL[s] === "Waiting for you" ? "Waiting for client" : STATUS_LABEL[s]}</div>
              <div className="mt-1 text-2xl font-semibold">{count(s)}</div>
            </div>
          ))}
        </div>
      )}
      <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="chip-filter h-9 w-fit px-3 text-sm">
        <option value="active">Still open</option>
        <option value="all">All tickets</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {list.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <p className={clsx(panel, "p-8 text-center text-sm text-ink-2")}>{all.length === 0 ? "No tickets yet." : "No tickets here."}</p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <ul className={clsx(panel, "flex flex-col p-2")}>
            {rows.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setSelectedId(t.id)} className={clsx("flex w-full flex-col gap-1 rounded-[var(--radius-control)] px-3 py-3 text-left transition-colors", sel?.id === t.id ? "bg-surface-2" : "hover:bg-[var(--nav-hover-bg)]")}>
                  <span className="flex items-center justify-between gap-2 text-xs text-ink-3">
                    <span>
                      #{t.number} · {t.filedBy}
                    </span>
                    <span>{fmtDay(t.updatedAt.slice(0, 10))}</span>
                  </span>
                  <span className="truncate text-sm font-medium">{t.subject}</span>
                  <span className="flex gap-2">
                    <Pill tone={statusTone[t.status]}>{support && t.status === "waiting" ? "Waiting for client" : STATUS_LABEL[t.status]}</Pill>
                    <Pill tone={priorityTone[t.priority]}>{nice(t.priority)}</Pill>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {sel && <TicketDetail key={sel.id} t={sel} support={support} />}
        </div>
      )}
      {filing && (
        <NewTicketDialog
          onClose={() => setFiling(false)}
          onFiled={(t) => {
            setFiling(false);
            setFilter("active");
            setSelectedId(t.id);
            queryClient.invalidateQueries({ queryKey: KEY });
            toast.show(`Ticket #${t.number} sent. Support will reply here.`);
          }}
        />
      )}
    </>
  );
}
