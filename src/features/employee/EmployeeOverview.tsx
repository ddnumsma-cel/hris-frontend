import { useEffect, useState } from "react";
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
  fetchEmployeeDtrSummary,
  fetchEmployeeThirteenthMonth,
  fetchLeaveBalances,
  fetchMyLeaveRequests,
  fetchMyPersonnelChecklist,
  fetchMyProfessionalLicense,
  fetchMyTrainingRecords,
  fetchPayslips,
} from "@/lib/api";
import { getCpdStatus, isTrainingOverdue } from "@/lib/automation";
import { formatElapsed, formatPHP, formatToday } from "@/lib/format";
import {
  BellIcon,
  BuildingIcon,
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  GraduationCapIcon,
  HomeIcon,
  LoaderIcon,
  ShieldIcon,
  WalletIcon,
} from "@/components/icons";
import { AttentionPanel, type AttentionItem } from "@/components/shared/AttentionPanel";
import { BenefitsCard } from "./BenefitsCard";
import { FaceScanDialog } from "./FaceScanDialog";
import { LeaveRequestDialog } from "./LeaveRequestDialog";
import { RequestCertificateDialog } from "./RequestCertificateDialog";
import { printPayslip } from "./printTemplates";

type WorkLocation = "Onsite" | "Remote";

