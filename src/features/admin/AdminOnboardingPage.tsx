import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardHeader } from "@/components/ui/Card";
import { fetchOnboardingPipeline } from "@/lib/api";
import { formatToday } from "@/lib/format";

export function AdminOnboardingPage() {
  const onboardingQuery = useQuery({ queryKey: ["admin", "onboarding-pipeline"], queryFn: fetchOnboardingPipeline });

  return (
    <>
      <ContentHead title="Onboarding" subtitle={formatToday()} />

      <Card>
        <CardHeader title="Onboarding pipeline" meta="September batch" />
        <div className="flex divide-x divide-dashed divide-border">
          {onboardingQuery.data?.map((stage) => (
            <div key={stage.stage} className="flex-1 px-2 py-3.5 text-center">
              <div className="font-num font-display text-2xl font-semibold">{stage.count}</div>
              <div className="mt-0.5 text-xs text-ink-2">{stage.stage}</div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
