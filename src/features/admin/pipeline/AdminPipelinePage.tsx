import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { InboxIcon, UserCheckIcon } from "@/components/icons";
import { fetchHiredThroughOnboarding, fetchOnboardingSubmissions } from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { OnboardingSubmission } from "@/lib/types";
import { ReviewSubmissionDialog } from "./ReviewSubmissionDialog";
import { formatSubmitted, submittedFileCount } from "./submissionFormat";

function Loading() {
  return (
    <table className="w-full">
      <tbody>
        <SkeletonRows columns={3} rows={2} />
      </tbody>
    </table>
  );
}

/** Where every new hire stands: sent Onboarding and waiting for HR, or accepted and hired. */
export function AdminPipelinePage() {
  const toast = useToast();
  const submissionsQuery = useQuery({ queryKey: ["admin", "onboarding-submissions"], queryFn: fetchOnboardingSubmissions });
  const hiredQuery = useQuery({ queryKey: ["admin", "hired-through-onboarding"], queryFn: fetchHiredThroughOnboarding });
  const [reviewing, setReviewing] = useState<OnboardingSubmission | null>(null);
  const waiting = submissionsQuery.data ?? [];
  const hired = hiredQuery.data ?? [];

  return (
    <>
      <ContentHead title="Pipeline" subtitle={`${waiting.length} not yet hired · ${hired.length} hired · ${formatToday()}`} />
      <p className="-mt-2 text-sm text-ink-2">
        New hires fill in the Onboarding form you set up in the Employee Directory. Review and accept them there or here.
      </p>

      <Card>
        <CardHeader title="Not yet hired" meta={waiting.length ? `${waiting.length} waiting for review` : undefined} />
        {submissionsQuery.isLoading ? (
          <Loading />
        ) : waiting.length === 0 ? (
          <EmptyState icon={<InboxIcon />} title="Nobody waiting" description="People who send their Onboarding form show up here until you accept them." />
        ) : (
          <ul className="divide-y divide-border">
            {waiting.map((s) => (
              <li key={s.id} className="item-enter flex flex-col gap-3 px-4.5 py-3.5 sm:flex-row sm:items-center">
                <MiniAvatar initials={(s.input.firstName[0] ?? "") + (s.input.lastName[0] ?? "")} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {s.input.firstName} {s.input.lastName}
                  </p>
                  <p className="truncate text-xs text-ink-2">
                    Sent {formatSubmitted(s.submittedAt)} · {s.input.phone ?? "No mobile"} · {submittedFileCount(s)} 201 file{submittedFileCount(s) === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="flex-none rounded-full bg-warning-tint px-2.5 py-0.5 text-xs font-semibold text-warning">Waiting for review</span>
                <Button size="sm" className="flex-none justify-center" onClick={() => setReviewing(s)}>
                  Review
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Hired" meta={hired.length ? `${hired.length} accepted` : undefined} />
        {hiredQuery.isLoading ? (
          <Loading />
        ) : hired.length === 0 ? (
          <EmptyState icon={<UserCheckIcon />} title="No one hired yet" description="People you accept move here and into the Employee Directory." />
        ) : (
          <ul className="divide-y divide-border">
            {hired.map((e) => (
              <li key={e.id} className="flex flex-col gap-3 px-4.5 py-3.5 sm:flex-row sm:items-center">
                <MiniAvatar initials={e.initials} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{e.name}</p>
                  <p className="truncate text-xs text-ink-2">
                    {e.position} · {e.department} · <span className="font-num">{e.id}</span>
                  </p>
                </div>
                <span className="flex-none text-xs text-ink-2">Accepted {e.acceptedAt ? formatSubmitted(e.acceptedAt) : ""}</span>
                <Link
                  to={`/admin/directory?employee=${e.id}`}
                  className="flex-none rounded-full border border-border px-3 py-1.5 text-center text-xs font-semibold hover:border-brand"
                >
                  View profile
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ReviewSubmissionDialog
        submission={reviewing}
        onClose={() => setReviewing(null)}
        onDone={(employee) => {
          setReviewing(null);
          toast.show(`Accepted ${employee.name} as ${employee.position} · ${employee.id}`);
        }}
      />
    </>
  );
}
