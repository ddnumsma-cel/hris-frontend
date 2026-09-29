import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Button } from "@/components/ui/Button";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { AlertTriangleIcon, CheckSquareIcon, ClockIcon, GraduationCapIcon, IdCardIcon } from "@/components/icons";
import { AttentionPanel, type AttentionItem } from "@/components/shared/AttentionPanel";
import { ClockInOutControl } from "@/components/shared/ClockInOutControl";
import {
  fetchAllPersonnelDocuments,
  fetchApprovalsQueue,
  fetchAttendanceTrend,
  fetchOnLeaveToday,
  fetchPerformanceReviewStatuses,
  fetchTeamRoster,
  fetchTeamTrainingRecords,
  fetchWorkforceAlerts,
} from "@/lib/api";
import { getExpiringPersonnelFields, isTrainingOverdue } from "@/lib/automation";
import { formatToday } from "@/lib/format";
import { currentManager, managerTeamStats } from "@/lib/mockData";
import { ApprovalsQueue } from "./ApprovalsQueue";
import { AttendanceChart } from "./AttendanceChart";
import { TeamRoster } from "./TeamRoster";
import { WorkforceAlerts } from "./WorkforceAlerts";

const APPROVAL_AGING_WARN_DAYS = 2;

export function ManagerOverview() {
  const navigate = useNavigate();
  const attendanceQuery = useQuery({ queryKey: ["manager", "attendance-trend"], queryFn: fetchAttendanceTrend });
  const onLeaveQuery = useQuery({ queryKey: ["manager", "on-leave-today"], queryFn: fetchOnLeaveToday });
  const approvalsQuery = useQuery({ queryKey: ["approvals-queue"], queryFn: fetchApprovalsQueue });
  const workforceAlertsQuery = useQuery({ queryKey: ["manager", "workforce-alerts"], queryFn: fetchWorkforceAlerts });
  const teamTrainingsQuery = useQuery({ queryKey: ["manager", "team-trainings"], queryFn: fetchTeamTrainingRecords });
  const rosterQuery = useQuery({ queryKey: ["manager", "team-roster"], queryFn: fetchTeamRoster });
  const reviewStatusesQuery = useQuery({
    queryKey: ["manager", "performance-review-statuses"],
    queryFn: fetchPerformanceReviewStatuses,
  });
  const personnelDocumentsQuery = useQuery({
    queryKey: ["manager", "personnel-documents"],
    queryFn: fetchAllPersonnelDocuments,
  });

  const roster = rosterQuery.data ?? [];
  const reviewStatuses = reviewStatusesQuery.data ?? {};
  const reviewsCompleted = roster.filter((m) => reviewStatuses[m.id] === "Submitted").length;
  const reviewsTotal = roster.length;
  const reviewProgressPercent = reviewsTotal === 0 ? 0 : Math.round((reviewsCompleted / reviewsTotal) * 100);

  const pendingCount = approvalsQuery.data?.length ?? 0;
  const oldestDays = approvalsQuery.data?.length
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(approvalsQuery.data[approvalsQuery.data.length - 1].requestedOn).getTime()) /
            86_400_000,
        ),
      )
    : 0;

  const attentionItems: AttentionItem[] = [];
  for (const r of approvalsQuery.data ?? []) {
    const ageDays = Math.max(0, Math.round((Date.now() - new Date(r.requestedOn).getTime()) / 86_400_000));
    if (ageDays >= APPROVAL_AGING_WARN_DAYS) {
      attentionItems.push({
        id: `approval-${r.id}`,
        icon: <ClockIcon className="h-4 w-4" />,
        title: `${r.employeeName}'s ${r.type} request has waited ${ageDays} day${ageDays === 1 ? "" : "s"}`,
        detail: r.detail,
        tone: ageDays >= 4 ? "crit" : "warn",
        action: { label: "Review", onClick: () => navigate("/manager/approvals") },
      });
    }
  }
  for (const t of teamTrainingsQuery.data ?? []) {
    if (isTrainingOverdue(t)) {
      attentionItems.push({
        id: `training-${t.id}`,
        icon: <GraduationCapIcon className="h-4 w-4" />,
        title: `${t.employeeName} is overdue on ${t.course}`,
        detail: `Was due ${t.dueDate}`,
        tone: "crit",
        action: { label: "View", onClick: () => navigate("/manager/trainings") },
      });
    }
  }
  const teamMemberIds = new Set(roster.map((m) => m.id));
  const teamNameById = new Map(roster.map((m) => [m.id, m.name]));
  for (const doc of personnelDocumentsQuery.data ?? []) {
    if (!teamMemberIds.has(doc.employeeId)) continue;
    for (const field of getExpiringPersonnelFields(doc)) {
      attentionItems.push({
        id: `personnel-${doc.id}-${field.label}`,
        icon: <IdCardIcon className="h-4 w-4" />,
        title: `${teamNameById.get(doc.employeeId)}'s ${field.label} is ${field.status === "Overdue" ? "expired" : "expiring soon"}`,
        detail: `${field.note} — see Team roster below to open their 201 file`,
        tone: field.status === "Overdue" ? "crit" : "warn",
      });
    }
  }

  return (
    <>
      <ContentHead
        title="Audit & Assurance — Team Overview"
        subtitle={`${currentManager.name}, ${currentManager.title} · ${currentManager.office} · ${formatToday()}`}
        actions={
          <>
            <ClockInOutControl personName={currentManager.name.split(" ")[0]} />
            <Button
              icon={<CheckSquareIcon className="h-3.75 w-3.75" />}
              onClick={() => navigate("/manager/approvals")}
            >
              Review approvals
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] sm:gap-3.5">
        <StatTile
          label="Team headcount"
          value={managerTeamStats.teamHeadcount}
          delta={`${managerTeamStats.onLeaveToday} on leave today`}
        />
        <StatTile
          label="Pending approvals"
          value={pendingCount}
          delta={pendingCount > 0 ? `Oldest: ${oldestDays} day${oldestDays === 1 ? "" : "s"}` : "All caught up"}
          tone={pendingCount > 0 ? "warn" : "good"}
          icon={<ClockIcon className="h-3 w-3" />}
        />
        <StatTile
          label="Attendance rate"
          value={`${managerTeamStats.attendanceRate}%`}
          delta="last 14 days"
          tone="good"
        />
        <StatTile
          label="Q3 reviews completed"
          value={
            <>
              {reviewsCompleted} <span className="text-sm font-semibold text-ink-3">/ {reviewsTotal}</span>
            </>
          }
          delta="due Oct 15, 2026"
        />
        <StatTile
          label="Workforce patterns flagged"
          value={workforceAlertsQuery.data?.length ?? <Skeleton className="h-7 w-8" />}
          delta={
            workforceAlertsQuery.data?.some((a) => a.severity === "crit") ? "Needs attention" : "Auto-detected this week"
          }
          tone={workforceAlertsQuery.data?.some((a) => a.severity === "crit") ? "crit" : "warn"}
          icon={<AlertTriangleIcon className="h-3 w-3" />}
        />
      </div>

      <AttentionPanel items={attentionItems} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <ApprovalsQueue />

        <Card>
          <CardHeader title="On leave today" meta={formatToday().split(",")[0]} />
          <CardBody className="flex flex-col gap-3">
            {onLeaveQuery.data?.map((person) => (
              <div key={person.name} className="flex items-center gap-2.5">
                <MiniAvatar initials={person.initials} />
                <div>
                  <div className="text-[0.85rem] font-semibold">{person.name}</div>
                  <div className="text-xs text-ink-2">{person.reason}</div>
                </div>
              </div>
            ))}
            <div className="border-t border-border pt-3">
              <div className="mb-1.5 text-xs text-ink-2">This week</div>
              <div className="text-[0.85rem]">
                4 of {managerTeamStats.teamHeadcount} team members have leave scheduled
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Team attendance — last 14 days" meta="On-time rate" />
          <CardBody>
            {attendanceQuery.data && <AttendanceChart data={attendanceQuery.data} />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Q3 2026 mid-year review" />
          <CardBody>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-ink-2">Progress</span>
              <span className="font-num font-bold">{reviewProgressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-brand"
                style={{ width: `${reviewProgressPercent}%` }}
              />
            </div>
            <p className="mt-2.5 text-xs text-ink-3">
              {reviewsCompleted} of {reviewsTotal} self-assessments and manager reviews submitted. Deadline Oct 15,
              2026.
            </p>
          </CardBody>
        </Card>
      </div>

      <TeamRoster />

      <WorkforceAlerts />
    </>
  );
}
