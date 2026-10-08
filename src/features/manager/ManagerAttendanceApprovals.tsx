import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { CorrectionsPage } from "@/features/admin/timekeeping/CorrectionsPage";
import { OvertimePage, UndertimePage } from "@/features/admin/timekeeping/RequestsPage";
import { Tabs } from "@/features/admin/timekeeping/common";
import { formatToday } from "@/lib/format";

type Tab = "overtime" | "undertime" | "adjustments";

/** Your team's overtime, undertime and time adjustments to approve or decline (direct reports only). */
export function ManagerAttendanceApprovals() {
  const [params] = useSearchParams();
  const start = params.get("tab");
  const [tab, setTab] = useState<Tab>(start === "undertime" || start === "adjustments" ? start : "overtime");
  return (
    <>
      <ContentHead title="Attendance Approvals" subtitle={`DTR corrections and exceptions · ${formatToday()}`} />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "overtime", label: "Overtime" },
          { value: "undertime", label: "Undertime" },
          { value: "adjustments", label: "Time adjustments" },
        ]}
      />
      <div className="settings-embed flex min-w-0 flex-col gap-5">{tab === "overtime" ? <OvertimePage /> : tab === "undertime" ? <UndertimePage /> : <CorrectionsPage />}</div>
    </>
  );
}
