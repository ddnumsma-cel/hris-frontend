// Requests › Certificates: what employees asked for (Certificate of Employment and the like) and
// what HR does with each: issue it (preview the certificate made from their record, then send the
// digital copy), prepare a signed copy for pickup, or decline with a reason. The employee is told
// in their bell each time and downloads or prints an issued certificate from their Certificates page.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { declineCertificate, fetchCertificateRequestsForReview, fetchEmployeeDirectory, issueCertificate, markCertificateReady, markCertificateReleased } from "@/lib/api";
import type { CertificateRequest, CertificateRequestStatus, Employee } from "@/lib/types";
import { useCan } from "@/lib/useCan";
import { printCertificate } from "@/features/employee/printTemplates";
import { certificateStatement } from "@/lib/certificates";
import { useActor, type Tone } from "../corehr/format";
import { ErrorNote, LoadError, Pill } from "../corehr/ui";
import { Name, SearchBox, SimpleTable, Tabs, Toolbar, type Col } from "../timekeeping/common";
import { shortDate } from "../timekeeping/format";

type Tab = CertificateRequestStatus | "all";

const TONE: Record<CertificateRequestStatus, Tone> = { Pending: "warn", "Ready for pickup": "info", Released: "good", Declined: "neutral" };
const KEYS = [["admin", "certificate-requests"], ["employee", "certificate-requests"]];

/**
 * The certificate made from the employee's record: a preview to check and send, or (once sent)
 * exactly what the employee received, with when and by whom.
 */
