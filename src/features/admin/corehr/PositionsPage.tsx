import { useMemo, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { PlusIcon, UserPlusIcon } from "@/components/icons";
import { listPositions, listUnits, savePosition, setPositionActive, unitPathOf, type PositionInput, type PositionSummary, type UnitSummary } from "@/lib/corehr/api";
import { EMPLOYMENT_TYPES, JOB_LEVELS } from "@/lib/corehr/types";
import { useOfficeFilter } from "../OfficeFilterContext";
import { filterSelectClass, inputClass, keys, statusTone } from "./format";
import { DetailHeader, DetailPlaceholder, DetailSection, ListBody, ListEmpty, ListGroup, ListRow, ListToolbar, SplitView, StatusText } from "./SplitView";
import { Detail, detailGrid, ErrorNote, Field, Initials, LoadError } from "./ui";

type Show = "all" | "open" | "closed";

const filledText = (p: { filled: number; slots: number }) => `${p.filled} of ${p.slots} filled`;
const openingText = (n: number) => `${n} opening${n === 1 ? "" : "s"}`;
const deptLabel = (p: PositionSummary) => `${p.departmentName} · ${p.branchName}`;

export function PositionsPage() {
  const { office } = useOfficeFilter();
  const [params, setParams] = useSearchParams();
  const unitsQuery = useQuery({ queryKey: keys.units, queryFn: listUnits });
  const positionsQuery = useQuery({ queryKey: keys.positions, queryFn: listPositions });
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");
  const departmentFilter = params.get("department") ?? "";
  const chosen = params.get("p");
  const select = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("p", id);
    else next.delete("p");
    setParams(next, { replace: true });
  };

  const all = (positionsQuery.data ?? []).filter((p) => office === "All offices" || p.branchName === office);
  const q = query.trim().toLowerCase();
  const rows = all.filter(
    (p) =>
      (show === "closed" ? !p.active : p.active) &&
      (show !== "open" || p.open > 0) &&
      (!departmentFilter || p.departmentId === departmentFilter) &&
      (!q || p.title.toLowerCase().includes(q) || p.departmentName.toLowerCase().includes(q) || p.holders.some((h) => h.name.toLowerCase().includes(q))),
  );
  const groups = [...new Set(rows.map((p) => p.departmentId))]
    .map((id) => {
      const items = rows.filter((p) => p.departmentId === id).sort((a, b) => JOB_LEVELS.indexOf(b.level) - JOB_LEVELS.indexOf(a.level) || a.title.localeCompare(b.title));
      return { id, label: deptLabel(items[0]!), items };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const active = all.filter((p) => p.active);
  const openings = active.reduce((n, p) => n + p.open, 0);
  const creating = chosen === "new";
  // Something is always open on the right: what was picked, or else the first job in the list.
  const selected = creating ? undefined : (positionsQuery.data?.find((p) => p.id === chosen) ?? groups[0]?.items[0]);

  if (positionsQuery.isError) return <LoadError onRetry={() => positionsQuery.refetch()} />;

  const list = (
    <>
      <ListToolbar query={query} onQuery={setQuery} placeholder="Search jobs, departments or people">
        <select aria-label="Show" value={show} onChange={(e) => setShow(e.target.value as Show)} className={filterSelectClass}>
          <option value="all">All jobs ({active.length})</option>
          <option value="open">Jobs with openings ({active.filter((p) => p.open > 0).length})</option>
          <option value="closed">Closed jobs ({all.filter((p) => !p.active).length})</option>
        </select>
        {departmentFilter && (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("department");
              setParams(next, { replace: true });
            }}
            className="h-8 rounded-full border border-border px-3 text-xs text-ink-2 hover:border-ink-3"
            title="Show every department"
          >
            Only {units.find((u) => u.id === departmentFilter)?.name} ✕
          </button>
        )}
      </ListToolbar>
      <ListBody label="Jobs">
        {positionsQuery.isLoading ? (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <ListEmpty>{show === "open" ? "Every job is filled." : "No jobs match your search."}</ListEmpty>
        ) : (
          groups.map((g) => (
            <ListGroup key={g.id} title={g.label}>
              {g.items.map((p) => (
                <ListRow
                  key={p.id}
                  active={!creating && p.id === selected?.id}
                  onClick={() => select(p.id)}
                  title={p.title}
                  meta={p.holders.length ? p.holders.map((h) => h.name).join(", ") : "No one in this job yet"}
                  muted={!p.active}
                  trailing={p.active && p.open > 0 ? <span className="font-medium text-warning">{openingText(p.open)}</span> : <span className="text-ink-3">{p.active ? "Filled" : "Closed"}</span>}
                />
              ))}
            </ListGroup>
          ))
        )}
      </ListBody>
    </>
  );

  return (
    <>
      <ContentHead
        title="Positions"
        subtitle={`The jobs in each department, and how many people each one needs. ${openings ? `${openingText(openings)} to fill.` : "Every job is filled."}`}
        actions={
          <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => select("new")}>
            Add a job
          </Button>
        }
      />
      <SplitView
        showDetail={Boolean(chosen)}
        list={list}
        detail={
          creating ? (
            <PositionForm key="new" units={units} positions={positionsQuery.data ?? []} defaultDepartmentId={departmentFilter} onDone={(id) => select(id)} onCancel={() => select(null)} />
          ) : selected ? (
            <PositionDetail key={selected.id} position={selected} units={units} positions={positionsQuery.data ?? []} onBack={() => select(null)} />
          ) : (
            <DetailPlaceholder title={positionsQuery.isLoading ? "Loading…" : "No jobs yet"}>{!positionsQuery.isLoading && "Use Add a job to create the first one."}</DetailPlaceholder>
          )
        }
      />
    </>
  );
}

