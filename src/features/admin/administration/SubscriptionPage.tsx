// Subscription plan and seats. Plans and billing aren't built yet; this shows seat use from the
// accounts list. TODO(backend): plan, seat limit and seat-limit notices to System Admins.

import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { listRoles } from "@/lib/admin/api";
import { LoadError } from "../corehr/ui";

export function SubscriptionPage() {
  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });
  if (roles.isError) return <LoadError onRetry={() => roles.refetch()} />;
  // Every client account takes a seat; System Admin accounts (our team) don't.
  const seats = (roles.data ?? []).filter((r) => r.key !== "system_admin").reduce((n, r) => n + r.users, 0);
  const tiles = [
    { label: "Plan", value: "Not set up yet", sub: "Plans and billing are coming." },
    { label: "Seats used", value: roles.isLoading ? "…" : String(seats), sub: "Client accounts, active or turned off" },
    { label: "Seat limit", value: "No limit set", sub: "You'll be told before the limit is reached." },
  ];
  return (
    <>
      <ContentHead title="Subscription & seats" subtitle="Your plan and how many accounts it covers." />
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-surface p-4">
            <div className="text-xs font-semibold text-ink-2">{t.label}</div>
            <div className="mt-1 text-xl font-semibold">{t.value}</div>
            <div className="mt-1 text-xs text-ink-2">{t.sub}</div>
          </div>
        ))}
      </div>
    </>
  );
}
