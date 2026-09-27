import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { StatTile } from "@/components/ui/StatTile";
import { Button } from "@/components/ui/Button";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { BellIcon, CheckIcon, DownloadIcon, FileQuestionIcon, ShieldIcon, UserPlusIcon } from "@/components/icons";
import { AttentionPanel, type AttentionItem } from "@/components/shared/AttentionPanel";
import {
  fetchAdminOverviewStats,
  fetchCertificateRequestsForReview,
  fetchComplianceCalendar,
  fetchEmployeeDirectory,
  fetchHeadcountByOffice,
  fetchOnboardingPipeline,
  fetchPayrollCostBreakdown,
  fetchPayrollRunSteps,
  fetchProfessionalLicenses,
} from "@/lib/api";
import { getCpdStatus, getEffectiveCompliance, getEffectivePayrollSteps } from "@/lib/automation";
import { downloadTextFile, toCsv } from "@/lib/download";
import { formatPHPCompact, formatToday } from "@/lib/format";
import type { Employee } from "@/lib/types";
import { AddEmployeeDialog } from "./AddEmployeeDialog";
import { EmployeeProfileDialog } from "./EmployeeProfileDialog";
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

  const stats = statsQuery.data;

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
    <>
      <ContentHead
        title="People Operations — MSMA Group"
        subtitle={`All offices · Cebu HQ, Manila, Davao · ${formatToday()}`}
        actions={
          <>
            <Button variant="ghost" icon={<DownloadIcon className="h-3.75 w-3.75" />} onClick={handleExportReport}>
              Export report
            </Button>
            <Button variant="ghost" icon={<BellIcon className="h-3.75 w-3.75" />} onClick={() => setAnnouncementOpen(true)}>
              Post announcement
            </Button>
            <Button icon={<UserPlusIcon className="h-3.75 w-3.75" />} onClick={() => setAddEmployeeOpen(true)}>
              Add employee
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] sm:gap-3.5">
        <StatTile
          label="Total headcount"
          value={stats?.totalHeadcount ?? <Skeleton className="h-7 w-14" />}
          delta={stats ? `+${stats.newHiresThisMonth} this month` : undefined}
          tone="good"
        />
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
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="October 2026 payroll run" action={<Chip variant="warn">In progress</Chip>} />
          <CardBody className="flex flex-col gap-2.5">
            {runStepsQuery.data &&
              getEffectivePayrollSteps(runStepsQuery.data).map((step) => (
              <div
                key={step.label}
                className={`flex items-center gap-2.5 text-sm ${step.status === "pending" ? "text-ink-3" : ""}`}
              >
                <span
                  className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold ${
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
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Headcount by office" meta={stats ? `${stats.totalHeadcount} total` : undefined} />
          <CardBody>{headcountQuery.data && <HeadcountChart data={headcountQuery.data} />}</CardBody>
        </Card>
      </div>

      <AttentionPanel items={attentionItems} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Compliance calendar" meta="September–October 2026" />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.82rem]">
              <thead>
                <tr>
                  {["Filing", "Agency", "Due", "Status"].map((h) => (
                    <th
                      key={h}
                      className="border-b border-border px-4 py-2.5 text-left text-[0.7rem] font-bold uppercase tracking-wider text-ink-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {complianceQuery.isLoading && <SkeletonRows columns={4} />}
                {effectiveCompliance.map(({ item, status, note }) => (
                  <tr key={item.id}>
                    <td className="border-b border-border px-4 py-2.5">{item.filing}</td>
                    <td className="border-b border-border px-4 py-2.5">{item.agency}</td>
                    <td className="border-b border-border px-4 py-2.5">{item.due}</td>
                    <td className="border-b border-border px-4 py-2.5">
                      <Chip variant={complianceVariant[status]}>
                        {status}
                        {note ? ` · ${note}` : ""}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Payroll cost breakdown"
            meta={stats ? `Oct cutoff · ${formatPHPCompact(stats.payrollRunTotal)}` : undefined}
          />
          <CardBody>{costQuery.data && <PayrollCostChart data={costQuery.data} />}</CardBody>
        </Card>
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
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {["Employee", "Department", "Office", "Status", "201 file"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-4 py-2.5 text-left text-[0.7rem] font-bold uppercase tracking-wider text-ink-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {directoryQuery.isLoading && <SkeletonRows columns={5} />}
              {directoryQuery.data?.map((emp) => (
                <tr key={emp.id}>
                  <td className="border-b border-border px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <MiniAvatar initials={emp.initials} />
                      <div>
                        <div>{emp.name}</div>
                        <div className="text-xs text-ink-2">{emp.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-border px-4 py-2.5">{emp.department}</td>
                  <td className="border-b border-border px-4 py-2.5">{emp.office}</td>
                  <td className="border-b border-border px-4 py-2.5">
                    <Chip variant={employeeStatusVariant[emp.status]}>{emp.status}</Chip>
                  </td>
                  <td className="border-b border-border px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setProfileEmployee(emp)}
                      className="font-semibold text-brand-ink"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <RecruitmentPipeline />

      <Card>
        <CardHeader title="Onboarding pipeline" meta="September batch" />
        <div className="flex divide-x divide-dashed divide-border">
          {onboardingQuery.data?.map((stage) => (
            <div key={stage.stage} className="flex-1 px-2 py-3.5 text-center">
              <div className="font-num font-display text-2xl font-extrabold">{stage.count}</div>
              <div className="mt-0.5 text-xs text-ink-2">{stage.stage}</div>
            </div>
          ))}
        </div>
      </Card>

      <AddEmployeeDialog
        open={addEmployeeOpen}
        onClose={() => setAddEmployeeOpen(false)}
        onSubmitted={() => toast.show("New employee added to the directory.")}
      />

      <EmployeeProfileDialog employee={profileEmployee} onClose={() => setProfileEmployee(null)} />

      <PostAnnouncementDialog
        open={announcementOpen}
        onClose={() => setAnnouncementOpen(false)}
        onSubmitted={() => toast.show("Announcement posted — visible to all employees now.")}
      />
    </>
  );
}