export function EmployeeOverview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [clockedIn, setClockedIn] = useState<Date | null>(null);
  const [scanning, setScanning] = useState(false);
  const [workLocation, setWorkLocation] = useState<WorkLocation>("Onsite");
  const [faceScanOpen, setFaceScanOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!clockedIn) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [clockedIn]);

  const employeeQuery = useQuery({ queryKey: ["employee", "me"], queryFn: fetchCurrentEmployee });
  const balancesQuery = useQuery({ queryKey: ["employee", "leave-balances"], queryFn: fetchLeaveBalances });
  const payslipsQuery = useQuery({ queryKey: ["employee", "payslips"], queryFn: fetchPayslips });
  const announcementsQuery = useQuery({ queryKey: ["employee", "announcements"], queryFn: fetchAnnouncements });
  const dtrQuery = useQuery({ queryKey: ["employee", "dtr"], queryFn: fetchEmployeeDtrSummary });
  const thirteenthMonthQuery = useQuery({
    queryKey: ["employee", "thirteenth-month"],
    queryFn: fetchEmployeeThirteenthMonth,
  });
  const benefitsQuery = useQuery({ queryKey: ["employee", "benefits"], queryFn: fetchEmployeeBenefits });
  const myTrainingsQuery = useQuery({ queryKey: ["employee", "my-trainings"], queryFn: fetchMyTrainingRecords });
  const myLeaveQuery = useQuery({ queryKey: ["employee", "my-leave-requests"], queryFn: fetchMyLeaveRequests });
  const licenseQuery = useQuery({
    queryKey: ["employee", "professional-license"],
    queryFn: fetchMyProfessionalLicense,
  });
  const checklistQuery = useQuery({
    queryKey: ["employee", "personnel-checklist"],
    queryFn: fetchMyPersonnelChecklist,
  });

  const employee = employeeQuery.data;
  const latestPayslip = payslipsQuery.data?.[0];

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
        action: { label: "View", onClick: () => navigate("/employee/leave-dtr") },
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

  function handleClockOut() {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setClockedIn(null);
      toast.show(`Clocked out — have a good evening, ${employee?.name.split(" ")[0] ?? ""}!`);
    }, 900);
  }

  function handleClockIn() {
    if (workLocation === "Remote") {
      if (!employee?.faceEnrolled) {
        toast.show("Enroll your Face ID under 201 File before clocking in remotely.", "critical");
        return;
      }
      setFaceScanOpen(true);
      return;
    }
    // Onsite attendance is verified by the office's physical fingerprint scanner (a
    // separate device), not by this laptop/browser — this just confirms that log with
    // the system, so there's no fingerprint capture step here.
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      const clockInTime = new Date();
      setClockedIn(clockInTime);
      setNow(clockInTime);
      const time = clockInTime.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
      toast.show(`Clocked in at ${time} (Onsite) — confirmed by the office biometric scanner.`);
    }, 900);
  }

  function handleClockToggle() {
    if (clockedIn) handleClockOut();
    else handleClockIn();
  }

  function handleFaceScanSuccess() {
    setFaceScanOpen(false);
    const clockInTime = new Date();
    setClockedIn(clockInTime);
    setNow(clockInTime);
    const time = clockInTime.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
    toast.show(`Face verified. Clocked in at ${time} (Remote).`);
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
            {!clockedIn && (
              <div className="flex rounded-lg border border-border bg-surface p-0.5">
                <button
                  type="button"
                  onClick={() => setWorkLocation("Onsite")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                    workLocation === "Onsite" ? "bg-brand-tint text-brand-ink" : "text-ink-2"
                  }`}
                >
                  <BuildingIcon className="h-3.5 w-3.5" />
                  Office
                </button>
                <button
                  type="button"
                  onClick={() => setWorkLocation("Remote")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                    workLocation === "Remote" ? "bg-brand-tint text-brand-ink" : "text-ink-2"
                  }`}
                >
                  <HomeIcon className="h-3.5 w-3.5" />
                  Remote
                </button>
              </div>
            )}
            {clockedIn && (
              <span className="flex items-center gap-1.5 rounded-lg border border-good/30 bg-good-tint px-2.5 py-1.5 text-xs font-semibold text-good">
                <ClockIcon className="h-3.5 w-3.5" />
                Clocked in at {clockedIn.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })} ·{" "}
                {formatElapsed(now.getTime() - clockedIn.getTime())}
              </span>
            )}
            <Button
              variant="ghost"
              icon={
                scanning ? (
                  <LoaderIcon className="h-3.75 w-3.75 animate-spin" />
                ) : (
                  <ClockIcon className="h-3.75 w-3.75" />
                )
              }
              onClick={handleClockToggle}
              disabled={scanning}
            >
              {scanning
                ? clockedIn
                  ? "Clocking out…"
                  : "Confirming with office scanner…"
                : clockedIn
                  ? "Clock Out"
                  : workLocation === "Remote"
                    ? "Clock In (Face Scan)"
                    : "Clock In"}
            </Button>
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
            title="Net pay · this cutoff"
            value={latestPayslip ? formatPHP(latestPayslip.net) : <Skeleton className="h-10 w-44" />}
            label={<span className="text-good">Sept 16–30, releases Oct 5</span>}
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
              label="On-time rate this month"
              value={dtrQuery.data ? `${dtrQuery.data.onTimeRatePercent}%` : <Skeleton className="h-7 w-14" />}
              delta={
                dtrQuery.data ? `${dtrQuery.data.lateCount} late, ${dtrQuery.data.absentCount} absences` : undefined
              }
              tone="good"
              icon={<CheckIcon className="h-3 w-3" />}
            />
            <StatTile
              label="Vacation leave available"
              value={
                balancesQuery.data
                  ? (() => {
                      const vl = balancesQuery.data.find((b) => b.type === "Vacation")!;
                      return (
                        <>
                          {vl.entitlement - vl.used}{" "}
                          <span className="text-sm font-semibold text-ink-3">/ {vl.entitlement} days</span>
                        </>
                      );
                    })()
                  : (
                    <Skeleton className="h-7 w-20" />
                  )
              }
              delta={
                balancesQuery.data
                  ? `${balancesQuery.data.find((b) => b.type === "Vacation")!.used} days used YTD`
                  : undefined
              }
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
            <CardHeader title="Leave balances" meta="2026 entitlement" />
            <CardBody className="flex flex-col gap-3.5">
              {balancesQuery.isLoading && <Skeleton className="h-16 w-full" />}
              {balancesQuery.data?.map((b) => (
                <LeaveBar key={b.type} label={b.type} used={b.used} entitlement={b.entitlement} />
              ))}
            </CardBody>
          </Card>
        </BentoArea>

        {/* Tip: the payslip deductions note. */}
        <BentoArea area="tip">
          <Card className="h-full">
            <CardBody className="flex h-full flex-col gap-3">
              <span className="dash-row-leading" style={{ background: "var(--dash-accent)", color: "#021850" }}>
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

      <LeaveRequestDialog
        open={leaveDialogOpen}
        onClose={() => setLeaveDialogOpen(false)}
        onSubmitted={() => toast.show("Your leave request was submitted and is now pending your manager's approval.")}
      />

      <RequestCertificateDialog
        open={certDialogOpen}
        onClose={() => setCertDialogOpen(false)}
        onSubmitted={() => {
          queryClient.invalidateQueries({ queryKey: ["employee", "certificate-requests"] });
          toast.show("Your certificate request was submitted. Track it under Certificates.");
        }}
      />

      <FaceScanDialog open={faceScanOpen} mode="verify" onClose={() => setFaceScanOpen(false)} onSuccess={handleFaceScanSuccess} />
    </div>
  );
}
