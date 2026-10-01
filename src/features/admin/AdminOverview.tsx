import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
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
  ArrowRightIcon,
  BellIcon,
  CheckIcon,
  DownloadIcon,
  FileQuestionIcon,
  IdCardIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";
import { AttentionPanel, type AttentionItem } from "@/components/shared/AttentionPanel";
import { ClockInOutControl } from "@/components/shared/ClockInOutControl";
import {
  fetchAdminOverviewStats,
  fetchCertificateRequestsForReview,
  fetchComplianceCalendar,
  fetchEmployeeDirectory,
  fetchHeadcountByOffice,
  fetchOnboardingSubmissions,
  fetchAllPersonnelDocuments,
  fetchAllPersonnelProfiles,
  fetchJobRequisitions,
  fetchPayrollRegister,
  fetchPayrollRun,
  fetchProfessionalLicenses,
} from "@/lib/api";
import {
  getAge,
  getCpdStatus,
  getEffectiveCompliance,
  getExpiringPersonnelFields,
  OPTIONAL_RETIREMENT_AGE,
} from "@/lib/automation";
import { downloadTextFile, toCsv } from "@/lib/download";
import { formatPHPCompact, formatToday } from "@/lib/format";
import { computePayroll, payrollVariance } from "@/lib/payroll";
import { currentAdmin } from "@/lib/mockData";
import { HeadcountChart } from "./HeadcountChart";
import { PayrollCostChart } from "./PayrollCostChart";
import { PostAnnouncementDialog } from "./PostAnnouncementDialog";

const complianceVariant: Record<string, ChipVariant> = {
  Filed: "good",
  "Due soon": "warn",
  Overdue: "crit",
};

