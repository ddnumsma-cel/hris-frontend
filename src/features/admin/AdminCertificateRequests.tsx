import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastContext";
import { EditIcon, FileQuestionIcon } from "@/components/icons";
import {
  advanceCertificateRequest,
  deleteCertificateRequest,
  fetchCertificateRequestsForReview,
  nextCertificateStatus,
} from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { CertificateRequest, CertificateRequestStatus } from "@/lib/types";
import { EditCertificateRequestDialog } from "./EditCertificateRequestDialog";

const statusVariant: Record<CertificateRequestStatus, ChipVariant> = {
  Pending: "warn",
  "Ready for pickup": "neutral",
  Released: "good",
};

export function AdminCertificateRequests() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editingRequest, setEditingRequest] = useState<CertificateRequest | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<CertificateRequest | null>(null);
  const requestsQuery = useQuery({
    queryKey: ["admin", "certificate-requests"],
    queryFn: fetchCertificateRequestsForReview,
  });

  const mutation = useMutation({
    mutationFn: advanceCertificateRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "certificate-requests"] });
      queryClient.invalidateQueries({ queryKey: ["employee", "certificate-requests"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCertificateRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "certificate-requests"] });
      queryClient.invalidateQueries({ queryKey: ["employee", "certificate-requests"] });
      toast.show("Certificate request removed.");
      setDeletingRequest(null);
    },
  });

  return (
    <>
      <ContentHead title="Certificate Requests" subtitle={formatToday()} />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {["Type", "Purpose", "Requested on", "Status", ""].map((h) => (
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
              {requestsQuery.isLoading && <SkeletonRows columns={5} />}
              {!requestsQuery.isLoading && requestsQuery.data?.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon={<FileQuestionIcon />} title="No certificate requests" />
                  </td>
                </tr>
              )}
              {requestsQuery.data?.map((r) => {
                const next = nextCertificateStatus(r.status);
                return (
                  <tr key={r.id}>
                    <td className="border-b border-border px-4 py-2.5 font-semibold">{r.type}</td>
                    <td className="border-b border-border px-4 py-2.5">{r.purpose}</td>
                    <td className="border-b border-border px-4 py-2.5">{r.requestedOn}</td>
                    <td className="border-b border-border px-4 py-2.5">
                      <Chip variant={statusVariant[r.status]}>{r.status}</Chip>
                    </td>
                    <td className="border-b border-border px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        {next && (
                          <button
                            type="button"
                            disabled={mutation.isPending}
                            onClick={() => mutation.mutate(r.id)}
                            className="text-xs font-semibold text-brand-ink disabled:opacity-50"
                          >
                            Mark {next.toLowerCase()}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingRequest(r)}
                          className="flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink"
                        >
                          <EditIcon className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingRequest(r)}
                          className="text-xs font-semibold text-critical"
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

      <EditCertificateRequestDialog
        request={editingRequest}
        onClose={() => setEditingRequest(null)}
        onSubmitted={() => toast.show("Certificate request updated.")}
      />

      <ConfirmDialog
        open={deletingRequest !== null}
        title="Remove certificate request"
        message="Remove this certificate request? This can't be undone."
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deletingRequest!.id)}
        onClose={() => setDeletingRequest(null)}
      />
    </>
  );
}
