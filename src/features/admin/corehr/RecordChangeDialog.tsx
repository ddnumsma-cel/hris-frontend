import { useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { listEmployees, listPositions, listUnits, peso, recordChange, unitPathOf, type ChangeInput, type EmployeeRecord } from "@/lib/corehr/api";
import { isoDate } from "@/lib/corehr/store";
import { CHANGE_KINDS, EMPLOYMENT_STATUSES, type ChangeKind, type EmploymentStatus } from "@/lib/corehr/types";
import { inputClass, keys, useActor } from "./format";
import { ErrorNote, Field } from "./ui";

const KIND_HELP: Record<ChangeKind, string> = {
  Promotion: "Moves up to a new position, usually with a pay change",
  Transfer: "Moves to another position, team, department or branch",
  "Salary adjustment": "Merit increase, market adjustment or correction",
  Regularization: "Ends probation; employment becomes regular",
  "Supervisor change": "Who they report to day to day",
  "Status change": "On leave, suspended, or back to active",
  Separation: "Resignation, end of contract, retirement or termination",
};

/** Records a job change on the employee's 201 file and applies it to their current job. */
export function RecordChangeDialog({ record, onClose }: { record: EmployeeRecord; onClose: () => void }) {
  const { employee: e } = record;
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const positionsQuery = useQuery({ queryKey: keys.positions, queryFn: listPositions });
  const unitsQuery = useQuery({ queryKey: keys.units, queryFn: listUnits });
  const employeesQuery = useQuery({ queryKey: keys.employees, queryFn: listEmployees });
  const units = unitsQuery.data ?? [];

  const [kind, setKind] = useState<ChangeKind | null>(null);
  const [effectiveDate, setEffectiveDate] = useState(isoDate());
  const [positionId, setPositionId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [salary, setSalary] = useState("");
  const [status, setStatus] = useState<EmploymentStatus | "">("");
  const [remarks, setRemarks] = useState("");

  const moves = kind === "Promotion" || kind === "Transfer";
  const position = positionsQuery.data?.find((p) => p.id === positionId);
  const teams = units.filter((u) => u.type === "team" && u.active && u.parentId === position?.departmentId);
  const positionOptions = (positionsQuery.data ?? [])
    .filter((p) => p.active)
    .sort((a, b) => unitPathOf(a.departmentId, units).localeCompare(unitPathOf(b.departmentId, units)) || a.title.localeCompare(b.title));
  const people = (employeesQuery.data ?? []).filter((x) => x.id !== e.id && x.status !== "Separated");
  const available = CHANGE_KINDS.filter((k) => k !== "Regularization" || e.job.employmentType === "Probationary");

  const mutation = useMutation({
    mutationFn: () => {
      const input: ChangeInput = {
        employeeId: e.id,
        kind: kind!,
        effectiveDate,
        positionId: moves ? positionId : undefined,
        teamId: moves ? teamId : undefined,
        supervisorId: moves || kind === "Supervisor change" ? supervisorId || undefined : undefined,
        monthlySalary: (moves || kind === "Salary adjustment") && salary ? Number(salary) : undefined,
        status: kind === "Status change" && status ? status : undefined,
        remarks,
      };
      return recordChange(input, actor);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.show(`${kind} recorded for ${record.summary.name}.`);
      onClose();
    },
  });

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={kind ? `Record ${kind.toLowerCase()}` : "Record a job change"}
      dismissOnBackdrop={false}
      footer={
        kind && (
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setKind(null)}>
              Change type
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button variant={kind === "Separation" ? "danger" : "primary"} onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Record change"}
              </Button>
            </div>
          </div>
        )
      }
    >
      {!kind ? (
        <div>
          <p className="mb-3 text-sm text-ink-2">
            What's changing for <span className="font-semibold text-ink">{record.summary.name}</span>? It's applied to their current job and kept in their history.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {available.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  mutation.reset();
                }}
                className={clsx("rounded-xl border border-border p-3 text-left transition-colors hover:border-brand hover:bg-brand-tint/40", k === "Separation" && "hover:border-critical hover:bg-critical-tint/40")}
              >
                <span className="block text-sm font-semibold">{k}</span>
                <span className="mt-0.5 block text-xs text-ink-2">{KIND_HELP[k]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
            <p className="text-xs font-semibold text-ink-3">Now</p>
            <p className="mt-0.5">
              {record.position?.title ?? "Unassigned"} · {record.unitPath || "—"}
            </p>
            <p className="text-xs text-ink-2">
              {e.job.employmentType} · {e.job.status} · {peso(e.job.monthlySalary)} a month · reports to {record.supervisor?.name ?? "no one"}
            </p>
          </div>

          <Field id="ch-date" label="Effective date" required className="sm:max-w-[13rem]">
            <input id="ch-date" type="date" className={inputClass} value={effectiveDate} min={e.job.dateHired} onChange={(ev) => setEffectiveDate(ev.target.value)} />
          </Field>

          {moves && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ch-position" label="New position" required className="sm:col-span-2" hint={position ? `${position.filled} of ${position.slots} slots filled` : "Full positions can't be chosen. Add a slot in Positions first."}>
                <select
                  id="ch-position"
                  className={inputClass}
                  value={positionId}
                  onChange={(ev) => {
                    setPositionId(ev.target.value);
                    setTeamId("");
                    setSupervisorId("");
                  }}
                >
                  <option value="">Choose a position</option>
                  {positionOptions.map((p) => {
                    const current = p.id === e.job.positionId;
                    return (
                      <option key={p.id} value={p.id} disabled={!current && p.open === 0}>
                        {p.title} · {unitPathOf(p.departmentId, units)}
                        {current ? " (current)" : p.open === 0 ? " (full)" : ` (${p.open} open)`}
                      </option>
                    );
                  })}
                </select>
              </Field>
              {teams.length > 0 && (
                <Field id="ch-team" label="Team">
                  <select id="ch-team" className={inputClass} value={teamId} onChange={(ev) => setTeamId(ev.target.value)}>
                    <option value="">Department only, no team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field id="ch-sup" label="Supervisor" hint="Leave blank to use whoever holds the position it reports to">
                <select id="ch-sup" className={inputClass} value={supervisorId} onChange={(ev) => setSupervisorId(ev.target.value)}>
                  <option value="">Automatic</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.positionTitle}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {(moves || kind === "Salary adjustment") && (
            <Field id="ch-salary" label="New monthly salary (₱)" required={kind === "Salary adjustment"} hint={`Currently ${peso(e.job.monthlySalary)}${moves ? ". Leave blank to keep it." : ""}`} className="sm:max-w-[13rem]">
              <input id="ch-salary" type="number" inputMode="numeric" min={1} step={500} className={inputClass} value={salary} onChange={(ev) => setSalary(ev.target.value)} />
            </Field>
          )}

          {kind === "Supervisor change" && (
            <Field id="ch-sup2" label="New supervisor" required>
              <select id="ch-sup2" className={inputClass} value={supervisorId} onChange={(ev) => setSupervisorId(ev.target.value)}>
                <option value="">Choose someone</option>
                {people
                  .filter((p) => p.id !== e.job.supervisorId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.positionTitle}
                    </option>
                  ))}
              </select>
            </Field>
          )}

          {kind === "Status change" && (
            <Field id="ch-status" label="New status" required className="sm:max-w-[13rem]">
              <select id="ch-status" className={inputClass} value={status} onChange={(ev) => setStatus(ev.target.value as EmploymentStatus)}>
                <option value="">Choose a status</option>
                {EMPLOYMENT_STATUSES.filter((s) => s !== "Separated" && s !== e.job.status).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          )}

          {kind === "Regularization" && <p className="rounded-lg bg-good-tint px-3 py-2 text-sm text-good">Employment type changes from Probationary to Regular on the effective date.</p>}
          {kind === "Separation" && (
            <p className="rounded-lg bg-critical-tint px-3 py-2 text-sm text-critical">Their position slot opens up and anyone reporting to them loses that link. The 201 file stays on record.</p>
          )}

          <Field id="ch-remarks" label={kind === "Separation" ? "Reason" : "Remarks"} required={kind === "Separation"} hint="Memo or PAN number, reason, approvals">
            <textarea id="ch-remarks" rows={2} className={clsx(inputClass, "resize-y")} value={remarks} onChange={(ev) => setRemarks(ev.target.value)} />
          </Field>

          <ErrorNote error={mutation.error} />
          <button type="submit" hidden />
        </form>
      )}
    </Dialog>
  );
}
