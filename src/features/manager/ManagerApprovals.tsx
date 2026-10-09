import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { LeaveRequestsPage } from "@/features/admin/leave/LeaveRequestsPage";
import { ReimbursementsPage } from "@/features/admin/reimbursements/ReimbursementsPage";
import { CorrectionsPage } from "@/features/admin/timekeeping/CorrectionsPage";
import { OvertimePage, UndertimePage } from "@/features/admin/timekeeping/RequestsPage";
import { Tabs } from "@/features/admin/timekeeping/common";
import { formatToday } from "@/lib/format";

const TABS = ["leave", "overtime", "undertime", "adjustments", "claims"] as const;
type Tab = (typeof TABS)[number];
const tabOf = (v: string | null): Tab => (TABS as readonly string[]).includes(v ?? "") ? (v as Tab) : "leave";

/**
 * Every request from your team in one place: leave, overtime, undertime, time adjustments and
 * claims. Your approval is final, except claims, which Accounting approves last. Only your direct
 * reports appear. Links from Home open the matching tab (?tab=…).
 */
export function ManagerApprovals() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(tabOf(params.get("tab")));
  // Following another link while already here switches the tab too.
  useEffect(() => setTab(tabOf(params.get("tab"))), [params]);
  return (
    <>
      <ContentHead title="Approvals" subtitle={formatToday()} />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "leave", label: "Leave" },
          { value: "overtime", label: "Overtime" },
          { value: "undertime", label: "Undertime" },
          { value: "adjustments", label: "Time adjustments" },
          { value: "claims", label: "Claims" },
        ]}
      />
      <div className="settings-embed flex min-w-0 flex-col gap-5">
        {tab === "leave" ? <LeaveRequestsPage /> : tab === "overtime" ? <OvertimePage /> : tab === "undertime" ? <UndertimePage /> : tab === "adjustments" ? <CorrectionsPage /> : <ReimbursementsPage />}
      </div>
    </>
  );
}
