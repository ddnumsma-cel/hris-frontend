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
} from "@/lib/api";
import { formatPHP, formatToday } from "@/lib/format";
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  WalletIcon,
} from "@/components/icons";
import { AttendanceClock } from "@/components/shared/AttendanceClock";
import { FileMyLeaveDialog } from "./EmployeeLeave";
import { myAttendance, myLeave, myPayslips } from "@/lib/ess/api";
import { whosOutToday } from "@/lib/ess/more";
import { fmtDay } from "@/lib/preferences";
import { RequestCertificateDialog } from "./RequestCertificateDialog";
import { printPayslip } from "./printTemplates";
import type { Payslip } from "@/lib/types";


/** Good morning, afternoon or evening, in Filipino, by the clock. */
const greeting = (h = new Date().getHours()) => (h < 12 ? "Magandang umaga" : h < 18 ? "Magandang hapon" : "Magandang gabi");

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
  // 13th month: basic pay earned this year (less absences) / 12, from the approved payslips.
  const thirteenthMonthQuery = useQuery({
    queryKey: ["ess", "thirteenth-month"],
    queryFn: async () => {
      const year = String(new Date().getFullYear());
      const slips = (await myPayslips()).filter((p) => p.released && p.period.to.slice(0, 4) === year);
      const basic = slips.reduce((n, p) => n + p.line.basic - p.line.deductions, 0);
      const last = slips.reduce<(typeof slips)[number] | undefined>((a, p) => (!a || p.period.to > a.period.to ? p : a), undefined);
      return { accrued: Math.round((Math.max(0, basic) / 12) * 100) / 100, asOfLabel: last ? last.period.label : null };
    },
  });
  const outQuery = useQuery({ queryKey: ["ess", "whos-out"], queryFn: whosOutToday });

  const employee = employeeQuery.data;
  // The hero shows the last released cut-off; the running one is still a preview.
  const latestPayslip = payslipsQuery.data?.find((p) => p.status === "Paid") ?? payslipsQuery.data?.[0];

  function handleDownloadPayslip() {
    if (!latestPayslip) return;
    printPayslip(employee, latestPayslip);
  }

  return (
    <div className="dash dash-fit">
      <ContentHead
        title={employee ? `${greeting()}, ${employee.name.split(" ")[0]}` : greeting()}
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
            value={latestPayslip ? formatPHP(latestPayslip.net) : payslipsQuery.isLoading ? <Skeleton className="h-10 w-44" /> : "—"}
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
              delta={thirteenthMonthQuery.data ? (thirteenthMonthQuery.data.asOfLabel ? `as of ${thirteenthMonthQuery.data.asOfLabel}` : "Builds up with each approved payslip") : undefined}
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
                    {creditsQuery.data.used} used · {creditsQuery.data.pending} waiting for your manager. Each leave uses 1, however many days.
                  </p>
                  <details className="text-xs text-ink-2">
                    <summary className="cursor-pointer font-medium text-ink">How credits are earned</summary>
                    <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
                      <li>Everyone gets 6 leave credits on January 1. Unused credits don't carry over.</li>
                      <li>One leave uses one credit, whether it's half a day or a full week.</li>
                      <li>Leave without pay doesn't use a credit.</li>
                      {creditsQuery.data.adjusted !== 0 && (
                        <li>
                          HR {creditsQuery.data.adjusted > 0 ? "added" : "removed"} {Math.abs(creditsQuery.data.adjusted)} this year.
                        </li>
                      )}
                    </ul>
                  </details>
                </>
              )}
              <div className="border-t border-[var(--line)] pt-3">
                <div className="mb-2 text-[13px] font-semibold">Who's out today in your department</div>
                {outQuery.isLoading ? (
                  <Skeleton className="h-5 w-40" />
                ) : (outQuery.data ?? []).length === 0 ? (
                  <p className="text-xs text-ink-2">Everyone's in today.</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-[13px]">
                    {outQuery.data!.map((p) => (
                      <li key={p.id} className="flex justify-between gap-3">
                        <span>{p.name}</span>
                        <span className="text-xs text-ink-2">back after {fmtDay(p.until)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardBody>
          </Card>
        </BentoArea>


      </div>


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
