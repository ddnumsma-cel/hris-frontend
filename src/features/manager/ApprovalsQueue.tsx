import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { CheckIcon, CheckSquareIcon, XIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchApprovalsQueue, updateApprovalStatus } from "@/lib/api";

export function ApprovalsQueue() {
  const queryClient = useQueryClient();
  const approvalsQuery = useQuery({ queryKey: ["approvals-queue"], queryFn: fetchApprovalsQueue });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Approved" | "Declined" }) =>
      updateApprovalStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals-queue"] });
      queryClient.invalidateQueries({ queryKey: ["manager", "approved-leave-schedule"] });
    },
  });

  const requests = approvalsQuery.data ?? [];

  return (
    <Card>
      <CardHeader title="Approvals queue" meta={`${requests.length} pending`} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[0.82rem]">
          <thead>
            <tr>
              {["Team member", "Type", "Dates", ""].map((h) => (
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
            {requests.length === 0 && !approvalsQuery.isLoading && (
              <tr>
                <td colSpan={4}>
                  <EmptyState icon={<CheckSquareIcon />} title="No pending approvals right now" />
                </td>
              </tr>
            )}
            {requests.map((r) => (
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
                <td className="border-b border-border px-4 py-2.5">{r.type}</td>
                <td className="border-b border-border px-4 py-2.5">{r.detail}</td>
                <td className="border-b border-border px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      aria-label={`Approve ${r.employeeName}'s request`}
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ id: r.id, status: "Approved" })}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-ink-2 hover:border-transparent hover:bg-good-tint hover:text-good disabled:opacity-50"
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Decline ${r.employeeName}'s request`}
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ id: r.id, status: "Declined" })}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-ink-2 hover:border-transparent hover:bg-critical-tint hover:text-critical disabled:opacity-50"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
