import { useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/StatTile";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastContext";
import { MoreVerticalIcon, PlusIcon, SearchIcon, UploadIcon } from "@/components/icons";
import { fetchApplicants, fetchJobRequisitions, moveApplicant } from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { Applicant, ApplicantStage, JobRequisition, RequisitionApproval, RequisitionStage } from "@/lib/types";
import { useOfficeFilter } from "./OfficeFilterContext";
import { NewRequisitionDialog } from "./NewRequisitionDialog";

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

const pipelineStages: ApplicantStage[] = ["Applied", "Screening", "Interview", "Offered", "Hired", "Rejected"];

const thClass = "border-b border-border px-4 py-2.5 text-left text-xs font-medium tracking-[0.01em] text-ink-3";
const tdClass = "border-b border-border px-4 py-2.5";

function applicantName(a: Applicant) {
  return `${a.firstName} ${a.lastName}`;
}

function formatShortDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function AdminRecruitment() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { office } = useOfficeFilter();
  const [requisitionDialogOpen, setRequisitionDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ApplicantStage | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const requisitionsQuery = useQuery({ queryKey: ["admin", "job-requisitions"], queryFn: fetchJobRequisitions });
  const applicantsQuery = useQuery({ queryKey: ["admin", "applicants"], queryFn: fetchApplicants });

  const moveMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: ApplicantStage }) => moveApplicant(id, stage),
    onSuccess: (applicant) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applicants"] });
      toast.show(`${applicantName(applicant)} moved to ${applicant.stage}.`);
    },
  });

  const requisitions = (requisitionsQuery.data ?? []).filter((r) => office === "All offices" || r.office === office);
  const requisitionIds = new Set(requisitions.map((r) => r.id));
  const allApplicants = (applicantsQuery.data ?? []).filter((a) => requisitionIds.has(a.requisitionId));
  const selected = requisitions.find((r) => r.id === selectedId) ?? requisitions[0];
  const pipeline = allApplicants.filter((a) => a.requisitionId === selected?.id);

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

  function move(applicant: Applicant, stage: ApplicantStage) {
    if (applicant.stage !== stage) moveMutation.mutate({ id: applicant.id, stage });
  }

  function handleDrop(e: DragEvent, stage: ApplicantStage) {
    e.preventDefault();
    setDragOverStage(null);
    const applicant = pipeline.find((a) => a.id === e.dataTransfer.getData("text/plain"));
    if (applicant) move(applicant, stage);
  }

  return (
    <>
      <ContentHead
        title="Recruitment"
        subtitle={`Job requisitions and applicant tracking · ${office} · ${formatToday()}`}
        actions={
          <>
            <Button
              variant="ghost"
              icon={<UploadIcon className="h-3.75 w-3.75" />}
              onClick={() => toast.show("Job board posting isn't connected yet.")}
            >
              Post job opening
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
        <CardHeader title="Job requisitions" />
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
                <RequisitionRow key={r.id} requisition={r} selected={r.id === selected?.id} onSelect={setSelectedId} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <Card>
          <CardHeader
            title={`Pipeline · ${selected.title}`}
            meta="Drag a card to move stages · Hired → creates the 201 file and onboarding checklist"
          />
          <div className="overflow-x-auto p-4">
            <div key={selected.id} className="tab-enter grid min-w-[56rem] grid-cols-6 gap-3">
              {pipelineStages.map((stage) => {
                const cards = pipeline.filter((a) => a.stage === stage);
                return (
                  <section
                    key={stage}
                    aria-label={stage}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverStage(stage);
                    }}
                    onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
                    onDrop={(e) => handleDrop(e, stage)}
                    className={clsx(
                      "flex min-h-48 flex-col gap-2 rounded-xl bg-surface-2 p-2.5",
                      dragOverStage === stage && "ring-2 ring-brand",
                    )}
                  >
                    <div className="flex items-center justify-between px-1 text-xs font-semibold text-ink-2">
                      <span>{stage}</span>
                      <span className="font-num">{cards.length}</span>
                    </div>
                    {cards.map((a) => (
                      <article
                        key={a.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", a.id);
                          setDraggingId(a.id);
                        }}
                        onDragEnd={() => setDraggingId(null)}
                        className={clsx(
                          "item-enter relative cursor-grab rounded-lg border border-border bg-surface p-2.5 shadow-sm active:cursor-grabbing",
                          draggingId === a.id && "is-dragging",
                        )}
                      >
                        <p className="pr-5 text-[0.82rem] font-semibold">{applicantName(a)}</p>
                        <p className="mt-0.5 text-xs text-ink-3">{a.note}</p>
                        {stage === "Hired" &&
                          (a.employeeId ? (
                            <Link
                              to={`/admin/directory?employee=${a.employeeId}`}
                              className="mt-2 inline-block text-xs font-semibold text-brand-ink hover:underline"
                            >
                              Open 201 file
                            </Link>
                          ) : (
                            <Button size="sm" className="mt-2 w-full justify-center" onClick={() => navigate(`/admin/directory/new?applicant=${a.id}`)}>
                              Create record
                            </Button>
                          ))}
                        {/* Dragging doesn't work on touch screens or from the keyboard, so each card also has a stage picker. */}
                        <span className="absolute top-2 right-1.5 flex h-5 w-5 items-center justify-center rounded text-ink-3 focus-within:ring-2 focus-within:ring-brand hover:bg-surface-2 hover:text-ink">
                          <MoreVerticalIcon className="h-3.5 w-3.5" />
                          <select
                            aria-label={`Move ${applicantName(a)} to another stage`}
                            value={a.stage}
                            onChange={(e) => move(a, e.target.value as ApplicantStage)}
                            className="absolute inset-0 cursor-pointer opacity-0"
                          >
                            {pipelineStages.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </span>
                      </article>
                    ))}
                  </section>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <NewRequisitionDialog
        open={requisitionDialogOpen}
        onClose={() => setRequisitionDialogOpen(false)}
        onSubmitted={(title) => toast.show(`${title} requisition submitted for approval.`)}
      />

    </>
  );
}

function RequisitionRow({
  requisition: r,
  selected,
  onSelect,
}: {
  requisition: JobRequisition;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <tr
      onClick={() => onSelect(r.id)}
      aria-selected={selected}
      className={clsx("cursor-pointer", selected ? "bg-gold-tint" : "hover:bg-surface-2")}
    >
      <td className={clsx(tdClass, "font-semibold")}>
        <button type="button" onClick={() => onSelect(r.id)} className="text-left">
          {r.title}
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
