import { useQueryClient } from "@tanstack/react-query";
import { formatPHP } from "@/lib/format";
import type { ClaimStatus } from "@/lib/reimbursements/store";
import type { Tone } from "../corehr/format";
import { fmtDay } from "@/lib/preferences";

export const STATUS: Record<ClaimStatus, { label: string; tone: Tone }> = {
  pending: { label: "Waiting for approver", tone: "warn" },
  endorsed: { label: "Waiting for Accounting", tone: "info" },
  approved: { label: "Approved", tone: "good" },
  rejected: { label: "Rejected", tone: "crit" },
};

export const peso = formatPHP;

export function receiptDate(iso: string) {
  return fmtDay(iso);
}

export function useClaimsRefresh() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["reimbursements"] });
    queryClient.invalidateQueries({ queryKey: ["ess", "claims"] });
  };
}
