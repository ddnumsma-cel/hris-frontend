// The client's subscription: plan, seats, renewal and payments. System Admins (our team) change
// it; the client's Super Admin sees it. Data: lib/admin/subscription.ts.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { formatPHP } from "@/lib/format";
import { fmtDay } from "@/lib/preferences";
import { useCan } from "@/lib/useCan";
import { PLANS, SUB_STATUSES, getSubscription, recordPayment, updateSubscription, type Cycle, type Plan, type SubStatus, type Subscription } from "@/lib/admin/subscription";
import { inputClass } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";

const KEY = ["admin", "subscription"] as const;
const panel = "rounded-[var(--radius-card)] border border-[var(--card-border)] bg-surface";
const statusTone: Record<SubStatus, "good" | "info" | "warn" | "crit" | "neutral"> = { Trial: "info", Active: "good", "Past due": "warn", Suspended: "crit", Cancelled: "neutral" };

function EditDialog({ sub, onClose }: { sub: Subscription; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ plan: sub.plan, status: sub.status, cycle: sub.cycle, seatLimit: String(sub.seatLimit), perSeat: String(sub.perSeat), renewsOn: sub.renewsOn, billingContact: sub.billingContact, billingEmail: sub.billingEmail, notes: sub.notes });
  const save = useMutation({
    mutationFn: () => updateSubscription({ ...form, seatLimit: Number(form.seatLimit), perSeat: Number(form.perSeat) }),
    onSuccess: () => (queryClient.invalidateQueries({ queryKey: KEY }), toast.show("Subscription saved."), onClose()),
  });
  const pickPlan = (plan: Plan) => setForm({ ...form, plan, perSeat: String(PLANS.find((p) => p.plan === plan)?.perSeat ?? form.perSeat) });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Change subscription"
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field id="s-plan" label="Plan">
          <select id="s-plan" className={inputClass} value={form.plan} onChange={(e) => pickPlan(e.target.value as Plan)}>
            {PLANS.map((p) => (
              <option key={p.plan} value={p.plan}>
                {p.plan} · {p.note}
              </option>
            ))}
          </select>
        </Field>
        <Field id="s-status" label="Status">
          <select id="s-status" className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SubStatus })}>
            {SUB_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field id="s-seats" label="Seat limit (0 = no limit)">
          <input id="s-seats" type="number" min={0} className={inputClass} value={form.seatLimit} onChange={(e) => setForm({ ...form, seatLimit: e.target.value })} />
        </Field>
        <Field id="s-price" label="Price per seat a month (₱)">
          <input id="s-price" type="number" min={0} className={inputClass} value={form.perSeat} onChange={(e) => setForm({ ...form, perSeat: e.target.value })} />
        </Field>
        <Field id="s-cycle" label="Billed">
          <select id="s-cycle" className={inputClass} value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value as Cycle })}>
            <option>Monthly</option>
            <option>Yearly</option>
          </select>
        </Field>
        <Field id="s-renew" label="Renews on">
          <input id="s-renew" type="date" className={inputClass} value={form.renewsOn} onChange={(e) => setForm({ ...form, renewsOn: e.target.value })} />
        </Field>
        <Field id="s-contact" label="Billing contact">
          <input id="s-contact" className={inputClass} value={form.billingContact} onChange={(e) => setForm({ ...form, billingContact: e.target.value })} />
        </Field>
        <Field id="s-email" label="Billing email">
          <input id="s-email" type="email" className={inputClass} value={form.billingEmail} onChange={(e) => setForm({ ...form, billingEmail: e.target.value })} />
        </Field>
        <Field id="s-notes" label="Internal notes" className="col-span-2">
          <textarea id="s-notes" rows={2} className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="col-span-2">
          <ErrorNote error={save.error} />
        </div>
      </div>
    </Dialog>
  );
}

function PaymentDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", reference: "", note: "" });
  const save = useMutation({
    mutationFn: () => recordPayment({ ...form, amount: Number(form.amount) }),
    onSuccess: () => (queryClient.invalidateQueries({ queryKey: KEY }), toast.show("Payment recorded."), onClose()),
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Record a payment"
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Record payment
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field id="p-date" label="Paid on">
          <input id="p-date" type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field id="p-amt" label="Amount (₱)" required>
          <input id="p-amt" type="number" min={0} className={inputClass} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field id="p-ref" label="Receipt or reference no." required className="col-span-2">
          <input id="p-ref" className={inputClass} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </Field>
        <Field id="p-note" label="Note" className="col-span-2">
          <input id="p-note" className={inputClass} value={form.note} placeholder="e.g. Year 2, 60 seats" onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
        <div className="col-span-2">
          <ErrorNote error={save.error} />
        </div>
      </div>
    </Dialog>
  );
}

