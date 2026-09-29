import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastContext";
import { CheckIcon, ClockIcon, XIcon } from "@/components/icons";
import { fetchAttendanceRequests, updateAttendanceRequestStatus } from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { AttendanceRequest, AttendanceRequestStatus } from "@/lib/types";

const statusVariant: Record<AttendanceRequestStatus, ChipVariant> = {
  Pending: "warn",
  Approved: "good",
  Declined: "crit",
};

const filters: AttendanceRequestStatus[] = ["Pending", "Approved", "Declined"];

function DecisionButtons({
  request,
  disabled,
  onDecide,
}: {
  request: AttendanceRequest;
  disabled: boolean;
  onDecide: (status: "Approved" | "Declined") => void;
}) {
  if (request.status !== "Pending") return <Chip variant={statusVariant[request.status]}>{request.status}</Chip>;
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        aria-label={`Approve ${request.employeeName}'s ${request.kind.toLowerCase()}`}
        disabled={disabled}
        onClick={() => onDecide("Approved")}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-ink-2 hover:border-transparent hover:bg-good-tint hover:text-good disabled:opacity-50"
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={`Decline ${request.employeeName}'s ${request.kind.toLowerCase()}`}
        disabled={disabled}
        onClick={() => onDecide("Declined")}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-ink-2 hover:border-transparent hover:bg-critical-tint hover:text-critical disabled:opacity-50"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ManagerAttendanceApprovals() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<AttendanceRequestStatus>("Pending");
  const requestsQuery = useQuery({ queryKey: ["manager", "attendance-requests"], queryFn: fetchAttendanceRequests });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Approved" | "Declined" }) =>
      updateAttendanceRequestStatus(id, status),
    onSuccess: (request) => {
      queryClient.invalidateQueries({ queryKey: ["manager", "attendance-requests"] });
      toast.show(
        request.status === "Approved"
          ? `${request.employeeName}'s DTR for ${request.date} was updated.`
          : `${request.employeeName}'s ${request.kind.toLowerCase()} was declined.`,
        request.status === "Approved" ? "good" : "critical",
      );
    },
  });

  const requests = requestsQuery.data ?? [];
  const counts = Object.fromEntries(filters.map((f) => [f, requests.filter((r) => r.status === f).length])) as Record<
    AttendanceRequestStatus,
    number
  >;
  const visible = requests.filter((r) => r.status === filter);
  const decide = (id: string, status: "Approved" | "Declined") => mutation.mutate({ id, status });

  return (
    <>
      <ContentHead title="Attendance Approvals" subtitle={`DTR corrections and exceptions · ${formatToday()}`} />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5">
        <StatTile label="Awaiting your decision" value={counts.Pending ?? 0} tone="warn" delta="pending" />
        <StatTile label="Approved" value={counts.Approved ?? 0} tone="good" delta="this cutoff" />
        <StatTile label="Declined" value={counts.Declined ?? 0} delta="this cutoff" />
      </div>

      <div role="tablist" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={clsx(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold",
              filter === f ? "border-transparent bg-brand-tint text-brand-ink" : "border-border bg-surface text-ink-2",
            )}
          >
            {f} · {counts[f] ?? 0}
          </button>
        ))}
      </div>

      <Card>
        {!requestsQuery.isLoading && visible.length === 0 && (
          <EmptyState
            icon={<ClockIcon />}
            title={filter === "Pending" ? "No attendance requests waiting" : `No ${filter.toLowerCase()} requests`}
            description={filter === "Pending" ? "Missed scans and DTR corrections your team files show up here." : undefined}
          />
        )}

        {/* Mobile: stacked cards */}
        <div className="flex flex-col sm:hidden">
          {visible.map((r) => (
            <div key={r.id} className="border-b border-border p-3.5 last:border-b-0">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <MiniAvatar initials={r.employeeInitials} />
                  <div>
                    <div className="text-sm font-semibold">{r.employeeName}</div>
                    <div className="text-xs text-ink-2">
                      {r.kind} · {r.date}
                    </div>
                  </div>
                </div>
                <DecisionButtons request={r} disabled={mutation.isPending} onDecide={(s) => decide(r.id, s)} />
              </div>
              <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <dt className="text-ink-3">Recorded</dt>
                  <dd className="mt-0.5 font-semibold">{r.recordedTime}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Requested</dt>
                  <dd className="mt-0.5 font-semibold">{r.requestedTime}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-ink-2">{r.reason}</p>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        {visible.length > 0 && (
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-[0.82rem]">
              <thead>
                <tr>
                  {["Team member", "Request", "Recorded", "Requested", "Reason", ""].map((h) => (
                    <th
                      key={h}
                      className="border-b border-border px-4 py-2.5 text-left text-xs font-medium tracking-[0.01em] text-ink-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td className="border-b border-border px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <MiniAvatar initials={r.employeeInitials} />
                        <div>
                          <div>{r.employeeName}</div>
                          <div className="text-xs text-ink-2">{r.employeeRole}</div>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-border px-4 py-2.5">
                      <div>{r.kind}</div>
                      <div className="text-xs text-ink-2">{r.date}</div>
                    </td>
                    <td className="border-b border-border px-4 py-2.5 text-ink-2">{r.recordedTime}</td>
                    <td className="border-b border-border px-4 py-2.5 font-semibold">{r.requestedTime}</td>
                    <td className="max-w-64 border-b border-border px-4 py-2.5 text-xs text-ink-2">{r.reason}</td>
                    <td className="border-b border-border px-4 py-2.5">
                      <DecisionButtons request={r} disabled={mutation.isPending} onDecide={(s) => decide(r.id, s)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
