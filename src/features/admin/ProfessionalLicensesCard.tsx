import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { LogCpdUnitsDialog } from "@/components/shared/LogCpdUnitsDialog";
import { fetchProfessionalLicenses } from "@/lib/api";
import { getCpdStatus } from "@/lib/automation";
import type { CpdStatus, ProfessionalLicense } from "@/lib/types";

const cpdVariant: Record<CpdStatus, ChipVariant> = {
  Compliant: "good",
  "In progress": "neutral",
  "Due soon": "warn",
  Overdue: "crit",
};

const thClass = "border-b border-border px-4 py-2.5 text-left text-xs font-medium tracking-[0.01em] text-ink-3";
const tdClass = "border-b border-border px-4 py-2.5";

/** PRC licenses and CPD units (moved here from the old Compliance page). */
export function ProfessionalLicensesCard() {
  const toast = useToast();
  const [loggingLicense, setLoggingLicense] = useState<ProfessionalLicense | null>(null);
  const licensesQuery = useQuery({ queryKey: ["admin", "professional-licenses"], queryFn: fetchProfessionalLicenses });
  const licenses = useMemo(
    () => (licensesQuery.data ?? []).map((license) => ({ license, ...getCpdStatus(license) })),
    [licensesQuery.data],
  );
  const atRisk = licenses.filter((l) => l.status === "Due soon" || l.status === "Overdue").length;

  return (
    <Card>
      <CardHeader title="Professional licenses & CPD" meta={atRisk > 0 ? `${atRisk} at risk` : "All on track"} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[0.82rem]">
          <thead>
            <tr>
              {["Employee", "License no.", "CPD units", "Cycle ends", "Status", ""].map((h) => (
                <th key={h} className={thClass}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {licensesQuery.isLoading && <SkeletonRows columns={6} />}
            {licenses.map(({ license, status, note }) => (
              <tr key={license.id}>
                <td className={tdClass}>
                  <div className="flex items-center gap-2.5">
                    <MiniAvatar initials={license.employeeInitials} />
                    {license.employeeName}
                  </div>
                </td>
                <td className={`${tdClass} font-num`}>{license.licenseNumber}</td>
                <td className={`${tdClass} font-num`}>
                  {license.cpdUnitsEarned}/{license.cpdUnitsRequired}
                </td>
                <td className={`${tdClass} whitespace-nowrap`}>{license.cycleEndDate}</td>
                <td className={tdClass}>
                  <Chip variant={cpdVariant[status]}>
                    {status} · {note}
                  </Chip>
                </td>
                <td className={tdClass}>
                  <button type="button" onClick={() => setLoggingLicense(license)} className="text-xs font-semibold text-brand-ink">
                    Log units
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <LogCpdUnitsDialog
        license={loggingLicense}
        onClose={() => setLoggingLicense(null)}
        onSubmitted={() => toast.show("CPD units logged.")}
      />
    </Card>
  );
}
