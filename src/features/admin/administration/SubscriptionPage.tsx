// Clients & Subscriptions (System Admin only): every client's plan and usage, the actions our
// team takes (change plan, override the seat limit, grant a temporary extension), and a log of
// seat alerts, blocked adds and upgrade requests.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { fmtDay } from "@/lib/preferences";
import { changePlan, grantExtension, listClients, listPlans, listSubscriptionEvents, setSeatOverride, type Usage } from "@/lib/subscription/api";
import type { SeatStatus, SubscriptionEventKind } from "@/lib/subscription/store";
import { useCan } from "@/lib/useCan";
import { inputClass, useActor } from "../corehr/format";
import { ErrorNote, LoadError, Pill } from "../corehr/ui";
import { SimpleTable, type Col } from "../timekeeping/common";

const STATUS: Record<SeatStatus, { label: string; tone: "good" | "warn" | "crit" | "info" }> = {
  ok: { label: "OK", tone: "good" },
  near: { label: "Near limit", tone: "warn" },
  at: { label: "At limit", tone: "crit" },
  grace: { label: "In grace", tone: "info" },
  over: { label: "Over limit", tone: "crit" },
};

const KIND: Record<SubscriptionEventKind, { label: string; tone: "good" | "warn" | "crit" | "info" | "neutral" }> = {
  threshold: { label: "Seat alert", tone: "warn" },
  blocked: { label: "Blocked add", tone: "crit" },
  "upgrade-request": { label: "Upgrade request", tone: "info" },
  "plan-changed": { label: "Plan changed", tone: "neutral" },
  "seat-override": { label: "Seat override", tone: "neutral" },
  extension: { label: "Extension", tone: "neutral" },
};

const when = (iso: string) => new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const today = () => new Date().toISOString().slice(0, 10);

type Action = { kind: "plan" | "override" | "extension"; client: Usage };

const keys = { clients: ["subscription", "clients"], plans: ["subscription", "plans"], events: ["subscription", "events"] } as const;

export function SubscriptionPage() {
  const canEdit = useCan("edit", "clients");
  const clients = useQuery({ queryKey: keys.clients, queryFn: listClients });
  const events = useQuery({ queryKey: keys.events, queryFn: listSubscriptionEvents });
  const [action, setAction] = useState<Action | null>(null);

  if (clients.isError) return <LoadError onRetry={() => clients.refetch()} />;

  const cols: Col<Usage>[] = [
    {
      header: "Client",
      cell: (c) => (
        <span className="flex flex-col">
          <span className="font-medium">{c.clientName}</span>
          <span className="text-xs text-ink-3">Renews {fmtDay(c.renewalDate)}</span>
        </span>
      ),
    },
    { header: "Plan", cell: (c) => c.planName },
    {
      header: "Seats",
      cell: (c) => (
        <span className="flex flex-col">
          <span className="font-medium">
            {c.seatsUsed} / {c.seatLimit}
          </span>
          <span className="text-xs text-ink-3">
            {c.seatLimitOverride ? `Override ${c.seatLimitOverride}` : `${c.gracePercent}% grace → ${c.seatCap}`}
            {c.extension && c.extension.until >= today() ? ` · +${c.extension.seats} until ${fmtDay(c.extension.until)}` : ""}
          </span>
        </span>
      ),
    },
    {
      header: "Admin accounts",
      cell: (c) => (
        <span className={c.adminStatus === "ok" || c.adminStatus === "near" ? "" : "font-medium text-critical"}>
          {c.adminsUsed} / {c.adminLimit}
        </span>
      ),
    },
    { header: "Status", cell: (c) => <Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill> },
    ...(canEdit
      ? [
          {
            header: "Actions",
            align: "right" as const,
            cell: (c: Usage) => (
              <span className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setAction({ kind: "plan", client: c })}>
                  Change plan
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAction({ kind: "override", client: c })}>
                  Override seats
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAction({ kind: "extension", client: c })}>
                  Extension
                </Button>
              </span>
            ),
          },
        ]
      : []),
  ];

  type EventRow = NonNullable<typeof events.data>[number];
  const eventCols: Col<EventRow>[] = [
    { header: "When", cell: (e) => <span className="text-ink-2">{when(e.at)}</span> },
    { header: "Client", cell: (e) => <span className="font-medium">{e.clientName}</span> },
    { header: "Type", cell: (e) => <Pill tone={KIND[e.kind].tone}>{KIND[e.kind].label}</Pill> },
    { header: "What", cell: (e) => <span className="inline-block max-w-96 truncate align-bottom" title={e.message}>{e.message}</span> },
    { header: "Seats", cell: (e) => <span className="text-ink-2">{e.seats}</span> },
    { header: "By", cell: (e) => <span className="text-ink-2">{e.by || "System"}</span> },
  ];

  return (
    <>
      <ContentHead title="Clients & Subscriptions" subtitle="Each client's plan, seats and admin accounts. Seat limits only stop new employees being added; payroll, attendance and leave always keep working." />
      <SimpleTable rows={clients.data ?? []} rowKey={(c) => c.clientId} cols={cols} loading={clients.isLoading} empty="No clients yet." />
      <h2 className="text-sm font-semibold">Notifications & upgrade requests</h2>
      <SimpleTable rows={events.data ?? []} rowKey={(e) => e.id} cols={eventCols} loading={events.isLoading} empty="Nothing yet. Seat alerts, blocked adds and upgrade requests appear here." />
      {action?.kind === "plan" && <PlanDialog client={action.client} onClose={() => setAction(null)} />}
      {action?.kind === "override" && <OverrideDialog client={action.client} onClose={() => setAction(null)} />}
      {action?.kind === "extension" && <ExtensionDialog client={action.client} onClose={() => setAction(null)} />}
    </>
  );
}

