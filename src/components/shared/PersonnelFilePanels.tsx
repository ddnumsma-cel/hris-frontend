import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CheckCircleIcon, CheckIcon, EditIcon, FileIcon, HistoryIcon, TrashIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/AuthContext";
import {
  fetchAuditLog,
  fetchPersonnelDocuments,
  removePersonnelDocument,
  updatePersonnelDocument,
  type AuditActor,
} from "@/lib/api";
import { getDocumentExpiryStatus } from "@/lib/automation";
import type { PersonnelDocument, PersonnelDocumentStatus } from "@/lib/types";
import { EditPersonnelDocumentDialog } from "./EditPersonnelDocumentDialog";

export const docStatusVariant: Record<PersonnelDocumentStatus, ChipVariant> = {
  Missing: "warn",
  Submitted: "neutral",
  Verified: "good",
  "Not applicable": "neutral",
};

export function useAuditActor(): AuditActor | undefined {
  const { user } = useAuth();
  return user && (user.role === "manager" || user.role === "admin") ? { name: user.name, role: user.role } : undefined;
}

export interface DocumentCompletion {
  applicable: number;
  verified: number;
  pending: number;
  missing: number;
  pct: number;
}

export function getDocumentCompletion(documents: PersonnelDocument[]): DocumentCompletion {
  const applicable = documents.filter((d) => d.status !== "Not applicable");
  const verified = applicable.filter((d) => d.status === "Verified").length;
  return {
    applicable: applicable.length,
    verified,
    pending: applicable.filter((d) => d.status === "Submitted").length,
    missing: applicable.filter((d) => d.status === "Missing").length,
    pct: applicable.length ? Math.round((verified / applicable.length) * 100) : 0,
  };
}

const tableHeadClass =
  "border-b border-border bg-surface-2/50 px-3.5 py-2 text-xs font-medium tracking-[0.01em] text-ink-3";

/** Completion summary plus the verify/edit/remove list of an employee's 201 documents. */
/** `readOnly` hides verify/edit/remove — for views where another page owns those actions. */
export function PersonnelDocumentsPanel({ employeeId, readOnly = false }: { employeeId: string; readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const actor = useAuditActor();
  const [editingDoc, setEditingDoc] = useState<PersonnelDocument | null>(null);
  const [removingDoc, setRemovingDoc] = useState<PersonnelDocument | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["personnel", "documents", employeeId],
    queryFn: () => fetchPersonnelDocuments(employeeId),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["personnel", "documents"] });
    queryClient.invalidateQueries({ queryKey: ["personnel", "audit-log", employeeId] });
  }

  const verifyMutation = useMutation({
    mutationFn: (id: string) => updatePersonnelDocument(id, { status: "Verified" }, actor),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removePersonnelDocument(id, actor),
    onSuccess: () => {
      invalidate();
      setRemovingDoc(null);
    },
  });

  const documents = documentsQuery.data ?? [];
  const completion = getDocumentCompletion(documents);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border p-3.5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-ink-2">Documents verified</div>
            <div className="font-num mt-0.5 text-xl font-semibold">
              {completion.verified}
              <span className="text-sm font-semibold text-ink-3"> / {completion.applicable}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {completion.pending > 0 && <Chip variant="neutral">{completion.pending} awaiting verification</Chip>}
            {completion.missing > 0 && <Chip variant="warn">{completion.missing} missing</Chip>}
            {completion.pending === 0 && completion.missing === 0 && completion.applicable > 0 && (
              <Chip variant="good">Complete</Chip>
            )}
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-good transition-[width]" style={{ width: `${completion.pct}%` }} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div
          className={clsx(
            tableHeadClass,
            "hidden gap-3 sm:grid",
            readOnly ? "grid-cols-[1fr_8.5rem]" : "grid-cols-[1fr_8.5rem_7rem]",
          )}
        >
          <span>Pre-employment & identity documents</span>
          <span>Status</span>
          {!readOnly && <span className="text-right">Actions</span>}
        </div>
        <ul className="divide-y divide-border">
          {documentsQuery.isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="px-3.5 py-3">
                <Skeleton className="h-9 w-full" />
              </li>
            ))}
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              readOnly={readOnly}
              verifying={verifyMutation.isPending && verifyMutation.variables === doc.id}
              onVerify={() => verifyMutation.mutate(doc.id)}
              onEdit={() => setEditingDoc(doc)}
              onRemove={() => setRemovingDoc(doc)}
            />
          ))}
        </ul>
      </div>

      <EditPersonnelDocumentDialog
        key={editingDoc?.id}
        document={editingDoc}
        onClose={() => setEditingDoc(null)}
        onSubmitted={() => {}}
      />

      <ConfirmDialog
        open={removingDoc !== null}
        title="Remove document"
        message={`Reset "${removingDoc?.type}" back to Missing? This clears the file and any saved details (ID/license number, expiry) — the employee will need to resubmit it.`}
        isPending={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate(removingDoc!.id)}
        onClose={() => setRemovingDoc(null)}
      />
    </div>
  );
}

