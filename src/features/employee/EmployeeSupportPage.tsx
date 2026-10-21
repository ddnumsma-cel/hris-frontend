import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { PlusIcon } from "@/components/icons";
import { fmtDay } from "@/lib/preferences";
import { useCreateParam } from "@/lib/useCreateParam";
import { CATEGORIES, STATUS_LABEL, closeTicket, fileTicket, listTickets, replyTicket, type Ticket, type TicketCategory } from "@/lib/support/store";
import { KEY, panel, statusTone, when } from "../admin/administration/SupportPage";
import { inputClass } from "../admin/corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../admin/corehr/ui";

/** Employee › IT support: a chat with IT about problems on their own side. Conversations on the left, the thread and a reply box on the right. Only the employee and IT (System Admin) see them. */
export function EmployeeSupportPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: KEY, queryFn: listTickets, staleTime: 0 });
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  useCreateParam("ticket", () => setSelectedId("new"));
  if (list.isError) return <LoadError onRetry={() => list.refetch()} />;

  const all = list.data ?? [];
  const current = selectedId === "new" ? null : (all.find((t) => t.id === selectedId) ?? all[0] ?? null);
  const composing = selectedId === "new" || (!list.isLoading && all.length === 0);
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

  return (
    <>
      <ContentHead title="IT support" subtitle="Message IT about a problem on your side. Only you and IT see these conversations." />
      {list.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid items-stretch gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className={clsx(panel, "flex flex-col p-2")} aria-label="Conversations">
            <Button className="m-2" icon={<PlusIcon className="h-4 w-4" />} onClick={() => setSelectedId("new")}>
              New message to IT
            </Button>
            <ul className="flex flex-col">
              {all.map((t) => {
                const last = t.messages[t.messages.length - 1];
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={clsx("flex w-full flex-col gap-1 rounded-[var(--radius-control)] px-3 py-3 text-left transition-colors", !composing && current?.id === t.id ? "bg-surface-2" : "hover:bg-[var(--nav-hover-bg)]")}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{t.subject}</span>
                        <span className="shrink-0 text-xs text-ink-3">{fmtDay(t.updatedAt.slice(0, 10))}</span>
                      </span>
                      <span className="truncate text-xs text-ink-2">
                        {last?.side === "support" ? "IT: " : "You: "}
                        {last?.text}
                      </span>
                      <span>
                        <Pill tone={statusTone[t.status]}>{STATUS_LABEL[t.status]}</Pill>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
          {composing ? (
            <Compose
              onCancel={all.length ? () => setSelectedId(null) : undefined}
              onSent={(t) => {
                refresh();
                setSelectedId(t.id);
                toast.show(`Sent to IT as ticket #${t.number}.`);
              }}
            />
          ) : current ? (
            <Thread key={current.id} t={current} onChange={refresh} />
          ) : null}
        </div>
      )}
    </>
  );
}

function Compose({ onSent, onCancel }: { onSent: (t: Ticket) => void; onCancel?: () => void }) {
  const [form, setForm] = useState({ subject: "", category: "Bug or error" as TicketCategory, text: "" });
  const send = useMutation({ mutationFn: () => fileTicket({ ...form, priority: "normal" }), onSuccess: onSent });
  return (
    <section className={clsx(panel, "flex flex-col gap-4 p-5")} aria-labelledby="compose-title">
      <div>
        <h2 id="compose-title" className="text-[15px] font-semibold">
          New message to IT
        </h2>
        <p className="mt-1 text-sm text-ink-2">Say what you were doing and what went wrong. IT replies in this conversation.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <Field id="c-subject" label="Short title" required>
          <input id="c-subject" className={inputClass} value={form.subject} placeholder="e.g. Clock in button does nothing" onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </Field>
        <Field id="c-cat" label="What it's about">
          <select id="c-cat" className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as TicketCategory })}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field id="c-text" label="Message" required>
        <textarea id="c-text" rows={6} className={inputClass} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
      </Field>
      <ErrorNote error={send.error} />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button loading={send.isPending} succeeded={send.isSuccess} disabled={send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? "Sending…" : "Send to IT"}
        </Button>
      </div>
    </section>
  );
}

function Thread({ t, onChange }: { t: Ticket; onChange: () => void }) {
  const toast = useToast();
  const [reply, setReply] = useState("");
  const send = useMutation({ mutationFn: () => replyTicket(t.id, reply), onSuccess: () => (setReply(""), onChange()), onError: (e) => toast.show(e.message, "critical") });
  const close = useMutation({ mutationFn: () => closeTicket(t.id), onSuccess: () => (onChange(), toast.show("Ticket closed.")) });
  return (
    <section className={clsx(panel, "flex min-h-[28rem] min-w-0 flex-col")} aria-labelledby="thread-title">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div className="min-w-0">
          <h2 id="thread-title" className="truncate text-[15px] font-semibold">
            {t.subject}
          </h2>
          <div className="mt-1 text-xs text-ink-3">
            #{t.number} · {t.category}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={statusTone[t.status]}>{STATUS_LABEL[t.status]}</Pill>
          {t.status !== "closed" && (
            <Button loading={close.isPending} succeeded={close.isSuccess} size="sm" variant="ghost" disabled={close.isPending} onClick={() => close.mutate()}>
              Close ticket
            </Button>
          )}
        </div>
      </header>
      <ol className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
        {t.messages.map((m) => {
          const it = m.side === "support";
          return (
            <li key={m.id} className={clsx("flex max-w-[85%] items-end gap-2", it ? "self-start" : "flex-row-reverse self-end")}>
              {it && (
                <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-tint text-xs font-semibold text-brand">
                  IT
                </span>
              )}
              <div className={clsx("rounded-[var(--radius-card)] px-4 py-3 text-sm", it ? "bg-surface-2" : "bg-brand-tint")}>
                <p className="whitespace-pre-line">{m.text}</p>
                <div className="mt-1 text-xs text-ink-2">
                  {it ? m.by : "You"} · {when(m.at)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {t.status !== "closed" && (
        <div className="flex items-end gap-2 border-t border-[var(--line)] p-4">
          <label htmlFor="c-reply" className="sr-only">
            Reply to IT
          </label>
          <textarea id="c-reply" rows={2} className={clsx(inputClass, "flex-1")} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
          <Button loading={send.isPending} succeeded={send.isSuccess} disabled={!reply.trim() || send.isPending} onClick={() => send.mutate()}>
            Send
          </Button>
        </div>
      )}
    </section>
  );
}
