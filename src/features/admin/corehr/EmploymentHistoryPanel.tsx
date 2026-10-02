import { useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { PlusIcon } from "@/components/icons";
import { useAuditActor } from "@/components/shared/PersonnelFilePanels";
import {
  EMPLOYEE_STATUSES,
  fetchAssignment,
  fetchEmploymentEvents,
  fetchOrgUnits,
  fetchPositions,
  recordEmploymentChange,
  unitPath,
  type EmployeeStatus,
  type EventType,
} from "@/lib/coreHr";
import { formatDate, peso } from "./format";
import { Badge, Detail, Field, inputClass } from "./ui";

const EVENT_TONE: Record<EventType, "neutral" | "good" | "warn" | "crit" | "brand"> = {
  Hired: "brand",
  Regularized: "good",
  Promoted: "good",
  Transferred: "brand",
  "Salary adjustment": "neutral",
  "Status change": "warn",
  Separated: "crit",
};

/** The 201 file's current assignment and every employment change on record. */
export function EmploymentHistoryPanel({ employeeId }: { employeeId: string }) {
  const [recording, setRecording] = useState(false);
  const assignmentQuery = useQuery({ queryKey: ["corehr", "assignment", employeeId], queryFn: () => fetchAssignment(employeeId) });
  const eventsQuery = useQuery({ queryKey: ["corehr", "events", employeeId], queryFn: () => fetchEmploymentEvents(employeeId) });
  const unitsQuery = useQuery({ queryKey: ["corehr", "units"], queryFn: fetchOrgUnits });
  const positionsQuery = useQuery({ queryKey: ["corehr", "positions"], queryFn: fetchPositions });
  const a = assignmentQuery.data;
  const position = positionsQuery.data?.find((p) => p.id === a?.positionId);
  const reportsTo = positionsQuery.data?.find((p) => p.id === position?.reportsToId);

  if (assignmentQuery.isLoading || eventsQuery.isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border p-4">
        <div className="mb-2 flex items-center gap-3">
          <h3 className="flex-1 text-sm font-semibold">Current assignment</h3>
          {a && a.status !== "Separated" && (
            <Button size="sm" icon={<PlusIcon className="h-3.5 w-3.5" />} onClick={() => setRecording(true)}>
              Record change
            </Button>
          )}
        </div>
        {!a ? (
          <p className="text-sm text-ink-3">No Core HR assignment yet.</p>
        ) : (
          <dl className="grid gap-x-8 sm:grid-cols-2">
            <Detail label="Position">{position?.title}</Detail>
            <Detail label="Level">{position?.level}</Detail>
            <Detail label="Unit">{unitsQuery.data && unitPath(a.unitId, unitsQuery.data)}</Detail>
            <Detail label="Reports to">{reportsTo?.title}</Detail>
            <Detail label="Employment">{a.employmentType}</Detail>
            <Detail label="Status">
              <Badge tone={a.status === "Active" ? "good" : a.status === "Separated" ? "crit" : a.status === "Probationary" ? "brand" : "warn"}>{a.status}</Badge>
            </Detail>
            <Detail label="Monthly salary">{a.monthlySalary !== undefined ? <span className="font-num">{peso(a.monthlySalary)}</span> : undefined}</Detail>
            <Detail label="Date hired">{a.dateHired && formatDate(a.dateHired)}</Detail>
          </dl>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Employment history</h3>
        {(eventsQuery.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-ink-3">Nothing recorded yet.</p>
        ) : (
          <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
            {eventsQuery.data!.map((ev) => (
              <li key={ev.id} className="relative">
                <span className={clsx("absolute top-1.5 -left-[1.6rem] h-2.5 w-2.5 rounded-full ring-4 ring-surface", ev.type === "Separated" ? "bg-critical" : "bg-brand")} aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={EVENT_TONE[ev.type]}>{ev.type}</Badge>
                  <span className="font-num text-xs text-ink-2">Effective {formatDate(ev.effectiveDate)}</span>
                </div>
                {(ev.from || ev.to) && (
                  <p className="mt-1 text-sm">
                    {ev.from && <span className="text-ink-2">{ev.from}</span>}
                    {ev.from && ev.to && <span className="px-1.5 text-ink-3">→</span>}
                    {ev.to && <span className="font-medium">{ev.to}</span>}
                  </p>
                )}
                {ev.remarks && <p className="mt-1 text-xs text-ink-2">“{ev.remarks}”</p>}
                <p className="mt-1 text-[0.7rem] text-ink-3">
                  Recorded by {ev.recordedBy} · {formatDate(ev.recordedAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {recording && a && <RecordChangeDialog employeeId={employeeId} onClose={() => setRecording(false)} />}
    </div>
  );
}

const CHANGE_TYPES: EventType[] = ["Promoted", "Transferred", "Salary adjustment", "Regularized", "Status change", "Separated"];

function RecordChangeDialog({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const toast = useToast();
  const actor = useAuditActor();
  const queryClient = useQueryClient();
  const assignmentQuery = useQuery({ queryKey: ["corehr", "assignment", employeeId], queryFn: () => fetchAssignment(employeeId) });
  const unitsQuery = useQuery({ queryKey: ["corehr", "units"], queryFn: fetchOrgUnits });
  const positionsQuery = useQuery({ queryKey: ["corehr", "positions"], queryFn: fetchPositions });
  const units = unitsQuery.data ?? [];
  const current = assignmentQuery.data;

  const [type, setType] = useState<EventType>("Promoted");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [positionId, setPositionId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [salary, setSalary] = useState("");
  const [status, setStatus] = useState<EmployeeStatus>("On leave");
  const [remarks, setRemarks] = useState("");

  const moves = type === "Promoted" || type === "Transferred";
  const position = positionsQuery.data?.find((p) => p.id === positionId);
  const teams = units.filter((u) => u.kind === "team" && u.active && u.parentId === position?.departmentId);
  const positionOptions = (positionsQuery.data ?? [])
    .filter((p) => p.active && p.id !== current?.positionId)
    .sort((x, y) => unitPath(x.departmentId, units).localeCompare(unitPath(y.departmentId, units)) || x.title.localeCompare(y.title));

  const mutation = useMutation({
    mutationFn: () =>
      recordEmploymentChange({
        employeeId,
        type,
        effectiveDate,
        positionId: moves ? positionId || undefined : undefined,
        unitId: moves ? unitId || undefined : undefined,
        monthlySalary: (moves || type === "Salary adjustment") && salary ? Number(salary) : undefined,
        status: type === "Status change" ? status : undefined,
        remarks,
        actor,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["personnel", "audit-log", employeeId] });
      toast.show(`${type} recorded.`);
      onClose();
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Record employment change"
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={type === "Separated" ? "danger" : "primary"} onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : `Record ${type.toLowerCase()}`}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <fieldset>
          <legend className="mb-1.5 text-[0.82rem] font-semibold text-ink-2">Change</legend>
          <div className="flex flex-wrap gap-1.5">
            {CHANGE_TYPES.filter((t) => t !== "Regularized" || current?.employmentType !== "Regular").map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={clsx(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  type === t ? "border-brand bg-brand-tint text-brand-ink" : "border-border text-ink-2 hover:border-brand",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <Field id="ch-date" label="Effective date" required className="sm:max-w-[14rem]">
          <input id="ch-date" type="date" className={inputClass} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </Field>

        {moves && (
          <>
            <Field id="ch-position" label="New position" required hint={position ? `${position.filled}/${position.slots} filled` : "Only positions with an open slot can be chosen"}>
              <select
                id="ch-position"
                className={inputClass}
                value={positionId}
                onChange={(e) => {
                  setPositionId(e.target.value);
                  setUnitId("");
                }}
              >
                <option value="">Choose a position</option>
                {positionOptions.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.vacant === 0}>
                    {p.title} · {unitPath(p.departmentId, units)}
                    {p.vacant === 0 ? " (full)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            {teams.length > 0 && (
              <Field id="ch-team" label="Team">
                <select id="ch-team" className={inputClass} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                  <option value="">No team (department only)</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}

        {(moves || type === "Salary adjustment") && (
          <Field id="ch-salary" label="New monthly salary" required={type === "Salary adjustment"} hint={`Currently ${peso(current?.monthlySalary)}${moves ? " · leave blank to keep" : ""}`} className="sm:max-w-[14rem]">
            <input id="ch-salary" type="number" min={0} step={500} inputMode="numeric" className={inputClass} value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="35000" />
          </Field>
        )}

        {type === "Status change" && (
          <Field id="ch-status" label="New status" required hint={`Currently ${current?.status}`} className="sm:max-w-[14rem]">
            <select id="ch-status" className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as EmployeeStatus)}>
              {EMPLOYEE_STATUSES.filter((s) => s !== "Separated" && s !== current?.status).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        )}

        {type === "Regularized" && <p className="rounded-lg bg-good-tint px-3.5 py-2.5 text-sm text-good">Employment type becomes Regular and probation ends.</p>}
        {type === "Separated" && (
          <p className="rounded-lg bg-critical-tint px-3.5 py-2.5 text-sm text-critical">Frees their position slot and marks them separated. Use the Separation tab for clearance and final pay.</p>
        )}

        <Field id="ch-remarks" label="Remarks" hint="Board resolution, memo no., reason…">
          <textarea id="ch-remarks" rows={2} className={clsx(inputClass, "resize-y")} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>

        {mutation.isError && (
          <p role="alert" className="rounded-lg bg-critical-tint px-3.5 py-2.5 text-sm text-critical">
            {(mutation.error as Error).message}
          </p>
        )}
      </form>
    </Dialog>
  );
}
