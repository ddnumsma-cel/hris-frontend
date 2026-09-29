import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Dialog } from "@/components/ui/Dialog";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EditIcon, UsersIcon } from "@/components/icons";
import { fetchPersonnelDocuments,
  fetchPersonnelProfile,
  logPersonnelView } from "@/lib/api";
import { getAge, OPTIONAL_RETIREMENT_AGE } from "@/lib/automation";
import { formatToday } from "@/lib/format";
import { EditPersonnelProfileDialog } from "./EditPersonnelProfileDialog";
import {
  getDocumentCompletion,
  PersonnelAuditLog,
  PersonnelDocumentsPanel,
  useAuditActor,
} from "./PersonnelFilePanels";

export interface PersonnelFileSubject {
  id: string;
  name: string;
  initials: string;
  position: string;
  department?: string;
  office?: string;
  cluster?: string;
  status?: string;
  email?: string;
  phone?: string;
  emergencyContact?: string;
}

type Tab = "Profile" | "201 File" | "Activity log";

const statusVariant: Record<string, ChipVariant> = {
  Active: "good",
  "On leave": "neutral",
};

export function PersonnelFileDialog({
  subject,
  onClose,
  documentsHref,
}: {
  subject: PersonnelFileSubject | null;
  onClose: () => void;
  /**
   * When the role has a dedicated 201 Files page, link there instead of
   * showing the documents as a tab inside this dialog.
   */
  documentsHref?: (employeeId: string) => string;
}) {
  const queryClient = useQueryClient();
  const actor = useAuditActor();
  const [tab, setTab] = useState<Tab>("Profile");
  const [editingProfile, setEditingProfile] = useState(false);
  const employeeId = subject?.id;
  const tabs: Tab[] = documentsHref ? ["Profile", "Activity log"] : ["Profile", "201 File", "Activity log"];

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

  useEffect(() => {
    setTab("Profile");
    if (employeeId && actor) {
      logPersonnelView(employeeId, actor, "Employee profile");
      queryClient.invalidateQueries({ queryKey: ["personnel", "audit-log", employeeId] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const profile = profileQuery.data;
  const age = profile?.birthDate ? getAge(profile.birthDate) : null;
  const completion = getDocumentCompletion(documentsQuery.data ?? []);

  return (
    <>
      <Dialog open={subject !== null} onClose={onClose} title="Employee Profile"
        size="lg"
        header={subject && (
          <>
            <div className="flex items-center gap-3.5">
              {profile?.photoDataUrl ? (
                <img src={profile.photoDataUrl} alt="" className="h-12 w-12 flex-none rounded-full object-cover" />
              ) : (
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-ink-2">
                  {subject.initials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-base font-bold">{subject.name}</div>
                <div className="truncate text-xs text-ink-2">{subject.position}<span className="text-ink-3"> · </span>
              <span className="font-num">{subject.id}</span>
                  </div>
              </div>
              {subject.status && <Chip variant={statusVariant[subject.status] ?? "neutral"}>{subject.status}</Chip>}
              </div>

              <div className="mt-3.5 flex items-center justify-between gap-2">
                <div role="tablist" aria-label="Profile sections" className="flex gap-1">
                  {tabs.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      aria-selected={tab === t}
                      onClick={() => setTab(t)}
                      className={clsx(
                        "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-bold transition-colors",
                        tab === t ? "border-brand text-brand-ink" : "border-transparent text-ink-2 hover:text-ink",
                      )}
                    >
                      {t}
                      {t === "201 File" && completion.applicable > 0 && (
                        <span className="font-num rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.65rem] text-ink-2">
                          {completion.verified}/{completion.applicable}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {documentsHref && (
                  <Link
                    to={documentsHref(subject.id)}
                    onClick={onClose}
                    className="mb-1.5 flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold text-ink-2 transition-colors hover:border-brand hover:text-ink"
                  >
                    <UsersIcon className="h-3.5 w-3.5" />
                    View employee
                  </Link>
                )}
              </div>
            </>
          )
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-[0.7rem] text-ink-3">Viewed {formatToday()} · access is logged</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
                </div>
        }
      >
        {subject && tab === "Profile" && (
                <div className="flex flex-col gap-4">
                  <Section title="Employment">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-3">
                <Field label="Employee ID" value={<span className="font-num">{subject.id}</span>} />
                  <Field label="Position" value={subject.position} />
                <Field label="Department" value={subject.department} />
                <Field label="Office" value={subject.office} />
                <Field label="Cluster" value={subject.cluster} />
                <Field label="Status" value={subject.status} />
              </dl>

            </Section>

            <Section title="Contact">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-3">
              <Field label="Email" value={subject.email && <span className="break-all">{subject.email}</span>} />
                <Field label="Phone" value={subject.phone} />
                <Field label="Emergency contact" value={subject.emergencyContact} />
              </dl>
            </Section>

            <Section
              title="Personal info"
              action={
                <button
                  type="button"
                  onClick={() => setEditingProfile(true)}
                  aria-label="Edit personal info"
                  title="Edit"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
                >
                  <EditIcon className="h-3.5 w-3.5" />
                </button>
              }
            >
              {profileQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-3">
                  <Field
                    label="Birth date"
                    value={profile?.birthDate && (
                        <>
                          {profile.birthDate}
                      {age !== null && (
                        <span className="ml-1 text-xs text-ink-3">
                          ({age} yrs{age >= OPTIONAL_RETIREMENT_AGE ? " · retirement-eligible" : ""})
                        </span>
                      )}
                    </>
                      )
                    }
                  />
                  <Field label="Civil status" value={profile?.civilStatus} />
                  <Field
                    label="Dependents"
                    value={profile?.dependents.length
                        ? profile.dependents.map((d) => `${d.name} (${d.relationship})`).join(", ")
                        : "None on file"}
                  />
                  </dl>
              )}
            </Section>
                </div>
              )}

        {subject && tab === "201 File" && <PersonnelDocumentsPanel employeeId={subject.id} />}
                {subject && tab === "Activity log" && <PersonnelAuditLog employeeId={subject.id} />}
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

      </>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border">
      <div className="flex min-h-9 items-center justify-between border-b border-border bg-surface-2/50 px-3.5 py-1">
        <h3 className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-3">{title}</h3>
        {action}
      </div>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || <span className="text-ink-3">—</span>}</dd>
    </div>
  );
}
