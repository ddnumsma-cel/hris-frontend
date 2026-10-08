// Rules: the company's leave and scheduling rules at a glance (edited in Settings), and the
// approval workflows (the existing Approval workflows page, shown here).

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { getLeavePolicy, getSchedulingRules } from "@/lib/settings/workspace";
import { WorkflowsPage } from "../administration/WorkflowsPage";

const ACCRUAL = { yearly: "Yearly", monthly: "Monthly", "per-payroll": "Every payroll" } as const;

function RuleCard({ title, edit, rows }: { title: string; edit: string; rows: [string, ReactNode][] | undefined }) {
  return (
    <section className="flex flex-col rounded-[var(--radius-card)] border border-[var(--card-border)] bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link to={edit} className="text-[13px] font-medium text-brand-ink hover:underline">
          Edit
        </Link>
      </div>
      <dl className="flex flex-col divide-y divide-[var(--line)]">
        {(rows ?? []).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-5 py-3 text-[13px]">
            <dt className="text-ink-2">{k}</dt>
            <dd className="font-medium text-ink">{v}</dd>
          </div>
        ))}
        {!rows && <div className="px-5 py-3 text-[13px] text-ink-2">Loading…</div>}
      </dl>
    </section>
  );
}

export function RulesPage() {
  const leave = useQuery({ queryKey: ["settings", "leave-policy"], queryFn: getLeavePolicy });
  const scheduling = useQuery({ queryKey: ["settings", "scheduling"], queryFn: getSchedulingRules });
  const yesNo = (b: boolean) => (b ? "Allowed" : "Not allowed");
  const l = leave.data;
  const s = scheduling.data;

  return (
    <>
      <ContentHead title="Rules" subtitle="Leave, scheduling and approval rules that apply to everyone." />
      <div className="grid gap-4 md:grid-cols-2">
        <RuleCard
          title="Leave rules"
          edit="/admin/settings/time-off"
          rows={
            l && [
              ["Half days", yesNo(l.allowHalfDays)],
              ["Negative balance", yesNo(l.allowNegative)],
              ["Default carry-over", `${l.defaultCarryOver} day${l.defaultCarryOver === 1 ? "" : "s"}`],
              ["Leave credits granted", ACCRUAL[l.accrual]],
            ]
          }
        />
        <RuleCard
          title="Scheduling rules"
          edit="/admin/settings/scheduling"
          rows={
            s && [
              ["Overtime counts after", `${s.overtimeThresholdMinutes} min`],
              ["Default break", `${s.defaultBreakMinutes} min`],
              ["Publish schedules", `${s.publishLeadDays} days ahead`],
            ]
          }
        />
      </div>
      <div className="settings-embed flex min-w-0 flex-col gap-5">
        <WorkflowsPage />
      </div>
    </>
  );
}
