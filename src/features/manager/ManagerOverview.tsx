import { useQuery } from "@tanstack/react-query";
import { listMyApprovals } from "@/lib/approvals";
import { useNavigate } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  BentoArea,
  BentoHero,
  EmptyNote,
  KpiStack,
  ListRow,
  ListRowSkeletons,
  ProgressMeter,
} from "@/components/ui/Bento";
import { AlertTriangleIcon, CheckSquareIcon, ClockIcon, GraduationCapIcon, IdCardIcon } from "@/components/icons";
import { AttentionPanel, type AttentionItem } from "@/components/shared/AttentionPanel";
import { ClockInOutControl } from "@/components/shared/ClockInOutControl";
import {
  fetchAllPersonnelDocuments,
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
  const approvalsQuery = useQuery({ queryKey: ["approvals-queue"], queryFn: listMyApprovals });
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
    <div className="dash">
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

      <div className="bento bento-manager">
        {/* Hero: 14-day on-time attendance, latest day highlighted. */}
        <BentoArea area="hero">
          <BentoHero
            title="Team attendance — last 14 days"
            value={`${managerTeamStats.attendanceRate}%`}
            label="Attendance rate · on-time rate per day"
            legend={[
              { color: "var(--grad-chart)", label: "Latest day" },
              { color: "var(--dash-bar-idle)", label: "Earlier days" },
            ]}
          >
            {attendanceQuery.data ? (
              <AttendanceChart data={attendanceQuery.data} variant="bars" />
            ) : (
              <Skeleton className="h-56 w-full" />
            )}
          </BentoHero>
        </BentoArea>

        <BentoArea area="kpis">
          <KpiStack>
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
              label="Workforce patterns flagged"
              value={workforceAlertsQuery.data?.length ?? <Skeleton className="h-7 w-8" />}
              delta={
                workforceAlertsQuery.data?.some((a) => a.severity === "crit")
                  ? "Needs attention"
                  : "Auto-detected this week"
              }
              tone={workforceAlertsQuery.data?.some((a) => a.severity === "crit") ? "crit" : "warn"}
              icon={<AlertTriangleIcon className="h-3 w-3" />}
            />
          </KpiStack>
        </BentoArea>

        {/* Right column: who's out today. */}
        <BentoArea area="leave">
          <Card className="h-full">
            <CardHeader title="On leave today" meta={formatToday().split(",")[0]} />
            <CardBody className="flex flex-col gap-1">
              {onLeaveQuery.isLoading && <ListRowSkeletons />}
              {onLeaveQuery.data?.length === 0 && <EmptyNote>No one is on leave today.</EmptyNote>}
              {onLeaveQuery.data?.map((person) => (
                <ListRow key={person.name} leading={person.initials} title={person.name} subtitle={person.reason} />
              ))}
              <div className="mt-3 rounded-[10px] bg-surface-2 px-3.5 py-3">
                <div className="mb-1 text-xs text-ink-2">This week</div>
                <div className="text-[13px]">
                  4 of {managerTeamStats.teamHeadcount} team members have leave scheduled
                </div>
              </div>
            </CardBody>
          </Card>
        </BentoArea>

        {/* Progress: Q3 mid-year review completion. */}
        <BentoArea area="review">
          <Card className="h-full">
            <CardHeader
              title="Q3 2026 mid-year review"
              action={<span className="font-num text-[15px] font-semibold">{reviewProgressPercent}%</span>}
            />
            <CardBody>
              <ProgressMeter
                percent={reviewProgressPercent}
                start={`${reviewsCompleted} submitted`}
                end={`${reviewsTotal} total`}
              />
              <p className="mt-3 text-xs text-ink-2">
                {reviewsCompleted} of {reviewsTotal} self-assessments and manager reviews submitted. Deadline Oct 15,
                2026.
              </p>
            </CardBody>
          </Card>
        </BentoArea>

        <BentoArea area="approvals">
          <ApprovalsQueue />
        </BentoArea>
      </div>

      {/* Two short lists side by side on wide screens, so their actions sit next to the text. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AttentionPanel items={attentionItems} />
        <WorkforceAlerts />
      </div>

      <TeamRoster />
    </div>
  );
}
