import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
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
  QuickActionRow,
  QuickActionTile,
} from "@/components/ui/Bento";
import { useToast } from "@/components/ui/ToastContext";
import {
  BellIcon,
  CheckIcon,
  DownloadIcon,
  FileQuestionIcon,
  IdCardIcon,
  ShieldIcon,
  UserPlusIcon,
  UsersIcon,
} from "@/components/icons";
import { AttentionPanel, type AttentionItem } from "@/components/shared/AttentionPanel";
import { ClockInOutControl } from "@/components/shared/ClockInOutControl";
import { PersonnelFileDialog } from "@/components/shared/PersonnelFileDialog";
import {
  fetchAdminOverviewStats,
  fetchCertificateRequestsForReview,
  fetchComplianceCalendar,
  fetchEmployeeDirectory,
  fetchHeadcountByOffice,
  fetchOnboardingPipeline,
  fetchAllPersonnelDocuments,
  fetchAllPersonnelProfiles,
  fetchPayrollCostBreakdown,
  fetchPayrollRunSteps,
  fetchProfessionalLicenses,
} from "@/lib/api";
import {
  getAge,
  getCpdStatus,
  getEffectiveCompliance,
  getEffectivePayrollSteps,
  getExpiringPersonnelFields,
  OPTIONAL_RETIREMENT_AGE,
} from "@/lib/automation";
import { downloadTextFile, toCsv } from "@/lib/download";
import { formatPHPCompact, formatToday } from "@/lib/format";
import { currentAdmin } from "@/lib/mockData";
import type { Employee } from "@/lib/types";
import { AddEmployeeDialog } from "./AddEmployeeDialog";
import { HeadcountChart } from "./HeadcountChart";
import { PayrollCostChart } from "./PayrollCostChart";
import { PostAnnouncementDialog } from "./PostAnnouncementDialog";
import { RecruitmentPipeline } from "./RecruitmentPipeline";

const complianceVariant: Record<string, ChipVariant> = {
  Filed: "good",
  "Due soon": "warn",
  Overdue: "crit",
};

const employeeStatusVariant: Record<string, ChipVariant> = {
  Active: "good",
  "On leave": "neutral",
};

export function AdminOverview() {
  const navigate = useNavigate();
  const toast = useToast();
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [profileEmployee, setProfileEmployee] = useState<Employee | null>(null);

  const statsQuery = useQuery({ queryKey: ["admin", "overview-stats"], queryFn: fetchAdminOverviewStats });
  const runStepsQuery = useQuery({ queryKey: ["admin", "payroll-run-steps"], queryFn: fetchPayrollRunSteps });
  const headcountQuery = useQuery({ queryKey: ["admin", "headcount-by-office"], queryFn: fetchHeadcountByOffice });
  const costQuery = useQuery({ queryKey: ["admin", "payroll-cost"], queryFn: fetchPayrollCostBreakdown });
  const complianceQuery = useQuery({ queryKey: ["admin", "compliance-calendar"], queryFn: fetchComplianceCalendar });
  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const onboardingQuery = useQuery({ queryKey: ["admin", "onboarding-pipeline"], queryFn: fetchOnboardingPipeline });
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
  const payrollSteps = runStepsQuery.data ? getEffectivePayrollSteps(runStepsQuery.data) : undefined;

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
        action: { label: "Review", onClick: () => navigate("/admin/compliance") },
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
        action: { label: "Review", onClick: () => navigate("/admin/compliance") },
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
            <Button icon={<UserPlusIcon className="h-3.75 w-3.75" />} onClick={() => setAddEmployeeOpen(true)}>
              Add employee
            </Button>
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
              value={
                stats ? (
                  stats.openPositions.audit + stats.openPositions.tax + stats.openPositions.legal
                ) : (
                  <Skeleton className="h-7 w-10" />
                )
              }
              delta={
                stats
                  ? `${stats.openPositions.audit} Audit · ${stats.openPositions.tax} Tax · ${stats.openPositions.legal} Legal`
                  : undefined
              }
            />
            <StatTile
              label="October payroll"
              value={stats ? formatPHPCompact(stats.payrollRunTotal) : <Skeleton className="h-7 w-20" />}
              delta={stats ? `Cutoff ${stats.payrollCutoffLabel}` : undefined}
              tone="warn"
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
                <QuickActionTile icon={<DownloadIcon />} label="Export report" onClick={handleExportReport} />
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
            <CardHeader title="October 2026 payroll run" action={<Chip variant="warn">In progress</Chip>} />
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
              title="Payroll cost breakdown"
              meta={stats ? `Oct cutoff · ${formatPHPCompact(stats.payrollRunTotal)}` : undefined}
            />
            <CardBody>
              {costQuery.data ? <PayrollCostChart data={costQuery.data} /> : <Skeleton className="h-9 w-full" />}
            </CardBody>
          </Card>
        </BentoArea>

        <BentoArea area="onboarding">
          <Card className="h-full">
            <CardHeader title="Onboarding pipeline" meta="September batch" />
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

      {/* Two short lists side by side on wide screens, so their actions sit next to the text. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AttentionPanel items={attentionItems} />
        <RecruitmentPipeline />
      </div>

      <Card>
        <CardHeader
          title="Employee directory"
          action={
            <button
              type="button"
              onClick={() => navigate("/admin/directory")}
              className="flex items-center gap-1 text-xs font-semibold text-brand-ink"
            >
              Open full directory
            </button>
          }
        />
        {/* One card per person: fills wide screens instead of a sparse table. */}
        <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {directoryQuery.isLoading &&
            Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 flex-none rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
              </li>
            ))}
          {directoryQuery.data?.map((emp) => (
            <li
              key={emp.id}
              className="flex flex-col rounded-xl border border-border p-4 transition-colors hover:bg-surface-2/60"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink-2">
                  {emp.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{emp.name}</div>
                  <div className="font-num truncate text-xs text-ink-2">{emp.id}</div>
                </div>
                <Chip variant={employeeStatusVariant[emp.status]}>{emp.status}</Chip>
              </div>
              <dl className="mt-3.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="text-ink-2">Department</dt>
                <dd className="truncate">{emp.department}</dd>
                <dt className="text-ink-2">Office</dt>
                <dd className="truncate">{emp.office}</dd>
              </dl>
              <button
                type="button"
                onClick={() => setProfileEmployee(emp)}
                className="mt-4 self-start rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-surface-2"
              >
                Open 201 file
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <AddEmployeeDialog
        open={addEmployeeOpen}
        onClose={() => setAddEmployeeOpen(false)}
        onSubmitted={() => toast.show("New employee added to the directory.")}
      />

      <PersonnelFileDialog
        subject={
          profileEmployee && {
            id: profileEmployee.id,
            name: profileEmployee.name,
            initials: profileEmployee.initials,
            position: profileEmployee.position,
            department: profileEmployee.department,
            office: profileEmployee.office,
            cluster: profileEmployee.cluster,
            status: profileEmployee.status,
          }
        }
        onClose={() => setProfileEmployee(null)}
        documentsHref={(id) => `/admin/directory?employee=${id}`}
      />

      <PostAnnouncementDialog
        open={announcementOpen}
        onClose={() => setAnnouncementOpen(false)}
        onSubmitted={() => toast.show("Announcement posted — visible to all employees now.")}
      />
    </div>
  );
}
