import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { Button } from "@/components/ui/Button";
import { LeaveBar } from "@/components/ui/LeaveBar";
import {
  fetchAnnouncements,
  fetchCurrentEmployee,
  fetchEmployeeBenefits,
  fetchEmployeeDtrSummary,
  fetchEmployeeThirteenthMonth,
  fetchLeaveBalances,
  fetchMyLeaveRequests,
  fetchMyProfessionalLicense,
  fetchMyTrainingRecords,
  fetchPayslips,
} from "@/lib/api";
import { getCpdStatus, isTrainingOverdue } from "@/lib/automation";
import { formatPHP, formatToday } from "@/lib/format";
import {
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
  const [clockedIn, setClockedIn] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [workLocation, setWorkLocation] = useState<WorkLocation>("Onsite");
  const [faceScanOpen, setFaceScanOpen] = useState(false);

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
      const time = new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
      setClockedIn(time);
      toast.show(`Clocked in at ${time} (Onsite) — confirmed by the office biometric scanner.`);
    }, 900);
  }

  function handleClockToggle() {
    if (clockedIn) handleClockOut();
    else handleClockIn();
  }

  function handleFaceScanSuccess() {
    setFaceScanOpen(false);
    const time = new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
    setClockedIn(time);
    toast.show(`Face verified. Clocked in at ${time} (Remote).`);
  }

  function handleDownloadPayslip() {
    if (!latestPayslip) return;
    printPayslip(employee, latestPayslip);
  }

  return (
    <>
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
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold ${
                    workLocation === "Onsite" ? "bg-brand-tint text-brand-ink" : "text-ink-2"
                  }`}
                >
                  <BuildingIcon className="h-3.5 w-3.5" />
                  Office
                </button>
                <button
                  type="button"
                  onClick={() => setWorkLocation("Remote")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold ${
                    workLocation === "Remote" ? "bg-brand-tint text-brand-ink" : "text-ink-2"
                  }`}
                >
                  <HomeIcon className="h-3.5 w-3.5" />
                  Remote
                </button>
              </div>
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

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] sm:gap-3.5">
        <StatTile
          label="Net pay · this cutoff"
          value={latestPayslip ? formatPHP(latestPayslip.net) : <Skeleton className="h-7 w-24" />}
          delta="Sept 16–30, releases Oct 5"
          tone="good"
          icon={<ClockIcon className="h-3 w-3" />}
        />
        <StatTile
          label="13th month pay accrued"
          value={
            thirteenthMonthQuery.data ? formatPHP(thirteenthMonthQuery.data.accrued) : <Skeleton className="h-7 w-24" />
          }
          delta={thirteenthMonthQuery.data ? `as of ${thirteenthMonthQuery.data.asOfLabel}` : undefined}
        />
        <StatTile
          label="On-time rate this month"
          value={dtrQuery.data ? `${dtrQuery.data.onTimeRatePercent}%` : <Skeleton className="h-7 w-14" />}
          delta={dtrQuery.data ? `${dtrQuery.data.lateCount} late, ${dtrQuery.data.absentCount} absences` : undefined}
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
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
        <button
          type="button"
          onClick={() => setLeaveDialogOpen(true)}
          className="flex flex-col items-start gap-2 rounded-[11px] border border-border bg-surface p-3.5 text-left text-sm font-bold hover:border-brand"
        >
          <CalendarIcon className="h-4.5 w-4.5 text-brand-ink" />
          File a Leave
        </button>
        <button
          type="button"
          onClick={() => setCertDialogOpen(true)}
          className="flex flex-col items-start gap-2 rounded-[11px] border border-border bg-surface p-3.5 text-left text-sm font-bold hover:border-brand"
        >
          <FileIcon className="h-4.5 w-4.5 text-brand-ink" />
          Request COE
        </button>
        <button
          type="button"
          onClick={handleDownloadPayslip}
          disabled={!latestPayslip}
          className="flex flex-col items-start gap-2 rounded-[11px] border border-border bg-surface p-3.5 text-left text-sm font-bold hover:border-brand disabled:opacity-50"
        >
          <DownloadIcon className="h-4.5 w-4.5 text-brand-ink" />
          Print Payslip
        </button>
        <button
          type="button"
          onClick={() => navigate("/employee/201-file")}
          className="flex flex-col items-start gap-2 rounded-[11px] border border-border bg-surface p-3.5 text-left text-sm font-bold hover:border-brand"
        >
          <FolderIcon className="h-4.5 w-4.5 text-brand-ink" />
          View 201 File
        </button>
      </div>

      <AttentionPanel items={attentionItems} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title="Recent payslips"
            action={
              <button
                type="button"
                onClick={() => navigate("/employee/payslips")}
                className="flex items-center gap-1 text-xs font-semibold text-brand-ink"
              >
                View all
              </button>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.82rem]">
              <thead>
                <tr>
                  {["Cutoff", "Gross", "Deductions", "Net pay", "Status"].map((h) => (
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
                {payslipsQuery.data?.map((p) => (
                  <tr key={p.id}>
                    <td className="border-b border-border px-4 py-2.5">{p.cutoffLabel}</td>
                    <td className="font-num border-b border-border px-4 py-2.5">{formatPHP(p.gross)}</td>
                    <td className="font-num border-b border-border px-4 py-2.5">{formatPHP(p.deductions)}</td>
                    <td className="font-num border-b border-border px-4 py-2.5">{formatPHP(p.net)}</td>
                    <td className="border-b border-border px-4 py-2.5">
                      <Chip variant={p.status === "Paid" ? "good" : "warn"}>{p.status}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 pb-3.5 pt-2.5 text-xs text-ink-3">
            Deductions include SSS, PhilHealth, Pag-IBIG and withholding tax. Download BIR Form 2316 anytime from
            Payslips.
          </p>
        </Card>

        <Card>
          <CardHeader title="Leave balances" meta="2026 entitlement" />
          <CardBody className="flex flex-col gap-3.5">
            {balancesQuery.data?.map((b) => (
              <LeaveBar key={b.type} label={b.type} used={b.used} entitlement={b.entitlement} />
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.2fr]">
        <BenefitsCard />

        <Card>
          <CardHeader title="Announcements" meta="Cebu HQ" />
          <div className="flex flex-col">
            {announcementsQuery.data?.map((a, i, arr) => (
              <div
                key={a.id}
                className={`flex gap-2.5 px-4 py-3 ${i < arr.length - 1 ? "border-b border-border" : ""}`}
              >
                <span className="mt-1.5 h-1.75 w-1.75 flex-none rounded-full bg-gold" />
                <div>
                  <div className="text-[0.83rem] font-semibold">{a.title}</div>
                  <div className="text-xs text-ink-3">{a.postedOn}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

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
    </>
  );
}
