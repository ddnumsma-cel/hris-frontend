import { CheckSquareIcon } from "@/components/icons";
import { myApproverName } from "@/lib/ess/more";

/** Tells the employee who decides what they're filing, shown on every request form. */
export function ApproverNote({ then }: { then?: string }) {
  const name = myApproverName();
  return (
    <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-xs text-ink-2">
      <CheckSquareIcon className="mt-px h-4 w-4 flex-none text-brand-ink" />
      <span>
        {name ? <><span className="font-semibold text-ink">{name}</span>, your manager,</> : "Your manager"} approves this{then ? `, then ${then}` : ""}. You'll be notified when it's decided.
      </span>
    </p>
  );
}
