import { useMemo, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { BriefcaseIcon, BuildingIcon, ChevronRightIcon, EditIcon, MapPinIcon, PlusIcon, SearchIcon, UsersIcon } from "@/components/icons";
import { fetchEmployeeDirectory } from "@/lib/api";
import {
  childKindOf,
  fetchAssignments,
  fetchOrgUnits,
  fetchPositions,
  saveOrgUnit,
  setOrgUnitActive,
  unitPath,
  type OrgKind,
  type OrgUnitInput,
  type OrgUnitWithCounts,
} from "@/lib/coreHr";
import { formatToday } from "@/lib/format";
import { Badge, Detail, Field, inputClass } from "./ui";

const KIND_LABEL: Record<OrgKind, string> = { company: "Company", branch: "Branch", department: "Department", team: "Team" };

/** Company → Branch → Department → Team, with headcount and open positions at every level. */
export function AdminOrganization() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const unitsQuery = useQuery({ queryKey: ["corehr", "units"], queryFn: fetchOrgUnits });
  const positionsQuery = useQuery({ queryKey: ["corehr", "positions"], queryFn: fetchPositions });
  const assignmentsQuery = useQuery({ queryKey: ["corehr", "assignments"], queryFn: fetchAssignments });
  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showInactive, setShowInactive] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<OrgUnitInput | null>(null);

  const company = units.find((u) => u.kind === "company");
  const selected = units.find((u) => u.id === (selectedId ?? company?.id)) ?? null;
  const employees = directoryQuery.data ?? [];
  const nameOf = (id?: string) => employees.find((e) => e.id === id)?.name;

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setOrgUnitActive(id, active),
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      toast.show(`${u.name} ${u.active ? "reactivated" : "deactivated"}.`);
    },
    onError: (e) => toast.show((e as Error).message),
  });

  const q = query.trim().toLowerCase();
  const visible = (u: OrgUnitWithCounts): boolean =>
    (showInactive || u.active) && (!q || u.name.toLowerCase().includes(q) || u.code.toLowerCase().includes(q) || units.some((c) => c.parentId === u.id && visible(c)));
  const children = (id: string) => units.filter((u) => u.parentId === id && visible(u)).sort((a, b) => a.name.localeCompare(b.name));

  const counts = { branch: units.filter((u) => u.kind === "branch" && u.active).length, department: units.filter((u) => u.kind === "department" && u.active).length, team: units.filter((u) => u.kind === "team" && u.active).length };

  // People and positions directly in the selected unit (and below it).
  const inSelected = useMemo(() => {
    if (!selected) return { people: [], positions: [] };
    const ids = new Set<string>();
    const walk = (id: string) => {
      ids.add(id);
      units.filter((u) => u.parentId === id).forEach((u) => walk(u.id));
    };
    walk(selected.id);
    const people = (assignmentsQuery.data ?? []).filter((a) => a.status !== "Separated" && a.unitId && ids.has(a.unitId));
    const positions = (positionsQuery.data ?? []).filter((p) => p.active && ids.has(p.departmentId));
    return { people, positions };
  }, [selected, units, assignmentsQuery.data, positionsQuery.data]);

  function Node({ u, depth }: { u: OrgUnitWithCounts; depth: number }) {
    const kids = children(u.id);
    const open = !collapsed.has(u.id) || Boolean(q);
    return (
      <li>
        <div
          className={clsx(
            "group flex items-center gap-2 rounded-lg py-1.5 pr-2 transition-colors",
            selected?.id === u.id ? "bg-brand-tint" : "hover:bg-surface-2",
            !u.active && "opacity-55",
          )}
          style={{ paddingLeft: `${0.5 + depth * 1.1}rem` }}
        >
          {kids.length ? (
            <button
              type="button"
              aria-label={open ? `Collapse ${u.name}` : `Expand ${u.name}`}
              aria-expanded={open}
              onClick={() => setCollapsed((s) => (s.has(u.id) ? new Set([...s].filter((x) => x !== u.id)) : new Set([...s, u.id])))}
              className="flex h-6 w-6 flex-none items-center justify-center rounded text-ink-3 hover:text-ink"
            >
              <ChevronRightIcon className={clsx("h-4 w-4 transition-transform", open && "rotate-90")} />
            </button>
          ) : (
            <span className="h-6 w-6 flex-none" />
          )}
          <button type="button" onClick={() => setSelectedId(u.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{u.name}</span>
            {!u.active && <Badge>Inactive</Badge>}
            <span className="font-num flex-none text-xs text-ink-3" title={`${u.headcount} people`}>
              {u.headcount}
            </span>
          </button>
        </div>
        {open && kids.length > 0 && (
          <ul>
            {kids.map((k) => (
              <Node key={k.id} u={k} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <>
      <ContentHead
        title="Organization"
        subtitle={`${counts.branch} branches · ${counts.department} departments · ${counts.team} teams · ${formatToday()}`}
        actions={
          company && (
            <Button icon={<PlusIcon className="h-3.75 w-3.75" />} onClick={() => setEditing({ kind: "branch", name: "", code: "", parentId: company.id })}>
              Add branch
            </Button>
          )
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* Tree */}
        <Card className="flex flex-col gap-3 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
            <SearchIcon className="h-4 w-4 flex-none text-ink-3" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a branch, department or team" aria-label="Find a unit" className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3" />
          </div>
          <label className="flex items-center gap-2 px-1 text-xs text-ink-2">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
            Show inactive
          </label>
          {unitsQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            company && (
              <ul aria-label="Organization tree" className="flex flex-col">
                <Node u={company} depth={0} />
              </ul>
            )
          )}
        </Card>

        {/* Detail */}
        {selected && (
          <Card key={selected.id} className="tab-enter flex flex-col gap-5 p-5">
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
                {selected.kind === "team" ? <UsersIcon className="h-5 w-5" /> : <BuildingIcon className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-[0.06em] text-ink-3 uppercase">{KIND_LABEL[selected.kind]}</p>
                <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">{selected.name}</h2>
                {selected.kind !== "company" && <p className="text-xs text-ink-2">{unitPath(selected.id, units)}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {childKindOf(selected.kind) && selected.active && (
                  <Button size="sm" icon={<PlusIcon className="h-3.5 w-3.5" />} onClick={() => setEditing({ kind: childKindOf(selected.kind)!, name: "", code: "", parentId: selected.id })}>
                    Add {KIND_LABEL[childKindOf(selected.kind)!].toLowerCase()}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<EditIcon className="h-3.5 w-3.5" />}
                  onClick={() => setEditing({ id: selected.id, kind: selected.kind, name: selected.name, code: selected.code, parentId: selected.parentId, headId: selected.headId, address: selected.address })}
                >
                  Edit
                </Button>
                {selected.kind !== "company" && (
                  <Button size="sm" variant="ghost" disabled={toggleActive.isPending} onClick={() => toggleActive.mutate({ id: selected.id, active: !selected.active })}>
                    {selected.active ? "Deactivate" : "Reactivate"}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "People", value: selected.headcount },
                { label: "Positions", value: inSelected.positions.length },
                { label: "Open slots", value: selected.vacancies },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-surface-2 px-4 py-3">
                  <p className="font-num font-display text-2xl font-semibold">{s.value}</p>
                  <p className="text-xs text-ink-2">{s.label}</p>
                </div>
              ))}
            </div>

            <dl>
              <Detail label="Code">{selected.code}</Detail>
              <Detail label="Head">{nameOf(selected.headId)}</Detail>
              {selected.kind === "branch" && (
                <Detail label="Address">
                  <span className="flex items-start gap-1.5">
                    <MapPinIcon className="mt-0.5 h-4 w-4 flex-none text-ink-3" />
                    {selected.address}
                  </span>
                </Detail>
              )}
              <Detail label="Status">{selected.active ? <Badge tone="good">Active</Badge> : <Badge>Inactive</Badge>}</Detail>
            </dl>

            {childKindOf(selected.kind) && (
              <section>
                <h3 className="mb-2 text-sm font-semibold">{KIND_LABEL[childKindOf(selected.kind)!]}s</h3>
                {children(selected.id).length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-ink-3">None yet</p>
                ) : (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {children(selected.id).map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => setSelectedId(c.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{c.name}</span>
                            <span className="block text-xs text-ink-3">
                              {c.code} · head: {nameOf(c.headId) ?? "not set"}
                            </span>
                          </span>
                          <span className="text-xs text-ink-2">
                            {c.headcount} people{c.vacancies ? ` · ${c.vacancies} open` : ""}
                          </span>
                          <ChevronRightIcon className="h-4 w-4 text-ink-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {selected.kind !== "company" && inSelected.positions.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <BriefcaseIcon className="h-4 w-4 text-ink-3" />
                  Positions
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {inSelected.positions.map((p) => (
                    <li key={p.id} className="rounded-full border border-border px-3 py-1 text-xs">
                      {p.title} <span className="text-ink-3">· {p.filled}/{p.slots}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </Card>
        )}
      </div>

      {editing && (
        <OrgUnitDialog
          input={editing}
          units={units}
          employees={employees.map((e) => ({ id: e.id, name: e.name }))}
          onClose={() => setEditing(null)}
          onSaved={(name, created) => {
            setEditing(null);
            toast.show(created ? `${name} added.` : `${name} updated.`);
          }}
        />
      )}
    </>
  );
}

function OrgUnitDialog({
  input,
  units,
  employees,
  onClose,
  onSaved,
}: {
  input: OrgUnitInput;
  units: OrgUnitWithCounts[];
  employees: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (name: string, created: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [v, setV] = useState(input);
  const parentKind: Record<OrgKind, OrgKind | null> = { company: null, branch: "company", department: "branch", team: "department" };
  const parents = units.filter((u) => u.kind === parentKind[v.kind] && u.active);
  const mutation = useMutation({
    mutationFn: () => saveOrgUnit(v),
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      onSaved(u.name, !input.id);
    },
  });
  const label = KIND_LABEL[v.kind].toLowerCase();
  return (
    <Dialog
      open
      onClose={onClose}
      title={input.id ? `Edit ${label}` : `Add ${label}`}
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : input.id ? "Save changes" : `Add ${label}`}
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
          <Field id="ou-name" label="Name" required>
            <input id="ou-name" autoFocus className={inputClass} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={v.kind === "branch" ? "Cebu HQ" : v.kind === "department" ? "Tax Advisory" : "RPM team"} />
          </Field>
          <Field id="ou-code" label="Code" hint="Auto if blank">
            <input id="ou-code" className={inputClass} value={v.code} maxLength={6} onChange={(e) => setV({ ...v, code: e.target.value })} placeholder="TAX" />
          </Field>
        </div>
        {v.kind !== "company" && (
          <Field id="ou-parent" label={`Part of (${KIND_LABEL[parentKind[v.kind]!].toLowerCase()})`} required>
            <select id="ou-parent" className={inputClass} value={v.parentId ?? ""} onChange={(e) => setV({ ...v, parentId: e.target.value })}>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {v.kind === "team" ? unitPath(p.id, units) : p.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="ou-head" label="Head" hint="Who leads it; shows on the org chart">
          <select id="ou-head" className={inputClass} value={v.headId ?? ""} onChange={(e) => setV({ ...v, headId: e.target.value || undefined })}>
            <option value="">Not set</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        {v.kind === "branch" && (
          <Field id="ou-address" label="Address">
            <textarea id="ou-address" rows={2} className={clsx(inputClass, "resize-y")} value={v.address ?? ""} onChange={(e) => setV({ ...v, address: e.target.value })} placeholder="Building, street, city" />
          </Field>
        )}
        {mutation.isError && (
          <p role="alert" className="rounded-lg bg-critical-tint px-3.5 py-2.5 text-sm text-critical">
            {(mutation.error as Error).message}
          </p>
        )}
      </form>
    </Dialog>
  );
}
