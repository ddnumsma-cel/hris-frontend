import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EditIcon, HistoryIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/AuthContext";
import {
  fetchAuditLog,
  fetchPersonnelDocuments,
  fetchPersonnelProfile,
  logPersonnelView,
  removePersonnelDocument,
  updatePersonnelDocument,
  type AuditActor,
} from "@/lib/api";
import { getAge, getDocumentExpiryStatus, OPTIONAL_RETIREMENT_AGE } from "@/lib/automation";
import { formatToday } from "@/lib/format";
import type { PersonnelDocument, PersonnelDocumentStatus } from "@/lib/types";
import { EditPersonnelDocumentDialog } from "./EditPersonnelDocumentDialog";
import { EditPersonnelProfileDialog } from "./EditPersonnelProfileDialog";

export interface PersonnelFileSubject {
  id: string;
  name: string;
  initials: string;
  position: string;
  department?: string;
  office?: string;
  cluster?: string;
  status?: string;
}

const statusVariant: Record<string, ChipVariant> = {
  Active: "good",
  "On leave": "neutral",
};

const docStatusVariant: Record<PersonnelDocumentStatus, ChipVariant> = {
  Missing: "warn",
  Submitted: "neutral",
  Verified: "good",
  "Not applicable": "neutral",
};

export function PersonnelFileDialog({
  subject,
  onClose,
}: {
  subject: PersonnelFileSubject | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingDoc, setEditingDoc] = useState<PersonnelDocument | null>(null);
  const [removingDoc, setRemovingDoc] = useState<PersonnelDocument | null>(null);
  const employeeId = subject?.id;
  const actor: AuditActor | undefined =
    user && (user.role === "manager" || user.role === "admin") ? { name: user.name, role: user.role } : undefined;

  const profileQuery = useQuery({
    queryKey: ["personnel", "profile", employeeId],
    queryFn: () => fetchPersonnelProfile(employeeId!),
    enabled: !!employeeId,
  });
  const documentsQuery = useQuery({
    queryKey: ["personnel", "documents", employeeId],
    queryFn: () => fetchPersonnelDocuments(employeeId!),
    enabled: !!employeeId,
  });
  const auditQuery = useQuery({
    queryKey: ["personnel", "audit-log", employeeId],
    queryFn: () => fetchAuditLog(employeeId!),
    enabled: !!employeeId,
  });

  useEffect(() => {
    if (employeeId && actor) {
      logPersonnelView(employeeId, actor);
      queryClient.invalidateQueries({ queryKey: ["personnel", "audit-log", employeeId] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const verifyMutation = useMutation({
    mutationFn: (id: string) => updatePersonnelDocument(id, { status: "Verified" }, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel", "documents", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["personnel", "audit-log", employeeId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removePersonnelDocument(id, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel", "documents", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["personnel", "audit-log", employeeId] });
      setRemovingDoc(null);
    },
  });

  const profile = profileQuery.data;
  const age = profile?.birthDate ? getAge(profile.birthDate) : null;

  return (
    <>
      <Dialog open={subject !== null} onClose={onClose} title="201 File">
        {subject && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              {profile?.photoDataUrl ? (
                <img src={profile.photoDataUrl} alt="" className="h-11 w-11 flex-none rounded-full object-cover" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-ink-2">
                  {subject.initials}
                </span>
              )}
              <div>
                <div className="font-display text-base font-bold">{subject.name}</div>
                <div className="text-xs text-ink-2">{subject.position}</div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs font-semibold text-ink-2">Employee ID</dt>
                <dd className="font-num mt-0.5">{subject.id}</dd>
              </div>
              {subject.status && (
                <div>
                  <dt className="text-xs font-semibold text-ink-2">Status</dt>
                  <dd className="mt-0.5">
                    <Chip variant={statusVariant[subject.status] ?? "neutral"}>{subject.status}</Chip>
                  </dd>
                </div>
              )}
              {subject.department && (
                <div>
                  <dt className="text-xs font-semibold text-ink-2">Department</dt>
                  <dd className="mt-0.5">{subject.department}</dd>
                </div>
              )}
              {subject.office && (
                <div>
                  <dt className="text-xs font-semibold text-ink-2">Office</dt>
                  <dd className="mt-0.5">{subject.office}</dd>
                </div>
              )}
            </dl>

            <div className="rounded-lg border border-border p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-3">Personal info</span>
                <button
                  type="button"
                  onClick={() => setEditingProfile(true)}
                  className="flex items-center gap-1 text-xs font-bold text-ink-2"
                >
                  <EditIcon className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
              {profileQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-ink-2">Birth date</dt>
                    <dd className="mt-0.5">
                      {profile?.birthDate ?? "—"}
                      {age !== null && (
                        <span className="ml-1 text-xs text-ink-3">
                          ({age} yrs{age >= OPTIONAL_RETIREMENT_AGE ? " · retirement-eligible" : ""})
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-2">Civil status</dt>
                    <dd className="mt-0.5">{profile?.civilStatus ?? "—"}</dd>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-xs text-ink-2">Dependents</dt>
                    <dd className="mt-0.5">
                      {profile?.dependents.length
                        ? profile.dependents.map((d) => `${d.name} (${d.relationship})`).join(", ")
                        : "None on file"}
                    </dd>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-3">
                Pre-employment & identity documents
              </div>
              <div className="flex flex-col gap-2">
                {documentsQuery.isLoading &&
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
                {documentsQuery.data?.map((doc) => {
                  const idExpiryStatus = doc.idExpiry ? getDocumentExpiryStatus(doc.idExpiry) : null;
                  const licenseExpiryStatus = doc.licenseExpiry ? getDocumentExpiryStatus(doc.licenseExpiry) : null;
                  return (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{doc.type}</div>
                        <div className="text-xs text-ink-2">
                          {doc.idNumber && `${doc.idType}: ${doc.idNumber}`}
                          {doc.idNumber && doc.idExpiry && " · "}
                          {doc.idExpiry && (
                            <span className={idExpiryStatus?.status !== "OK" ? "font-semibold text-warning" : ""}>
                              {idExpiryStatus?.note}
                            </span>
                          )}
                          {doc.licenseNumber && `License ${doc.licenseNumber}`}
                          {doc.licenseNumber && doc.licenseExpiry && " · "}
                          {doc.licenseExpiry && (
                            <span className={licenseExpiryStatus?.status !== "OK" ? "font-semibold text-warning" : ""}>
                              {licenseExpiryStatus?.note}
                            </span>
                          )}
                          {!doc.idNumber && !doc.licenseNumber && doc.fileName && `${doc.fileName} · ${doc.uploadedOn}`}
                        </div>
                      </div>
                      <div className="flex flex-none items-center gap-2.5">
                        <Chip variant={docStatusVariant[doc.status]}>{doc.status}</Chip>
                        {doc.status === "Submitted" && (
                          <button
                            type="button"
                            onClick={() => verifyMutation.mutate(doc.id)}
                            disabled={verifyMutation.isPending}
                            className="text-xs font-bold text-brand-ink disabled:opacity-50"
                          >
                            Verify
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingDoc(doc)}
                          className="text-xs font-bold text-ink-2"
                        >
                          Edit
                        </button>
                        {(doc.status === "Submitted" || doc.status === "Verified") && (
                          <button
                            type="button"
                            onClick={() => setRemovingDoc(doc)}
                            className="text-xs font-bold text-critical"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-3">
                <HistoryIcon className="h-3.5 w-3.5" />
                Access & change log
              </div>
              <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border p-3">
                {auditQuery.isLoading && <Skeleton className="h-8 w-full" />}
                {auditQuery.data?.length === 0 && (
                  <p className="text-xs text-ink-3">No recorded access yet.</p>
                )}
                {auditQuery.data?.map((entry) => (
                  <div key={entry.id} className="flex items-baseline justify-between gap-2 text-xs">
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
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
            <p className="-mt-3 text-center text-[0.7rem] text-ink-3">Viewed {formatToday()}</p>
          </div>
        )}
      </Dialog>

      {employeeId && editingProfile && (
        <EditPersonnelProfileDialog
          key={employeeId}
          employeeId={employeeId}
          profile={profile}
          onClose={() => setEditingProfile(false)}
          onSubmitted={() => {}}
        />
      )}

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
    </>
  );
}
