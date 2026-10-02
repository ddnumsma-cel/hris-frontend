import { Fragment, useMemo, useState } from "react";
import clsx from "clsx";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { EditIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { fetchEmployeeDirectory } from "@/lib/api";
import {
  EMPLOYMENT_TYPES,
  JOB_LEVELS,
  fetchAssignments,
  fetchOrgUnits,
  fetchPositions,
  savePosition,
  setPositionActive,
  unitPath,
  type PositionInput,
  type PositionWithCounts,
} from "@/lib/coreHr";
import { Badge, Field, inputClass } from "./ui";

/** Every budgeted position, how many slots it has and who fills them. */
export function AdminPositions() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const unitsQuery = useQuery({ queryKey: ["corehr", "units"], queryFn: fetchOrgUnits });
  const positionsQuery = useQuery({ queryKey: ["corehr", "positions"], queryFn: fetchPositions });
  const assignmentsQuery = useQuery({ queryKey: ["corehr", "assignments"], queryFn: fetchAssignments });
  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);
  const positions = useMemo(() => positionsQuery.data ?? [], [positionsQuery.data]);

  const [branch, setBranch] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const [vacantOnly, setVacantOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<PositionInput | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const branches = units.filter((u) => u.kind === "branch" && u.active);
  const departments = units.filter((u) => u.kind === "department" && u.active && (!branch || u.parentId === branch));
  const branchOf = (deptId: string) => units.find((u) => u.id === deptId)?.parentId;

  const q = query.trim().toLowerCase();
  const rows = positions
    .filter(
      (p) =>
        (showInactive || p.active) &&
        (!branch || branchOf(p.departmentId) === branch) &&
        (!department || p.departmentId === department) &&
        (!level || p.level === level) &&
        (!vacantOnly || p.vacant > 0) &&
        (!q || p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)),
    )
    .sort((a, b) => unitPath(a.departmentId, units).localeCompare(unitPath(b.departmentId, units)) || JOB_LEVELS.indexOf(b.level) - JOB_LEVELS.indexOf(a.level) || a.title.localeCompare(b.title));

  const active = positions.filter((p) => p.active);
  const totals = { slots: active.reduce((n, p) => n + p.slots, 0), filled: active.reduce((n, p) => n + p.filled, 0), vacant: active.reduce((n, p) => n + p.vacant, 0) };

  const toggleActive = useMutation({
    mutationFn: (p: PositionWithCounts) => setPositionActive(p.id, !p.active),
    onSuccess: (_, p) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      toast.show(`${p.title} ${p.active ? "deactivated" : "reactivated"}.`);
    },
    onError: (e) => toast.show((e as Error).message),
  });

  const holders = (positionId: string) =>
    (assignmentsQuery.data ?? [])
      .filter((a) => a.positionId === positionId && a.status !== "Separated")
      .map((a) => ({ ...a, employee: directoryQuery.data?.find((e) => e.id === a.employeeId) }));

  const emptyInput = (): PositionInput => ({
    title: "",
    code: "",
    departmentId: department || departments[0]?.id || "",
    level: "Rank and file",
    employmentType: "Regular",
    slots: 1,
  });

  return (
    <>
      <ContentHead
        title="Positions"
        subtitle={`${active.length} positions · ${totals.filled} of ${totals.slots} slots filled · ${totals.vacant} open`}
        actions={
          <Button icon={<PlusIcon className="h-3.75 w-3.75" />} onClick={() => setEditing(emptyInput())}>
            Add position
          </Button>
        }
      />

      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-lg border border-border px-3 py-2">
            <SearchIcon className="h-4 w-4 flex-none text-ink-3" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title or code" aria-label="Search positions" className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3" />
          </div>
          <select
            aria-label="Branch"
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              setDepartment("");
            }}
            className={clsx(inputClass, "w-auto py-2")}
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select aria-label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} className={clsx(inputClass, "w-auto py-2")}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {branch ? d.name : unitPath(d.id, units)}
              </option>
            ))}
          </select>
          <select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)} className={clsx(inputClass, "w-auto py-2")}>
            <option value="">All levels</option>
            {JOB_LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-1 text-xs text-ink-2">
            <input type="checkbox" checked={vacantOnly} onChange={(e) => setVacantOnly(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
            With openings
          </label>
          <label className="flex items-center gap-2 px-1 text-xs text-ink-2">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
            Inactive
          </label>
        </div>

        {positionsQuery.isLoading ? (
          <Skeleton className="m-4 h-64" />
        ) : rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-ink-3">No positions match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-2">
                  <th className="px-4 py-2.5 font-semibold">Position</th>
                  <th className="px-4 py-2.5 font-semibold">Department</th>
                  <th className="px-4 py-2.5 font-semibold">Level</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Filled</th>
                  <th className="px-4 py-2.5 font-semibold">Reports to</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const open = openId === p.id;
                  const list = open ? holders(p.id) : [];
                  return (
                    <Fragment key={p.id}>
                      <tr className={clsx("border-b border-border last:border-0", !p.active && "opacity-55")}>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => setOpenId(open ? null : p.id)} aria-expanded={open} className="text-left">
                            <span className="block font-medium hover:text-brand">{p.title}</span>
                            <span className="block text-xs text-ink-3">{p.code}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-ink-2">{unitPath(p.departmentId, units)}</td>
                        <td className="px-4 py-3">{p.level}</td>
                        <td className="px-4 py-3 text-ink-2">{p.employmentType}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-num font-medium">
                            {p.filled}/{p.slots}
                          </span>
                          {p.vacant > 0 && p.active && (
                            <span className="ml-2">
                              <Badge tone="warn">{p.vacant} open</Badge>
                            </span>
                          )}
                          {!p.active && (
                            <span className="ml-2">
                              <Badge>Inactive</Badge>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-2">{positions.find((x) => x.id === p.reportsToId)?.title ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Edit ${p.title}`}
                              icon={<EditIcon className="h-3.5 w-3.5" />}
                              onClick={() => setEditing({ id: p.id, title: p.title, code: p.code, departmentId: p.departmentId, level: p.level, employmentType: p.employmentType, slots: p.slots, reportsToId: p.reportsToId })}
                            >
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" disabled={toggleActive.isPending} onClick={() => toggleActive.mutate(p)}>
                              {p.active ? "Deactivate" : "Reactivate"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-border bg-surface-2/60">
                          <td colSpan={7} className="px-4 py-3">
                            {list.length === 0 ? (
                              <p className="text-xs text-ink-3">Nobody holds this position yet.</p>
                            ) : (
                              <ul className="flex flex-wrap gap-2">
                                {list.map((h) => (
                                  <li key={h.employeeId}>
                                    <Link to={`/admin/directory?employee=${h.employeeId}`} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs hover:border-brand">
                                      <span className="font-medium">{h.employee?.name ?? h.employeeId}</span>
                                      <span className="text-ink-3">{unitPath(h.unitId, units).split(" › ").pop()}</span>
                                      {h.status !== "Active" && <Badge tone={h.status === "Probationary" ? "brand" : "warn"}>{h.status}</Badge>}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <PositionDialog
          input={editing}
          onClose={() => setEditing(null)}
          onSaved={(title) => {
            toast.show(editing.id ? `${title} updated.` : `${title} added.`);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function PositionDialog({ input, onClose, onSaved }: { input: PositionInput; onClose: () => void; onSaved: (title: string) => void }) {
  const queryClient = useQueryClient();
  const unitsQuery = useQuery({ queryKey: ["corehr", "units"], queryFn: fetchOrgUnits });
  const positionsQuery = useQuery({ queryKey: ["corehr", "positions"], queryFn: fetchPositions });
  const units = unitsQuery.data ?? [];
  const [v, setV] = useState(input);
  const departments = units.filter((u) => u.kind === "department" && u.active).sort((a, b) => unitPath(a.id, units).localeCompare(unitPath(b.id, units)));
  const sameBranch = units.find((u) => u.id === v.departmentId)?.parentId;
  const reportsOptions = (positionsQuery.data ?? []).filter((p) => p.active && p.id !== v.id && units.find((u) => u.id === p.departmentId)?.parentId === sameBranch);
  const mutation = useMutation({
    mutationFn: () => savePosition(v),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      onSaved(p.title);
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={input.id ? "Edit position" : "Add position"}
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : input.id ? "Save changes" : "Add position"}
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
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <Field id="ps-title" label="Title" required>
            <input id="ps-title" autoFocus className={inputClass} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Senior Associate" />
          </Field>
          <Field id="ps-code" label="Code" hint="Auto if blank">
            <input id="ps-code" className={inputClass} maxLength={8} value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="SA" />
          </Field>
        </div>
        <Field id="ps-dept" label="Department" required>
          <select id="ps-dept" className={inputClass} value={v.departmentId} onChange={(e) => setV({ ...v, departmentId: e.target.value, reportsToId: undefined })}>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {unitPath(d.id, units)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ps-level" label="Level" required>
            <select id="ps-level" className={inputClass} value={v.level} onChange={(e) => setV({ ...v, level: e.target.value as PositionInput["level"] })}>
              {JOB_LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field id="ps-type" label="Employment type" required>
            <select id="ps-type" className={inputClass} value={v.employmentType} onChange={(e) => setV({ ...v, employmentType: e.target.value as PositionInput["employmentType"] })}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <Field id="ps-slots" label="Slots" required hint="Budgeted headcount">
            <input id="ps-slots" type="number" min={1} className={inputClass} value={v.slots} onChange={(e) => setV({ ...v, slots: Number(e.target.value) })} />
          </Field>
          <Field id="ps-reports" label="Reports to">
            <select id="ps-reports" className={inputClass} value={v.reportsToId ?? ""} onChange={(e) => setV({ ...v, reportsToId: e.target.value || undefined })}>
              <option value="">No one</option>
              {reportsOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {units.find((u) => u.id === p.departmentId)?.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {mutation.isError && (
          <p role="alert" className="rounded-lg bg-critical-tint px-3.5 py-2.5 text-sm text-critical">
            {(mutation.error as Error).message}
          </p>
        )}
      </form>
    </Dialog>
  );
}
