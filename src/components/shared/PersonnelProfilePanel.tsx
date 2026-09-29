import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { EditIcon } from "@/components/icons";
import { fetchPersonnelProfile } from "@/lib/api";
import { getAge, OPTIONAL_RETIREMENT_AGE } from "@/lib/automation";
import { EditPersonnelProfileDialog } from "./EditPersonnelProfileDialog";
import type { PersonnelFileSubject } from "./PersonnelFileDialog";

/** Employment, contact and personal info for one employee — shared by the
 * profile dialog and the Employee Directory's Profile tab. */
export function PersonnelProfilePanel({ subject }: { subject: PersonnelFileSubject }) {
  const [editingProfile, setEditingProfile] = useState(false);
  const profileQuery = useQuery({
    queryKey: ["personnel", "profile", subject.id],
    queryFn: () => fetchPersonnelProfile(subject.id),
  });
  const profile = profileQuery.data;
  const age = profile?.birthDate ? getAge(profile.birthDate) : null;

  return (
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
              value={
                profile?.birthDate && (
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
              value={
                profile?.dependents.length
                  ? profile.dependents.map((d) => `${d.name} (${d.relationship})`).join(", ")
                  : "None on file"
              }
            />
          </dl>
        )}
      </Section>

      {editingProfile && (
        <EditPersonnelProfileDialog
          key={subject.id}
          employeeId={subject.id}
          profile={profile}
          onClose={() => setEditingProfile(false)}
          onSubmitted={() => {}}
        />
      )}
    </div>
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
