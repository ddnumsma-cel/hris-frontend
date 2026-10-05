import { useQueryClient } from "@tanstack/react-query";
import { formatPHP } from "@/lib/format";
import type { ClaimStatus } from "@/lib/reimbursements/store";
import type { Tone } from "../corehr/format";

export const STATUS: Record<ClaimStatus, { label: string; tone: Tone }> = {
  pending: { label: "Waiting for approval", tone: "warn" },
  approved: { label: "Approved", tone: "good" },
  rejected: { label: "Rejected", tone: "crit" },
};

export const peso = formatPHP;

export function receiptDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function useClaimsRefresh() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
    queryClient.invalidateQueries({ queryKey: ["ess", "claims"] });
  };
}
