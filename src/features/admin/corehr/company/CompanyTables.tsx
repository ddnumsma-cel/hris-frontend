import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import type { PositionSummary, UnitSummary } from "@/lib/corehr/api";
import { Pill } from "../ui";
import { Choice, Name, SearchBox, SimpleTable, Tabs, Toolbar, type Col } from "../../timekeeping/common";
import { editInput, newUnit, type Company, type CompanyActions } from "./data";

type Tab = "branches" | "departments" | "jobs";

/** Option A: three plain tables. Every row has its own Edit; one Add button per tab. */
export function CompanyTables({ c, act }: { c: Company; act: CompanyActions }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("departments");
  const [branchId, setBranchId] = useState("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const inBranch = (u?: UnitSummary) => branchId === "all" || c.branchOf(u)?.id === branchId;

  const depts = c.departments.filter((d) => inBranch(d) && (!q || d.name.toLowerCase().includes(q)));
  const jobs = c.jobs.filter((j) => (branchId === "all" || j.branchId === branchId) && (!q || `${j.title} ${j.departmentName}`.toLowerCase().includes(q)));
  const branches = c.branches.filter((b) => !q || b.name.toLowerCase().includes(q));

  const branchCols: Col<UnitSummary>[] = [
    { header: "Branch", cell: (b) => <Name name={b.name} sub={b.address || "No address yet"} /> },
    { header: "Branch head", cell: (b) => b.headName ?? <span className="text-ink-3">Not set</span> },
    { header: "Departments", cell: (b) => c.childrenOf(b.id).filter((u) => u.type === "department").length },
    { header: "People", cell: (b) => b.headcount },
    { header: "Openings", cell: (b) => (b.openSlots ? <Pill tone="warn">{b.openSlots} to fill</Pill> : <span className="text-ink-3">None</span>) },
    { header: "", align: "right", cell: (b) => <Button size="sm" variant="ghost" onClick={() => act.editUnit(editInput(b))}>Edit</Button> },
  ];
  const deptCols: Col<UnitSummary>[] = [
    { header: "Department", cell: (d) => <Name name={d.name} sub={c.branchOf(d)?.name} /> },
    { header: "Head", cell: (d) => d.headName ?? <span className="text-ink-3">Not set</span> },
    {
      header: "Teams",
      cell: (d) => {
        const teams = c.childrenOf(d.id).filter((u) => u.type === "team");
        return (
          <span className="flex max-w-64 flex-wrap gap-1">
            {teams.map((t) => (
              <button key={t.id} type="button" onClick={() => act.editUnit(editInput(t))} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-2 hover:text-ink">
                {t.name}
              </button>
            ))}
            <button type="button" onClick={() => act.editUnit(newUnit("team", d.id))} className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-ink-3 hover:text-ink">
              + Team
            </button>
          </span>
        );
      },
    },
    { header: "People", cell: (d) => d.headcount },
    { header: "Jobs", cell: (d) => `${c.jobsOf(d.id).length}${d.openSlots ? ` · ${d.openSlots} open` : ""}` },
    { header: "", align: "right", cell: (d) => <Button size="sm" variant="ghost" onClick={() => act.editUnit(editInput(d))}>Edit</Button> },
  ];
  const jobCols: Col<PositionSummary>[] = [
    { header: "Job", cell: (j) => <Name name={j.title} sub={j.level} /> },
    { header: "Department", cell: (j) => <Name name={j.departmentName} sub={j.branchName} /> },
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

  const add =
    tab === "branches" ? (
      c.company && <Button onClick={() => act.editUnit(newUnit("branch", c.company!.id))}>Add branch</Button>
    ) : tab === "departments" ? (
      <Button onClick={() => act.editUnit(newUnit("department", branchId !== "all" ? branchId : (c.branches[0]?.id ?? "")))}>Add department</Button>
    ) : (
      <Button onClick={() => act.openJob(depts[0]?.id ?? c.departments[0]?.id ?? "")}>Add job</Button>
    );

  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "branches", label: "Branches", count: c.branches.length },
          { value: "departments", label: "Departments", count: c.departments.length },
          { value: "jobs", label: "Jobs", count: c.jobs.length },
        ]}
      />
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} placeholder={`Search ${tab}`} />
        {tab !== "branches" && <Choice label="Branch" value={branchId} onChange={setBranchId} options={[{ value: "all", label: "All branches" }, ...c.branches.map((b) => ({ value: b.id, label: b.name }))]} />}
        <span className="ml-auto">{add}</span>
      </Toolbar>
      {tab === "branches" && <SimpleTable rows={branches} rowKey={(b) => b.id} cols={branchCols} loading={c.loading} empty="No branches yet." />}
      {tab === "departments" && <SimpleTable rows={depts} rowKey={(d) => d.id} cols={deptCols} loading={c.loading} empty="No departments match." />}
      {tab === "jobs" && <SimpleTable rows={jobs} rowKey={(j) => j.id} cols={jobCols} loading={c.loading} empty="No jobs match." />}
    </>
  );
}
