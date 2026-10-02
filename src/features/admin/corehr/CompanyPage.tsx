import { useMemo, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { MapPinIcon, PlusIcon, UserPlusIcon } from "@/components/icons";
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

/** Branches as tabs, each department as a card with its people, teams and jobs. */
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
  const branch = branches.find((b) => b.id === params.get("branch")) ?? branches[0];
  const departments = units.filter((u) => u.type === "department" && u.parentId === branch?.id && (u.active || showClosed)).sort((a, b) => a.name.localeCompare(b.name));
  const subtree = (id: string) => {
    const ids = new Set([id]);
    for (const u of units) if (u.parentId === id) ids.add(u.id);
    return ids;
  };
  const staffOf = (deptId: string) => {
    const ids = subtree(deptId);
    return (employeesQuery.data ?? []).filter((e) => e.status !== "Separated" && ids.has(e.unitId));
  };
  const editInput = (u: UnitSummary): UnitInput => ({ id: u.id, type: u.type, name: u.name, code: u.code, parentId: u.parentId, headEmployeeId: u.headEmployeeId, address: u.address });
  // The job dialog shows the latest numbers after edits elsewhere.
  const liveJob = job?.job ? jobs.find((j) => j.id === job.job!.id) : undefined;

  if (unitsQuery.isError) return <LoadError onRetry={() => unitsQuery.refetch()} />;

  return (
    <>
      <ContentHead
        title="Company"
        subtitle="Each branch and its departments: who leads them, who works there, and which jobs still need people."
        actions={
          company && (
            <Button variant="ghost" icon={<PlusIcon className="h-4 w-4" />} onClick={() => setEditingUnit({ type: "branch", name: "", code: "", parentId: company.id })}>
              Add a branch
            </Button>
          )
        }
      />

      {unitsQuery.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Branches" className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
              {branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={b.id === branch?.id}
                  onClick={() => setParams({ branch: b.id }, { replace: true })}
                  className={clsx("flex flex-none items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition-colors", b.id === branch?.id ? "bg-ink font-semibold text-surface" : "text-ink-2 hover:bg-surface-2 hover:text-ink", !b.active && "line-through")}
                >
                  {b.name}
                  <span className={clsx("text-xs", b.id === branch?.id ? "text-surface/70" : "text-ink-3")}>{b.headcount}</span>
                </button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-ink)]" />
              Show closed ones
            </label>
          </div>

          {branch && (
            <section key={branch.id} aria-label={branch.name} className="rise-in">
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {/* The branch itself, as the first card alongside its departments. */}
                <article className="rise-in flex flex-col rounded-2xl border border-border bg-surface shadow-sm">
                  <header className="flex items-start gap-3 px-5 pt-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.7rem] font-medium text-ink-3">Branch</p>
                      <h2 className="font-display truncate text-base font-semibold tracking-[-0.01em]">{branch.name}</h2>
                      <p className="mt-0.5 truncate text-xs text-ink-2">
                        {branch.headName ? (
                          <>
                            Led by{" "}
                            <Link to={`/admin/people/${branch.headEmployeeId}`} className="font-medium text-ink hover:underline">
                              {branch.headName}
                            </Link>
                          </>
                        ) : (
                          <button type="button" onClick={() => setEditingUnit(editInput(branch))} className="text-ink-3 underline underline-offset-4 hover:text-ink">
                            No branch head yet, set one
                          </button>
                        )}
                      </p>
                    </div>
                    <button type="button" onClick={() => setEditingUnit(editInput(branch))} className="flex-none rounded-md px-2 py-1 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink">
                      Edit
                    </button>
                  </header>
                  <p className="flex items-start gap-1.5 px-5 pt-3 text-xs text-ink-2">
                    <MapPinIcon className="mt-px h-3.5 w-3.5 flex-none text-ink-3" />
                    {branch.address || "No address yet"}
                  </p>
                  <dl className="mt-3 grid flex-1 grid-cols-3 gap-3 border-t border-border px-5 py-4">
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
                  <footer className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-border bg-surface-2/50 px-5 py-3">
                    <span className={clsx("text-xs", branch.openSlots > 0 ? "font-medium text-warning" : "text-ink-3")}>
                      {!branch.active ? "This branch is closed" : branch.openSlots > 0 ? `${openingText(branch.openSlots)} to fill` : "All jobs filled"}
                    </span>
                    {branch.active && (
                      <Button size="sm" icon={<PlusIcon className="h-3.5 w-3.5" />} onClick={() => setEditingUnit({ type: "department", name: "", code: "", parentId: branch.id })}>
                        Add a department
                      </Button>
                    )}
                  </footer>
                </article>
                {departments.map((d, i) => (
                  <DepartmentCard
                    key={d.id}
                    index={i}
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
              </div>
            </section>
          )}
        </>
      )}

      {editingUnit && (
        <UnitDialog
          input={editingUnit}
          units={units}
          onClose={() => setEditingUnit(null)}
          onSaved={(name, id) => {
            toast.show(editingUnit.id ? `${name} saved.` : `${name} added.`);
            if (editingUnit.type === "branch") setParams({ branch: id }, { replace: true });
            setEditingUnit(null);
          }}
        />
      )}
      {job && <JobDialog key={job.job?.id ?? "new"} job={liveJob ?? job.job} departmentId={job.departmentId} units={units} jobs={jobs} onClose={() => setJob(null)} />}
    </>
  );
}