function IssueDialog({ request, employee, onClose }: { request: CertificateRequest; employee?: Employee; onClose: () => void }) {
  const sent = request.status === "Released" || request.status === "Declined";
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const send = useMutation({
    mutationFn: () => issueCertificate(request.id, actor),
    onSuccess: () => {
      KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      toast.show(`Sent. ${request.employeeName ?? "The employee"} can download or print it now.`);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={sent ? request.type : `Issue ${request.type}`}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          {employee ? (
            <Button variant="ghost" onClick={() => printCertificate(employee, request)}>
              {sent ? "Download HR copy" : "Open printable copy"}
            </Button>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {sent ? "Close" : "Cancel"}
            </Button>
            {!sent && (
              <Button disabled={send.isPending || !employee} onClick={() => send.mutate()}>
                {send.isPending ? "Sending…" : "Send to employee"}
              </Button>
            )}
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {sent ? (
          <p className="rounded-[var(--radius-control)] bg-surface-2 px-4 py-3 text-sm text-ink-2">
            {request.delivery === "digital" ? "Sent to" : "Released to"} <span className="font-medium text-ink">{request.employeeName ?? "the employee"}</span>
            {request.handledAt ? ` on ${shortDate(request.handledAt)}` : ""}
            {request.handledBy ? ` by ${request.handledBy}` : ""}.{" "}
            {request.issued ? `HR's copy, filed as No. ${request.issued.number}: exactly what they received, even if their record changes later.` : "Issued before copies were filed, so this is made from their current record."}
          </p>
        ) : (
          <p className="text-sm text-ink-2">This is made from {request.employeeName ? `${request.employeeName}'s` : "their"} record. Check it, then send it: they're told in their notifications and can download or print it from Certificates.</p>
        )}
        {employee || request.issued ? (
          <article className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-6">
            <div className="flex items-baseline justify-between gap-2 border-b border-[var(--line)] pb-3">
              <span className="text-lg font-bold tracking-wide text-ink">MSMA</span>
              <span className="text-right">
                <span className="block text-sm font-semibold text-ink">{request.type}</span>
                <span className="block text-xs text-ink-2">{request.issued ? `No. ${request.issued.number} · Issued ${shortDate(request.issued.issuedAt)}` : `Requested ${shortDate(request.requestedOn)}`}</span>
              </span>
            </div>
            {/* certificateStatement escapes every value it inserts. */}
            <p className="text-sm leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: request.issued?.statement ?? certificateStatement(employee!, request.type) }} />
            <p className="text-sm text-ink">Purpose: {(request.issued?.purpose ?? request.purpose) || "—"}</p>
          </article>
        ) : (
          <p className="rounded-[var(--radius-card)] bg-surface-2 px-4 py-3 text-sm text-ink-2">This request has no employee record linked, so a certificate can't be made from it. Prepare a signed copy for pickup instead.</p>
        )}
        <ErrorNote error={send.error} />
      </div>
    </Dialog>
  );
}

function DeclineDialog({ request, onClose }: { request: CertificateRequest; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const decline = useMutation({
    mutationFn: () => declineCertificate(request.id, reason, actor),
    onSuccess: () => {
      KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      toast.show("Declined. The employee was told why.");
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Decline ${request.employeeName ?? "this"}'s request?`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="remove" disabled={decline.isPending || !reason.trim()} onClick={() => decline.mutate()}>
            Decline
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="cert-decline" className="text-xs font-medium text-ink">
          Reason (sent to the employee)
        </label>
        <textarea id="cert-decline" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Your 2316 for this year isn't filed yet; ask again after Jan 31." className="field w-full px-3 py-2 text-sm" />
        <ErrorNote error={decline.error} />
      </div>
    </Dialog>
  );
}

export function CertificatesPage() {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const canAct = useCan("edit", "selfService");
  const query = useQuery({ queryKey: ["admin", "certificate-requests"], queryFn: fetchCertificateRequestsForReview });
  const people = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const [tab, setTab] = useState<Tab>("Pending");
  const [search, setSearch] = useState("");
  const [issuing, setIssuing] = useState<CertificateRequest | null>(null);
  const [declining, setDeclining] = useState<CertificateRequest | null>(null);
  const done = () => KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  const onError = (e: unknown) => toast.show(e instanceof Error ? e.message : "Couldn't save.", "critical");
  const ready = useMutation({ mutationFn: (r: CertificateRequest) => markCertificateReady(r.id, actor), onSuccess: (r) => (done(), toast.show(`${r.employeeName ?? "The employee"} was told to pick up a signed copy.`)), onError });
  const released = useMutation({ mutationFn: (r: CertificateRequest) => markCertificateReleased(r.id, actor), onSuccess: () => (done(), toast.show("Marked released.")), onError });

  if (query.isError) return <LoadError onRetry={() => query.refetch()} />;
  const all = query.data ?? [];
  const count = (s: CertificateRequestStatus) => all.filter((r) => r.status === s).length;
  const q = search.trim().toLowerCase();
  const rows = all
    .filter((r) => tab === "all" || r.status === tab)
    .filter((r) => !q || `${r.employeeName ?? ""} ${r.type} ${r.purpose}`.toLowerCase().includes(q))
    .sort((a, b) => b.requestedOn.localeCompare(a.requestedOn));
  const employeeOf = (r: CertificateRequest) => people.data?.find((e) => e.id === r.employeeId);
  const busy = ready.isPending || released.isPending;

  const outcome = (r: CertificateRequest) =>
    r.status === "Declined" ? `Declined: ${r.note ?? ""}` : r.status === "Released" ? (r.delivery === "digital" ? "Sent as a digital copy" : "Signed copy handed over") : "";

  const cols: Col<CertificateRequest>[] = [
    { header: "Employee", cell: (r) => <Name name={r.employeeName ?? "Employee"} sub={`Asked ${shortDate(r.requestedOn)}`} /> },
    { header: "Certificate", cell: (r) => <Name name={r.type} sub={r.purpose ? `For: ${r.purpose}` : undefined} /> },
    {
      header: "Status",
      cell: (r) => (
        <span className="flex flex-col items-start gap-1">
          <Pill tone={TONE[r.status]}>{r.status}</Pill>
          {r.handledAt && <span className="text-xs text-ink-3">{[r.issued && `No. ${r.issued.number}`, outcome(r), `${shortDate(r.handledAt)}${r.handledBy ? ` · ${r.handledBy}` : ""}`].filter(Boolean).join(" · ")}</span>}
        </span>
      ),
    },
    {
      header: "Actions",
      align: "right",
      cell: (r) =>
        !canAct ? null : r.status === "Pending" ? (
          <span className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="remove" onClick={() => setDeclining(r)}>
              Decline
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => ready.mutate(r)}>
              Ready for pickup
            </Button>
            <Button size="sm" onClick={() => setIssuing(r)}>
              Issue certificate
            </Button>
          </span>
        ) : r.status === "Released" ? (
          <Button size="sm" variant="ghost" onClick={() => setIssuing(r)}>
            View certificate
          </Button>
        ) : r.status === "Ready for pickup" ? (
          <span className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setIssuing(r)}>
              Send digital copy
            </Button>
            <Button size="sm" disabled={busy} onClick={() => released.mutate(r)}>
              Mark released
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <>
      <ContentHead title="Certificates" />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "Pending", label: "To do", count: count("Pending") },
          { value: "Ready for pickup", label: "Ready for pickup", count: count("Ready for pickup") },
          { value: "Released", label: "Released", count: count("Released") },
          { value: "Declined", label: "Declined", count: count("Declined") },
          { value: "all", label: "All", count: all.length },
        ]}
      />
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search employee or certificate" />
      </Toolbar>
      <SimpleTable rows={rows} rowKey={(r) => r.id} cols={cols} loading={query.isLoading} empty={tab === "Pending" ? "Nothing to do. You're all caught up." : "Nothing here yet."} />
      {issuing && <IssueDialog request={issuing} employee={employeeOf(issuing)} onClose={() => setIssuing(null)} />}
      {declining && <DeclineDialog request={declining} onClose={() => setDeclining(null)} />}
    </>
  );
}
