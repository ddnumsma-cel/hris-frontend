import { ContentHead } from "@/components/layout/RolePage";
import { formatToday } from "@/lib/format";
import { WorkforceAlerts } from "./WorkforceAlerts";

export function ManagerWorkforcePage() {
  return (
    <>
      <ContentHead title="Workforce Intelligence" subtitle={formatToday()} />
      <WorkforceAlerts />
    </>
  );
}
