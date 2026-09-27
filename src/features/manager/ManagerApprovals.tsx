import { ContentHead } from "@/components/layout/RolePage";
import { formatToday } from "@/lib/format";
import { ApprovalsQueue } from "./ApprovalsQueue";

export function ManagerApprovals() {
  return (
    <>
      <ContentHead title="Approvals" subtitle={formatToday()} />
      <ApprovalsQueue />
    </>
  );
}
