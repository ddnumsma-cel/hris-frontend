import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { Button } from "@/components/ui/Button";
import { LeaveBar } from "@/components/ui/LeaveBar";
import {
  BentoArea,
  BentoHero,
  EmptyNote,
  KpiStack,
  ListRow,
  ListRowSkeletons,
  QuickActionRow,
  QuickActionTile,
} from "@/components/ui/Bento";
import {
  fetchAnnouncements,
  fetchCurrentEmployee,
  fetchEmployeeBenefits,
  fetchEmployeeThirteenthMonth,
  fetchMyLeaveRequests,
  fetchMyPersonnelChecklist,
  fetchMyProfessionalLicense,
  fetchMyTrainingRecords,
} from "@/lib/api";
import { getCpdStatus, isTrainingOverdue } from "@/lib/automation";
import { formatPHP, formatToday } from "@/lib/format";
import {
  BellIcon,
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  GraduationCapIcon,
  ShieldIcon,
  WalletIcon,
} from "@/components/icons";
import { AttentionPanel, type AttentionItem } from "@/components/shared/AttentionPanel";
import { BenefitsCard } from "./BenefitsCard";
import { AttendanceClock } from "@/components/shared/AttendanceClock";
import { FileMyLeaveDialog } from "./EmployeeLeave";
import { myAttendance, myId, myLeave, myPayslips } from "@/lib/ess/api";
import { policiesFor } from "@/lib/policies";
import { RequestCertificateDialog } from "./RequestCertificateDialog";
import { printPayslip } from "./printTemplates";
import type { Payslip } from "@/lib/types";


