import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardHeader } from "@/components/ui/Card";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { CheckSquareIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { listMyApprovals } from "@/lib/approvals";

export function ApprovalsQueue() {
  // Real team items waiting for this person (claims, overtime, undertime, time adjustments).
  const approvalsQuery = useQuery({ queryKey: ["approvals-queue"], queryFn: listMyApprovals });

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
                  className="border-b border-border px-4 py-2.5 text-left text-xs font-medium tracking-[0.01em] text-ink-3"
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
                  <Link to={r.href} className="btn btn-secondary inline-flex items-center px-3 py-1.5 text-xs font-medium">
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
