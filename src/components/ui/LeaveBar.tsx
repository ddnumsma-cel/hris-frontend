import { CalendarIcon } from "../icons";

export function LeaveBar({
  label,
  used,
  entitlement,
}: {
  label: string;
  used: number;
  entitlement: number;
}) {
  const available = entitlement - used;
  const percent = Math.min(100, Math.round((available / entitlement) * 100));

  return (
    <div className="flex items-center gap-3">
      <span className="flex w-28 flex-none items-center gap-1.5 text-sm font-semibold text-ink-2">
        <CalendarIcon className="h-3.5 w-3.5 text-ink-3" />
        {label}
      </span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
      </span>
      <span className="font-num w-20 flex-none text-right text-sm">
        {available}
        {" / "}
        {entitlement}d
      </span>
    </div>
  );
}
