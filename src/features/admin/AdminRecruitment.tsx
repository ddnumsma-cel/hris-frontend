import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/StatTile";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastContext";
import { ArrowRightIcon, PlusIcon, SearchIcon, ShareIcon } from "@/components/icons";
import { fetchApplicants, fetchJobRequisitions } from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { Applicant, JobRequisition, RequisitionApproval, RequisitionStage } from "@/lib/types";
import { useOfficeFilter } from "./OfficeFilterContext";
import { NewRequisitionDialog } from "./NewRequisitionDialog";
import { ShareJobLinkDialog } from "./ShareJobLinkDialog";

const stageVariant: Record<RequisitionStage, ChipVariant> = {
  Sourcing: "neutral",
  Interviewing: "warn",
  "Offer extended": "good",
};

const approvalVariant: Record<RequisitionApproval, ChipVariant> = {
  Approved: "good",
  "Pending L1": "warn",
  "Pending L2": "warn",
};

const thClass = "border-b border-border px-4 py-2.5 text-left text-xs font-medium tracking-[0.01em] text-ink-3";
const tdClass = "border-b border-border px-4 py-2.5";

function formatShortDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

/** Job requisitions and the numbers behind them. Applicants themselves are moved through stages in Pipeline. */
export function AdminRecruitment() {
  const toast = useToast();
  const navigate = useNavigate();
  const { office } = useOfficeFilter();
  const [requisitionDialogOpen, setRequisitionDialogOpen] = useState(false);
  // Which link the share dialog opens on: undefined = every open role.
  const [shareRole, setShareRole] = useState<string | undefined | null>(null);

  const requisitionsQuery = useQuery({ queryKey: ["admin", "job-requisitions"], queryFn: fetchJobRequisitions });
  const applicantsQuery = useQuery({ queryKey: ["admin", "applicants"], queryFn: fetchApplicants });

  const requisitions = (requisitionsQuery.data ?? []).filter((r) => office === "All offices" || r.office === office);
  const requisitionIds = new Set(requisitions.map((r) => r.id));
  const allApplicants = (applicantsQuery.data ?? []).filter((a) => requisitionIds.has(a.requisitionId));

  const totalOpenings = requisitions.reduce((sum, r) => sum + r.openings, 0);
  const totalApplicants = requisitions.reduce((sum, r) => sum + r.applicants, 0);
  const applicantsThisWeek = requisitions.reduce((sum, r) => sum + r.applicantsThisWeek, 0);
  const inInterview = allApplicants.filter((a) => a.stage === "Interview");
  const offersOut = allApplicants.filter((a) => a.stage === "Offered");
  const nextOfferExpiry = offersOut
    .map((a) => a.offerExpires)
    .filter((d): d is string => Boolean(d))
    .sort()[0];

  function roleTitles(list: Applicant[]) {
    return [...new Set(list.map((a) => requisitions.find((r) => r.id === a.requisitionId)?.title))].join(", ");
  }

  return (
    <>
      <ContentHead
        title="Recruitment"
        subtitle={`Job requisitions and applicant tracking · ${office} · ${formatToday()}`}
        actions={
          <>
            <Button variant="ghost" icon={<ShareIcon className="h-3.75 w-3.75" />} onClick={() => setShareRole(undefined)}>
              Share job link
            </Button>
            <Button icon={<PlusIcon className="h-3.75 w-3.75" />} onClick={() => setRequisitionDialogOpen(true)}>
              New requisition
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Open requisitions"
          value={requisitions.length}
          delta={`${totalOpenings} openings across ${requisitions.length} roles`}
        />
        <StatTile label="Applicants" value={totalApplicants} delta={`+${applicantsThisWeek} this week`} tone="good" />
        <StatTile label="In interview" value={inInterview.length} delta={roleTitles(inInterview) || "None scheduled"} />
        <StatTile
          label="Offers out"
          value={offersOut.length}
          delta={nextOfferExpiry ? `Expires ${formatShortDate(nextOfferExpiry)}` : "No open offers"}
          tone={nextOfferExpiry ? "warn" : "neutral"}
        />
      </div>

      <Card>
        <CardHeader title="Job requisitions" meta="Open a role to see its applicants in Pipeline" />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr>
                <th className={thClass}>Role</th>
                <th className={thClass}>Department</th>
                <th className={thClass}>Office</th>
                <th className={clsx(thClass, "text-right")}>Openings</th>
                <th className={clsx(thClass, "text-right")}>Applicants</th>
                <th className={thClass}>Stage</th>
                <th className={thClass}>Approval</th>
              </tr>
            </thead>
            <tbody>
              {requisitionsQuery.isLoading && <SkeletonRows columns={7} />}
              {!requisitionsQuery.isLoading && requisitions.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState icon={<SearchIcon />} title={`No open requisitions for ${office}`} />
                  </td>
                </tr>
              )}
              {requisitions.map((r) => (
                <RequisitionRow key={r.id} requisition={r} onOpen={() => navigate(`/admin/pipeline?role=${r.id}`)} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>


      <ShareJobLinkDialog open={shareRole !== null} roles={requisitionsQuery.data ?? []} initialRoleId={shareRole ?? undefined} onClose={() => setShareRole(null)} />
      <NewRequisitionDialog
        open={requisitionDialogOpen}
        onClose={() => setRequisitionDialogOpen(false)}
        onSubmitted={(title) => toast.show(`${title} requisition submitted for approval.`)}
      />

    </>
  );
}

function RequisitionRow({ requisition: r, onOpen }: { requisition: JobRequisition; onOpen: () => void }) {
  return (
    <tr onClick={onOpen} className="group cursor-pointer hover:bg-surface-2">
      <td className={clsx(tdClass, "font-semibold")}>
        <button type="button" onClick={onOpen} className="flex items-center gap-1.5 text-left" aria-label={`See applicants for ${r.title} in Pipeline`}>
          {r.title}
          <ArrowRightIcon className="h-3.5 w-3.5 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      </td>
      <td className={tdClass}>{r.department}</td>
      <td className={tdClass}>{r.office}</td>
      <td className={clsx(tdClass, "font-num text-right")}>{r.openings}</td>
      <td className={clsx(tdClass, "font-num text-right")}>{r.applicants}</td>
      <td className={tdClass}>
        <Chip variant={stageVariant[r.stage]}>{r.stage}</Chip>
      </td>
      <td className={tdClass}>
        <Chip variant={approvalVariant[r.approval]}>{r.approval}</Chip>
      </td>
    </tr>
  );
}