export function EmployeeOverview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const employeeQuery = useQuery({ queryKey: ["employee", "me"], queryFn: fetchCurrentEmployee });
  // The yearly leave credit pool, same as the My leave page.
  const creditsQuery = useQuery({
    queryKey: ["ess", "leave", "overview"],
    queryFn: async () => (await myLeave()).credits,
  });
  // Same payslips as the Payslips page (computed by the payroll engine), newest first.
  const payslipsQuery = useQuery({
    queryKey: ["ess", "payslips", "overview"],
    queryFn: async (): Promise<Payslip[]> =>
      (await myPayslips()).map((s) => ({
        id: s.period.id,
        cutoffLabel: s.period.label,
        gross: s.line.gross,
        deductions: Math.round((s.line.gross - s.line.net) * 100) / 100,
        net: s.line.net,
        status: s.released ? "Paid" : "Processing",
        breakdown: [
          { label: "Basic pay", amount: s.line.basic, kind: "earning" },
          ...(s.line.overtime ? [{ label: "Overtime", amount: s.line.overtime, kind: "earning" as const }] : []),
          ...(s.line.premiums ? [{ label: "Holiday and night pay", amount: s.line.premiums, kind: "earning" as const }] : []),
          ...(s.line.deductions ? [{ label: "Absences and undertime", amount: s.line.deductions, kind: "deduction" as const }] : []),
          { label: "SSS", amount: s.line.sssEe, kind: "deduction" },
          { label: "PhilHealth", amount: s.line.phEe, kind: "deduction" },
          { label: "Pag-IBIG", amount: s.line.piEe, kind: "deduction" },
          { label: "Withholding tax", amount: s.line.tax, kind: "deduction" },
        ],
      })),
  });
  const announcementsQuery = useQuery({ queryKey: ["employee", "announcements"], queryFn: fetchAnnouncements });
  // From the time clock, last 2 weeks.
  const dtrQuery = useQuery({
    queryKey: ["ess", "attendance", "overview"],
    queryFn: async () => {
      const { days } = await myAttendance();
      const worked = days.filter((d) => d.timeIn);
      return { onTimeRatePercent: worked.length ? Math.round((worked.filter((d) => d.lateMinutes === 0).length / worked.length) * 100) : 100, lateCount: days.filter((d) => d.lateMinutes > 0).length, absentCount: days.filter((d) => d.status === "absent").length };
    },
  });
  const thirteenthMonthQuery = useQuery({
    queryKey: ["employee", "thirteenth-month"],
    queryFn: fetchEmployeeThirteenthMonth,
  });
  const benefitsQuery = useQuery({ queryKey: ["employee", "benefits"], queryFn: fetchEmployeeBenefits });
  const myTrainingsQuery = useQuery({ queryKey: ["employee", "my-trainings"], queryFn: fetchMyTrainingRecords });
  const myLeaveQuery = useQuery({ queryKey: ["employee", "my-leave-requests"], queryFn: fetchMyLeaveRequests });
  const policiesQuery = useQuery({ queryKey: ["employee", "policies"], queryFn: () => policiesFor(myId()) });
  const licenseQuery = useQuery({
    queryKey: ["employee", "professional-license"],
    queryFn: fetchMyProfessionalLicense,
  });
  const checklistQuery = useQuery({
    queryKey: ["employee", "personnel-checklist"],
    queryFn: fetchMyPersonnelChecklist,
  });

  const employee = employeeQuery.data;
  // The hero shows the last released cut-off; the running one is still a preview.
  const latestPayslip = payslipsQuery.data?.find((p) => p.status === "Paid") ?? payslipsQuery.data?.[0];

  const attentionItems: AttentionItem[] = [];
  if (employee && !employee.faceEnrolled) {
    attentionItems.push({
      id: "face-id",
      icon: <CameraIcon className="h-4 w-4" />,
      title: "Face ID isn't enrolled yet",
      detail: "You'll need it to clock in remotely without a physical scanner.",
      tone: "info",
      action: { label: "Enroll", onClick: () => navigate("/employee/201-file") },
    });
  }
  for (const b of benefitsQuery.data ?? []) {
    if (b.status === "Pending") {
      attentionItems.push({
        id: `benefit-${b.id}`,
        icon: <WalletIcon className="h-4 w-4" />,
        title: `${b.name} enrollment is pending`,
        detail: b.memberId,
        tone: "warn",
        action: { label: "Review", onClick: () => navigate("/employee/benefits") },
      });
    }
  }
  for (const t of myTrainingsQuery.data ?? []) {
    if (isTrainingOverdue(t)) {
      attentionItems.push({
        id: `training-${t.id}`,
        icon: <GraduationCapIcon className="h-4 w-4" />,
        title: `${t.course} is overdue`,
        detail: `Was due ${t.dueDate}`,
        tone: "crit",
        action: { label: "View", onClick: () => navigate("/employee/trainings") },
      });
    }
  }
  for (const r of myLeaveQuery.data ?? []) {
    if (r.status === "Declined") {
      attentionItems.push({
        id: `leave-${r.id}`,
        icon: <CalendarIcon className="h-4 w-4" />,
        title: `Your ${r.type} request was declined`,
        detail: r.detail,
        tone: "info",
        action: { label: "View", onClick: () => navigate("/employee/leave") },
      });
    }
  }
  if (licenseQuery.data) {
    const cpd = getCpdStatus(licenseQuery.data);
    if (cpd.status === "Due soon" || cpd.status === "Overdue") {
      attentionItems.push({
        id: `cpd-${licenseQuery.data.id}`,
        icon: <ShieldIcon className="h-4 w-4" />,
        title: `Your CPD units are ${cpd.status === "Overdue" ? "past deadline" : "due soon"}`,
        detail: cpd.note,
        tone: cpd.status === "Overdue" ? "crit" : "warn",
        action: { label: "View", onClick: () => navigate("/employee/201-file") },
      });
    }
  }
  const unreadPolicies = (policiesQuery.data ?? []).filter((p) => p.requireAck && !p.acknowledgedAt);
  if (unreadPolicies.length > 0) {
    attentionItems.push({
      id: "policies-unread",
      icon: <FileIcon className="h-4 w-4" />,
      title: unreadPolicies.length === 1 ? `Please read ${unreadPolicies[0].title}` : `${unreadPolicies.length} company policies to read`,
      detail: "HR needs you to confirm you've read and understood them.",
      tone: "warn",
      action: { label: "Read", onClick: () => navigate("/employee/policies") },
    });
  }
  const missingDocs = (checklistQuery.data ?? []).filter((d) => d.status === "Missing");
  if (missingDocs.length > 0) {
    attentionItems.push({
      id: "personnel-docs-missing",
      icon: <FileIcon className="h-4 w-4" />,
      title: `${missingDocs.length} document${missingDocs.length === 1 ? "" : "s"} still needed for your 201 file`,
      detail: missingDocs.map((d) => d.type).join(", "),
      tone: "warn",
      action: { label: "Upload", onClick: () => navigate("/employee/201-file") },
    });
  }

  function handleDownloadPayslip() {
    if (!latestPayslip) return;
    printPayslip(employee, latestPayslip);
  }

  return (
    <div className="dash">
      <ContentHead
        title={employee ? `Magandang umaga, ${employee.name.split(" ")[0]}` : "Magandang umaga"}
        subtitle={`${formatToday()} · ${employee?.department ?? "…"}, ${employee?.office ?? ""} · ID ${employee?.id ?? ""}`}
        actions={
          <>
            <AttendanceClock employeeId={employee?.id} personName={employee?.name.split(" ")[0]} actor={employee?.name ?? "Employee"} needsEnrollment={!!employee && !employee.faceEnrolled} />
            <Button icon={<CalendarIcon className="h-3.75 w-3.75" />} onClick={() => setLeaveDialogOpen(true)}>
              File Leave
            </Button>
          </>
        }
      />

      <div className="bento bento-employee">
        {/* Hero: this cutoff's net pay, with recent payslips as amount rows. */}
        <BentoArea area="hero">
          <BentoHero
            title="Take-home pay · last cut-off"
            value={latestPayslip ? formatPHP(latestPayslip.net) : <Skeleton className="h-10 w-44" />}
            label={<span className="text-good">{latestPayslip?.cutoffLabel ?? ""}</span>}
            action={
              <button
                type="button"
                onClick={() => navigate("/employee/payslips")}
                className="rounded-[10px] border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
              >
                View all
              </button>
            }
          >
            <div className="mb-1 text-[15px] font-semibold tracking-[-0.01em]">Recent payslips</div>
            <div className="flex flex-col gap-0.5">
              {payslipsQuery.isLoading && <ListRowSkeletons />}
              {payslipsQuery.data?.length === 0 && <EmptyNote>No payslips yet.</EmptyNote>}
              {payslipsQuery.data?.map((p) => (
                <ListRow
                  key={p.id}
                  leading={<WalletIcon />}
                  title={p.cutoffLabel}
                  subtitle={`Gross ${formatPHP(p.gross)} · Deductions ${formatPHP(p.deductions)}`}
                  value={formatPHP(p.net)}
                  positive
                  status={p.status}
                />
              ))}
            </div>
          </BentoHero>
        </BentoArea>

        <BentoArea area="kpis">
          <KpiStack>
            <StatTile
              label="13th month pay accrued"
              value={
                thirteenthMonthQuery.data ? (
                  formatPHP(thirteenthMonthQuery.data.accrued)
                ) : (
                  <Skeleton className="h-7 w-24" />
                )
              }
              delta={thirteenthMonthQuery.data ? `as of ${thirteenthMonthQuery.data.asOfLabel}` : undefined}
            />
            <StatTile
              label="On-time rate, last 2 weeks"
              value={dtrQuery.data ? `${dtrQuery.data.onTimeRatePercent}%` : <Skeleton className="h-7 w-14" />}
              delta={
                dtrQuery.data ? `${dtrQuery.data.lateCount} late, ${dtrQuery.data.absentCount} absences` : undefined
              }
              tone="good"
              icon={<CheckIcon className="h-3 w-3" />}
            />
            <StatTile
              label="Leave credits left"
              value={
                creditsQuery.data ? (
                  <>
                    {creditsQuery.data.available}{" "}
                    <span className="text-sm font-semibold text-ink-3">/ {creditsQuery.data.total} leaves</span>
                  </>
                ) : (
                  <Skeleton className="h-7 w-20" />
                )
              }
              delta={creditsQuery.data ? `${creditsQuery.data.used + creditsQuery.data.pending} used or waiting` : undefined}
            />
          </KpiStack>
        </BentoArea>

        {/* Right column: quick actions, then announcements. */}
        <BentoArea area="actions">
          <Card>
            <CardHeader title="Quick actions" />
            <CardBody>
              <QuickActionRow>
                <QuickActionTile icon={<CalendarIcon />} label="File a Leave" onClick={() => setLeaveDialogOpen(true)} />
                <QuickActionTile icon={<FileIcon />} label="Request COE" onClick={() => setCertDialogOpen(true)} />
                <QuickActionTile
                  icon={<DownloadIcon />}
                  label="Print Payslip"
                  onClick={handleDownloadPayslip}
                  disabled={!latestPayslip}
                />
                <QuickActionTile
                  icon={<FolderIcon />}
                  label="View 201 File"
                  onClick={() => navigate("/employee/201-file")}
                />
              </QuickActionRow>
            </CardBody>
          </Card>
        </BentoArea>

        <BentoArea area="feed">
          <Card className="h-full">
            <CardHeader title="Announcements" meta="Cebu HQ" />
            <CardBody className="flex flex-col gap-1">
              {announcementsQuery.isLoading && <ListRowSkeletons />}
              {announcementsQuery.data?.length === 0 && <EmptyNote>No announcements right now.</EmptyNote>}
              {announcementsQuery.data?.map((a) => (
                <ListRow key={a.id} leading={<BellIcon />} title={a.title} subtitle={a.postedOn} />
              ))}
            </CardBody>
          </Card>
        </BentoArea>

        {/* Progress: leave used against each entitlement. */}
        <BentoArea area="leave">
          <Card className="h-full">
            <CardHeader title="Leave credits" meta={`${new Date().getFullYear()}`} />
            <CardBody className="flex flex-col gap-3.5">
              {creditsQuery.isLoading && <Skeleton className="h-16 w-full" />}
              {creditsQuery.data && (
                <>
                  <LeaveBar label="Leaves left" used={creditsQuery.data.used + creditsQuery.data.pending} entitlement={creditsQuery.data.total} />
                  <p className="text-xs text-ink-2">
                    {creditsQuery.data.used} used · {creditsQuery.data.pending} waiting for HR. Each leave uses 1, however many days.
                  </p>
                </>
              )}
            </CardBody>
          </Card>
        </BentoArea>

        {/* Tip: the payslip deductions note. */}
        <BentoArea area="tip">
          <Card className="h-full">
            <CardBody className="flex h-full flex-col gap-3">
              <span className="dash-row-leading" style={{ background: "var(--grad-primary)", color: "var(--on-accent)" }}>
                <WalletIcon />
              </span>
              <p className="text-[13px] text-ink-2">
                Deductions include SSS, PhilHealth, Pag-IBIG and withholding tax. Download BIR Form 2316 anytime from
                Payslips.
              </p>
              <button
                type="button"
                onClick={() => navigate("/employee/payslips")}
                className="mt-auto self-start text-[13px] font-medium text-brand-ink hover:underline"
              >
                Read more ›
              </button>
            </CardBody>
          </Card>
        </BentoArea>

        <BentoArea area="benefits">
          <BenefitsCard />
        </BentoArea>
      </div>

      <AttentionPanel items={attentionItems} />

      {leaveDialogOpen && <FileMyLeaveDialog onClose={() => setLeaveDialogOpen(false)} />}

      <RequestCertificateDialog
        open={certDialogOpen}
        onClose={() => setCertDialogOpen(false)}
        onSubmitted={() => {
          queryClient.invalidateQueries({ queryKey: ["employee", "certificate-requests"] });
          toast.show("Your certificate request was submitted. Track it under Certificates.");
        }}
      />

    </div>
  );
}
