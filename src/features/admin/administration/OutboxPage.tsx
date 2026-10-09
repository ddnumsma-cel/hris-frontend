import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { clearOutbox, listOutbox, type OutboxMessage } from "@/lib/outbox";
import { LoadError, Pill } from "../corehr/ui";
import { Choice, Name, SearchBox, SimpleTable, Toolbar } from "../timekeeping/common";

const when = (iso: string) => new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Administration › Outbox: the emails and texts waiting for the mail and SMS service. */
export function OutboxPage() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["outbox"], queryFn: listOutbox, staleTime: 0 });
  const [channel, setChannel] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<OutboxMessage | null>(null);
  if (list.isError) return <LoadError onRetry={() => list.refetch()} />;
  const q = query.trim().toLowerCase();
  const rows = (list.data ?? []).filter((m) => (channel === "all" || m.channel === channel) && (!q || `${m.to} ${m.subject} ${m.body}`.toLowerCase().includes(q)));

  return (
    <>
      <ContentHead
        title="Email & text outbox"
        subtitle="Messages the system sends: leave requests and decisions, work from home, payslips, new policies and separations. They wait here until the mail and SMS service is connected on the server."
        actions={
          list.data?.length ? (
            <Button variant="ghost" onClick={() => window.confirm("Clear every waiting message?") && (clearOutbox(), queryClient.invalidateQueries({ queryKey: ["outbox"] }))}>
              Clear
            </Button>
          ) : undefined
        }
      />
      <Toolbar>
        <Choice
          label="Channel"
          value={channel}
          onChange={setChannel}
          options={[
            { value: "all", label: "Email and text" },
            { value: "email", label: "Email" },
            { value: "sms", label: "Text (SMS)" },
          ]}
        />
        <SearchBox value={query} onChange={setQuery} placeholder="Search recipient or message" />
      </Toolbar>
      <SimpleTable<OutboxMessage>
        rows={rows}
        rowKey={(m) => m.id}
        loading={list.isLoading}
        empty="Nothing waiting. Messages appear here when someone files leave, a payslip is released, and so on."
        cols={[
          { header: "To", cell: (m) => <Name name={m.to} sub={m.address} /> },
          { header: "Message", cell: (m) => <Name name={m.subject} sub={m.body.length > 90 ? `${m.body.slice(0, 90)}…` : m.body} /> },
          { header: "Channel", cell: (m) => <Pill tone={m.channel === "email" ? "info" : "neutral"}>{m.channel === "email" ? "Email" : "Text"}</Pill> },
          { header: "Queued", cell: (m) => <span className="text-ink-2">{when(m.at)}</span> },
          {
            header: "",
            align: "right",
            cell: (m) => (
              <Button size="sm" variant="ghost" onClick={() => setOpen(m)}>
                View
              </Button>
            ),
          },
        ]}
      />
      {open && (
        <div role="dialog" aria-label={open.subject} className="overlay-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div className="glass-surface w-full max-w-lg rounded-[var(--radius-modal)] p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs text-ink-2">
              {open.channel === "email" ? "Email" : "Text"} to {open.to} · {open.address}
            </p>
            <h2 className="mt-1 text-base font-semibold">{open.subject}</h2>
            <p className="mt-3 text-sm whitespace-pre-line">{open.body}</p>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
