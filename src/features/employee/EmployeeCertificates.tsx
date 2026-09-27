import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastContext";
import { FileIcon, FileQuestionIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { cancelCertificateRequest, fetchCertificateRequests, fetchCurrentEmployee } from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { CertificateRequest, CertificateRequestStatus } from "@/lib/types";
import { RequestCertificateDialog } from "./RequestCertificateDialog";
import { printCertificate } from "./printTemplates";

const statusVariant: Record<CertificateRequestStatus, ChipVariant> = {
  Pending: "warn",
  "Ready for pickup": "good",
  Released: "neutral",
};

export function EmployeeCertificates() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState<CertificateRequest | null>(null);
  const requestsQuery = useQuery({ queryKey: ["employee", "certificate-requests"], queryFn: fetchCertificateRequests });
  const employeeQuery = useQuery({ queryKey: ["employee", "me"], queryFn: fetchCurrentEmployee });

  const cancelMutation = useMutation({
    mutationFn: cancelCertificateRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "certificate-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "certificate-requests"] });
      toast.show("Request cancelled.");
      setCancellingRequest(null);
    },
  });

  return (
    <>
      <ContentHead
        title="Certificates"
        subtitle={formatToday()}
        actions={
          <Button icon={<FileIcon className="h-3.75 w-3.75" />} onClick={() => setDialogOpen(true)}>
            Request certificate
          </Button>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {["Type", "Purpose", "Requested on", "Status", ""].map((h) => (
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
              {requestsQuery.isLoading && <SkeletonRows columns={5} />}
              {requestsQuery.data?.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={<FileQuestionIcon />}
                      title="No certificate requests yet"
                      description="Request a COE or other certificate and track its status here."
                    />
                  </td>
                </tr>
              )}
              {requestsQuery.data?.map((r) => (
                <tr key={r.id}>
                  <td className="border-b border-border px-4 py-2.5 font-semibold">{r.type}</td>
                  <td className="border-b border-border px-4 py-2.5">{r.purpose}</td>
                  <td className="border-b border-border px-4 py-2.5">{r.requestedOn}</td>
                  <td className="border-b border-border px-4 py-2.5">
                    <Chip variant={statusVariant[r.status]}>{r.status}</Chip>
                  </td>
                  <td className="border-b border-border px-4 py-2.5">
                    {r.status === "Pending" && (
                      <button
                        type="button"
                        onClick={() => setCancellingRequest(r)}
                        className="text-xs font-bold text-critical"
                      >
                        Cancel
                      </button>
                    )}
                    {r.status === "Released" && employeeQuery.data && (
                      <button
                        type="button"
                        onClick={() => printCertificate(employeeQuery.data, r)}
                        className="text-xs font-bold text-brand-ink"
                      >
                        Print
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <RequestCertificateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmitted={() => toast.show("Your certificate request was submitted and is now pending HR processing.")}
      />

      <ConfirmDialog
        open={cancellingRequest !== null}
        title="Cancel certificate request"
        message={`Cancel your ${cancellingRequest?.type} request?`}
        confirmLabel="Cancel request"
        pendingLabel="Cancelling…"
        isPending={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate(cancellingRequest!.id)}
        onClose={() => setCancellingRequest(null)}
      />
    </>
  );
}
