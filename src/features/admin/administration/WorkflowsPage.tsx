import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { ArrowRightIcon } from "@/components/icons";
import { approvalPath, describeSteps, listRoles, listWorkflows, sampleEmployees, saveWorkflow, WORKFLOW_LABEL } from "@/lib/admin/api";
import type { ApproverKind, RequestKind, Workflow, WorkflowStep } from "@/lib/admin/store";
import { inputClass, useActor } from "../corehr/format";
import { ErrorNote, Field, LoadError } from "../corehr/ui";
import { Name, SimpleTable, type Col } from "../timekeeping/common";

const APPROVER: Record<ApproverKind, string> = { supervisor: "Their manager or supervisor", "department-head": "Department head", role: "Anyone with a role…" };

function WorkflowDialog({ initial, onClose }: { initial: Workflow; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });
  const [w, setW] = useState(initial);
  const setStep = (i: number, patch: Partial<WorkflowStep>) => setW({ ...w, steps: w.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, by: number) => {
    const steps = [...w.steps];
    [steps[i], steps[i + by]] = [steps[i + by]!, steps[i]!];
    setW({ ...w, steps });
  };
  const save = useMutation({
    mutationFn: () => saveWorkflow(w, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.show("Approval steps saved.");
      onClose();
    },
  });
  const hrRoles = (roles.data ?? []).filter((r) => r.workspace === "admin");

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={`${WORKFLOW_LABEL[w.kind].name} approvals`}
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">A request goes through these steps in order. Each person must approve before it moves on; one rejection ends it.</p>
        <ol className="flex flex-col gap-2">
          {w.steps.map((s, i) => (
            <li key={i} className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
              <span className="mb-2 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-ink text-xs font-semibold text-bg">{i + 1}</span>
              <Field id={`ws-${i}`} label="Who approves" className="min-w-44 flex-1">
                <select id={`ws-${i}`} className={inputClass} value={s.approver} onChange={(e) => setStep(i, { approver: e.target.value as ApproverKind, roleId: e.target.value === "role" ? (s.roleId ?? hrRoles[0]?.id) : undefined })}>
                  {Object.entries(APPROVER).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              {s.approver === "role" && (
                <Field id={`wr-${i}`} label="Role" className="min-w-40 flex-1">
                  <select id={`wr-${i}`} className={inputClass} value={s.roleId ?? ""} onChange={(e) => setStep(i, { roleId: e.target.value })}>
                    {hrRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {w.kind === "leave" && i > 0 && (
                <Field id={`wd-${i}`} label="Only when longer than (days)" className="w-44">
                  <input id={`wd-${i}`} type="number" min={1} placeholder="Always" className={inputClass} value={s.overDays ?? ""} onChange={(e) => setStep(i, { overDays: e.target.value ? e.target.valueAsNumber : undefined })} />
                </Field>
              )}
              <span className="mb-1 flex gap-1">
                <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                  ↑
                </Button>
                <Button size="sm" variant="ghost" disabled={i === w.steps.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                  ↓
                </Button>
                <Button size="sm" variant="ghost" disabled={w.steps.length === 1} onClick={() => setW({ ...w, steps: w.steps.filter((_, j) => j !== i) })}>
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Button variant="ghost" size="sm" disabled={w.steps.length >= 3} onClick={() => setW({ ...w, steps: [...w.steps, { approver: "role", roleId: hrRoles[0]?.id }] })}>
            Add a step
          </Button>
          <Field id="w-remind" label="Remind the approver after (days)" hint="0 means no reminders." className="w-60">
            <input id="w-remind" type="number" min={0} className={inputClass} value={w.remindAfterDays} onChange={(e) => setW({ ...w, remindAfterDays: e.target.valueAsNumber })} />
          </Field>
        </div>
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}

export function WorkflowsPage() {
  const flows = useQuery({ queryKey: ["admin", "workflows"], queryFn: listWorkflows });
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [staff] = useState(sampleEmployees);
  const [tryKind, setTryKind] = useState<RequestKind>("leave");
  const [tryEmp, setTryEmp] = useState(staff[0]?.id ?? "");
  const [tryDays, setTryDays] = useState(5);

  if (flows.isError) return <LoadError onRetry={() => flows.refetch()} />;

  // Recomputed on each render so it follows saved changes.
  const path = flows.data ? approvalPath(tryKind, tryEmp, tryDays) : [];
  const cols: Col<Workflow>[] = [
    { header: "Request", cell: (w) => <Name name={WORKFLOW_LABEL[w.kind].name} sub={WORKFLOW_LABEL[w.kind].description} /> },
    { header: "Approved by", cell: (w) => <span className="inline-block max-w-md truncate align-bottom">{describeSteps(w)}</span> },
    { header: "Reminder", cell: (w) => <span className="text-ink-2">{w.remindAfterDays ? `After ${w.remindAfterDays} ${w.remindAfterDays === 1 ? "day" : "days"}` : "None"}</span> },
    {
      header: "",
      align: "right",
      cell: (w) => (
        <Button size="sm" variant="ghost" onClick={() => setEditing(w)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <>
      <ContentHead title="Approval workflows" subtitle="Who approves each kind of request, and in what order." />
      <SimpleTable rows={flows.data ?? []} rowKey={(w) => w.kind} cols={cols} loading={flows.isLoading} empty="No workflows." />
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Check who would approve</h2>
        <p className="mb-3 text-xs text-ink-2">Pick an employee and a request to see the actual people it goes to.</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field id="t-emp" label="Employee" className="w-56">
            <select id="t-emp" className={inputClass} value={tryEmp} onChange={(e) => setTryEmp(e.target.value)}>
              {staff.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="t-kind" label="Request" className="w-44">
            <select id="t-kind" className={inputClass} value={tryKind} onChange={(e) => setTryKind(e.target.value as RequestKind)}>
              {Object.entries(WORKFLOW_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          {tryKind === "leave" && (
            <Field id="t-days" label="Days of leave" className="w-32">
              <input id="t-days" type="number" min={0.5} step={0.5} className={inputClass} value={tryDays} onChange={(e) => setTryDays(e.target.valueAsNumber || 0)} />
            </Field>
          )}
          <ol className="flex min-h-10 flex-1 flex-wrap items-center gap-2 pb-1">
            {path.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                {i > 0 && <ArrowRightIcon className="h-3.5 w-3.5 text-ink-3" />}
                <span className="rounded-lg bg-surface-2 px-2.5 py-1 text-sm">
                  <span className="text-xs text-ink-2">{p.step}: </span>
                  <span className="font-medium">{p.who}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>
      {editing && <WorkflowDialog initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
