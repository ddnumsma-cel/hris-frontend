import { CheckSquareIcon } from "@/components/icons";
import type { RequestKind } from "@/lib/admin/store";
import { myApprovers } from "@/lib/ess/more";

/**
 * Tells the employee who decides what they're filing. It's whoever the approval workflow names
 * (usually their manager), the same people who are notified and see it in their Approvals.
 */
export function ApproverNote({ kind, then }: { kind: RequestKind | null; then?: string }) {
  const { names, roles, isSupervisor } = myApprovers(kind);
  const who = [...names, ...roles.map((r) => `the ${r}`)];
  const list = who.length > 1 ? `${who.slice(0, -1).join(", ")} and ${who.at(-1)}` : (who[0] ?? "your manager");
  return (
    <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-xs text-ink-2">
      <CheckSquareIcon className="mt-px h-4 w-4 flex-none text-brand-ink" />
      <span>
        Goes straight to <span className="font-semibold text-ink">{list}</span>
        {isSupervisor && names.length === 1 && !roles.length ? ", your manager," : ""} for approval{then ? `, then ${then}` : ""}. You'll be notified when it's decided.
      </span>
    </p>
  );
}
