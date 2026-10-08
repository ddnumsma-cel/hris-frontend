import { useState } from "react";
import { ContentHead } from "@/components/layout/RolePage";
import { LeaveRequestsPage } from "@/features/admin/leave/LeaveRequestsPage";
import { ReimbursementsPage } from "@/features/admin/reimbursements/ReimbursementsPage";
import { Tabs } from "@/features/admin/timekeeping/common";
import { formatToday } from "@/lib/format";

type Tab = "claims" | "leave";

/**
 * Your team's requests. Claims: you approve or decline first, then Accounting gives the final
 * approval. Leave: shown so you know who's off; HR approves leave. Only your direct reports appear.
 */
export function ManagerApprovals() {
  const [tab, setTab] = useState<Tab>("claims");
  return (
    <>
      <ContentHead title="Approvals" subtitle={formatToday()} />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "claims", label: "Claims" },
          { value: "leave", label: "Leave" },
        ]}
      />
      <div className="settings-embed flex min-w-0 flex-col gap-5">{tab === "claims" ? <ReimbursementsPage /> : <LeaveRequestsPage />}</div>
    </>
  );
}
