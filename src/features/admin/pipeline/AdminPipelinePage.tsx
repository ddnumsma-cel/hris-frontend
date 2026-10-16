import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { ArrowRightIcon, FileIcon, InboxIcon, MailIcon, MapPinIcon, PhoneIcon, SearchIcon, ShareIcon, XIcon } from "@/components/icons";
import { fetchApplicants, fetchJobRequisitions, moveApplicant } from "@/lib/api";
import { formatToday } from "@/lib/format";
import { byAccountantPriority, isAccountant } from "@/lib/recruitment";
import type { Applicant, ApplicantStage, JobRequisition } from "@/lib/types";
import { ShareJobLinkDialog } from "../ShareJobLinkDialog";

/** The four hiring stages. "Offered" applicants sit in Interview until they're hired. */
const STAGES: { key: "Applied" | "Screening" | "Interview" | "Hired"; includes: ApplicantStage[]; hint: string; tone: string }[] = [
  { key: "Applied", includes: ["Applied"], hint: "New applications from the job link", tone: "bg-[var(--color-cat-1)]" },
  { key: "Screening", includes: ["Screening"], hint: "Resume check and exams", tone: "bg-warning" },
  { key: "Interview", includes: ["Interview", "Offered"], hint: "Interviews and job offers", tone: "bg-brand" },
  { key: "Hired", includes: ["Hired"], hint: "Accepted the offer", tone: "bg-good" },
];
const stageOf = (a: Applicant) => STAGES.find((s) => s.includes.includes(a.stage))?.key;
const nextStage: Partial<Record<ApplicantStage, ApplicantStage>> = { Applied: "Screening", Screening: "Interview", Interview: "Hired", Offered: "Hired" };

function relative(iso?: string) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

const initials = (a: Applicant) => (a.firstName[0] ?? "") + (a.lastName[0] ?? "");

/**
 * Every applicant across roles, in four stages. Applications from the shared job link arrive in
 * Applied; HR drags cards (or uses the buttons) to move people forward. Accountants are listed first.
 */
