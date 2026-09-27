import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastContext";
import { EditCaseDialog } from "@/components/shared/EditCaseDialog";
import { EditIcon, FlagIcon, InboxIcon } from "@/components/icons";
import { deleteEmployeeCase, fetchEmployeeCases, updateCaseStatus } from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { CaseStatus, EmployeeCase } from "@/lib/types";
import { AdminFileCaseDialog } from "./AdminFileCaseDialog";

const statusVariant: Record<CaseStatus, ChipVariant> = {
  Open: "warn",
  "Under review": "neutral",
  Resolved: "good",
};

const nextStatus: Record<CaseStatus, CaseStatus | null> = {
  Open: "Under review",
  "Under review": "Resolved",
  Resolved: null,
};

export function AdminCases() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [fileCaseOpen, setFileCaseOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<EmployeeCase | null>(null);
  const [deletingCase, setDeletingCase] = useState<EmployeeCase | null>(null);
  const casesQuery = useQuery({ queryKey: ["cases"], queryFn: fetchEmployeeCases });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CaseStatus }) => updateCaseStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cases"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEmployeeCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      toast.show("Case removed.");
      setDeletingCase(null);
    },
  });

  return (
    <>
      <ContentHead
        title="Employee Relations"
        subtitle={formatToday()}
        actions={
          <Button icon={<FlagIcon className="h-3.75 w-3.75" />} onClick={() => setFileCaseOpen(true)}>
            File a case
          </Button>
        }
      />

      {!casesQuery.isLoading && casesQuery.data?.length === 0 && (
        <Card>
          <EmptyState icon={<InboxIcon />} title="No cases on file" />
        </Card>
      )}

      {(casesQuery.isLoading || (casesQuery.data?.length ?? 0) > 0) && (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {casesQuery.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-3.5">
                  <div className="skeleton h-16 w-full rounded-lg" />
                </Card>
              ))}
            {casesQuery.data?.map((c) => {
              const next = nextStatus[c.status];
              return (
                <Card key={c.id} className="p-3.5">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <MiniAvatar initials={c.employeeInitials} />
                      <div>
                        <div className="text-sm font-bold">{c.employeeName}</div>
                        <div className="text-xs text-ink-2">{c.type}</div>
                      </div>
                    </div>
                    <Chip variant={statusVariant[c.status]}>{c.status}</Chip>
                  </div>
                  <p className="mt-2.5 text-xs text-ink-2">{c.summary}</p>
                  <div className="mt-2.5 text-xs text-ink-3">
                    Filed by {c.filedBy} · {c.filedOn}
                  </div>
                  <div className="mt-3 flex items-center gap-4 border-t border-border pt-2.5 text-xs">
                    {next && (
                      <button
                        type="button"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ id: c.id, status: next })}
                        className="font-bold text-brand-ink disabled:opacity-50"
                      >
                        Mark {next.toLowerCase()}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingCase(c)}
                      className="flex items-center gap-1 font-bold text-ink-2"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button type="button" onClick={() => setDeletingCase(c)} className="font-bold text-critical">
                      Remove
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop: table */}
          <Card className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.82rem]">
                <thead>
                  <tr>
                    {["Employee", "Type", "Filed by", "Filed on", "Status", "Summary", ""].map((h) => (
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
                  {casesQuery.isLoading && <SkeletonRows columns={7} />}
                  {casesQuery.data?.map((c) => {
                    const next = nextStatus[c.status];
                    return (
                      <tr key={c.id}>
                        <td className="border-b border-border px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <MiniAvatar initials={c.employeeInitials} />
                            {c.employeeName}
                          </div>
                        </td>
                        <td className="border-b border-border px-4 py-2.5">{c.type}</td>
                        <td className="border-b border-border px-4 py-2.5">{c.filedBy}</td>
                        <td className="border-b border-border px-4 py-2.5">{c.filedOn}</td>
                        <td className="border-b border-border px-4 py-2.5">
                          <Chip variant={statusVariant[c.status]}>{c.status}</Chip>
                        </td>
                        <td className="max-w-xs border-b border-border px-4 py-2.5 text-ink-2">{c.summary}</td>
                        <td className="border-b border-border px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            {next && (
                              <button
                                type="button"
                                disabled={mutation.isPending}
                                onClick={() => mutation.mutate({ id: c.id, status: next })}
                                className="text-xs font-bold text-brand-ink disabled:opacity-50"
                              >
                                Mark {next.toLowerCase()}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingCase(c)}
                              className="flex items-center gap-1 text-xs font-bold text-ink-2 hover:text-ink"
                            >
                              <EditIcon className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingCase(c)}
                              className="text-xs font-bold text-critical"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <AdminFileCaseDialog
        open={fileCaseOpen}
        onClose={() => setFileCaseOpen(false)}
        onSubmitted={() => toast.show("Case filed.")}
      />

      <EditCaseDialog
        employeeCase={editingCase}
        onClose={() => setEditingCase(null)}
        onSubmitted={() => toast.show("Case updated.")}
      />

      <ConfirmDialog
        open={deletingCase !== null}
        title="Remove case"
        message={`Remove this case for ${deletingCase?.employeeName}? This can't be undone.`}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingCase!.id)}
        onClose={() => setDeletingCase(null)}
      />
    </>
  );
}
