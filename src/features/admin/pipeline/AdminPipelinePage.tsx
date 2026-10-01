import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { CheckCircleIcon, InboxIcon, XIcon } from "@/components/icons";
import { applicableDocuments, fetchOnboardingSubmissions } from "@/lib/api";
import { PERSONNEL_DOCUMENT_TYPES, SITUATIONAL_DOCUMENT_TYPES } from "@/lib/mockData";
import { formatToday } from "@/lib/format";
import { maskGovId } from "@/lib/govIds";
import type { Employee, OnboardingSubmission } from "@/lib/types";
import { SetUpEmploymentDialog } from "./SetUpEmploymentDialog";

function formatSubmitted(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`;
}

const fileCount = (s: OnboardingSubmission) =>
  new Set([...(s.input.uploadedDocuments ?? []).map((u) => u.type), ...(s.input.governmentId ? ["Valid Government ID"] : [])]).size;
const fileTotal = (s: OnboardingSubmission) =>
  PERSONNEL_DOCUMENT_TYPES.length - SITUATIONAL_DOCUMENT_TYPES.length + applicableDocuments(s.input).length;

/** New hires who submitted Onboarding and are waiting for HR to add their job details. */
export function AdminPipelinePage() {
  const toast = useToast();
  const submissionsQuery = useQuery({ queryKey: ["admin", "onboarding-submissions"], queryFn: fetchOnboardingSubmissions });
  const [settingUp, setSettingUp] = useState<OnboardingSubmission | null>(null);
  const [viewing, setViewing] = useState<OnboardingSubmission | null>(null);
  const [justAdded, setJustAdded] = useState<Employee | null>(null);
  const submissions = submissionsQuery.data ?? [];

  return (
    <>
      <ContentHead title="Pipeline" subtitle={`${submissions.length} awaiting employment details · ${formatToday()}`} />
      <p className="-mt-2 text-sm text-ink-2">
        New hires fill in their own details and upload their 201 files from Onboarding. Add their role and start date here to put them in the Employee Directory.
      </p>

      {justAdded && (
        <div role="status" className="item-enter flex flex-wrap items-center gap-3 rounded-xl border border-good/30 bg-good-tint px-4 py-3">
          <CheckCircleIcon className="h-5 w-5 flex-none text-good" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">{justAdded.name}</span> is now in the directory as {justAdded.position} ·{" "}
            <span className="font-num font-semibold">{justAdded.id}</span>
          </p>
          <Link
            to={`/admin/directory?employee=${justAdded.id}`}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-brand"
          >
            View profile
          </Link>
          <button type="button" aria-label="Dismiss" onClick={() => setJustAdded(null)} className="rounded-lg p-1 text-ink-2 hover:bg-surface">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <Card>
        <CardHeader title="Awaiting employment details" meta={submissions.length ? `${submissions.length} new hire${submissions.length === 1 ? "" : "s"}` : undefined} />
        {submissionsQuery.isLoading ? (
          <table className="w-full">
            <tbody>
              <SkeletonRows columns={4} rows={3} />
            </tbody>
          </table>
        ) : submissions.length === 0 ? (
          <EmptyState icon={<InboxIcon />} title="No new hires waiting" description="Submissions from Onboarding appear here." />
        ) : (
          <ul className="divide-y divide-border">
            {submissions.map((s) => (
              <li key={s.id} className="item-enter flex flex-col gap-3 px-4.5 py-3.5 sm:flex-row sm:items-center">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand-ink">
                  {(s.input.firstName[0] ?? "") + (s.input.lastName[0] ?? "")}
                </span>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => setViewing(s)} className="truncate text-left text-sm font-semibold hover:text-brand-ink hover:underline">
                    {s.input.firstName} {s.input.lastName}
                  </button>
                  <p className="truncate text-xs text-ink-2">
                    Submitted {formatSubmitted(s.submittedAt)} · {s.input.phone ?? "No mobile"} · {fileCount(s)} of {fileTotal(s)} files uploaded
                  </p>
                </div>
                <div className="flex flex-none gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setViewing(s)}>
                    View details
                  </Button>
                  <Button size="sm" onClick={() => setSettingUp(s)}>
                    Set up employment
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SubmissionDetailsDialog
        submission={viewing}
        onClose={() => setViewing(null)}
        onSetUp={() => {
          setSettingUp(viewing);
          setViewing(null);
        }}
      />

      <SetUpEmploymentDialog
        submission={settingUp}
        onClose={() => setSettingUp(null)}
        onDone={(employee) => {
          setSettingUp(null);
          setJustAdded(employee);
          toast.show(`Added ${employee.name} as ${employee.position} · ${employee.id}`);
        }}
      />
    </>
  );
}

function Detail({ label, children }: { label: string; children?: ReactNode }) {
  const empty = children === undefined || children === null || children === "";
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 py-1.5 text-sm">
      <dt className="text-ink-2">{label}</dt>
      <dd className={empty ? "text-ink-3" : "font-medium break-words"}>{empty ? "Not added" : children}</dd>
    </div>
  );
}

/** Read-only view of what the new hire sent. */
function SubmissionDetailsDialog({ submission, onClose, onSetUp }: { submission: OnboardingSubmission | null; onClose: () => void; onSetUp: () => void }) {
  const i = submission?.input;
  const gov = i?.governmentNumbers ?? {};
  return (
    <Dialog
      open={Boolean(submission)}
      onClose={onClose}
      title={i ? `${i.firstName} ${i.lastName}` : "Submission"}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onSetUp}>Set up employment</Button>
        </div>
      }
    >
      {i && (
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-[0.04em] text-ink-3 uppercase">Personal</h3>
            <dl>
              <Detail label="Full name">{[i.firstName, i.middleName, i.lastName, i.suffix].filter(Boolean).join(" ")}</Detail>
              <Detail label="Birth date">{i.birthDate}</Detail>
              <Detail label="Civil status">{i.civilStatus}</Detail>
              <Detail label="Blood type">{i.bloodType}</Detail>
              <Detail label="Dependents">{i.dependents?.map((d) => `${d.name} (${d.relationship})`).join(", ")}</Detail>
            </dl>
          </section>
          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-[0.04em] text-ink-3 uppercase">Contact</h3>
            <dl>
              <Detail label="Mobile">{i.phone}</Detail>
              <Detail label="Personal email">{i.personalEmail}</Detail>
              <Detail label="Address">{i.address}</Detail>
              <Detail label="Emergency contact">{i.emergencyContact && `${i.emergencyContact.name}${i.emergencyContact.phone ? ` · ${i.emergencyContact.phone}` : ""}`}</Detail>
              <Detail label="PRC license">{i.license?.number}</Detail>
              <Detail label="Previous employer">{i.previousEmployer?.name}</Detail>
            </dl>
          </section>
          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-[0.04em] text-ink-3 uppercase">Government numbers</h3>
            <dl>
              <Detail label="TIN">{gov.tin && maskGovId(gov.tin)}</Detail>
              <Detail label="SSS">{gov.sss && maskGovId(gov.sss)}</Detail>
              <Detail label="PhilHealth">{gov.philHealth && maskGovId(gov.philHealth)}</Detail>
              <Detail label="Pag-IBIG">{gov.pagIbig && maskGovId(gov.pagIbig)}</Detail>
            </dl>
          </section>
          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-[0.04em] text-ink-3 uppercase">Uploaded files</h3>
            <ul className="flex flex-col gap-1.5 py-1.5 text-sm">
              {i.governmentId && (
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 flex-none text-good" />
                  Valid Government ID <span className="text-ink-3">· {i.governmentId.idType}</span>
                </li>
              )}
              {(i.uploadedDocuments ?? []).filter((u) => !(i.governmentId && u.type === "Valid Government ID")).map((u) => (
                <li key={u.type} className="flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 flex-none text-good" />
                  <span className="min-w-0 truncate">
                    {u.type} <span className="text-ink-3">· {u.fileName}</span>
                  </span>
                </li>
              ))}
              {!i.governmentId && !(i.uploadedDocuments ?? []).length && <li className="text-ink-3">No files uploaded yet</li>}
            </ul>
          </section>
        </div>
      )}
    </Dialog>
  );
}