export function AdminOverview() {
  const navigate = useNavigate();
  const toast = useToast();
  const [announcementOpen, setAnnouncementOpen] = useState(false);

  const statsQuery = useQuery({ queryKey: ["admin", "overview-stats"], queryFn: fetchAdminOverviewStats });
  // Same queries as the Payroll Runs and Recruitment pages, so the figures here always match them.
  const registerQuery = useQuery({ queryKey: ["manager", "payroll-register"], queryFn: fetchPayrollRegister });
  const runQuery = useQuery({ queryKey: ["admin", "payroll-run"], queryFn: fetchPayrollRun });
  const requisitionsQuery = useQuery({ queryKey: ["admin", "job-requisitions"], queryFn: fetchJobRequisitions });
  const headcountQuery = useQuery({ queryKey: ["admin", "headcount-by-office"], queryFn: fetchHeadcountByOffice });
  const complianceQuery = useQuery({ queryKey: ["admin", "compliance-calendar"], queryFn: fetchComplianceCalendar });
  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const pipelineQuery = useQuery({ queryKey: ["admin", "onboarding-submissions"], queryFn: fetchOnboardingSubmissions });
  const certificatesQuery = useQuery({
    queryKey: ["admin", "certificate-requests"],
    queryFn: fetchCertificateRequestsForReview,
  });
  const licensesQuery = useQuery({
    queryKey: ["admin", "professional-licenses"],
    queryFn: fetchProfessionalLicenses,
  });
  const personnelDocumentsQuery = useQuery({
    queryKey: ["admin", "personnel-documents"],
    queryFn: fetchAllPersonnelDocuments,
  });
  const personnelProfilesQuery = useQuery({
    queryKey: ["admin", "personnel-profiles"],
    queryFn: fetchAllPersonnelProfiles,
  });

  const stats = statsQuery.data;
  const run = runQuery.data;
  const released = Boolean(run?.releasedAt);
  const payroll = (registerQuery.data ?? []).map((r) => ({ pay: computePayroll(r.entry), variance: payrollVariance(r.entry) }));
  const payrollTotal = (pick: (p: (typeof payroll)[number]["pay"]) => number) => payroll.reduce((s, r) => s + pick(r.pay), 0);
  const grossTotal = payrollTotal((p) => p.gross);
  const varianceCount = payroll.filter((r) => r.variance).length;
  const grossBreakdown =
    grossTotal > 0
      ? [
          { label: "Basic pay" as const, percent: Math.round((payrollTotal((p) => p.basicPay) / grossTotal) * 100) },
          { label: "Overtime" as const, percent: Math.round((payrollTotal((p) => p.overtimePay) / grossTotal) * 100) },
          { label: "Allowances" as const, percent: Math.round((payrollTotal((p) => p.allowance) / grossTotal) * 100) },
        ]
      : undefined;
  const payrollSteps = run && [
    { label: `Timekeeping locked — ${run.cutoff.timekeepingLockedOn}`, status: "done" },
    { label: `Payroll computed — ${payroll.length} employees`, status: "done" },
    {
      label: varianceCount > 0 && !released ? `Review & approve — ${varianceCount} variances` : "Review & approve",
      status: released ? "done" : "current",
    },
    { label: `Payslips released — ${run.cutoff.payDate.replace(/, \d{4}$/, "")}`, status: released ? "done" : "pending" },
  ];
  const requisitions = requisitionsQuery.data ?? [];
  const openings = requisitions.reduce((s, r) => s + r.openings, 0);

  const effectiveCompliance = (complianceQuery.data ?? []).map((item) => ({
    item,
    ...getEffectiveCompliance(item),
  }));

  const attentionItems: AttentionItem[] = [];
  for (const { item, status, note } of effectiveCompliance) {
    if (status === "Overdue" || status === "Due soon") {
      attentionItems.push({
        id: `compliance-${item.id}`,
        icon: <ShieldIcon className="h-4 w-4" />,
        title: `${item.filing} (${item.agency}) is ${status.toLowerCase()}`,
        detail: note,
        tone: status === "Overdue" ? "crit" : "warn",
        action: { label: "Review", onClick: () => navigate("/admin/payroll-runs?tab=remittances") },
      });
    }
  }
  for (const r of certificatesQuery.data ?? []) {
    if (r.status !== "Pending") continue;
    const ageDays = Math.max(0, Math.round((Date.now() - new Date(r.requestedOn).getTime()) / 86_400_000));
    if (ageDays >= 3) {
      attentionItems.push({
        id: `cert-${r.id}`,
        icon: <FileQuestionIcon className="h-4 w-4" />,
        title: `${r.type} request has waited ${ageDays} days`,
        detail: r.purpose,
        tone: ageDays >= 5 ? "crit" : "warn",
        action: { label: "Process", onClick: () => navigate("/admin/certificates") },
      });
    }
  }
  for (const license of licensesQuery.data ?? []) {
    const cpd = getCpdStatus(license);
    if (cpd.status === "Overdue" || cpd.status === "Due soon") {
      attentionItems.push({
        id: `cpd-${license.id}`,
        icon: <ShieldIcon className="h-4 w-4" />,
        title: `${license.employeeName}'s CPD units are ${cpd.status === "Overdue" ? "past deadline" : "due soon"}`,
        detail: cpd.note,
        tone: cpd.status === "Overdue" ? "crit" : "warn",
        action: { label: "Review", onClick: () => navigate("/admin/payroll-runs?tab=remittances") },
      });
    }
  }
  const employeeNameById = new Map((directoryQuery.data ?? []).map((e) => [e.id, e.name]));
  for (const doc of personnelDocumentsQuery.data ?? []) {
    for (const field of getExpiringPersonnelFields(doc)) {
      attentionItems.push({
        id: `personnel-${doc.id}-${field.label}`,
        icon: <IdCardIcon className="h-4 w-4" />,
        title: `${employeeNameById.get(doc.employeeId) ?? doc.employeeId}'s ${field.label} is ${field.status === "Overdue" ? "expired" : "expiring soon"}`,
        detail: field.note,
        tone: field.status === "Overdue" ? "crit" : "warn",
        action: { label: "Review", onClick: () => navigate("/admin/directory") },
      });
    }
  }
  for (const profile of personnelProfilesQuery.data ?? []) {
    if (!profile.birthDate) continue;
    const age = getAge(profile.birthDate);
    if (age !== null && age >= OPTIONAL_RETIREMENT_AGE) {
      attentionItems.push({
        id: `retirement-${profile.employeeId}`,
        icon: <UsersIcon className="h-4 w-4" />,
        title: `${employeeNameById.get(profile.employeeId) ?? profile.employeeId} is retirement-eligible`,
        detail: `${age} years old — optional retirement age under RA 7641`,
        tone: "info",
        action: { label: "Review", onClick: () => navigate(`/admin/directory?employee=${profile.employeeId}`) },
      });
    }
  }

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
        subtitle={`All offices · Cebu HQ, Manila, Davao · ${formatToday()}`}
        actions={
          <>
            <ClockInOutControl personName={currentAdmin.name.split(" ")[0]} />
          </>
        }
      />

      <div className="bento bento-admin">
        {/* Hero: total headcount, split by office. */}
        <BentoArea area="hero">
          <BentoHero
            title="Headcount by office"
            value={stats?.totalHeadcount ?? <Skeleton className="h-10 w-24" />}
            label={
              stats ? (
                <span className="text-good">+{stats.newHiresThisMonth} this month</span>
              ) : undefined
            }
          >
            <div className="flex h-full flex-col justify-end">
              {headcountQuery.data ? (
                <HeadcountChart data={headcountQuery.data} />
              ) : (
                <Skeleton className="h-36 w-full" />
              )}
            </div>
          </BentoHero>
        </BentoArea>

        <BentoArea area="kpis">
          <KpiStack>
            <StatTile
              label="Attrition rate, YTD"
              value={stats ? `${stats.attritionRateYtd}%` : <Skeleton className="h-7 w-14" />}
              delta="24 separations / 2026"
            />
            <StatTile
              label="Open positions"
              value={requisitionsQuery.data ? openings : <Skeleton className="h-7 w-10" />}
              delta={requisitionsQuery.data ? `Across ${requisitions.length} roles` : undefined}
            />
            <StatTile
              label="Net payroll this cutoff"
              value={registerQuery.data ? formatPHPCompact(payrollTotal((p) => p.net)) : <Skeleton className="h-7 w-20" />}
              delta={run ? `${run.cutoff.shortLabel} · ${released ? "released" : "in review"}` : undefined}
              tone={released ? "good" : "warn"}
            />
          </KpiStack>
        </BentoArea>

        {/* Right column: quick actions, then the compliance calendar as a list. */}
        <BentoArea area="actions">
          <Card>
            <CardHeader title="Quick actions" />
            <CardBody>
              <QuickActionRow>
                <QuickActionTile
                  icon={<BellIcon />}
                  label="Post announcement"
                  onClick={() => setAnnouncementOpen(true)}
                />
                <QuickActionTile icon={<DownloadIcon />} label="Export directory" onClick={handleExportReport} />
              </QuickActionRow>
            </CardBody>
          </Card>
        </BentoArea>

        <BentoArea area="feed">
          <Card className="h-full">
            <CardHeader title="Compliance calendar" meta="September–October 2026" />
            <CardBody className="flex flex-col gap-1">
              {complianceQuery.isLoading && <ListRowSkeletons count={4} />}
              {complianceQuery.data?.length === 0 && <EmptyNote>No filings on the calendar.</EmptyNote>}
              {effectiveCompliance.map(({ item, status, note }) => (
                <ListRow
                  key={item.id}
                  leading={<ShieldIcon />}
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

        {/* Progress: payroll run steps. */}
        <BentoArea area="payroll">
          <Card className="h-full">
            <CardHeader
              title={run ? `Payroll run · ${run.cutoff.label}` : "Payroll run"}
              action={
                <button
                  type="button"
                  onClick={() => navigate("/admin/payroll-runs")}
                  className="text-xs font-semibold text-brand-ink hover:underline"
                >
                  {released ? "Released · view" : "Review payroll"}
                </button>
              }
            />
            <CardBody className="flex flex-col gap-4">
              {payrollSteps ? (
                <ProgressMeter
                  percent={(payrollSteps.filter((s) => s.status === "done").length / payrollSteps.length) * 100}
                  start={`${payrollSteps.filter((s) => s.status === "done").length} done`}
                  end={`${payrollSteps.length} steps`}
                />
              ) : (
                <Skeleton className="h-3.5 w-full" />
              )}
              <div className="grid gap-2.5 sm:grid-cols-2">
                {payrollSteps?.map((step) => (
                  <div
                    key={step.label}
                    className={`flex items-center gap-2.5 text-sm ${step.status === "pending" ? "text-ink-3" : ""}`}
                  >
                    <span
                      className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-semibold ${
                        step.status === "done"
                          ? "bg-good-tint text-good"
                          : step.status === "current"
                            ? "bg-brand-tint text-brand-ink"
                            : "bg-surface-2 text-ink-3"
                      }`}
                    >
                      {step.status === "done" ? <CheckIcon className="h-3 w-3" /> : null}
                    </span>
                    {step.label}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </BentoArea>

        {/* Breakdown: segmented bar with a percentage legend. */}
        <BentoArea area="cost">
          <Card className="h-full">
            <CardHeader
              title="Gross pay breakdown"
              meta={run && registerQuery.data ? `${run.cutoff.shortLabel} · ${formatPHPCompact(grossTotal)}` : undefined}
            />
            <CardBody>
              {grossBreakdown ? (
                <PayrollCostChart data={grossBreakdown} />
              ) : registerQuery.data ? (
                <p className="text-xs text-ink-2">No payroll yet. Costs show here once employees are on this cutoff.</p>
              ) : (
                <Skeleton className="h-9 w-full" />
              )}
            </CardBody>
          </Card>
        </BentoArea>

        <BentoArea area="onboarding">
          <Card className="h-full">
            <CardHeader title="Pipeline" />
            <Link to="/admin/pipeline" className="flex items-center justify-between gap-3 px-4.5 pb-4 hover:text-brand-ink">
              <div>
                <div className="font-num font-display text-[28px] font-semibold tracking-[-0.02em]">{pipelineQuery.data ? pipelineQuery.data.length : <Skeleton className="h-8 w-8" />}</div>
                <div className="mt-0.5 text-xs text-ink-2">Onboarding forms waiting for review</div>
              </div>
              <ArrowRightIcon className="h-4 w-4 flex-none text-ink-3" />
            </Link>
          </Card>
        </BentoArea>
      </div>

      <AttentionPanel items={attentionItems} />

      <PostAnnouncementDialog
        open={announcementOpen}
        onClose={() => setAnnouncementOpen(false)}
        onSubmitted={() => toast.show("Announcement posted — visible to all employees now.")}
      />
    </div>
  );
}
