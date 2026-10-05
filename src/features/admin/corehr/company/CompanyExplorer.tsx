import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { ChevronRightIcon, MapPinIcon } from "@/components/icons";
import type { EmployeeSummary, PositionSummary, UnitSummary } from "@/lib/corehr/api";
import { Initials, Pill } from "../ui";
import { Name, SimpleTable, Tabs, type Col } from "../../timekeeping/common";
import { editInput, newUnit, people, type Company, type CompanyActions } from "./data";

const TYPE_LABEL = { company: "Company", branch: "Branch", department: "Department", team: "Team" } as const;

function TreeRow({ u, depth, selected, open, hasKids, onSelect, onToggle }: { u: UnitSummary; depth: number; selected: boolean; open: boolean; hasKids: boolean; onSelect: () => void; onToggle: () => void }) {
  return (
    <div className={clsx("flex items-center rounded-lg", selected ? "bg-ink text-surface" : "hover:bg-surface-2")} style={{ paddingLeft: depth * 14 }}>
      <button type="button" aria-label={open ? `Collapse ${u.name}` : `Expand ${u.name}`} onClick={onToggle} className={clsx("flex h-8 w-6 flex-none items-center justify-center", !hasKids && "invisible")}>
        <ChevronRightIcon className={clsx("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
      </button>
      <button type="button" onClick={onSelect} aria-current={selected ? "true" : undefined} className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1.5 pr-2.5 text-left text-sm">
        <span className={clsx("truncate", depth === 0 && "font-semibold")}>{u.name}</span>
        <span className={clsx("flex-none text-xs", selected ? "text-surface/70" : "text-ink-3")}>{u.headcount}</span>
      </button>
    </div>
  );
}

/** Option B: the structure on the left, whatever you pick on the right. */
export function CompanyExplorer({ c, act }: { c: Company; act: CompanyActions }) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [tab, setTab] = useState<"people" | "jobs" | "units">("people");
  const selected = c.unit(selectedId) ?? c.branches[0];
  const isOpen = (id: string) => expanded.has(id) || (!!selected && c.branchOf(selected)?.id === id) || c.unit(selected?.parentId)?.id === id;
  const toggle = (id: string) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  const rows: { u: UnitSummary; depth: number }[] = [];
  const walk = (u: UnitSummary, depth: number) => {
    rows.push({ u, depth });
    if (isOpen(u.id)) c.childrenOf(u.id).filter((k) => k.type !== "company").forEach((k) => walk(k, depth + 1));
  };
  c.branches.forEach((b) => walk(b, 0));

  if (!selected) return <p className="text-sm text-ink-3">No branches yet.</p>;
  const kids = c.childrenOf(selected.id);
  const kidLabel = selected.type === "branch" ? "Departments" : "Teams";
  const staff = c.staffOf(selected.id);
  const jobs = c.jobsOf(selected.id);

  const peopleCols: Col<EmployeeSummary>[] = [
    {
      header: "Name",
      cell: (e) => (
        <Link to={`/admin/people/${e.id}`} className="flex items-center gap-2.5 hover:underline">
          <Initials initials={e.initials} size="sm" />
          <Name name={e.name} sub={e.positionTitle} />
        </Link>
      ),
    },
    { header: "Department", cell: (e) => <span className="text-ink-2">{e.teamName ? `${e.departmentName} · ${e.teamName}` : e.departmentName}</span> },
    { header: "Type", cell: (e) => <span className="text-ink-2">{e.employmentType}</span> },
  ];
  const jobCols: Col<PositionSummary>[] = [
    { header: "Job", cell: (j) => <Name name={j.title} sub={j.departmentName} /> },
    { header: "Filled", cell: (j) => `${j.filled} of ${j.slots}` },
    { header: "Openings", cell: (j) => (j.open ? <Pill tone="warn">{j.open} to fill</Pill> : <span className="text-ink-3">Full</span>) },
    {
      header: "",
      align: "right",
      cell: (j) => (
        <span className="flex justify-end gap-1.5">
          {j.open > 0 && <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/people/new?position=${j.id}`)}>Hire</Button>}
          <Button size="sm" variant="ghost" onClick={() => act.openJob(j.departmentId, j)}>Edit</Button>
        </span>
      ),
    },
  ];
  const unitCols: Col<UnitSummary>[] = [
    { header: kidLabel.slice(0, -1), cell: (u) => <button type="button" onClick={() => setSelectedId(u.id)} className="font-medium hover:underline">{u.name}</button> },
    { header: "Head", cell: (u) => u.headName ?? <span className="text-ink-3">Not set</span> },
    { header: "People", cell: (u) => u.headcount },
    { header: "", align: "right", cell: (u) => <Button size="sm" variant="ghost" onClick={() => act.editUnit(editInput(u))}>Edit</Button> },
  ];
  const tabs = [
    { value: "people" as const, label: "People", count: staff.length },
    ...(selected.type !== "team" ? [{ value: "jobs" as const, label: "Jobs", count: jobs.length }] : []),
    ...(selected.type !== "team" ? [{ value: "units" as const, label: kidLabel, count: kids.length }] : []),
  ];
  const current = tabs.some((t) => t.value === tab) ? tab : "people";

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <nav aria-label="Company structure" className="flex flex-col gap-0.5 self-start rounded-xl border border-border bg-surface p-2">
        <div className="flex items-center justify-between px-2 pt-1 pb-2 text-xs font-semibold text-ink-2">
          Branches
          {c.company && (
            <button type="button" onClick={() => act.editUnit(newUnit("branch", c.company!.id))} className="font-medium text-brand hover:underline">
              + Add
            </button>
          )}
        </div>
        {rows.map(({ u, depth }) => (
          <TreeRow key={u.id} u={u} depth={depth} selected={u.id === selected.id} open={isOpen(u.id)} hasKids={c.childrenOf(u.id).length > 0} onSelect={() => (setSelectedId(u.id), setTab("people"))} onToggle={() => toggle(u.id)} />
        ))}
      </nav>

      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5">
          <div className="min-w-0">
            <div className="text-xs font-medium text-ink-3">
              {TYPE_LABEL[selected.type]}
              {selected.type !== "branch" && c.branchOf(selected) && ` · ${c.branchOf(selected)!.name}`}
            </div>
            <h2 className="font-display text-lg leading-tight font-semibold">{selected.name}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
              <span>{selected.headName ? `Led by ${selected.headName}` : "No head set"}</span>
              <span>{people(selected.headcount)}</span>
              {selected.openSlots > 0 && <span className="font-medium text-warning">{selected.openSlots} to fill</span>}
              {selected.type === "branch" && (
                <span className="flex items-center gap-1">
                  <MapPinIcon className="h-3.5 w-3.5" />
                  {selected.address || "No address yet"}
                </span>
              )}
            </p>
          </div>
          <span className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => act.editUnit(editInput(selected))}>
              Edit {TYPE_LABEL[selected.type].toLowerCase()}
            </Button>
            {selected.type === "branch" && <Button size="sm" onClick={() => act.editUnit(newUnit("department", selected.id))}>Add department</Button>}
            {selected.type === "department" && (
              <>
                <Button size="sm" variant="ghost" onClick={() => act.editUnit(newUnit("team", selected.id))}>Add team</Button>
                <Button size="sm" onClick={() => act.openJob(selected.id)}>Add job</Button>
              </>
            )}
          </span>
        </div>
        <Tabs value={current} onChange={setTab} options={tabs} />
        {current === "people" && <SimpleTable rows={staff} rowKey={(e) => e.id} cols={peopleCols} loading={c.loading} empty="No one here yet." />}
        {current === "jobs" && <SimpleTable rows={jobs} rowKey={(j) => j.id} cols={jobCols} loading={c.loading} empty="No jobs yet." />}
        {current === "units" && <SimpleTable rows={kids} rowKey={(u) => u.id} cols={unitCols} loading={c.loading} empty={`No ${kidLabel.toLowerCase()} yet.`} />}
      </section>
    </div>
  );
}
