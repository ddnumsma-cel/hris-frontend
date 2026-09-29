import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EditCaseDialog } from "@/components/shared/EditCaseDialog";
import { EditIcon, FlagIcon, InboxIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { deleteEmployeeCase, fetchEmployeeCases } from "@/lib/api";
import { formatToday } from "@/lib/format";
import { currentManager } from "@/lib/mockData";
import type { CaseStatus, EmployeeCase } from "@/lib/types";
import { FileCaseDialog } from "./FileCaseDialog";

const statusVariant: Record<CaseStatus, ChipVariant> = {
  Open: "warn",
  "Under review": "neutral",
  Resolved: "good",
};

export function ManagerCases() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<EmployeeCase | null>(null);
  const [deletingCase, setDeletingCase] = useState<EmployeeCase | null>(null);
  const casesQuery = useQuery({ queryKey: ["cases"], queryFn: fetchEmployeeCases });
  const myTeamCases = (casesQuery.data ?? []).filter((c) => c.filedBy === currentManager.name);

  const deleteMutation = useMutation({
    mutationFn: deleteEmployeeCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      toast.show("Case withdrawn.");
      setDeletingCase(null);
    },
  });

  return (
    <>
      <ContentHead
        title="Employee Relations"
        subtitle={formatToday()}
        actions={
          <Button icon={<FlagIcon className="h-3.75 w-3.75" />} onClick={() => setDialogOpen(true)}>
            File a case
          </Button>
        }
      />

      {!casesQuery.isLoading && myTeamCases.length === 0 && (
        <Card>
          <EmptyState
            icon={<InboxIcon />}
            title="No cases filed by you yet"
            description="Cases you file for employee relations show up here."
          />
        </Card>
      )}

      {(casesQuery.isLoading || myTeamCases.length > 0) && (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {casesQuery.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-3.5">
                  <div className="skeleton h-16 w-full rounded-lg" />
                </Card>
              ))}
            {myTeamCases.map((c) => (
              <Card key={c.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <MiniAvatar initials={c.employeeInitials} />
                    <div>
                      <div className="text-sm font-semibold">{c.employeeName}</div>
                      <div className="text-xs text-ink-2">{c.type}</div>
                    </div>
                  </div>
                  <Chip variant={statusVariant[c.status]}>{c.status}</Chip>
                </div>
                <p className="mt-2.5 text-xs text-ink-2">{c.summary}</p>
                <div className="mt-2.5 text-xs text-ink-3">Filed {c.filedOn}</div>
                {c.status === "Open" && (
                  <div className="mt-3 flex items-center gap-4 border-t border-border pt-2.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditingCase(c)}
                      className="flex items-center gap-1 font-semibold text-ink-2"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button type="button" onClick={() => setDeletingCase(c)} className="font-semibold text-critical">
                      Withdraw
                    </button>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.82rem]">
                <thead>
                  <tr>
                    {["Employee", "Type", "Filed on", "Status", "Summary", ""].map((h) => (
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
                  {casesQuery.isLoading && <SkeletonRows columns={6} />}
                  {myTeamCases.map((c) => (
                    <tr key={c.id}>
                      <td className="border-b border-border px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <MiniAvatar initials={c.employeeInitials} />
                          {c.employeeName}
                        </div>
                      </td>
                      <td className="border-b border-border px-4 py-2.5">{c.type}</td>
                      <td className="border-b border-border px-4 py-2.5">{c.filedOn}</td>
                      <td className="border-b border-border px-4 py-2.5">
                        <Chip variant={statusVariant[c.status]}>{c.status}</Chip>
                      </td>
                      <td className="max-w-xs border-b border-border px-4 py-2.5 text-ink-2">{c.summary}</td>
                      <td className="border-b border-border px-4 py-2.5">
                        {c.status === "Open" && (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setEditingCase(c)}
                              className="flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink"
                            >
                              <EditIcon className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingCase(c)}
                              className="text-xs font-semibold text-critical"
                            >
                              Withdraw
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <FileCaseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmitted={() => toast.show("Case filed and routed to HR for review.")}
      />

      <EditCaseDialog
        employeeCase={editingCase}
        onClose={() => setEditingCase(null)}
        onSubmitted={() => toast.show("Case updated.")}
      />

      <ConfirmDialog
        open={deletingCase !== null}
        title="Withdraw case"
        message={`Withdraw this case for ${deletingCase?.employeeName}? This can't be undone.`}
        confirmLabel="Withdraw"
        pendingLabel="Withdrawing…"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingCase!.id)}
        onClose={() => setDeletingCase(null)}
      />
    </>
  );
}
