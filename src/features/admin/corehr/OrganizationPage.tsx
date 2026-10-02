import { useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { MapPinIcon, PlusIcon } from "@/components/icons";
import { CHILD_TYPE, listEmployees, listPositions, listUnits, saveUnit, setUnitActive, type EmployeeSummary, type UnitInput, type UnitSummary } from "@/lib/corehr/api";
import type { UnitType } from "@/lib/corehr/types";
import { filterSelectClass, inputClass, keys, statusTone } from "./format";
import { DetailHeader, DetailPlaceholder, DetailSection, ListBody, ListEmpty, ListToolbar, SplitView, StatusText, TextAction } from "./SplitView";
import { ErrorNote, Field, Initials, LoadError } from "./ui";

const LABEL: Record<UnitType, string> = { company: "Company", branch: "Branch", department: "Department", team: "Team" };
const PARENT: Record<UnitType, UnitType | null> = { company: null, branch: "company", department: "branch", team: "department" };
const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
const openings = (n: number) => (n ? `${n} opening${n === 1 ? "" : "s"}` : "All jobs filled");

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 truncate text-[0.95rem] font-semibold">{children}</dd>
    </div>
  );
}

function PeopleGrid({ list }: { list: EmployeeSummary[] }) {
  if (list.length === 0) return <p className="text-sm text-ink-3">No one here yet.</p>;
  return (
    <ul className="grid gap-x-6 sm:grid-cols-2">
      {list.map((e) => (
        <li key={e.id}>
          <Link to={`/admin/people/${e.id}`} className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-2/60">
            <Initials initials={e.initials} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{e.name}</span>
              <span className="block truncate text-xs text-ink-3">{e.positionTitle}</span>
            </span>
            {e.status !== "Active" && <StatusText tone={statusTone[e.status]}>{e.status}</StatusText>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Branches, the departments in them, and the teams inside each department. */
export function OrganizationPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const unitsQuery = useQuery({ queryKey: keys.units, queryFn: listUnits });
  const positionsQuery = useQuery({ queryKey: keys.positions, queryFn: listPositions });
  const employeesQuery = useQuery({ queryKey: keys.employees, queryFn: listEmployees });
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);
  const [query, setQuery] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [editing, setEditing] = useState<UnitInput | null>(null);
  const chosen = params.get("u");
  const select = (id: string | null) => setParams(id ? { u: id } : {}, { replace: true });

  const company = units.find((u) => u.type === "company");
  const shown = (u: UnitSummary) => showClosed || u.active;
  const childrenOf = (id: string) => units.filter((u) => u.parentId === id && shown(u)).sort((a, b) => a.name.localeCompare(b.name));
  const branches = company ? childrenOf(company.id) : [];
  const q = query.trim().toLowerCase();
  const matches = (u: UnitSummary) => !q || u.name.toLowerCase().includes(q) || (u.headName ?? "").toLowerCase().includes(q);
  const firstDepartment = branches.flatMap((b) => childrenOf(b.id))[0];
  // Something is always open on the right: what was picked, or the first department.
  const selected = units.find((u) => u.id === chosen) ?? firstDepartment ?? branches[0];
  const parentOf = (u: UnitSummary) => units.find((x) => x.id === u.parentId);

  const toggle = useMutation({
    mutationFn: (u: UnitSummary) => setUnitActive(u.id, !u.active),
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      toast.show(`${u.name} ${u.active ? "reopened" : "closed"}.`);
    },
  });

  if (unitsQuery.isError) return <LoadError onRetry={() => unitsQuery.refetch()} />;

  const list = (
    <>
      <ListToolbar query={query} onQuery={setQuery} placeholder="Search departments or heads">
        <select aria-label="Show" value={showClosed ? "all" : "open"} onChange={(e) => setShowClosed(e.target.value === "all")} className={filterSelectClass}>
          <option value="open">Open departments</option>
          <option value="all">Include closed ones</option>
        </select>
      </ListToolbar>
      <ListBody label="Branches and departments">
        {unitsQuery.isLoading ? (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <ListEmpty>No branches yet. Use Add a branch to start.</ListEmpty>
        ) : (
          branches.map((b) => {
            const depts = childrenOf(b.id).filter((d) => matches(d) || matches(b));
            if (q && depts.length === 0 && !matches(b)) return null;
            const branchActive = selected?.id === b.id;
            return (
              <div key={b.id} className="pb-2">
                <button
                  type="button"
                  onClick={() => select(b.id)}
                  aria-current={branchActive ? "true" : undefined}
                  className={clsx("mx-1.5 mt-2 flex w-[calc(100%-0.75rem)] items-center gap-2 rounded-md px-3 py-2 text-left transition-colors", branchActive ? "bg-surface-2" : "hover:bg-surface-2/60", !b.active && "opacity-55")}
                >
                  <MapPinIcon className="h-3.5 w-3.5 flex-none text-ink-3" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{b.name}</span>
                  <span className="text-[0.72rem] text-ink-3">{people(b.headcount)}</span>
                </button>
                <ul>
                  {depts.map((d) => {
                    const active = selected?.id === d.id || (selected?.type === "team" && selected.parentId === d.id);
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => select(d.id)}
                          aria-current={active ? "true" : undefined}
                          className={clsx("relative mx-1.5 flex w-[calc(100%-0.75rem)] items-center gap-2 rounded-md py-2 pr-3 pl-8 text-left transition-colors", active ? "bg-surface-2" : "hover:bg-surface-2/60", !d.active && "opacity-55")}
                        >
                          <span aria-hidden="true" className={clsx("absolute inset-y-1 left-0 w-0.5 rounded-full", active ? "bg-ink" : "bg-transparent")} />
                          <span className="min-w-0 flex-1">
                            <span className={clsx("block truncate text-[0.84rem]", active ? "font-semibold" : "font-medium")}>{d.name}</span>
                            <span className="block truncate text-[0.72rem] text-ink-3">{d.headName ? `Led by ${d.headName}` : "No head set"}</span>
                          </span>
                          <span className="flex-none text-right text-[0.72rem]">
                            <span className="block text-ink-2">{people(d.headcount)}</span>
                            {d.openSlots > 0 && <span className="block font-medium text-warning">{d.openSlots} open</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {depts.length === 0 && <li className="py-1.5 pl-8 text-[0.72rem] text-ink-3">No departments yet</li>}
                </ul>
              </div>
            );
          })
        )}
      </ListBody>
    </>
  );

  let detail: ReactNode = <DetailPlaceholder title={unitsQuery.isLoading ? "Loading…" : "Nothing set up yet"} />;
  if (selected) {
    const ids = new Set([selected.id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const u of units) {
        if (u.parentId && ids.has(u.parentId) && !ids.has(u.id)) {
          ids.add(u.id);
          grew = true;
        }
      }
    }
    const here = (employeesQuery.data ?? []).filter((e) => e.status !== "Separated" && ids.has(e.unitId));
    const jobs = (positionsQuery.data ?? []).filter((p) => p.active && ids.has(p.departmentId));
    const childType = CHILD_TYPE[selected.type];
    const kids = childrenOf(selected.id);
    const parent = parentOf(selected);
    const where = selected.type === "branch" ? "Branch" : selected.type === "department" ? `Department in ${parent?.name}` : `Team in ${parent?.name} · ${parentOf(parent!)?.name}`;
    const editInput: UnitInput = { id: selected.id, type: selected.type, name: selected.name, code: selected.code, parentId: selected.parentId, headEmployeeId: selected.headEmployeeId, address: selected.address };

    detail = (
      <div key={selected.id} className="rise-in">
        <DetailHeader
          back={{ onClick: () => select(null), label: "Organization" }}
          title={selected.name}
          subtitle={
            <span>
              {where}
              {!selected.active && <span className="text-warning"> · Closed</span>}
            </span>
          }
          actions={
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(editInput)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={toggle.isPending}
                onClick={() => {
                  if (selected.active && !window.confirm(`Close ${selected.name}? You can reopen it later.`)) return;
                  toggle.mutate(selected);
                }}
              >
                {selected.active ? `Close ${LABEL[selected.type].toLowerCase()}` : "Reopen"}
              </Button>
            </>
          }
        />
        {toggle.error && (
          <div className="px-5 pt-4 sm:px-6">
            <ErrorNote error={toggle.error} />
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border px-5 py-5 sm:grid-cols-3 sm:px-6">
          <Fact label={selected.type === "branch" ? "Branch head" : selected.type === "team" ? "Team lead" : "Department head"}>
            {selected.headEmployeeId ? (
              <Link to={`/admin/people/${selected.headEmployeeId}`} className="hover:underline">
                {selected.headName}
              </Link>
            ) : (
              <button type="button" onClick={() => setEditing(editInput)} className="font-normal text-ink-3 underline underline-offset-4 hover:text-ink">
                Not set, add one
              </button>
            )}
          </Fact>
          <Fact label="Working here">{people(selected.headcount)}</Fact>
          <Fact label="Jobs">
            <span className={selected.openSlots ? "text-warning" : undefined}>{openings(selected.openSlots)}</span>
          </Fact>
          {selected.type === "branch" && selected.address && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs text-ink-3">Address</dt>
              <dd className="mt-0.5 text-sm">{selected.address}</dd>
            </div>
          )}
        </dl>

        {childType && (
          <DetailSection
            title={`${childType === "team" ? "Teams" : "Departments"} (${kids.length})`}
            action={
              selected.active && (
                <Button size="sm" variant="ghost" icon={<PlusIcon className="h-3.5 w-3.5" />} onClick={() => setEditing({ type: childType, name: "", code: "", parentId: selected.id })}>
                  Add a {childType}
                </Button>
              )
            }
          >
            {kids.length === 0 ? (
              <p className="text-sm text-ink-3">{childType === "team" ? "This department isn't split into teams. That's fine; add one only if you need it." : "No departments yet."}</p>
            ) : (
              <ul className="divide-y divide-border">
                {kids.map((k) => (
                  <li key={k.id}>
                    <button type="button" onClick={() => select(k.id)} className={clsx("-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-2/60", !k.active && "opacity-55")}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{k.name}</span>
                        <span className="block truncate text-xs text-ink-3">{k.headName ? `Led by ${k.headName}` : "No head set"}</span>
                      </span>
                      <span className="text-xs text-ink-2">{people(k.headcount)}</span>
                      <span className="text-xs text-ink-3">View →</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>
        )}

        {selected.type !== "team" && (
          <DetailSection title={`Jobs (${jobs.length})`} action={selected.type === "department" && <TextAction to={`/admin/positions?department=${selected.id}`}>Manage jobs →</TextAction>}>
            {jobs.length === 0 ? (
              <p className="text-sm text-ink-3">No jobs yet. Add them in Positions.</p>
            ) : (
              <ul className="divide-y divide-border">
                {jobs.map((p) => (
                  <li key={p.id}>
                    <Link to={`/admin/positions?p=${p.id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-surface-2/60">
                      <span className="min-w-0 flex-1 truncate">
                        {p.title}
                        {selected.type === "branch" && <span className="text-ink-3"> · {p.departmentName}</span>}
                      </span>
                      <span className="text-xs text-ink-2">
                        {p.filled} of {p.slots} filled
                      </span>
                      {p.open > 0 && <span className="text-xs font-medium text-warning">{p.open} open</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>
        )}

        {selected.type !== "branch" && (
          <DetailSection title={`People (${here.length})`}>
            <PeopleGrid list={here} />
          </DetailSection>
        )}
      </div>
    );
  }

  return (
    <>
      <ContentHead
        title="Organization"
        subtitle="Your branches and the departments in each. Pick one to see who leads it, who works there and its jobs."
        actions={
          company && (
            <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setEditing({ type: "branch", name: "", code: "", parentId: company.id })}>
              Add a branch
            </Button>
          )
        }
      />
      <SplitView showDetail={Boolean(chosen)} list={list} detail={detail} />
      {editing && (
        <UnitDialog
          input={editing}
          units={units}
          onClose={() => setEditing(null)}
          onSaved={(name, id) => {
            toast.show(editing.id ? `${name} saved.` : `${name} added.`);
            setEditing(null);
            select(id);
          }}
        />
      )}
    </>
  );
}

function UnitDialog({ input, units, onClose, onSaved }: { input: UnitInput; units: UnitSummary[]; onClose: () => void; onSaved: (name: string, id: string) => void }) {
  const queryClient = useQueryClient();
  const employeesQuery = useQuery({ queryKey: keys.employees, queryFn: listEmployees });
  const [v, setV] = useState(input);
  const label = LABEL[v.type].toLowerCase();
  const parentType = PARENT[v.type];
  const parents = units.filter((u) => u.type === parentType && u.active);
  const parentLabel = (u: UnitSummary) => (u.type === "department" ? `${u.name} · ${units.find((b) => b.id === u.parentId)?.name}` : u.name);
  const mutation = useMutation({
    mutationFn: () => saveUnit(v),
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      onSaved(u.name, u.id);
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={input.id ? `Edit ${input.name}` : `Add a ${label}`}
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
        <Field id="u-name" label={`${LABEL[v.type]} name`} required>
          <input id="u-name" autoFocus className={inputClass} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={v.type === "branch" ? "e.g. Iloilo" : v.type === "department" ? "e.g. Finance" : "e.g. Payroll team"} />
        </Field>
        {parentType && parentType !== "company" && (
          <Field id="u-parent" label={`Which ${parentType} is it in?`} required hint={input.id ? `Changing this moves the ${label} and everyone in it.` : undefined}>
            <select id="u-parent" className={inputClass} value={v.parentId ?? ""} onChange={(e) => setV({ ...v, parentId: e.target.value })}>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {parentLabel(p)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="u-head" label={v.type === "team" ? "Team lead" : `${LABEL[v.type]} head`} hint="Optional. Who's in charge here.">
          <select id="u-head" className={inputClass} value={v.headEmployeeId ?? ""} onChange={(e) => setV({ ...v, headEmployeeId: e.target.value || undefined })}>
            <option value="">No one yet</option>
            {(employeesQuery.data ?? [])
              .filter((e) => e.status !== "Separated")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.positionTitle}
                </option>
              ))}
          </select>
        </Field>
        {v.type === "branch" && (
          <Field id="u-address" label="Office address">
            <textarea id="u-address" rows={2} className={clsx(inputClass, "resize-y")} value={v.address ?? ""} onChange={(e) => setV({ ...v, address: e.target.value })} placeholder="Building, street, city" />
          </Field>
        )}
        <ErrorNote error={mutation.error} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
