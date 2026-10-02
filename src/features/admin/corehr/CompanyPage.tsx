import { useMemo, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { ArrowRightIcon, MapPinIcon, PlusIcon, UserPlusIcon } from "@/components/icons";
import { listEmployees, listPositions, listUnits, setUnitActive, type EmployeeSummary, type PositionSummary, type UnitInput, type UnitSummary } from "@/lib/corehr/api";
import { keys } from "./format";
import { JobDialog } from "./JobDialog";
import { UnitDialog } from "./UnitDialog";
import { Initials, LoadError } from "./ui";

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
const openingText = (n: number) => `${n} opening${n === 1 ? "" : "s"}`;

/** Little row of faces, with a count when there are more than fit. */
function Faces({ list, max = 6 }: { list: EmployeeSummary[]; max?: number }) {
  if (list.length === 0) return <span className="text-xs text-ink-3">No one here yet</span>;
  return (
    <span className="flex items-center">
      <span className="flex -space-x-1.5">
        {list.slice(0, max).map((e) => (
          <Link key={e.id} to={`/admin/people/${e.id}`} title={`${e.name}, ${e.positionTitle}`} className="rounded-full ring-2 ring-surface transition-transform hover:z-10 hover:-translate-y-0.5">
            <Initials initials={e.initials} size="sm" />
          </Link>
        ))}
      </span>
      {list.length > max && <span className="ml-2 text-xs text-ink-3">+{list.length - max} more</span>}
    </span>
  );
}

function DepartmentCard({
  dept,
  teams,
  jobs,
  staff,
  index,
  onEdit,
  onAddTeam,
  onEditTeam,
  onOpenJob,
  onAddJob,
}: {
  dept: UnitSummary;
  teams: UnitSummary[];
  jobs: PositionSummary[];
  staff: EmployeeSummary[];
  index: number;
  onEdit: () => void;
  onAddTeam: () => void;
  onEditTeam: (t: UnitSummary) => void;
  onOpenJob: (j: PositionSummary) => void;
  onAddJob: () => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const open = jobs.reduce((n, j) => n + j.open, 0);
  const firstOpen = jobs.find((j) => j.open > 0);
  const close = useMutation({
    mutationFn: () => setUnitActive(dept.id, !dept.active),
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      toast.show(`${u.name} ${u.active ? "reopened" : "closed"}.`);
    },
    onError: (e) => toast.show((e as Error).message),
  });

  return (
    <article style={{ "--i": index } as React.CSSProperties} className={clsx("rise-in lift flex flex-col rounded-2xl border border-border bg-surface shadow-sm", !dept.active && "opacity-60")}>
      <header className="flex items-start gap-3 px-5 pt-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-base font-semibold tracking-[-0.01em]">{dept.name}</h2>
          <p className="mt-0.5 truncate text-xs text-ink-2">
            {dept.headName ? (
              <>
                Led by{" "}
                <Link to={`/admin/people/${dept.headEmployeeId}`} className="font-medium text-ink hover:underline">
                  {dept.headName}
                </Link>
              </>
            ) : (
              <button type="button" onClick={onEdit} className="text-ink-3 underline underline-offset-4 hover:text-ink">
                No head yet, set one
              </button>
            )}
            {!dept.active && <span className="text-warning"> · Closed</span>}
          </p>
        </div>
        <div className="flex flex-none gap-1">
          <button type="button" onClick={onEdit} className="rounded-md px-2 py-1 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink">
            Edit
          </button>
          <button
            type="button"
            disabled={close.isPending}
            onClick={() => {
              if (dept.active && !window.confirm(`Close ${dept.name}? You can reopen it later.`)) return;
              close.mutate();
            }}
            className="rounded-md px-2 py-1 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            {dept.active ? "Close" : "Reopen"}
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3 px-5 pt-3">
        <Faces list={staff} />
        <span className="flex-none text-xs text-ink-2">{people(staff.length)}</span>
      </div>

      {(teams.length > 0 || dept.active) && (
        <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3">
          {teams.map((t) => (
            <button key={t.id} type="button" onClick={() => onEditTeam(t)} title="Edit team" className={clsx("rounded-full bg-surface-2 px-2.5 py-1 text-[0.72rem] text-ink-2 hover:text-ink", !t.active && "line-through opacity-60")}>
              {t.name} · {t.headcount}
            </button>
          ))}
          {dept.active && (
            <button type="button" onClick={onAddTeam} className="rounded-full border border-dashed border-border px-2.5 py-1 text-[0.72rem] text-ink-3 hover:border-ink-3 hover:text-ink">
              + Team
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex-1 border-t border-border px-5 py-2">
        <p className="pt-1 pb-1 text-xs font-semibold text-ink-2">Jobs</p>
        {jobs.length === 0 ? (
          <p className="py-1 text-xs text-ink-3">No jobs yet.</p>
        ) : (
          <ul>
            {jobs.map((j) => (
              <li key={j.id} className="flex items-center gap-2">
                <button type="button" onClick={() => onOpenJob(j)} className="-mx-2 flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-2/70">
                  <span className="min-w-0 flex-1 truncate text-sm">{j.title}</span>
                  <span className="flex-none text-xs text-ink-2">
                    {j.filled} of {j.slots}
                  </span>
                  {j.open > 0 ? <span className="h-1.5 w-1.5 flex-none rounded-full bg-warning" aria-label={openingText(j.open)} /> : <span className="w-1.5 flex-none" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        {dept.active && (
          <button type="button" onClick={onAddJob} className="mt-1 text-xs text-ink-3 hover:text-ink">
            + Add a job
          </button>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-border bg-surface-2/50 px-5 py-3">
        {open > 0 ? (
          <>
            <span className="text-xs font-medium text-warning">{openingText(open)}</span>
            <Button size="sm" icon={<UserPlusIcon className="h-3.5 w-3.5" />} onClick={() => navigate(`/admin/people/new?position=${firstOpen!.id}`)}>
              Hire{jobs.filter((j) => j.open > 0).length > 1 ? "" : ` for ${firstOpen!.title}`}
            </Button>
          </>
        ) : (
          <span className="text-xs text-ink-3">{jobs.length ? "All jobs filled" : "Add a job to start hiring"}</span>
        )}
      </footer>
    </article>
  );
}

/** A branch as a card: who leads it, where it is, its numbers. On the overview it opens the branch. */
function BranchCard({
  branch,
  departments,
  staff,
  index,
  onEdit,
  onAddDepartment,
  onOpen,
}: {
  branch: UnitSummary;
  departments: UnitSummary[];
  staff: EmployeeSummary[];
  index: number;
  onEdit: () => void;
  onAddDepartment: () => void;
  onOpen?: () => void;
}) {
  return (
    <article style={{ "--i": index } as React.CSSProperties} className={clsx("rise-in flex flex-col rounded-2xl border border-border bg-surface shadow-sm", onOpen && "lift", !branch.active && "opacity-60")}>
      <header className="flex items-start gap-3 px-5 pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-[0.7rem] font-medium text-ink-3">Branch</p>
          <h2 className="font-display truncate text-base font-semibold tracking-[-0.01em]">
            {onOpen ? (
              <button type="button" onClick={onOpen} className="hover:underline">
                {branch.name}
              </button>
            ) : (
              branch.name
            )}
          </h2>
          <p className="mt-0.5 truncate text-xs text-ink-2">
            {branch.headName ? (
              <>
                Led by{" "}
                <Link to={`/admin/people/${branch.headEmployeeId}`} className="font-medium text-ink hover:underline">
                  {branch.headName}
                </Link>
              </>
            ) : (
              <button type="button" onClick={onEdit} className="text-ink-3 underline underline-offset-4 hover:text-ink">
                No branch head yet, set one
              </button>
            )}
            {!branch.active && <span className="text-warning"> · Closed</span>}
          </p>
        </div>
        <button type="button" onClick={onEdit} className="flex-none rounded-md px-2 py-1 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink">
          Edit
        </button>
      </header>
      <p className="flex items-start gap-1.5 px-5 pt-3 text-xs text-ink-2">
        <MapPinIcon className="mt-px h-3.5 w-3.5 flex-none text-ink-3" />
        {branch.address || "No address yet"}
      </p>
      {onOpen && (
        <div className="flex items-center justify-between gap-3 px-5 pt-3">
          <Faces list={staff} max={7} />
        </div>
      )}
      <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-border px-5 py-4">
        <div>
          <dt className="text-xs text-ink-3">People</dt>
          <dd className="font-display mt-0.5 text-xl font-semibold">{branch.headcount}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Departments</dt>
          <dd className="font-display mt-0.5 text-xl font-semibold">{departments.length}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Openings</dt>
          <dd className={clsx("font-display mt-0.5 text-xl font-semibold", branch.openSlots > 0 && "text-warning")}>{branch.openSlots}</dd>
        </div>
      </dl>
      {onOpen && departments.length > 0 && (
        <p className="-mt-1 px-5 pb-4 text-xs text-ink-3">
          {departments
            .slice(0, 4)
            .map((d) => d.name)
            .join(" · ")}
          {departments.length > 4 && ` · +${departments.length - 4} more`}
        </p>
      )}
      <footer className="mt-auto flex items-center justify-between gap-3 rounded-b-2xl border-t border-border bg-surface-2/50 px-5 py-3">
        <span className={clsx("text-xs", branch.openSlots > 0 ? "font-medium text-warning" : "text-ink-3")}>
          {!branch.active ? "This branch is closed" : branch.openSlots > 0 ? `${openingText(branch.openSlots)} to fill` : "All jobs filled"}
        </span>
        {onOpen ? (
          <Button size="sm" onClick={onOpen} icon={<ArrowRightIcon className="h-3.5 w-3.5" />}>
            Open branch
          </Button>
        ) : (
          branch.active && (
            <Button size="sm" icon={<PlusIcon className="h-3.5 w-3.5" />} onClick={onAddDepartment}>
              Add a department
            </Button>
          )
        )}
      </footer>
    </article>
  );
}

/** All branches first; open one to see its departments as cards with their people, teams and jobs. */
export function CompanyPage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const unitsQuery = useQuery({ queryKey: keys.units, queryFn: listUnits });
  const positionsQuery = useQuery({ queryKey: keys.positions, queryFn: listPositions });
  const employeesQuery = useQuery({ queryKey: keys.employees, queryFn: listEmployees });
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);
  const jobs = useMemo(() => positionsQuery.data ?? [], [positionsQuery.data]);
  const [showClosed, setShowClosed] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitInput | null>(null);
  const [job, setJob] = useState<{ job?: PositionSummary; departmentId: string } | null>(null);

  const company = units.find((u) => u.type === "company");
  const branches = units.filter((u) => u.type === "branch" && (u.active || showClosed)).sort((a, b) => a.name.localeCompare(b.name));
  const branch = units.find((b) => b.type === "branch" && b.id === params.get("branch"));
  const departmentsOf = (branchId: string) => units.filter((u) => u.type === "department" && u.parentId === branchId && (u.active || showClosed)).sort((a, b) => a.name.localeCompare(b.name));
  const subtree = (id: string) => {
    const ids = new Set([id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const u of units) {
        if (u.parentId && ids.has(u.parentId) && !ids.has(u.id)) {
          ids.add(u.id);
          grew = true;
        }
      }
    }
    return ids;
  };
  const staffOf = (unitId: string) => {
    const ids = subtree(unitId);
    return (employeesQuery.data ?? []).filter((e) => e.status !== "Separated" && ids.has(e.unitId));
  };
  const editInput = (u: UnitSummary): UnitInput => ({ id: u.id, type: u.type, name: u.name, code: u.code, parentId: u.parentId, headEmployeeId: u.headEmployeeId, address: u.address });
  const openBranch = (id: string | null) => {
    setParams(id ? { branch: id } : {});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // The job dialog shows the latest numbers after edits elsewhere.
  const liveJob = job?.job ? jobs.find((j) => j.id === job.job!.id) : undefined;
  const departments = branch ? departmentsOf(branch.id) : [];

  if (unitsQuery.isError) return <LoadError onRetry={() => unitsQuery.refetch()} />;

  return (
    <>
      {branch ? (
        <div>
          <button type="button" onClick={() => openBranch(null)} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
            <ArrowRightIcon className="h-4 w-4 rotate-180" />
            All branches
          </button>
          <h1 className="font-display mt-2 text-2xl font-semibold tracking-[-0.02em]">{branch.name}</h1>
          <p className="mt-0.5 text-[0.85rem] text-ink-2">Its departments: who leads them, who works there, and which jobs still need people.</p>
        </div>
      ) : (
        <ContentHead
          title="Company"
          subtitle={`${branches.filter((b) => b.active).length} branches · ${company?.headcount ?? 0} people${company?.openSlots ? ` · ${openingText(company.openSlots)} to fill` : ""}. Open a branch to see its departments.`}
          actions={
            company && (
              <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setEditingUnit({ type: "branch", name: "", code: "", parentId: company.id })}>
                Add a branch
              </Button>
            )
          }
        />
      )}

      <label className="-mt-2 flex items-center gap-2 self-end text-xs text-ink-2">
        <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-ink)]" />
        Show closed ones
      </label>

      {unitsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : !branch ? (
        <section key="overview" aria-label="Branches" className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {branches.map((b, i) => (
            <BranchCard
              key={b.id}
              index={i}
              branch={b}
              departments={departmentsOf(b.id)}
              staff={staffOf(b.id)}
              onEdit={() => setEditingUnit(editInput(b))}
              onAddDepartment={() => setEditingUnit({ type: "department", name: "", code: "", parentId: b.id })}
              onOpen={() => openBranch(b.id)}
            />
          ))}
          {branches.length === 0 && <p className="text-sm text-ink-3">No branches yet. Use Add a branch to start.</p>}
        </section>
      ) : (
        <section key={branch.id} aria-label={branch.name} className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <BranchCard
            index={0}
            branch={branch}
            departments={departments}
            staff={staffOf(branch.id)}
            onEdit={() => setEditingUnit(editInput(branch))}
            onAddDepartment={() => setEditingUnit({ type: "department", name: "", code: "", parentId: branch.id })}
          />
          {departments.map((d, i) => (
            <DepartmentCard
              key={d.id}
              index={i + 1}
              dept={d}
              teams={units.filter((u) => u.type === "team" && u.parentId === d.id && (u.active || showClosed))}
              jobs={jobs.filter((j) => j.departmentId === d.id && (j.active || showClosed)).sort((a, b) => b.open - a.open || a.title.localeCompare(b.title))}
              staff={staffOf(d.id)}
              onEdit={() => setEditingUnit(editInput(d))}
              onAddTeam={() => setEditingUnit({ type: "team", name: "", code: "", parentId: d.id })}
              onEditTeam={(t) => setEditingUnit(editInput(t))}
              onOpenJob={(j) => setJob({ job: j, departmentId: d.id })}
              onAddJob={() => setJob({ departmentId: d.id })}
            />
          ))}
        </section>
      )}

      {editingUnit && (
        <UnitDialog
          input={editingUnit}
          units={units}
          onClose={() => setEditingUnit(null)}
          onSaved={(name) => {
            toast.show(editingUnit.id ? `${name} saved.` : `${name} added.`);
            setEditingUnit(null);
          }}
        />
      )}
      {job && <JobDialog key={job.job?.id ?? "new"} job={liveJob ?? job.job} departmentId={job.departmentId} units={units} jobs={jobs} onClose={() => setJob(null)} />}
    </>
  );
}
