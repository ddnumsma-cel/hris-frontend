import { useState } from "react";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { UserPlusIcon } from "@/components/icons";
import { savePosition, setPositionActive, type PositionInput, type PositionSummary, type UnitSummary } from "@/lib/corehr/api";
import { EMPLOYMENT_TYPES, JOB_LEVELS } from "@/lib/corehr/types";
import { inputClass, statusTone } from "./format";
import { StatusText } from "./SplitView";
import { ErrorNote, Field, Initials } from "./ui";

const openingText = (n: number) => `${n} opening${n === 1 ? "" : "s"}`;

/** A job: who's in it, how many it needs, and its details. Opens in edit mode when adding a new one. */
export function JobDialog({
  job,
  departmentId,
  units,
  jobs,
  onClose,
}: {
  job?: PositionSummary;
  /** For a new job: the department it goes in. */
  departmentId: string;
  units: UnitSummary[];
  jobs: PositionSummary[];
  onClose: () => void;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(!job);
  const department = units.find((u) => u.id === (job?.departmentId ?? departmentId));
  const branchId = department?.parentId;
  const [v, setV] = useState<PositionInput>(
    job
      ? { id: job.id, title: job.title, code: job.code, departmentId: job.departmentId, level: job.level, employmentType: job.employmentType, slots: job.slots, reportsToPositionId: job.reportsToPositionId, description: job.description }
      : { title: "", code: "", departmentId, level: "Rank and file", employmentType: "Probationary", slots: 1 },
  );
  const reportsOptions = jobs.filter((p) => p.active && p.id !== v.id && p.branchId === branchId);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["corehr"] });
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  };
  const save = useMutation({
    mutationFn: () => savePosition(v),
    onSuccess: (p) => {
      invalidate();
      toast.show(job ? `${p.title} saved.` : `${p.title} added to ${department?.name}.`);
      onClose();
    },
  });
  const toggle = useMutation({
    mutationFn: () => setPositionActive(job!.id, !job!.active),
    onSuccess: (p) => {
      invalidate();
      toast.show(`${p.title} ${p.active ? "reopened" : "closed"}.`);
      onClose();
    },
  });

  const footer = editing ? (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={() => (job ? setEditing(false) : onClose())}>
        Cancel
      </Button>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving…" : job ? "Save changes" : "Add job"}
      </Button>
    </div>
  ) : (
    <div className="flex flex-wrap justify-between gap-2">
      <Button
        variant="ghost"
        disabled={toggle.isPending}
        onClick={() => {
          if (job!.active && !window.confirm(`Close the ${job!.title} job? It won't be offered for new hires until you reopen it.`)) return;
          toggle.mutate();
        }}
      >
        {job!.active ? "Close job" : "Reopen job"}
      </Button>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setEditing(true)}>
          Edit job
        </Button>
        {job!.active && job!.open > 0 && (
          <Button icon={<UserPlusIcon className="h-4 w-4" />} onClick={() => navigate(`/admin/people/new?position=${job!.id}`)}>
            Hire for this job
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open onClose={onClose} title={job ? (editing ? `Edit ${job.title}` : job.title) : `Add a job to ${department?.name ?? "this department"}`} dismissOnBackdrop={!editing} footer={footer}>
      {!editing && job ? (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs text-ink-3">
              {job.departmentName} · {job.branchName}
            </p>
            <p className="font-display mt-2 text-2xl font-semibold tracking-[-0.02em]">
              {job.filled} of {job.slots} filled
            </p>
            <p className={clsx("mt-0.5 text-sm", job.open > 0 && job.active ? "font-medium text-warning" : "text-ink-2")}>
              {!job.active ? "This job is closed." : job.open > 0 ? `${openingText(job.open)} waiting to be filled` : "Every seat is filled."}
            </p>
          </div>
          <section>
            <h3 className="mb-1.5 text-sm font-semibold">People in this job</h3>
            {job.holders.length === 0 ? (
              <p className="text-sm text-ink-3">No one yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {job.holders.map((h) => (
                  <li key={h.id}>
                    <Link to={`/admin/people/${h.id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-2/60">
                      <Initials initials={h.initials} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm">{h.name}</span>
                      {h.status !== "Active" && <StatusText tone={statusTone[h.status]}>{h.status}</StatusText>}
                      <span className="text-xs text-ink-3">Open 201 file →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-3">Job level</dt>
              <dd>{job.level}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">New hires start as</dt>
              <dd>{job.employmentType}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Reports to</dt>
              <dd>{job.reportsToTitle ?? "—"}</dd>
            </div>
            {job.description && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs text-ink-3">What the job involves</dt>
                <dd>{job.description}</dd>
              </div>
            )}
          </dl>
          <ErrorNote error={toggle.error} />
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field id="j-title" label="Job title" required>
            <input id="j-title" autoFocus className={inputClass} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. Senior Associate" />
          </Field>
          <Field id="j-slots" label="How many people does this job need?" required hint={job ? `${job.filled} ${job.filled === 1 ? "person is" : "people are"} in it now.` : "You can change this later."} className="max-w-[16rem]">
            <input id="j-slots" type="number" min={Math.max(1, job?.filled ?? 1)} className={inputClass} value={Number.isNaN(v.slots) ? "" : v.slots} onChange={(e) => setV({ ...v, slots: e.target.valueAsNumber })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="j-level" label="Job level">
              <select id="j-level" className={inputClass} value={v.level} onChange={(e) => setV({ ...v, level: e.target.value as PositionInput["level"] })}>
                {JOB_LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field id="j-type" label="New hires start as">
              <select id="j-type" className={inputClass} value={v.employmentType} onChange={(e) => setV({ ...v, employmentType: e.target.value as PositionInput["employmentType"] })}>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field id="j-reports" label="Reports to" hint="The job this one answers to, if any.">
            <select id="j-reports" className={inputClass} value={v.reportsToPositionId ?? ""} onChange={(e) => setV({ ...v, reportsToPositionId: e.target.value || undefined })}>
              <option value="">No one</option>
              {reportsOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {p.departmentName}
                </option>
              ))}
            </select>
          </Field>
          <Field id="j-desc" label="What the job involves">
            <textarea id="j-desc" rows={2} className={clsx(inputClass, "resize-y")} value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="A sentence or two, optional" />
          </Field>
          <ErrorNote error={save.error} />
          <button type="submit" hidden />
        </form>
      )}
    </Dialog>
  );
}
