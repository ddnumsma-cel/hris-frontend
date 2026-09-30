import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { StatTile } from "@/components/ui/StatTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastContext";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, ReturnIcon } from "@/components/icons";
import {
  decideLeaveAsHr,
  fetchLeaveApplications,
  fetchLeaveOverviewStats,
  fetchLeavePolicies,
  returnLeaveRequest,
  type LeaveApplication,
} from "@/lib/api";
import { formatToday, todayIso } from "@/lib/format";
import { useOfficeFilter } from "./OfficeFilterContext";
import { FileLeaveDialog } from "./FileLeaveDialog";

type Tab = "Needs HR" | "Returned" | "Approved" | "Rejected";
const tabs: Tab[] = ["Needs HR", "Returned", "Approved", "Rejected"];

function inTab(a: LeaveApplication, tab: Tab) {
  switch (tab) {
    case "Needs HR":
      return a.status === "Pending" && a.partnerApproved === true;
    case "Returned":
      return a.status === "Returned";
    case "Approved":
      return a.status === "Approved";
    case "Rejected":
      return a.status === "Declined";
  }
}

/** "Vacation leave", "Sick leave" — overtime reads as-is. */
function requestLabel(a: LeaveApplication) {
  return a.type === "Overtime" ? "Overtime" : `${a.type} leave`;
}

/** 5.5, 7 — half days show one decimal. */
function formatCredits(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatDays(n: number) {
  return `${formatCredits(n)} ${n === 1 ? "day" : "days"}`;
}

function invalidateLeave(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["admin", "leave-applications"] });
  queryClient.invalidateQueries({ queryKey: ["admin", "leave-balance"] });
  queryClient.invalidateQueries({ queryKey: ["approvals-queue"] });
  queryClient.invalidateQueries({ queryKey: ["manager", "approved-leave-schedule"] });
  queryClient.invalidateQueries({ queryKey: ["employee", "my-leave-requests"] });
}

