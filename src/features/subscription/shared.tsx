// Subscription pieces shared by the HR workspace: the usage query, the top-bar seat chip, the
// seat indicator, and the "Seat limit reached." and "Request upgrade" dialogs. Only Super Admins and
// HR see any of it (System Admins have Clients & Subscriptions instead).

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { AlertTriangleIcon, UsersIcon, XIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/AuthContext";
import { checkSeatAvailable, getSubscription, isSeatLimitError, requestUpgrade, type Usage } from "@/lib/subscription/api";
import { sessionAccountId, signInTime } from "@/lib/session";
import { useCan } from "@/lib/useCan";

export const subscriptionKey = ["subscription"] as const;

/** The company's plan and usage, for people who may see it (Super Admin, HR); null otherwise. */
export function useSubscription() {
  const canView = useCan("view", "subscription");
  const isPlatform = useCan("view", "clients");
  const enabled = canView && !isPlatform;
  const query = useQuery({ queryKey: subscriptionKey, queryFn: getSubscription, enabled, refetchInterval: 60_000 });
  return enabled ? query : null;
}

/**
 * Asks the API whether another employee fits before opening the add form. Resolves to null when
 * it does, or the refusal message (a refused attempt is logged and System Admins are told).
 */
export async function seatCheck(): Promise<string | null> {
  try {
    await checkSeatAvailable();
    return null;
  } catch (err) {
    if (isSeatLimitError(err)) return err.message;
    return null;
  }
}

/** Seats left before new adds are refused (limit plus grace). */
export const seatsLeft = (u: Usage) => Math.max(0, u.seatCap - u.seatsUsed);

/**
 * "17 / 20 seats" beside the People heading: a secondary-button-style control the same height as
 * Add employee, with a small meter that turns amber near the limit and red at it. Opens Settings ›
 * Subscription.
 */
export function SeatIndicator() {
  const query = useSubscription();
  const u = query?.data;
  if (!u) return null;
  const pct = Math.min(100, Math.round((u.seatsUsed / Math.max(1, u.seatLimit)) * 100));
  const bar = u.status === "ok" ? "bg-brand" : u.status === "near" ? "seat-bar" : "bg-critical";
  const icon = u.status === "ok" ? "text-ink-2" : u.status === "near" ? "seat-icon" : "text-critical";
  return (
    <Link
      to="/admin/settings/subscription"
      title={`${u.planName} plan · ${Math.max(0, u.seatLimit - u.seatsUsed)} seats left`}
      aria-label={`${u.seatsUsed} of ${u.seatLimit} employee seats used. Open subscription.`}
      className="btn btn-secondary inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium"
    >
      <UsersIcon aria-hidden="true" className={clsx("h-4 w-4 flex-none", icon)} />
      <span className="whitespace-nowrap">
        <span className="font-semibold text-ink">
          {u.seatsUsed} / {u.seatLimit}
        </span>{" "}
        <span className="text-ink-2">seats</span>
      </span>
      <span aria-hidden="true" className="h-1.5 w-12 flex-none overflow-hidden rounded-full bg-[var(--line-strong)]">
        <span className={clsx("block h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
      </span>
    </Link>
  );
}

/**
 * "17 / 20 seats" in the top bar from 80% of seats (Super Admin and HR), in place of a banner over
 * every page: a plain pill, "⚠ 17 / 20 seats". Opens a small panel with the details and Request upgrade
 * (Super Admin) or a link to the subscription.
 */
export function SeatChip() {
  const query = useSubscription();
  const canUpgrade = useCan("create", "subscriptionUpgrade");
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    chipRef.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const u = query?.data;
  if (!u || u.status === "ok") return null;
  const pct = Math.min(100, Math.round((u.seatsUsed / Math.max(1, u.seatLimit)) * 100));
  // Lead with the same numbers as the pill (17 of 20, so 3 left); the grace seats only come up once
  // the plan's own seats are used.
  const left = seatsLeft(u);
  const planLeft = Math.max(0, u.seatLimit - u.seatsUsed);
  const blocked = left === 0;
  // Red once every seat on the plan is used, orange before that.
  const full = planLeft === 0;
  const more = left === 1 ? "1 more employee" : `${left} more employees`;
  const heading = planLeft > 0 ? `${planLeft} ${planLeft === 1 ? "seat" : "seats"} left` : u.seatsUsed > u.seatLimit ? "Over your seat limit" : "No seats left";
  const detail =
    planLeft > 0
      ? `You've used ${u.seatsUsed} of your ${u.seatLimit} seats.`
      : blocked
        ? `You've used all ${u.seatLimit} seats. Upgrade your plan to add new employees.`
        : u.seatsUsed > u.seatLimit
          ? `You have ${u.seatsUsed} employees on a ${u.seatLimit}-seat plan. You can add ${more} for now, then adding stops.`
          : `You've used all ${u.seatLimit} seats. You can add ${more} for now, then adding stops.`;
  return (
    <div className="relative">
      <button
        ref={chipRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Employee seats: ${left} left, ${u.seatsUsed} of ${u.seatLimit} used`}
        data-full={full || undefined}
        onClick={() => setOpen((v) => !v)}
        className="seat-chip inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold whitespace-nowrap"
      >
        <AlertTriangleIcon aria-hidden="true" className="seat-icon h-4 w-4 flex-none" />
        {u.seatsUsed} / {u.seatLimit} seats
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close seat details" className="fixed inset-0 z-40 cursor-default" onClick={close} />
          <div role="dialog" aria-label="Employee seats" className="glass-surface panel-enter absolute right-0 top-full z-50 mt-2 flex w-80 flex-col rounded-[var(--radius-dropdown)]">
            <div className="border-b border-[var(--line)] px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-2">Employee seats</div>
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangleIcon aria-hidden="true" className={clsx("mt-0.5 h-5 w-5 flex-none", full ? "text-critical" : "seat-text")} />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className={clsx("text-xl leading-tight font-bold", full ? "text-critical" : "seat-text")}>{heading}</span>
                  <span className="text-xs leading-relaxed text-ink-2">{detail}</span>
                </div>
              </div>
              <span aria-hidden="true" className="seat-track h-1.5 overflow-hidden rounded-full">
                <span className={clsx("block h-full rounded-full", full ? "bg-critical" : "seat-bar")} style={{ width: `${pct}%` }} />
              </span>
              <p className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-2">
                When seats run out, you can't add new employees. Payroll, attendance and leave keep working.
              </p>
              {!canUpgrade && <p className="text-xs text-ink-2">Need more seats? Ask your Super Admin to upgrade the plan.</p>}
            </div>
            <div className="flex gap-2 border-t border-[var(--line)] px-4 py-3">
              <Link to="/admin/settings/subscription" onClick={() => setOpen(false)} className="inline-flex flex-1 items-center justify-center rounded-[var(--radius-control)] px-3 py-2 text-[13px] font-medium whitespace-nowrap text-ink transition-colors duration-150 hover:bg-[var(--nav-hover-bg)]">
                View plan
              </Link>
              {canUpgrade && (
                <button
                  type="button"
                  className="btn btn-strong flex-1 justify-center px-3 py-2 text-[13px] font-semibold whitespace-nowrap"
                  onClick={() => {
                    setOpen(false);
                    setAsking(true);
                  }}
                >
                  Request more seats
                </button>
              )}
            </div>
          </div>
        </>
      )}
      <RequestUpgradeDialog open={asking} onClose={() => setAsking(false)} />
    </div>
  );
}

/**
 * A small card in the bottom-right corner (above the assistant button) when seats are almost full,
 * in the quiet-strip style: warning icon, "17 of 20 seats used", what that means, a bar, one action
 * (Request more seats for Super Admins, View plan for HR) and a close button. Closing hides it until the next sign-in, or sooner
 * if it gets worse (fewer seats left).
 */
export function SeatNotice() {
  const query = useSubscription();
  const canUpgrade = useCan("create", "subscriptionUpgrade");
  const [asking, setAsking] = useState(false);
  const key = `heyhr-seat-notice-${sessionAccountId() ?? "anon"}`;
  // Closed for this sign-in only: a new login shows it again.
  const [hiddenAt, setHiddenAt] = useState<number | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null") as { at: string; left: number } | null;
      return saved && saved.at === signInTime() ? saved.left : null;
    } catch {
      return null;
    }
  });
  const u = query?.data;
  const left = u ? seatsLeft(u) : 0;
  const visible = !!u && u.status !== "ok" && !(hiddenAt !== null && left >= hiddenAt);
  // Tell other bottom-right messages (the sign-in welcome) how much room this card takes.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const card = cardRef.current;
    if (!visible || !card) {
      root.style.removeProperty("--seat-notice-h");
      return;
    }
    const sync = () => root.style.setProperty("--seat-notice-h", `${card.offsetHeight + 12}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(card);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--seat-notice-h");
    };
  }, [visible]);
  if (!u || !visible) return null;
  const planLeft = Math.max(0, u.seatLimit - u.seatsUsed);
  const full = planLeft === 0;
  const pct = Math.min(100, Math.round((u.seatsUsed / Math.max(1, u.seatLimit)) * 100));
  const more = left === 1 ? "1 more employee" : `${left} more employees`;
  const text = !full
    ? `${planLeft} left before new employees can't be added.`
    : left
      ? `You can add ${more} for now, then adding stops.`
      : "New employees can't be added until the plan is upgraded.";
  const hide = () => {
    setHiddenAt(left);
    try {
      localStorage.setItem(key, JSON.stringify({ at: signInTime(), left }));
    } catch {
      // Blocked storage: hidden for this visit only.
    }
  };
  return (
    <>
      <div ref={cardRef} role="status" className="glass-surface panel-enter fixed bottom-21 right-5 z-30 flex w-[min(380px,calc(100vw-40px))] flex-col gap-3 rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-drawer)]">
        <div className="flex items-start gap-3">
          <AlertTriangleIcon aria-hidden="true" className={clsx("mt-0.5 h-4 w-4 flex-none", full ? "text-critical" : "seat-icon")} />
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">
              {full ? `All ${u.seatLimit} seats used` : `${u.seatsUsed} of ${u.seatLimit} seats used`}
            </span>{" "}
            · {text} Payroll, attendance and leave keep working.
          </p>
          <button type="button" aria-label="Hide seat notice" onClick={hide} className="-mr-1 -mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-[var(--radius-control)] text-ink-2 transition-colors duration-150 hover:bg-[var(--nav-hover-bg)] hover:text-ink">
            <XIcon aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <span aria-hidden="true" className="seat-track h-1.5 overflow-hidden rounded-full">
          <span className={clsx("block h-full rounded-full", full ? "bg-critical" : "seat-bar")} style={{ width: `${pct}%` }} />
        </span>
        {/* One action: the request for whoever can make it, otherwise the plan. */}
        <div className="flex justify-end">
          {canUpgrade ? (
            <Button variant="ghost" onClick={() => setAsking(true)}>
              Request more seats
            </Button>
          ) : (
            <Link to="/admin/settings/subscription" className="btn btn-secondary px-4 py-2 text-[13px] font-medium">
              View plan
            </Link>
          )}
        </div>
      </div>
      <RequestUpgradeDialog open={asking} onClose={() => setAsking(false)} />
    </>
  );
}

/** Super Admin asks the System Admin team for a bigger plan. */
export function RequestUpgradeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: () => requestUpgrade(note, user?.name ?? "Super Admin"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKey });
      toast.show("Upgrade requested. Our team will contact you.");
      setNote("");
      onClose();
    },
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Request upgrade"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={mutation.isPending} succeeded={mutation.isSuccess} disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Sending…" : "Send request"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">We'll tell the System Admin team you'd like more seats or admin accounts. They'll get back to you about plans and pricing.</p>
        <label htmlFor="upgrade-note" className="text-xs font-medium text-ink">
          Note (optional)
        </label>
        <textarea id="upgrade-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. We're hiring 15 people next quarter" className="field w-full px-3 py-2 text-sm" />
        {mutation.error && (
          <p role="alert" className="text-xs font-medium text-critical">
            {mutation.error.message}
          </p>
        )}
      </div>
    </Dialog>
  );
}

/** "Seat limit reached.": Super Admins can ask for an upgrade, HR is pointed to their administrator. */
export function SeatLimitDialog({ open, onClose, message }: { open: boolean; onClose: () => void; message?: string }) {
  const canUpgrade = useCan("create", "subscriptionUpgrade");
  const [asking, setAsking] = useState(false);
  return (
    <>
      <Dialog
        open={open && !asking}
        onClose={onClose}
        title="Seat limit reached."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {canUpgrade && <Button onClick={() => setAsking(true)}>Request upgrade</Button>}
          </div>
        }
      >
        <div className="flex gap-3">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-critical-tint text-critical">
            <AlertTriangleIcon aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="flex flex-col gap-2 text-sm text-ink-2">
            <p>{message?.replace(/^Seat limit reached\.\s*/, "") || "Your plan has no seats left for another employee."} Everything else (payroll, attendance, leave and reports) keeps working.</p>
            {!canUpgrade && <p className="font-medium text-ink">Contact your administrator.</p>}
          </div>
        </div>
      </Dialog>
      <RequestUpgradeDialog
        open={open && asking}
        onClose={() => {
          setAsking(false);
          onClose();
        }}
      />
    </>
  );
}