/** Who viewed or changed an employee's personnel records. */
export function PersonnelAuditLog({ employeeId }: { employeeId: string }) {
  const auditQuery = useQuery({
    queryKey: ["personnel", "audit-log", employeeId],
    queryFn: () => fetchAuditLog(employeeId),
  });

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className={clsx(tableHeadClass, "flex items-center gap-1.5")}>
        <HistoryIcon className="h-3.5 w-3.5" />
        Access & change log
      </div>
      {auditQuery.isLoading && (
        <div className="p-3.5">
          <Skeleton className="h-8 w-full" />
        </div>
      )}
      {auditQuery.data?.length === 0 && <p className="p-3.5 text-xs text-ink-3">No recorded access yet.</p>}
      <ul className="divide-y divide-border">
        {auditQuery.data?.map((entry) => (
          <li key={entry.id} className="flex items-baseline justify-between gap-3 px-3.5 py-2.5 text-xs">
            <span>
              <span className="font-semibold">{entry.actorName}</span>
              <span className="text-ink-2"> ({entry.actorRole === "admin" ? "HR" : "Manager"}) </span>
              {entry.action.toLowerCase()} <span className="font-semibold">{entry.target}</span>
              {entry.detail && <span className="text-ink-2"> — {entry.detail}</span>}
            </span>
            <span className="flex-none text-ink-3">
              {new Date(entry.timestamp).toLocaleString("en-PH", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const docIconClasses: Record<PersonnelDocumentStatus, string> = {
  Missing: "bg-warning-tint text-warning",
  Submitted: "bg-surface-2 text-ink-2",
  Verified: "bg-good-tint text-good",
  "Not applicable": "bg-surface-2 text-ink-3",
};

function DocumentRow({
  doc,
  readOnly,
  verifying,
  onVerify,
  onEdit,
  onRemove,
}: {
  doc: PersonnelDocument;
  readOnly: boolean;
  verifying: boolean;
  onVerify: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const expiryDate = doc.idExpiry ?? doc.licenseExpiry;
  const expiry = expiryDate ? getDocumentExpiryStatus(expiryDate) : null;
  const notApplicable = doc.status === "Not applicable";
  const hasFile = doc.status === "Submitted" || doc.status === "Verified";

  let meta: ReactNode = null;
  if (doc.idNumber || doc.licenseNumber) {
    meta = (
      <>
        {doc.idNumber ? `${doc.idType}: ${doc.idNumber}` : `License ${doc.licenseNumber}`}
        {expiry && (
          <>
            {" · "}
            <span className={expiry.status !== "OK" ? "font-semibold text-warning" : ""}>{expiry.note}</span>
          </>
        )}
      </>
    );
  } else if (doc.fileName) {
    const more = doc.extraFileNames?.length ?? 0;
    meta = `${doc.fileName}${more ? ` + ${more} more` : ""} · ${doc.uploadedOn}`;
  } else if (doc.status === "Missing") {
    meta = "Not yet submitted";
  } else if (notApplicable) {
    meta = "Not required for this employee";
  }

  return (
    <li
      className={clsx(
        "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-3.5 py-3",
        readOnly ? "sm:grid-cols-[1fr_8.5rem]" : "sm:grid-cols-[1fr_8.5rem_7rem]",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={clsx("flex h-8 w-8 flex-none items-center justify-center rounded-lg", docIconClasses[doc.status])}
        >
          {doc.status === "Verified" ? <CheckIcon className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <div className={clsx("truncate text-sm font-semibold", notApplicable && "text-ink-2")}>{doc.type}</div>
          {meta && <div className="truncate text-xs text-ink-2">{meta}</div>}
        </div>
      </div>
      <div className="justify-self-end sm:justify-self-start">
        <Chip variant={docStatusVariant[doc.status]}>{doc.status}</Chip>
      </div>
      {!readOnly && (
        <div className="col-span-2 flex items-center justify-end gap-0.5 sm:col-span-1">
          {doc.status === "Submitted" && (
            <button
              type="button"
              onClick={onVerify}
              disabled={verifying}
              aria-label={`Verify ${doc.type}`}
              title="Mark as verified"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-good hover:bg-good-tint disabled:opacity-50"
            >
              <CheckCircleIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${doc.type}`}
            title="Edit"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <EditIcon className="h-3.5 w-3.5" />
          </button>
          {hasFile && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${doc.type}`}
              title="Remove"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-critical hover:bg-critical-tint"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
