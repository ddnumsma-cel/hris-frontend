import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BrandName } from "@/components/layout/Brand";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { BriefcaseIcon, CheckCircleIcon, MapPinIcon } from "@/components/icons";
import { fetchOpenRequisitions } from "@/lib/api";
import { isAccountingRole } from "@/lib/recruitment";
import type { Applicant, JobRequisition } from "@/lib/types";
import { ApplicationWizard } from "./ApplicationWizard";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 pt-5 pb-12 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandName />
          <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink-2">Careers</span>
        </div>
        <ThemeToggle />
      </header>
      {children}
      <p className="mt-8 text-center text-xs text-ink-3">MSMA Group · Cebu · Manila · Davao</p>
    </div>
  );
}

/**
 * Public application form behind the link HR shares on social media. No login. Accounting roles are
 * listed first, and HR reviews CPAs and accountancy graduates first.
 */
export function ApplyPage() {
  const { requisitionId } = useParams();
  const rolesQuery = useQuery({ queryKey: ["public", "open-roles"], queryFn: fetchOpenRequisitions });
  const [sent, setSent] = useState<{ applicant: Applicant; role: JobRequisition } | null>(null);

  // The firm hires for accounting: only accounting roles are offered here.
  const roles = useMemo(
    () => (rolesQuery.data ?? []).filter(isAccountingRole).sort((a, b) => a.title.localeCompare(b.title)),
    [rolesQuery.data],
  );
  const role = requisitionId ? roles.find((r) => r.id === requisitionId) : undefined;

  if (rolesQuery.isLoading) {
    return (
      <Shell>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-4 h-[28rem] w-full rounded-2xl" />
      </Shell>
    );
  }

  if (sent) {
    return (
      <Shell>
        <div className="success-enter rounded-2xl border border-border bg-surface p-7 text-center shadow-sm sm:p-9">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-good-tint text-good">
            <CheckCircleIcon className="h-7 w-7" />
          </span>
          <h1 className="font-display mt-4 text-2xl font-semibold tracking-[-0.02em]">Thanks, {sent.applicant.firstName}</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-2">
            Your application for <span className="font-semibold text-ink">{sent.role.title}</span> is in. HR will contact you at{" "}
            <span className="font-semibold text-ink">{sent.applicant.email}</span>.
          </p>
          <Link to="/apply" onClick={() => setSent(null)} className="mt-6 inline-block text-sm font-semibold text-brand-ink hover:underline">
            See other open roles
          </Link>
        </div>
      </Shell>
    );
  }

  if (requisitionId && !role) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-surface p-7 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-2">
            <BriefcaseIcon className="h-6 w-6" />
          </span>
          <h1 className="font-display mt-4 text-xl font-semibold">This role is no longer open</h1>
          <p className="mt-1.5 text-sm text-ink-2">It may have been filled or closed. Other roles may still fit you.</p>
          <Link to="/apply" className="mt-5 inline-flex rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-ink">
            See all open roles
          </Link>
        </div>
      </Shell>
    );
  }

  if (rolesQuery.isError) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-surface p-7 text-center shadow-sm">
          <h1 className="font-display text-xl font-semibold">We couldn't load the open roles</h1>
          <p className="mt-1.5 text-sm text-ink-2">Check your connection and try again.</p>
          <Button className="mt-5 justify-center" onClick={() => rolesQuery.refetch()}>
            Try again
          </Button>
        </div>
      </Shell>
    );
  }

  if (roles.length === 0) {
    return (
      <Shell>
        <div className="rounded-2xl border border-border bg-surface p-7 text-center shadow-sm">
          <h1 className="font-display text-xl font-semibold">No open roles right now</h1>
          <p className="mt-1.5 text-sm text-ink-2">Check back soon, or follow MSMA for new openings.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="mb-5">
        <p className="text-xs font-semibold tracking-[0.06em] text-brand-ink uppercase">{role ? "Now hiring" : `${roles.length} open roles`}</p>
        <h1 className="font-display mt-1 text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] sm:text-3xl">
          {role ? role.title : "Join MSMA Group"}
        </h1>
        {role ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink-2">
              <MapPinIcon className="h-3.5 w-3.5" />
              {role.office}
            </span>
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink-2">{role.department}</span>
            {role.employmentType && <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink-2">{role.employmentType}</span>}
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink-2">
              {role.openings} {role.openings === 1 ? "opening" : "openings"}
            </span>
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-ink-2">An accounting and professional-services firm. Upload your resumé and apply in about 3 minutes.</p>
        )}
      </section>
      <ApplicationWizard roles={roles} fixedRoleId={role?.id} onSent={setSent} />
    </Shell>
  );
}

