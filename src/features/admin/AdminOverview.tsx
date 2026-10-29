import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  BentoArea,
  BentoHero,
  EmptyNote,
  KpiStack,
  ListRow,
  ListRowSkeletons,
  ProgressMeter,
  QuickActionRow,
  QuickActionTile,
} from "@/components/ui/Bento";
import { useToast } from "@/components/ui/ToastContext";
import {
  BellIcon,
  MapPinIcon,
  DownloadIcon,
  UsersIcon,
} from "@/components/icons";
import {
  fetchAdminOverviewStats,
  fetchComplianceCalendar,
  fetchEmployeeDirectory,
  fetchEmployeeHireDates,
  fetchHeadcountByOffice,
  fetchOnboardingPipeline,
} from "@/lib/api";
import {
  getEffectiveCompliance,
} from "@/lib/automation";
import { downloadTextFile, toCsv } from "@/lib/download";
import { formatToday } from "@/lib/format";
import { listDays } from "@/lib/timekeeping/api";
import { headcountByDepartment } from "@/lib/homeFigures";
import { useCan } from "@/lib/useCan";
import { DepartmentSplit, RecentlyJoined } from "./HeadcountChart";
import { PostAnnouncementDialog } from "./PostAnnouncementDialog";
import { useCreateParam } from "@/lib/useCreateParam";

const complianceVariant: Record<string, ChipVariant> = {
  Filed: "good",
  "Due soon": "warn",
  Overdue: "crit",
};

