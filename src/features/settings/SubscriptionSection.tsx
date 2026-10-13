import { useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { SettingsCard, SettingsHeader, SettingsRow } from "@/components/ui/SettingsCard";
import { LoadError } from "@/features/admin/corehr/ui";
import { RequestUpgradeDialog, seatsLeft, useSubscription } from "@/features/subscription/shared";
import { fmtDay } from "@/lib/preferences";
import type { Usage } from "@/lib/subscription/api";
import { useCan } from "@/lib/useCan";
import { SectionSkeleton } from "./AccountSection";

/** Seats left in the same plain numbers as the top-bar pill; the grace seats only once the plan's own are used. */
function seatsNote(u: Usage) {
  const planLeft = Math.max(0, u.seatLimit - u.seatsUsed);
  const left = seatsLeft(u);
  if (planLeft > 0) return `${planLeft} ${planLeft === 1 ? "seat" : "seats"} left.`;
  if (left > 0) return `All ${u.seatLimit} seats are used. You can add ${left === 1 ? "1 more employee" : `${left} more employees`} for now, then adding stops.`;
  return `All ${u.seatLimit} seats are used. Upgrade the plan to add new employees.`;
}

/** Used / limit with a thin bar, tinted as it fills. */
function Meter({ used, limit, status }: { used: number; limit: number; status: Usage["status"] }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const bar = status === "ok" ? "bg-brand" : status === "near" ? "seat-bar" : "bg-critical";
  return (
    <span className="flex w-full flex-col gap-2 sm:items-end">
      <span className="text-sm font-semibold text-ink">
        {used} / {limit}
      </span>
      <span className={clsx("h-1.5 w-full overflow-hidden rounded-full sm:w-48", status === "near" ? "seat-track" : "bg-surface-2")}>
        <span className={clsx("block h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

/**
 * Settings › Subscription: the company's plan and what it uses. Super Admins can ask for an
 * upgrade; HR sees the same card read-only.
 */
export function SubscriptionSection() {
  const query = useSubscription();
  const canUpgrade = useCan("create", "subscriptionUpgrade");
  const [asking, setAsking] = useState(false);
  if (!query) return null;
  if (query.isError) return <LoadError onRetry={() => query.refetch()} />;
  const u = query.data;
  if (!u) return <SectionSkeleton title="Subscription" />;
  const running = u.extension && u.extension.until >= new Date().toISOString().slice(0, 10);

  return (
    <>
      <SettingsHeader title="Subscription" />
      <SettingsCard title={`${u.planName} plan`} description={`Renews ${fmtDay(u.renewalDate)}.`}>
        <SettingsRow label="Employee seats" help={`Active employees (on leave and suspended count; separated don't). ${seatsNote(u)}`}>
          <Meter used={u.seatsUsed} limit={u.seatLimit} status={u.status} />
        </SettingsRow>
        <SettingsRow
          label="Admin accounts"
          help={
            <>
              Active HR, Approver and Accounting logins.
              {u.adminsUsed > u.adminLimit && (
                <span className="mt-1 block font-medium text-critical">
                  {u.adminsUsed - u.adminLimit} over the plan's {u.adminLimit}. Existing logins keep working, but no new HR, Approver or Accounting logins can be added until you upgrade or turn some off.
                </span>
              )}
              {u.adminsUsed === u.adminLimit && <span className="mt-1 block font-medium text-critical">All used. New HR, Approver or Accounting logins can't be added.</span>}
            </>
          }
        >
          <Meter used={u.adminsUsed} limit={u.adminLimit} status={u.adminStatus} />
        </SettingsRow>
        <SettingsRow label="Renewal date">
          <span className="text-sm text-ink">{fmtDay(u.renewalDate)}</span>
        </SettingsRow>
        {(u.seatLimitOverride || running) && (
          <SettingsRow label="Adjustments" help="Set by our team on top of your plan.">
            <span className="flex flex-col gap-1 text-sm text-ink">
              {u.seatLimitOverride && <span>Seat limit set to {u.seatLimitOverride}</span>}
              {running && (
                <span>
                  +{u.extension!.seats} seats until {fmtDay(u.extension!.until)}
                </span>
              )}
            </span>
          </SettingsRow>
        )}
        {canUpgrade && (
          <SettingsRow label="Need more room?" help="We'll tell the System Admin team, who'll get back to you about plans.">
            <Button onClick={() => setAsking(true)}>Request upgrade</Button>
          </SettingsRow>
        )}
      </SettingsCard>
      <RequestUpgradeDialog open={asking} onClose={() => setAsking(false)} />
    </>
  );
}