/** Shared save handling for the three action dialogs. */
function useClientAction(fn: () => Promise<void>, done: string, onClose: () => void) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast.show(done);
      onClose();
    },
  });
}

function ActionDialog({ title, onClose, onSave, pending, error, children }: { title: string; onClose: () => void; onSave: () => void; pending: boolean; error: unknown; children: React.ReactNode }) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={onSave}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {children}
        <ErrorNote error={error} />
      </div>
    </Dialog>
  );
}

function PlanDialog({ client, onClose }: { client: Usage; onClose: () => void }) {
  const actor = useActor();
  const plans = useQuery({ queryKey: keys.plans, queryFn: listPlans });
  const [planId, setPlanId] = useState(client.planId);
  const save = useClientAction(() => changePlan(client.clientId, planId, actor), `${client.clientName} moved to a new plan.`, onClose);
  return (
    <ActionDialog title={`Change plan · ${client.clientName}`} onClose={onClose} onSave={() => save.mutate()} pending={save.isPending} error={save.error}>
      <label htmlFor="plan" className="text-xs font-medium text-ink">
        Plan
      </label>
      <select id="plan" value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputClass}>
        {(plans.data ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.employeeSeatLimit} seats · {p.adminAccountLimit} admin accounts · {p.gracePercent}% grace
          </option>
        ))}
      </select>
      <p className="text-xs text-ink-2">
        Using {client.seatsUsed} seats and {client.adminsUsed} admin accounts now.
      </p>
    </ActionDialog>
  );
}

function OverrideDialog({ client, onClose }: { client: Usage; onClose: () => void }) {
  const actor = useActor();
  const [value, setValue] = useState(client.seatLimitOverride ? String(client.seatLimitOverride) : "");
  const seats = value.trim() === "" ? null : Number(value);
  const save = useClientAction(() => setSeatOverride(client.clientId, seats, actor), seats === null ? "Seat override removed." : "Seat limit overridden.", onClose);
  return (
    <ActionDialog title={`Override seat limit · ${client.clientName}`} onClose={onClose} onSave={() => save.mutate()} pending={save.isPending} error={save.error}>
      <label htmlFor="override" className="text-xs font-medium text-ink">
        Employee seat limit
      </label>
      <input id="override" type="number" min={1} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Leave blank to use the plan's limit" className={inputClass} />
      <p className="text-xs text-ink-2">Replaces the {client.planName} plan's limit for this client only. Clear it to go back to the plan.</p>
    </ActionDialog>
  );
}

function ExtensionDialog({ client, onClose }: { client: Usage; onClose: () => void }) {
  const actor = useActor();
  const running = client.extension && client.extension.until >= today() ? client.extension : undefined;
  const [seats, setSeats] = useState(running ? String(running.seats) : "5");
  const [until, setUntil] = useState(running?.until ?? "");
  const [ending, setEnding] = useState(false);
  const save = useClientAction(() => grantExtension(client.clientId, ending ? null : { seats: Number(seats), until }, actor), ending ? "Extension ended." : "Extension granted.", onClose);
  return (
    <ActionDialog title={`Temporary extension · ${client.clientName}`} onClose={onClose} onSave={() => save.mutate()} pending={save.isPending} error={save.error}>
      <p className="text-xs text-ink-2">Extra seats on top of the limit until the end date, e.g. while an upgrade is being arranged.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="ext-seats" className="text-xs font-medium text-ink">
            Extra seats
          </label>
          <input id="ext-seats" type="number" min={1} inputMode="numeric" disabled={ending} value={seats} onChange={(e) => setSeats(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ext-until" className="text-xs font-medium text-ink">
            Until
          </label>
          <input id="ext-until" type="date" min={today()} disabled={ending} value={until} onChange={(e) => setUntil(e.target.value)} className={inputClass} />
        </div>
      </div>
      {running && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={ending} onChange={(e) => setEnding(e.target.checked)} />
          End the current extension now
        </label>
      )}
    </ActionDialog>
  );
}
