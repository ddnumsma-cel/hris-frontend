import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { CheckIcon } from "@/components/icons";
import { fetchAdminOverviewStats, fetchPayrollCostBreakdown, fetchPayrollRunSteps } from "@/lib/api";
import { getEffectivePayrollSteps } from "@/lib/automation";
import { formatPHPCompact, formatToday } from "@/lib/format";
import { PayrollCostChart } from "./PayrollCostChart";

export function AdminPayrollRuns() {
  const statsQuery = useQuery({ queryKey: ["admin", "overview-stats"], queryFn: fetchAdminOverviewStats });
  const runStepsQuery = useQuery({ queryKey: ["admin", "payroll-run-steps"], queryFn: fetchPayrollRunSteps });
  const costQuery = useQuery({ queryKey: ["admin", "payroll-cost"], queryFn: fetchPayrollCostBreakdown });
  const stats = statsQuery.data;

  return (
    <>
      <ContentHead title="Payroll Runs" subtitle={formatToday()} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="October 2026 payroll run" action={<Chip variant="warn">In progress</Chip>} />
          <CardBody className="flex flex-col gap-2.5">
            {runStepsQuery.data &&
              getEffectivePayrollSteps(runStepsQuery.data).map((step) => (
              <div
                key={step.label}
                className={`flex items-center gap-2.5 text-sm ${step.status === "pending" ? "text-ink-3" : ""}`}
              >
                <span
                  className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-semibold ${
                    step.status === "done"
                      ? "bg-good-tint text-good"
                      : step.status === "current"
                        ? "bg-brand-tint text-brand-ink"
                        : "bg-surface-2 text-ink-3"
                  }`}
                >
                  {step.status === "done" ? <CheckIcon className="h-3 w-3" /> : null}
                </span>
                {step.label}
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Payroll cost breakdown"
            meta={stats ? `Oct cutoff · ${formatPHPCompact(stats.payrollRunTotal)}` : undefined}
          />
          <CardBody>{costQuery.data && <PayrollCostChart data={costQuery.data} />}</CardBody>
        </Card>
      </div>
    </>
  );
}