export function AdminPipelinePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const applicantsQuery = useQuery({ queryKey: ["admin", "applicants"], queryFn: fetchApplicants });
  const rolesQuery = useQuery({ queryKey: ["admin", "job-requisitions"], queryFn: fetchJobRequisitions });
  const [search, setSearch] = useState("");
  // Recruitment links here with ?role= to open one role's applicants.
  const [searchParams] = useSearchParams();
  const [roleId, setRoleId] = useState(() => searchParams.get("role") ?? "all");
  const [accountantsOnly, setAccountantsOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  // "New this week" is measured from when the page opened.
  const [now] = useState(() => Date.now());

  const mutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: ApplicantStage }) => moveApplicant(id, stage),
    onSuccess: (a) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applicants"] });
      toast.show(a.stage === "Rejected" ? `${a.firstName} ${a.lastName} marked as not moving forward.` : `${a.firstName} ${a.lastName} moved to ${stageOf(a) ?? a.stage}.`);
    },
  });

  const q = search.trim().toLowerCase();
  const visible = (applicantsQuery.data ?? []).filter(
    (a) =>
      a.stage !== "Rejected" &&
      (roleId === "all" || a.requisitionId === roleId) &&
      (!accountantsOnly || isAccountant(a)) &&
      (!q || `${a.firstName} ${a.lastName} ${a.email ?? ""} ${roleById.get(a.requisitionId)?.title ?? ""}`.toLowerCase().includes(q)),
  );
  const total = (applicantsQuery.data ?? []).filter((a) => a.stage !== "Rejected").length;
  const newThisWeek = (applicantsQuery.data ?? []).filter((a) => a.appliedAt && now - new Date(a.appliedAt).getTime() < 7 * 86_400_000).length;
  const open = (applicantsQuery.data ?? []).find((a) => a.id === openId) ?? null;

  function drop(e: DragEvent, stage: (typeof STAGES)[number]) {
    e.preventDefault();
    setOver(null);
    const a = (applicantsQuery.data ?? []).find((x) => x.id === dragId);
    setDragId(null);
    if (!a || stage.includes.includes(a.stage)) return;
    mutation.mutate({ id: a.id, stage: stage.includes[0] });
  }

  return (
    <>
      <ContentHead
        title="Pipeline"
        subtitle={`${total} active applicant${total === 1 ? "" : "s"} · ${newThisWeek} new this week · ${formatToday()}`}
        actions={
          <Button variant="ghost" icon={<ShareIcon className="h-3.75 w-3.75" />} onClick={() => setShareOpen(true)}>
            Share job link
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 sm:max-w-xs">
          <SearchIcon className="h-4 w-4 flex-none text-ink-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or role…"
            aria-label="Search applicants"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="rounded p-0.5 text-ink-3 hover:text-ink">
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          aria-label="Filter by role"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
        >
          <option value="all">All roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title} · {r.office}
            </option>
          ))}
        </select>
        <div role="radiogroup" aria-label="Which applicants to show" className="inline-flex rounded-full border border-border bg-surface-2 p-0.5">
          {[
            { v: false, label: "Everyone" },
            { v: true, label: "Accountants" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={accountantsOnly === o.v}
              onClick={() => setAccountantsOnly(o.v)}
              className={clsx("rounded-full px-3 py-1.5 text-xs font-semibold transition-colors", accountantsOnly === o.v ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink")}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-3 sm:ml-auto">Drag a card to another stage, or open it to move it.</p>
      </div>

      {/* Board */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[60rem] grid-cols-4 gap-3">
          {STAGES.map((stage) => {
            const cards = visible.filter((a) => stage.includes.includes(a.stage)).sort(byAccountantPriority);
            const isOver = over === stage.key && dragId !== null;
            return (
              <section
                key={stage.key}
                aria-label={stage.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(stage.key);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
                }}
                onDrop={(e) => drop(e, stage)}
                className={clsx(
                  "flex min-h-[26rem] flex-col rounded-2xl border bg-surface-2/60 transition-colors",
                  isOver ? "border-brand bg-brand-tint/50" : "border-border",
                )}
              >
                <header className="flex items-start gap-2.5 border-b border-border px-3.5 py-3">
                  <span className={clsx("mt-1.5 h-2 w-2 flex-none rounded-full", stage.tone)} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <h2 className="flex items-center gap-2 text-sm font-semibold">
                      {stage.key}
                      <span className="font-num rounded-full bg-surface px-2 py-px text-xs text-ink-2">{cards.length}</span>
                    </h2>
                    <p className="truncate text-xs text-ink-3">{stage.hint}</p>
                  </div>
                </header>
                <ul className="flex flex-1 flex-col gap-2 p-2.5">
                  {applicantsQuery.isLoading &&
                    Array.from({ length: 2 }).map((_, i) => (
                      <li key={i}>
                        <Skeleton className="h-24 w-full rounded-xl" />
                      </li>
                    ))}
                  {cards.map((a) => (
                    <li key={a.id}>
                      <ApplicantCard
                        a={a}
                        role={roleById.get(a.requisitionId)}
                        dragging={dragId === a.id}
                        onOpen={() => setOpenId(a.id)}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", a.id);
                          setDragId(a.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOver(null);
                        }}
                      />
                    </li>
                  ))}
                  {!applicantsQuery.isLoading && cards.length === 0 && (
                    <li className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-8 text-center">
                      <InboxIcon className="h-5 w-5 text-ink-3" />
                      <p className="text-xs text-ink-3">{q || roleId !== "all" || accountantsOnly ? "No one matches these filters" : stage.key === "Applied" ? "New applications land here" : "Drag applicants here"}</p>
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <ApplicantDialog
        a={open}
        role={open ? roleById.get(open.requisitionId) : undefined}
        busy={mutation.isPending}
        onClose={() => setOpenId(null)}
        onMove={(stage) => {
          if (!open) return;
          mutation.mutate({ id: open.id, stage });
          if (stage === "Rejected") setOpenId(null);
        }}
      />
      <ShareJobLinkDialog open={shareOpen} roles={roles} onClose={() => setShareOpen(false)} />
    </>
  );
}

function ApplicantCard({
  a,
  role,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  a: Applicant;
  role?: JobRequisition;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={clsx(
        "item-enter group relative cursor-grab rounded-xl border border-border bg-surface p-3 shadow-sm transition-[box-shadow,transform,opacity] hover:-translate-y-px hover:shadow-md active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <button type="button" onClick={onOpen} className="absolute inset-0 rounded-xl" aria-label={`Open ${a.firstName} ${a.lastName}'s application`} />
      <div className="pointer-events-none relative flex items-start gap-2.5">
        <MiniAvatar initials={initials(a)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {a.firstName} {a.lastName}
          </p>
          <p className="truncate text-xs text-ink-2">{role?.title ?? "Role closed"}</p>
        </div>
        {a.stage === "Offered" && <span className="flex-none rounded-full bg-good-tint px-1.5 py-px text-[0.65rem] font-semibold text-good">Offer sent</span>}
      </div>
      <div className="pointer-events-none relative mt-2.5 flex flex-wrap items-center gap-1.5">
        {isAccountant(a) && <span className="rounded-full bg-brand-tint px-2 py-px text-[0.68rem] font-semibold text-brand-ink">Accountant</span>}
        {a.background && <span className="max-w-full truncate rounded-full bg-surface-2 px-2 py-px text-[0.68rem] text-ink-2">{a.background}</span>}
        {!a.background && a.profession && a.profession !== "Other" && <span className="rounded-full bg-surface-2 px-2 py-px text-[0.68rem] text-ink-2">{a.profession}</span>}
      </div>
      <div className="pointer-events-none relative mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2 text-[0.7rem] text-ink-3">
        <span className="truncate">{a.source ?? a.note.split("·")[0].trim()}</span>
        <span className="flex-none">{a.appliedAt ? relative(a.appliedAt) : a.note.split("·")[1]?.trim()}</span>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[0.7rem] font-semibold tracking-[0.06em] text-ink-3 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function ApplicantDialog({
  a,
  role,
  busy,
  onClose,
  onMove,
}: {
  a: Applicant | null;
  role?: JobRequisition;
  busy: boolean;
  onClose: () => void;
  onMove: (stage: ApplicantStage) => void;
}) {
  const next = a ? nextStage[a.stage] : undefined;
  const current = a ? stageOf(a) : undefined;
  return (
    <Dialog
      open={Boolean(a)}
      onClose={onClose}
      title={a ? `${a.firstName} ${a.lastName}` : "Applicant"}
      description={a ? `${role?.title ?? "Role closed"}${role ? ` · ${role.office}` : ""} · ${current ?? a.stage}` : undefined}
      size="lg"
      footer={
        a && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {a.stage !== "Hired" && (
              <Button variant="ghost" className="justify-center sm:mr-auto" disabled={busy} onClick={() => onMove("Rejected")}>
                Not moving forward
              </Button>
            )}
            <select
              aria-label="Move to stage"
              value={current}
              disabled={busy}
              onChange={(e) => onMove(STAGES.find((s) => s.key === e.target.value)!.includes[0])}
              className="rounded-full border border-border bg-surface px-3 py-2 text-sm"
            >
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.key}
                </option>
              ))}
            </select>
            {next && (
              <Button className="justify-center" disabled={busy} icon={<ArrowRightIcon className="h-4 w-4" />} onClick={() => onMove(next)}>
                Move to {STAGES.find((s) => s.includes.includes(next))?.key}
              </Button>
            )}
          </div>
        )
      }
    >
      {a && (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand-ink">{initials(a)}</span>
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {a.firstName} {a.lastName}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  {isAccountant(a) && <span className="rounded-full bg-brand-tint px-2 py-px text-[0.68rem] font-semibold text-brand-ink">Accountant</span>}
                  <span className="rounded-full bg-surface-2 px-2 py-px text-[0.68rem] text-ink-2">{a.source ?? "Applied"}</span>
                </div>
              </div>
            </div>
            <Section title="Contact">
              <ul className="flex flex-col gap-1.5 text-sm">
                {a.email && (
                  <li className="flex items-center gap-2">
                    <MailIcon className="h-4 w-4 flex-none text-ink-3" />
                    <a href={`mailto:${a.email}`} className="truncate text-brand-ink hover:underline">
                      {a.email}
                    </a>
                  </li>
                )}
                {a.phone && (
                  <li className="flex items-center gap-2">
                    <PhoneIcon className="h-4 w-4 flex-none text-ink-3" />
                    {a.phone}
                  </li>
                )}
                {(a.city || a.province) && (
                  <li className="flex items-center gap-2">
                    <MapPinIcon className="h-4 w-4 flex-none text-ink-3" />
                    {[a.city, a.province].filter(Boolean).join(", ")}
                  </li>
                )}
              </ul>
            </Section>
            <Section title="Documents">
              <ul className="flex flex-col gap-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <FileIcon className="h-4 w-4 flex-none text-ink-3" />
                  {a.resumeFileName ?? <span className="text-ink-3">No resumé</span>}
                </li>
                <li className="flex items-center gap-2">
                  <FileIcon className="h-4 w-4 flex-none text-ink-3" />
                  {a.coverLetter ? (a.coverLetter.kind === "upload" ? a.coverLetter.fileName : "Written cover letter (below)") : <span className="text-ink-3">No cover letter</span>}
                </li>
              </ul>
            </Section>
            {a.skills && a.skills.length > 0 && (
              <Section title="Skills">
                <ul className="flex flex-wrap gap-1.5">
                  {a.skills.map((s) => (
                    <li key={s} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs">
                      {s}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
          <div className="flex flex-col gap-5">
            <Section title="Experience">
              <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-ink-2">Background</dt>
                <dd className="font-medium">{a.background ?? a.profession ?? "—"}</dd>
                <dt className="text-ink-2">Years</dt>
                <dd className="font-medium">{a.yearsExperience !== undefined ? (a.yearsExperience === 0 ? "None yet" : `${a.yearsExperience} year${a.yearsExperience === 1 ? "" : "s"}`) : "—"}</dd>
                {a.prcLicenseNumber && (
                  <>
                    <dt className="text-ink-2">License no.</dt>
                    <dd className="font-num font-medium">{a.prcLicenseNumber}</dd>
                  </>
                )}
              </dl>
              {a.workExperience && <p className="mt-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">{a.workExperience}</p>}
            </Section>
            {a.careerHistory && a.careerHistory.length > 0 && (
              <Section title="Career history">
                <ul className="flex flex-col gap-2">
                  {a.careerHistory.map((r, i) => (
                    <li key={i} className="rounded-xl border border-border px-3.5 py-2.5 text-sm">
                      <p className="font-semibold">{r.title}</p>
                      <p className="text-ink-2">
                        {r.company} · {r.start} – {r.end || "Present"}
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {a.education && a.education.length > 0 && (
              <Section title="Education">
                <ul className="flex flex-col gap-2">
                  {a.education.map((e, i) => (
                    <li key={i} className="rounded-xl border border-border px-3.5 py-2.5 text-sm">
                      <p className="font-semibold">{e.degree}</p>
                      <p className="text-ink-2">
                        {e.school}
                        {e.finished ? ` · ${e.finished}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {a.coverLetter?.kind === "write" && (
              <Section title="Cover letter">
                <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm whitespace-pre-line">{a.coverLetter.text}</p>
              </Section>
            )}
            {!a.workExperience && !a.careerHistory?.length && !a.education?.length && <p className="text-sm text-ink-3">{a.note}</p>}
          </div>
        </div>
      )}
    </Dialog>
  );
}