function PositionDetail({ position: p, units, positions, onBack }: { position: PositionSummary; units: UnitSummary[]; positions: PositionSummary[]; onBack: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const toggle = useMutation({
    mutationFn: () => setPositionActive(p.id, !p.active),
    onSuccess: (x) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      toast.show(`${x.title} ${x.active ? "reopened" : "closed"}.`);
    },
  });
  if (editing) return <PositionForm position={p} units={units} positions={positions} defaultDepartmentId={p.departmentId} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />;
  return (
    <div className="rise-in">
      <DetailHeader
        back={{ onClick: onBack, label: "All jobs" }}
        title={p.title}
        subtitle={deptLabel(p)}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit job
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={toggle.isPending}
              onClick={() => {
                if (p.active && !window.confirm(`Close the ${p.title} job? It won't be offered for new hires until you reopen it.`)) return;
                toggle.mutate();
              }}
            >
              {p.active ? "Close job" : "Reopen job"}
            </Button>
          </>
        }
      />
      {toggle.error && (
        <div className="px-5 pt-4 sm:px-6">
          <ErrorNote error={toggle.error} />
        </div>
      )}

      <div className="border-b border-border px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <p className="font-display text-2xl font-semibold tracking-[-0.02em]">{filledText(p)}</p>
            <p className="mt-0.5 text-xs text-ink-2">
              {p.slots === 1 ? "This job is for 1 person." : `This job is for ${p.slots} people.`} {!p.active && "It's closed, so it isn't offered for new hires."}
            </p>
          </div>
          {p.active && p.open > 0 ? (
            <div className="flex flex-1 flex-wrap items-center justify-end gap-3 rounded-xl bg-warning-tint/60 px-4 py-3">
              <p className="mr-auto text-sm">
                <span className="font-semibold text-warning">{openingText(p.open)}</span> <span className="text-ink-2">waiting to be filled</span>
              </p>
              <Button size="sm" icon={<UserPlusIcon className="h-3.5 w-3.5" />} onClick={() => navigate(`/admin/people/new?position=${p.id}`)}>
                Hire for this job
              </Button>
            </div>
          ) : (
            p.active && <p className="text-sm text-ink-2">Every seat is filled.</p>
          )}
        </div>
      </div>

      <DetailSection title={`People in this job (${p.holders.length})`}>
        {p.holders.length === 0 ? (
          <p className="text-sm text-ink-3">No one yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {p.holders.map((h) => (
              <li key={h.id}>
                <Link to={`/admin/people/${h.id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-2/60">
                  <Initials initials={h.initials} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{h.name}</span>
                    <span className="block truncate text-xs text-ink-3">{h.unitName}</span>
                  </span>
                  {h.status !== "Active" && <StatusText tone={statusTone[h.status]}>{h.status}</StatusText>}
                  <span className="text-xs text-ink-3">Open 201 file →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      <DetailSection title="About this job">
        <dl className={detailGrid}>
          <Detail label="Job level">{p.level}</Detail>
          <Detail label="New hires start as">{p.employmentType}</Detail>
          <Detail label="Reports to">{p.reportsToTitle}</Detail>
          {p.description && (
            <Detail label="What the job involves" wide>
              {p.description}
            </Detail>
          )}
        </dl>
      </DetailSection>
    </div>
  );
}

function PositionForm({
  position,
  units,
  positions,
  defaultDepartmentId,
  onDone,
  onCancel,
}: {
  position?: PositionSummary;
  units: UnitSummary[];
  positions: PositionSummary[];
  defaultDepartmentId: string;
  onDone: (id: string) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const departments = units.filter((u) => u.type === "department" && u.active).sort((a, b) => unitPathOf(a.id, units).localeCompare(unitPathOf(b.id, units)));
  const [v, setV] = useState<PositionInput>(
    position
      ? { id: position.id, title: position.title, code: position.code, departmentId: position.departmentId, level: position.level, employmentType: position.employmentType, slots: position.slots, reportsToPositionId: position.reportsToPositionId, description: position.description }
      : { title: "", code: "", departmentId: defaultDepartmentId || departments[0]?.id || "", level: "Rank and file", employmentType: "Probationary", slots: 1 },
  );
  const branchOf = (deptId: string) => units.find((u) => u.id === deptId)?.parentId;
  const reportsOptions = positions.filter((p) => p.active && p.id !== v.id && branchOf(p.departmentId) === branchOf(v.departmentId));
  const deptName = (id: string) => {
    const d = units.find((u) => u.id === id);
    return d ? `${d.name} · ${units.find((u) => u.id === d.parentId)?.name}` : "";
  };
  const save = useMutation({
    mutationFn: () => savePosition(v),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.show(position ? `${p.title} saved.` : `${p.title} added.`);
      onDone(p.id);
    },
  });
  const locked = Boolean(position && position.filled > 0);

  return (
    <form
      className="rise-in"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <DetailHeader
        back={{ onClick: onCancel, label: "Back" }}
        title={position ? `Edit ${position.title}` : "Add a job"}
        subtitle={position ? deptName(position.departmentId) : "Create a job in one of your departments."}
        actions={
          <>
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending ? "Saving…" : position ? "Save changes" : "Add job"}
            </Button>
          </>
        }
      />
      <div className="flex max-w-xl flex-col gap-4 px-5 py-5 sm:px-6">
        <Field id="p-title" label="Job title" required>
          <input id="p-title" autoFocus className={inputClass} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. Senior Associate" />
        </Field>
        <Field id="p-dept" label="Department" required hint={locked ? "Can't be changed while people are in this job." : undefined}>
          <select id="p-dept" className={inputClass} disabled={locked} value={v.departmentId} onChange={(e) => setV({ ...v, departmentId: e.target.value, reportsToPositionId: undefined })}>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {deptName(d.id)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="p-slots" label="How many people does this job need?" required hint={position ? `${position.filled} ${position.filled === 1 ? "person is" : "people are"} in it now.` : "You can change this later."} className="max-w-[16rem]">
          <input id="p-slots" type="number" min={Math.max(1, position?.filled ?? 1)} className={inputClass} value={Number.isNaN(v.slots) ? "" : v.slots} onChange={(e) => setV({ ...v, slots: e.target.valueAsNumber })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="p-level" label="Job level">
            <select id="p-level" className={inputClass} value={v.level} onChange={(e) => setV({ ...v, level: e.target.value as PositionInput["level"] })}>
              {JOB_LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field id="p-type" label="New hires start as">
            <select id="p-type" className={inputClass} value={v.employmentType} onChange={(e) => setV({ ...v, employmentType: e.target.value as PositionInput["employmentType"] })}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="p-reports" label="Reports to" hint="The job this one answers to, if any.">
          <select id="p-reports" className={inputClass} value={v.reportsToPositionId ?? ""} onChange={(e) => setV({ ...v, reportsToPositionId: e.target.value || undefined })}>
            <option value="">No one</option>
            {reportsOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {p.departmentName}
              </option>
            ))}
          </select>
        </Field>
        <Field id="p-desc" label="What the job involves">
          <textarea id="p-desc" rows={3} className={clsx(inputClass, "resize-y")} value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="A sentence or two, optional" />
        </Field>
        <ErrorNote error={save.error} />
      </div>
    </form>
  );
}