export function AdminLeave() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { office } = useOfficeFilter();
  const [tab, setTab] = useState<Tab>("Needs HR");
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [returning, setReturning] = useState<LeaveApplication | null>(null);
  const [returnNote, setReturnNote] = useState("");
  // The card being approved/rejected slides out first, then the list updates.
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const applicationsQuery = useQuery({ queryKey: ["admin", "leave-applications"], queryFn: fetchLeaveApplications });
  const statsQuery = useQuery({ queryKey: ["admin", "leave-overview-stats"], queryFn: fetchLeaveOverviewStats });
  const policiesQuery = useQuery({ queryKey: ["admin", "leave-policies"], queryFn: fetchLeavePolicies });

  const decideMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Approved" | "Declined" }) => decideLeaveAsHr(id, status),
    onSuccess: (request) => {
      invalidateLeave(queryClient);
      setLeavingId(null);
      const what = request.type === "Overtime" ? "overtime" : `${request.type.toLowerCase()} leave`;
      toast.show(`${request.employeeName}'s ${what} was ${request.status === "Approved" ? "approved" : "rejected"}.`);
    },
    onError: () => {
      setLeavingId(null);
      toast.show("That didn't go through. Please try again.");
    },
  });

  const returnMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => returnLeaveRequest(id, note),
    onSuccess: (request) => {
      invalidateLeave(queryClient);
      setReturning(null);
      toast.show(`${request.employeeName}'s request was returned for changes.`);
    },
  });

  const applications = (applicationsQuery.data ?? []).filter((a) => office === "All offices" || a.office === office);
  const needsHr = applications.filter((a) => inTab(a, "Needs HR"));
  const visible = applications.filter((a) => inTab(a, tab));
  const oldestWaiting = Math.max(0, ...needsHr.map((a) => a.waitingDays));
  const stats = statsQuery.data;

  function decide(id: string, status: "Approved" | "Declined") {
    setLeavingId(id);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => decideMutation.mutate({ id, status }), reduced ? 0 : 220);
  }

  function openReturn(a: LeaveApplication) {
    setReturnNote("");
    setReturning(a);
  }

  return (
    <>
      <ContentHead
        title="Leave"
        subtitle={`Leave applications, balances and policy · ${office} · ${formatToday()}`}
        actions={
          <Button icon={<PlusIcon className="h-3.75 w-3.75" />} onClick={() => setFileDialogOpen(true)}>
            File leave for employee
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Don't claim "All caught up" before the requests have loaded. */}
        <StatTile
          label="Waiting for HR"
          value={applicationsQuery.isLoading ? "—" : needsHr.length}
          delta={
            applicationsQuery.isLoading
              ? undefined
              : needsHr.length > 0
                ? `Oldest ${formatDays(oldestWaiting)}`
                : "All caught up"
          }
          tone={needsHr.length > 0 ? "warn" : "good"}
        />
        <StatTile
          label="On leave today"
          value={stats?.onLeaveToday ?? "—"}
          delta={stats && `Across ${stats.onLeaveOffices} offices`}
        />
        <StatTile
          label="Leave utilization"
          value={stats ? `${stats.utilizationPercent}%` : "—"}
          delta={stats && `YTD vs ${stats.utilizationLastYearPercent}% last year`}
        />
        <StatTile
          label="VL to convert (Dec)"
          value={stats ? `${stats.vlToConvertDays} days` : "—"}
          delta={stats && "Est. cash conversion"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-3">
          <div role="tablist" aria-label="Leave applications" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border px-3">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={clsx(
                  "-mb-px flex-none whitespace-nowrap border-b-2 px-3 py-3 text-[0.82rem] font-semibold transition-colors",
                  tab === t ? "border-brand text-ink" : "border-transparent text-ink-3 hover:text-ink",
                )}
              >
                {t} · <span className="font-num">{applications.filter((a) => inTab(a, t)).length}</span>
              </button>
            ))}
          </div>

          <div key={tab} className="tab-enter flex flex-col gap-3 p-4">
            {applicationsQuery.isLoading && <Skeleton className="h-40 w-full" />}
            {!applicationsQuery.isLoading && visible.length === 0 && (
              <EmptyState
                icon={<CalendarIcon />}
                title={tab === "Needs HR" ? "No leave requests waiting on HR" : `No ${tab.toLowerCase()} requests`}
              />
            )}
            {visible.map((a) => (
              <LeaveApplicationCard
                key={a.id}
                application={a}
                leaving={leavingId === a.id}
                actionsDisabled={decideMutation.isPending || leavingId !== null}
                onApprove={() => decide(a.id, "Approved")}
                onReject={() => decide(a.id, "Declined")}
                onReturn={() => openReturn(a)}
              />
            ))}
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {applicationsQuery.isLoading ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : (
            <LeaveCalendar applications={applications} />
          )}

          <Card>
            <CardHeader title="Leave types" />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.82rem]">
                <thead>
                  <tr>
                    {["Code", "Type", "Days", "Accrual", "Cash"].map((h) => (
                      <th
                        key={h}
                        className={clsx(
                          "border-b border-border px-4 py-2.5 text-left text-xs font-medium tracking-[0.01em] text-ink-3",
                          h === "Days" && "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {policiesQuery.data?.map((p) => (
                    <tr key={p.code}>
                      <td className="border-b border-border px-4 py-2.5 text-xs text-ink-3">{p.code}</td>
                      <td className="border-b border-border px-4 py-2.5">{p.type}</td>
                      <td className="font-num border-b border-border px-4 py-2.5 text-right">{p.days}</td>
                      <td className="border-b border-border px-4 py-2.5 text-xs text-ink-2">{p.accrual}</td>
                      <td className="whitespace-nowrap border-b border-border px-4 py-2.5 text-xs text-ink-2">{p.cashConversion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <FileLeaveDialog
        open={fileDialogOpen}
        onClose={() => setFileDialogOpen(false)}
        onSubmitted={(name) => toast.show(`Leave filed for ${name}. It goes to the Partner, then HR.`)}
      />

      <Dialog
        open={returning !== null}
        onClose={() => setReturning(null)}
        title={returning ? `Return ${returning.employeeName}'s request?` : ""}
      >
        {returning && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              returnMutation.mutate({ id: returning.id, note: returnNote });
            }}
          >
            <p className="text-sm text-ink-2">
              The request goes back to {returning.employeeName.split(" ")[0]} to edit and resubmit. It doesn't count
              against the leave balance.
            </p>
            <label htmlFor="return-note" className="mt-3.5 mb-1 block text-xs font-semibold text-ink-2">
              Note to employee
            </label>
            <textarea
              id="return-note"
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              placeholder="Please attach your travel itinerary."
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
            />
            <div className="-mx-4.5 mt-4 flex justify-end gap-2 border-t border-border px-4.5 pt-3.5">
              <Button type="button" variant="ghost" onClick={() => setReturning(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={returnMutation.isPending}>
                {returnMutation.isPending ? "Returning…" : "Return request"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

function RouteStep({ label, tone }: { label: string; tone: "good" | "warn" | "crit" }) {
  return (
    <span
      className={clsx(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "good" && "bg-good-tint text-good",
        tone === "warn" && "bg-warning-tint text-warning",
        tone === "crit" && "bg-critical-tint text-critical",
      )}
    >
      {label}
    </span>
  );
}

/** Filed → Partner ✓ → HR, coloured by where the request is. */
function ApprovalRoute({ application: a }: { application: LeaveApplication }) {
  const hr =
    a.status === "Approved"
      ? { label: "HR ✓", tone: "good" as const }
      : a.status === "Declined"
        ? { label: "HR ✕", tone: "crit" as const }
        : a.status === "Returned"
          ? { label: "Returned", tone: "warn" as const }
          : { label: "HR", tone: "warn" as const };
  return (
    <div className="flex flex-none items-center gap-1.5 text-xs text-ink-3">
      <RouteStep label="Filed" tone="good" />
      <span aria-hidden="true">→</span>
      <RouteStep label={a.partnerApproved ? "Partner ✓" : "Partner"} tone={a.partnerApproved ? "good" : "warn"} />
      <span aria-hidden="true">→</span>
      <RouteStep label={hr.label} tone={hr.tone} />
    </div>
  );
}

function LeaveApplicationCard({
  application: a,
  leaving,
  actionsDisabled,
  onApprove,
  onReject,
  onReturn,
}: {
  application: LeaveApplication;
  leaving: boolean;
  actionsDisabled: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReturn: () => void;
}) {
  const needsHr = inTab(a, "Needs HR");
  return (
    <article className={clsx("item-enter rounded-xl border border-border bg-surface p-4", leaving && "item-leave")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gold-tint text-[0.7rem] font-semibold text-gold">
            {a.employeeInitials}
          </span>
          <div>
            <div className="text-[0.85rem] font-medium">{a.employeeName}</div>
            <div className="text-xs text-ink-3">
              {a.employeeRole}
              {a.department && ` · ${a.department}`}
            </div>
          </div>
        </div>
        <ApprovalRoute application={a} />
      </div>

      <p className="mt-3 text-[0.9rem] font-semibold">
        {requestLabel(a)} · {a.detail}
      </p>
      {(a.reason || a.attachmentNote) && (
        <p className="text-[0.82rem] text-ink-2">{a.reason ? `“${a.reason}”` : a.attachmentNote}</p>
      )}
      {a.status === "Returned" && a.returnNote && (
        <p className="mt-1 text-xs text-warning">HR note: {a.returnNote}</p>
      )}

      <dl className="mt-3 grid gap-3 rounded-lg bg-surface-2 px-3.5 py-2.5 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-3">Balance after</dt>
          <dd className="text-[0.82rem] font-semibold">
            {a.balanceAfter ? `${formatCredits(a.balanceAfter.left)} of ${a.balanceAfter.of} days` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Team off same days</dt>
          <dd className={clsx("text-[0.82rem] font-semibold", a.teamOffSameDays.length > 0 ? "text-warning" : "text-good")}>
            {a.teamOffSameDays.length > 0 ? a.teamOffSameDays.join(", ") : "None"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Attendance</dt>
          <dd className={clsx("text-[0.82rem] font-semibold", a.latesThisCutoff > 0 && "text-warning")}>
            {a.latesThisCutoff === 0
              ? "No lates this cutoff"
              : `${a.latesThisCutoff} ${a.latesThisCutoff === 1 ? "late" : "lates"} this cutoff`}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {a.employeeId ? (
          <Link to={`/admin/directory?employee=${a.employeeId}`} className="text-[0.82rem] font-semibold hover:underline">
            Open 201 file
          </Link>
        ) : (
          <span />
        )}
        {needsHr && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" icon={<ReturnIcon className="h-3.5 w-3.5" />} disabled={actionsDisabled} onClick={onReturn}>
              Return
            </Button>
            <Button size="sm" variant="ghost" disabled={actionsDisabled} onClick={onReject}>
              Reject
            </Button>
            <Button size="sm" disabled={actionsDisabled} onClick={onApprove}>
              Approve leave
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Month view of who's off: shaded days have someone on leave, gold numbers have two or more. */
function LeaveCalendar({ applications }: { applications: LeaveApplication[] }) {
  // Filed and approved leave; returned and rejected requests don't take anyone off.
  const leave = applications.filter(
    (a) => a.type !== "Overtime" && a.startDate && a.endDate && (a.status === "Pending" || a.status === "Approved"),
  );
  const today = todayIso();
  // Open on the month of the next upcoming leave, so the calendar isn't empty at month end.
  const nextLeave = leave
    .map((a) => a.endDate!)
    .filter((d) => d >= today)
    .sort()[0];
  const [shownMonth, setShownMonth] = useState<string | null>(null);
  const month = shownMonth ?? (nextLeave ?? today).slice(0, 7);

  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const first = new Date(year, monthIndex - 1, 1);
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const leadingBlanks = (first.getDay() + 6) % 7;
  const monthName = first.toLocaleDateString("en-PH", { month: "long" });

  function shift(by: number) {
    const d = new Date(year, monthIndex - 1 + by, 1);
    setShownMonth(isoDate(d).slice(0, 7));
  }

  return (
    <Card>
      <CardHeader
        title={`${monthName} · leave calendar`}
        action={
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shift(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shift(1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-7 gap-1.5 p-4 text-center text-[0.82rem]">
        {weekdayLabels.map((d, i) => (
          <div key={i} className="pb-1 text-xs text-ink-3">
            {d}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const iso = `${month}-${String(day).padStart(2, "0")}`;
          const off = leave.filter((a) => a.startDate! <= iso && a.endDate! >= iso);
          const weekend = (leadingBlanks + i) % 7 >= 5;
          return (
            <div
              key={iso}
              title={off.length > 0 ? off.map((a) => a.employeeName).join(", ") : undefined}
              aria-label={off.length > 0 ? `${monthName} ${day}: ${off.map((a) => a.employeeName).join(", ")}` : undefined}
              className={clsx(
                "flex aspect-square items-center justify-center rounded-lg",
                off.length > 0 && "bg-gold-tint",
                off.length > 1 ? "font-semibold text-gold" : weekend ? "text-ink-3" : "text-ink",
              )}
            >
              {day}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