export function SubscriptionPage() {
  const canEdit = useCan("edit", "subscription");
  const sub = useQuery({ queryKey: KEY, queryFn: getSubscription, staleTime: 0 });
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  if (sub.isError) return <LoadError onRetry={() => sub.refetch()} />;
  const s = sub.data;
  const pct = s && s.seatLimit ? Math.min(100, Math.round((s.seatsUsed / s.seatLimit) * 100)) : 0;
  const amount = s ? s.perSeat * (s.seatLimit || s.seatsUsed) * (s.cycle === "Yearly" ? 12 : 1) : 0;

  return (
    <>
      <ContentHead
        title="Subscription & seats"
        subtitle={canEdit ? "The client's plan, seats and billing. Accounts can't be added past the seat limit or while the subscription is suspended." : "Your plan and how many accounts it covers. To change it, file a support ticket."}
        actions={
          canEdit && s ? (
            <>
              <Button variant="ghost" onClick={() => setPaying(true)}>
                Record payment
              </Button>
              <Button onClick={() => setEditing(true)}>Change subscription</Button>
            </>
          ) : undefined
        }
      />
      {!s ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={clsx(panel, "p-4")}>
              <div className="text-xs font-semibold text-ink-2">Plan</div>
              <div className="mt-1 flex items-center gap-2 text-xl font-semibold">
                {s.plan} <Pill tone={statusTone[s.status]}>{s.status}</Pill>
              </div>
              <div className="mt-1 text-xs text-ink-2">{PLANS.find((p) => p.plan === s.plan)?.note}</div>
            </div>
            <div className={clsx(panel, "p-4")}>
              <div className="text-xs font-semibold text-ink-2">Seats used</div>
              <div className="mt-1 text-xl font-semibold">
                {s.seatsUsed}
                <span className="text-sm font-medium text-ink-3"> / {s.seatLimit || "no limit"}</span>
              </div>
              {s.seatLimit > 0 && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className={clsx("h-full rounded-full", pct >= 90 ? "bg-critical" : pct >= 75 ? "bg-warning" : "bg-good")} style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
            <div className={clsx(panel, "p-4")}>
              <div className="text-xs font-semibold text-ink-2">Renews on</div>
              <div className="mt-1 text-xl font-semibold">{fmtDay(s.renewsOn)}</div>
              <div className="mt-1 text-xs text-ink-2">Billed {s.cycle.toLowerCase()}</div>
            </div>
            <div className={clsx(panel, "p-4")}>
              <div className="text-xs font-semibold text-ink-2">Each {s.cycle === "Yearly" ? "year" : "month"}</div>
              <div className="mt-1 text-xl font-semibold">{formatPHP(amount)}</div>
              <div className="mt-1 text-xs text-ink-2">{formatPHP(s.perSeat)} per seat a month</div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <section className={clsx(panel, "flex flex-col gap-3 p-5")}>
              <h2 className="text-sm font-semibold">Client</h2>
              <dl className="flex flex-col gap-2 text-sm">
                {[
                  ["Company", s.client],
                  ["Customer since", fmtDay(s.startedOn)],
                  ["Billing contact", s.billingContact],
                  ["Billing email", s.billingEmail],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-ink-2">{k}</dt>
                    <dd className="text-right font-medium">{v || "—"}</dd>
                  </div>
                ))}
              </dl>
              {canEdit && s.notes && <p className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-xs text-ink-2">{s.notes}</p>}
            </section>
            <section className={clsx(panel, "overflow-x-auto")}>
              <h2 className="px-5 pt-5 pb-3 text-sm font-semibold">Payments</h2>
              {s.payments.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-ink-2">No payments recorded yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-5 py-2 text-left">Date</th>
                      <th className="px-5 py-2 text-left">Reference</th>
                      <th className="px-5 py-2 text-left">Note</th>
                      <th className="px-5 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.payments.map((p) => (
                      <tr key={p.id} className="border-t border-[var(--line)]">
                        <td className="px-5 py-3 whitespace-nowrap">{fmtDay(p.date)}</td>
                        <td className="px-5 py-3">{p.reference}</td>
                        <td className="px-5 py-3 text-ink-2">{p.note || "—"}</td>
                        <td className="px-5 py-3 text-right font-medium">{formatPHP(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </>
      )}
      {editing && s && <EditDialog sub={s} onClose={() => setEditing(false)} />}
      {paying && <PaymentDialog onClose={() => setPaying(false)} />}
    </>
  );
}
