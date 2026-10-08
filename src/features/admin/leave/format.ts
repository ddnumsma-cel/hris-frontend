import { useQueryClient } from "@tanstack/react-query";
import type { Eligibility, LeaveType, RequestStatus } from "@/lib/leave/types";
import { fmtDayShort } from "@/lib/preferences";

export const leaveKeys = {
  types: ["leave", "types"] as const,
  requests: ["leave", "requests"] as const,
  balances: ["leave", "balances"] as const,
  adjustments: (id: string) => ["leave", "adjustments", id] as const,
  away: (from: string, to: string) => ["leave", "away", from, to] as const,
};

/** Leave changes who Timekeeping shows as on leave, so refresh both. */
export const LEAVE_INVALIDATES = [["leave"], ["timekeeping"]] as const;

const md = (iso: string) => fmtDayShort(iso);

/** "Oct 5", "Oct 5 – 9", "Sep 29 – Oct 3" */
export function dateRange(start: string, end: string) {
  if (start === end) return md(start);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${md(start)} – ${Number(end.slice(8))}`;
  return `${md(start)} – ${md(end)}`;
}

export const STATUS: Record<RequestStatus, { label: string; tone: "good" | "warn" | "crit" | "neutral" }> = {
  pending: { label: "Waiting", tone: "warn" },
  approved: { label: "Approved", tone: "good" },
  rejected: { label: "Rejected", tone: "crit" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const ELIGIBILITY: Record<Eligibility, string> = {
  everyone: "Everyone",
  female: "Women",
  "male-married": "Married men",
  "solo-parent": "Solo parents",
  "after-1-year": "After 1 year of service",
  "after-6-months": "After 6 months of service",
};

export function earningText(t: Pick<LeaveType, "earning" | "daysPerYear">) {
  switch (t.earning.kind) {
    case "monthly":
      return `${t.earning.perMonth} a month, up to ${t.daysPerYear} a year`;
    case "yearly":
      return `${t.daysPerYear} days every January`;
    case "per-event":
      return `${t.daysPerYear} days each time it applies`;
    default:
      return "No limit";
  }
}

export function proofText(over: number | null) {
  if (over === null) return "Not needed";
  if (over === 0) return "Always";
  return `Over ${over} ${over === 1 ? "day" : "days"}`;
}

/** Short day count for tight cells: "1.5", "15". */
export const num = (n: number) => (n === Infinity ? "—" : Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

export function useLeaveRefresh() {
  const queryClient = useQueryClient();
  return () => LEAVE_INVALIDATES.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
}
