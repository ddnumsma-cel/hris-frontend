import { useQuery } from "@tanstack/react-query";
import { fetchComplianceCalendar } from "@/lib/api";
import { getEffectiveCompliance } from "@/lib/automation";

export const COMPLIANCE_KEY = ["admin", "compliance-calendar"];

/** Filings that aren't filed yet — shown on the Remittances tab label. */
export function useRemittancesDue() {
  const query = useQuery({ queryKey: COMPLIANCE_KEY, queryFn: fetchComplianceCalendar });
  return (query.data ?? []).filter((item) => getEffectiveCompliance(item).status !== "Filed").length;
}