export function AdminOverview() {
  const navigate = useNavigate();
  const toast = useToast();
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  // Home actions follow the access matrix: adding people, posting announcements, exporting reports.
  const canAnnounce = useCan("create", "announcements");
  const canExport = useCan("view", "analytics");
  useCreateParam("announcement", () => canAnnounce && setAnnouncementOpen(true));

  const statsQuery = useQuery({ queryKey: ["admin", "overview-stats"], queryFn: fetchAdminOverviewStats });
  const headcountQuery = useQuery({ queryKey: ["admin", "headcount-by-office"], queryFn: fetchHeadcountByOffice });
  const complianceQuery = useQuery({ queryKey: ["admin", "compliance-calendar"], queryFn: fetchComplianceCalendar });
  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const hireDatesQuery = useQuery({ queryKey: ["admin", "employee-hire-dates"], queryFn: fetchEmployeeHireDates });
  const onboardingQuery = useQuery({ queryKey: ["admin", "onboarding-pipeline"], queryFn: fetchOnboardingPipeline });
  const seesTime = useCan("view", "attendanceRecords");
  const todayIso = new Date().toLocaleDateString("en-CA");
  const todayQuery = useQuery({ queryKey: ["timekeeping", "days", todayIso, todayIso], queryFn: () => listDays(todayIso, todayIso), enabled: seesTime, staleTime: 0 });
  const departments = headcountByDepartment();

  const stats = statsQuery.data;

  const effectiveCompliance = (complianceQuery.data ?? []).map((item) => ({
    item,
    ...getEffectiveCompliance(item),
  }));

  function handleExportReport() {
    if (!directoryQuery.data) return;
    const csv = toCsv(
      directoryQuery.data.map((e) => ({
        id: e.id,
        name: e.name,
        position: e.position,
        department: e.department,
        office: e.office,
        status: e.status,
      })),
    );
    downloadTextFile("msma-hris-employee-directory.csv", csv, "text/csv");
  }

  return (
    <div className="dash">
      <ContentHead
        title="People Operations — MSMA Group"
        subtitle={`All offices${headcountQuery.data?.length ? ` · ${headcountQuery.data.map((o) => o.office).join(", ")}` : ""} · ${formatToday()}`}
      />

      <div className="bento bento-admin">
        {/* Hero: total employees, growth this month, and where they work. */}
        <BentoArea area="hero">
          <BentoHero
            title="Total employees"
            value={stats?.totalHeadcount ?? <Skeleton className="h-10 w-24" />}
            label={
              stats?.newHiresThisMonth || headcountQuery.data?.length ? (
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {stats?.newHiresThisMonth ? (
                    <span className="inline-flex rounded-[var(--radius-pill)] bg-good-tint px-2.5 py-[3px] text-[11px] font-medium text-good">
                      +{stats.newHiresThisMonth} this month
                    </span>
                  ) : null}
                  {headcountQuery.data?.length ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPinIcon aria-hidden="true" className="h-4 w-4 flex-none" />
                      {headcountQuery.data.length === 1
                        ? `All at ${headcountQuery.data[0]!.office}`
                        : headcountQuery.data.map((o) => `${o.office} ${o.count}`).join(" · ")}
                    </span>
                  ) : null}
                </span>
              ) : undefined
            }
            action={
              directoryQuery.data && hireDatesQuery.data ? (
                <RecentlyJoined employees={directoryQuery.data} hireDates={hireDatesQuery.data} />
              ) : undefined
            }
          >
            <div className="h-full">
              {departments.length ? (
                <DepartmentSplit data={departments} />
              ) : (
                <Skeleton className="h-full min-h-36 w-full" />
              )}
            </div>
          </BentoHero>
        </BentoArea>

        <BentoArea area="kpis">
          <KpiStack>
            <StatTile
              label="Attrition rate, YTD"
              value={stats ? `${stats.attritionRateYtd}%` : <Skeleton className="h-7 w-14" />}
              delta={stats ? `${stats.separationsYtd} ${stats.separationsYtd === 1 ? "separation" : "separations"} / ${new Date().getFullYear()}` : undefined}
            />
            <StatTile
              label="Open positions"
              value={stats ? stats.openPositions.total : <Skeleton className="h-7 w-10" />}
              delta={stats ? (stats.openPositions.byDepartment.length ? stats.openPositions.byDepartment.slice(0, 3).map((d) => `${d.count} ${d.name}`).join(" · ") : "All positions filled") : undefined}
            />
            <StatTile
              label="On leave today"
              value={stats ? stats.onLeaveToday : <Skeleton className="h-7 w-10" />}
              delta={stats ? (stats.onLeaveToday ? "Approved leave" : "Everyone's in") : undefined}
            />
          </KpiStack>
        </BentoArea>

        {/* Right column: quick actions, then the compliance calendar as a list. */}
        <BentoArea area="actions">
          <Card>
            <CardHeader title="Quick actions" />
            <CardBody>
              <QuickActionRow>
                {canAnnounce && (
                  <QuickActionTile
                    icon={<BellIcon />}
                    label="Post announcement"
                    onClick={() => setAnnouncementOpen(true)}
                  />
                )}
                {canExport && <QuickActionTile icon={<DownloadIcon />} label="Export report" onClick={handleExportReport} />}
                <QuickActionTile
                  icon={<UsersIcon />}
                  label="Open full directory"
                  onClick={() => navigate("/admin/directory")}
                />
              </QuickActionRow>
            </CardBody>
          </Card>
        </BentoArea>

        <BentoArea area="feed">
          <Card className="h-full">
            <CardHeader title="Compliance calendar" meta={new Date().toLocaleDateString("en-PH", { month: "long", year: "numeric" })} />
            <CardBody className="flex flex-col gap-1">
              {complianceQuery.isLoading && <ListRowSkeletons count={4} />}
              {complianceQuery.data?.length === 0 && <EmptyNote>No filings on the calendar.</EmptyNote>}
              {effectiveCompliance.map(({ item, status, note }) => (
                <ListRow
                  key={item.id}
                  title={item.filing}
                  subtitle={`${item.agency} · Due ${item.due}`}
                  footer={
                    <Chip variant={complianceVariant[status]}>
                      {status}
                      {note ? ` · ${note}` : ""}
                    </Chip>
                  }
                />
              ))}
            </CardBody>
          </Card>
        </BentoArea>

        {/* Today's attendance from the office scanners and clock-ins from home. */}
        <BentoArea area="payroll">
          <Card className="h-full">
            <CardHeader title="Today's attendance" meta={formatToday()} />
            <CardBody className="flex flex-col gap-4">
              {(() => {
                const days = (todayQuery.data ?? []).filter((d) => d.kind === "work" || d.kind === "leave");
                const working = days.filter((d) => d.kind === "work");
                const inNow = working.filter((d) => d.status === "done" || d.status === "working").length;
                const late = working.filter((d) => d.lateMinutes > 0).length;
                const notIn = working.filter((d) => d.status === "not-in" || d.status === "absent").length;
                const onLeave = days.filter((d) => d.kind === "leave").length;
                if (!seesTime) return <EmptyNote>Attendance isn't part of your access.</EmptyNote>;
                if (todayQuery.isLoading) return <Skeleton className="h-20 w-full" />;
                if (!working.length && !onLeave) return <EmptyNote>No one is scheduled to work today.</EmptyNote>;
                return (
                  <>
                    <ProgressMeter percent={working.length ? (inNow / working.length) * 100 : 0} start={`${inNow} in`} end={`${working.length} scheduled`} />
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: "In", value: inNow, tone: "text-good" },
                        { label: "Late", value: late, tone: late ? "text-warning" : "" },
                        { label: "Not in yet", value: notIn, tone: notIn ? "text-critical" : "" },
                        { label: "On leave", value: onLeave, tone: "" },
                      ].map((t) => (
                        <div key={t.label} className="rounded-[var(--radius-control)] bg-surface-2 p-3">
                          <div className="text-xs text-ink-2">{t.label}</div>
                          <div className={`font-display text-xl font-semibold ${t.tone}`}>{t.value}</div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </CardBody>
          </Card>
        </BentoArea>

        <BentoArea area="onboarding">
          <Card className="h-full">
            <CardHeader title="New hires" meta="Last 90 days" />
            <div className="flex divide-x divide-dashed divide-border px-2 pb-4">
              {onboardingQuery.data?.map((stage) => (
                <div key={stage.stage} className="flex-1 px-2 py-3 text-center">
                  <div className="font-num font-display text-[28px] font-semibold tracking-[-0.02em]">
                    {stage.count}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-2">{stage.stage}</div>
                </div>
              ))}
            </div>
          </Card>
        </BentoArea>
      </div>


      <PostAnnouncementDialog
        open={announcementOpen}
        onClose={() => setAnnouncementOpen(false)}
        onSubmitted={() => toast.show("Announcement posted — visible to all employees now.")}
      />
    </div>
  );
}
