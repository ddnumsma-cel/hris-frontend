import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { fetchWorkforceAlerts } from "@/lib/api";
import type { WorkforceAlertSeverity } from "@/lib/types";

const severityVariant: Record<WorkforceAlertSeverity, ChipVariant> = {
  info: "neutral",
  warn: "warn",
  crit: "crit",
};

export function WorkforceAlerts() {
  const alertsQuery = useQuery({ queryKey: ["manager", "workforce-alerts"], queryFn: fetchWorkforceAlerts });
  const alerts = alertsQuery.data ?? [];

  return (
    <Card>
      <CardHeader title="Workforce intelligence" meta={`${alerts.length} pattern${alerts.length === 1 ? "" : "s"} flagged`} />
      <CardBody className="flex flex-col gap-3">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-start gap-2.5">
            <MiniAvatar initials={alert.employeeInitials} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[0.85rem] font-semibold">{alert.employeeName}</span>
                <Chip variant={severityVariant[alert.severity]}>{alert.category}</Chip>
              </div>
              <p className="mt-0.5 text-[0.82rem] text-ink-2">{alert.message}</p>
              <span className="text-xs text-ink-3">{alert.detectedLabel}</span>
            </div>
          </div>
        ))}
        {alertsQuery.isSuccess && alerts.length === 0 && (
          <p className="text-[0.85rem] text-ink-2">No unusual patterns detected this week.</p>
        )}
      </CardBody>
    </Card>
  );
}
