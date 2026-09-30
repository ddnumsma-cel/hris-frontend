import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { LeaveBar } from "@/components/ui/LeaveBar";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastContext";
import {
  BuildingIcon,
  CalendarIcon,
  FingerprintIcon,
  HomeIcon,
  InboxIcon,
  CameraIcon as FaceIcon,
} from "@/components/icons";
import { cancelLeaveRequest, fetchLeaveBalances, fetchMyDtrLog, fetchMyLeaveRequests } from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { DtrStatus, LeaveRequest } from "@/lib/types";
import { LeaveRequestDialog } from "./LeaveRequestDialog";

const statusVariant: Record<DtrStatus, ChipVariant> = {
  "On time": "good",
  Late: "warn",
  Absent: "crit",
};

const leaveStatusVariant: Record<LeaveRequest["status"], ChipVariant> = {
  Pending: "warn",
  Approved: "good",
  Declined: "crit",
  Returned: "warn",
};

export function EmployeeLeaveDtr() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState<LeaveRequest | null>(null);
  const balancesQuery = useQuery({ queryKey: ["employee", "leave-balances"], queryFn: fetchLeaveBalances });
  const dtrLogQuery = useQuery({ queryKey: ["employee", "dtr-log"], queryFn: fetchMyDtrLog });
  const myRequestsQuery = useQuery({ queryKey: ["employee", "my-leave-requests"], queryFn: fetchMyLeaveRequests });

  const cancelMutation = useMutation({
    mutationFn: cancelLeaveRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "my-leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["approvals-queue"] });
      toast.show("Leave request cancelled.");
      setCancellingRequest(null);
    },
  });

  return (
    <>
      <ContentHead
        title="Leave & DTR"
        subtitle={formatToday()}
        actions={
          <Button icon={<CalendarIcon className="h-3.75 w-3.75" />} onClick={() => setLeaveDialogOpen(true)}>
            File Leave
          </Button>
        }
      />

      <Card>
        <CardHeader title="Leave balances" meta="2026 entitlement" />
        <CardBody className="flex flex-col gap-3.5">
          {balancesQuery.isLoading &&
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          {balancesQuery.data?.map((b) => (
            <LeaveBar key={b.type} label={b.type} used={b.used} entitlement={b.entitlement} />
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="My leave requests" meta="Cancel while pending" />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {["Type", "Dates", "Requested on", "Status", ""].map((h) => (
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
              {myRequestsQuery.isLoading && <SkeletonRows columns={5} />}
              {!myRequestsQuery.isLoading && myRequestsQuery.data?.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon={<InboxIcon />} title="No leave requests filed yet" />
                  </td>
                </tr>
              )}
              {myRequestsQuery.data?.map((r) => (
                <tr key={r.id}>
                  <td className="border-b border-border px-4 py-2.5">{r.type}</td>
                  <td className="border-b border-border px-4 py-2.5">{r.detail}</td>
                  <td className="border-b border-border px-4 py-2.5">{r.requestedOn}</td>
                  <td className="border-b border-border px-4 py-2.5">
                    <Chip variant={leaveStatusVariant[r.status]}>{r.status}</Chip>
                  </td>
                  <td className="border-b border-border px-4 py-2.5">
                    {r.status === "Pending" && (
                      <button
                        type="button"
                        onClick={() => setCancellingRequest(r)}
                        className="text-xs font-semibold text-critical"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Daily time record" meta="Last 2 weeks" />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {["Date", "Time in", "Time out", "Location", "Status"].map((h) => (
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
              {dtrLogQuery.isLoading && <SkeletonRows columns={5} />}
              {dtrLogQuery.data?.map((entry) => (
                <tr key={entry.date}>
                  <td className="border-b border-border px-4 py-2.5">{entry.date}</td>
                  <td className="font-num border-b border-border px-4 py-2.5">{entry.timeIn}</td>
                  <td className="font-num border-b border-border px-4 py-2.5">{entry.timeOut}</td>
                  <td className="border-b border-border px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-ink-2">
                      {entry.location === "Onsite" ? (
                        <BuildingIcon className="h-3.5 w-3.5" />
                      ) : (
                        <HomeIcon className="h-3.5 w-3.5" />
                      )}
                      {entry.location}
                      <span className="text-ink-3">
                        ·{" "}
                        {entry.method === "Fingerprint" ? (
                          <FingerprintIcon className="inline h-3 w-3" />
                        ) : (
                          <FaceIcon className="inline h-3 w-3" />
                        )}
                      </span>
                    </span>
                  </td>
                  <td className="border-b border-border px-4 py-2.5">
                    <Chip variant={statusVariant[entry.status]}>{entry.status}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <LeaveRequestDialog
        open={leaveDialogOpen}
        onClose={() => setLeaveDialogOpen(false)}
        onSubmitted={() => {
          queryClient.invalidateQueries({ queryKey: ["employee", "my-leave-requests"] });
          toast.show("Your leave request was submitted and is now pending your manager's approval.");
        }}
      />

      <ConfirmDialog
        open={cancellingRequest !== null}
        title="Cancel leave request"
        message={`Cancel your ${cancellingRequest?.type} request (${cancellingRequest?.detail})?`}
        confirmLabel="Cancel request"
        pendingLabel="Cancelling…"
        isPending={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate(cancellingRequest!.id)}
        onClose={() => setCancellingRequest(null)}
      />
    </>
  );
}
