import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import type { UnitSummary } from "@/lib/corehr/api";
import { Drawer, Initials } from "../ui";
import { editInput, newUnit, openings, people, type Company, type CompanyActions } from "./data";

const TYPE_LABEL = { company: "Company", branch: "Branch", department: "Department", team: "Team" } as const;

function Box({ u, onOpen, tone = "plain", sub }: { u: UnitSummary; onOpen: () => void; tone?: "top" | "branch" | "plain"; sub?: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={clsx(
        "lift w-full rounded-xl border px-3.5 py-2.5 text-left transition-colors",
        tone === "top" ? "border-transparent bg-ink text-surface" : tone === "branch" ? "border-ink/20 bg-surface shadow-sm" : "border-border bg-surface hover:border-ink-3",
      )}
    >
      <div className={clsx("truncate font-semibold", tone === "plain" ? "text-sm" : "text-base")}>{u.name}</div>
      <div className={clsx("mt-0.5 flex items-center justify-between gap-2 text-xs", tone === "top" ? "text-surface/70" : "text-ink-2")}>
        <span className="truncate">{sub ?? (u.headName ? `Led by ${u.headName}` : "No head set")}</span>
        <span className="flex-none">
          {people(u.headcount)}
          {u.openSlots > 0 && <span className={clsx("ml-1.5 font-medium", tone === "top" ? "text-[var(--color-warning)]" : "text-warning")}>· {u.openSlots} open</span>}
        </span>
      </div>
    </button>
  );
}

/** Option C: the company drawn as a chart. Click any box for its people and jobs. */
export function CompanyChart({ c, act }: { c: Company; act: CompanyActions }) {
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = c.unit(openId);
  const n = Math.max(1, c.branches.length);

  if (!c.company) return null;
  const staff = open ? c.staffOf(open.id) : [];
  const jobs = open ? c.jobsOf(open.id) : [];

  return (
    <>
      <div className="flex flex-col items-center">
        <div className="w-80">
          <Box u={c.company} tone="top" onOpen={() => setOpenId(c.company!.id)} sub={`${c.branches.length} branches`} />
        </div>
        <div className="h-5 w-px bg-border" />
        <div className="relative grid w-full gap-4" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {/* The line joining the branches */}
          {n > 1 && <div className="absolute top-0 h-px bg-border" style={{ left: `${50 / n}%`, right: `${50 / n}%` }} />}
          {c.branches.map((b) => (
            <div key={b.id} className="flex flex-col items-stretch">
              <div className="mx-auto h-5 w-px bg-border" />
              <Box u={b} tone="branch" onOpen={() => setOpenId(b.id)} />
              <div className="mx-auto h-4 w-px bg-border" />
              <div className="flex flex-col gap-2 border-l-2 border-border/70 pl-3">
                {c.childrenOf(b.id)
                  .filter((d) => d.type === "department")
                  .map((d) => {
                    const teams = c.childrenOf(d.id).filter((t) => t.type === "team");
                    return (
                      <div key={d.id}>
                        <Box u={d} onOpen={() => setOpenId(d.id)} />
                        {teams.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1 pl-2">
                            {teams.map((t) => (
                              <button key={t.id} type="button" onClick={() => setOpenId(t.id)} className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] text-ink-2 hover:text-ink">
                                {t.name} · {t.headcount}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                <button type="button" onClick={() => act.editUnit(newUnit("department", b.id))} className="rounded-xl border border-dashed border-border px-3 py-2 text-left text-xs text-ink-3 hover:border-ink-3 hover:text-ink">
                  + Add department
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => act.editUnit(newUnit("branch", c.company!.id))} className="mt-4 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-ink-3 hover:border-ink-3 hover:text-ink">
          + Add branch
        </button>
      </div>

      {open && (
        <Drawer
          open
          onClose={() => setOpenId(null)}
          title={open.name}
          subtitle={`${TYPE_LABEL[open.type]}${open.headName ? ` · Led by ${open.headName}` : ""} · ${people(open.headcount)}${open.openSlots ? ` · ${openings(open.openSlots)}` : ""}`}
          footer={
            <span className="flex flex-wrap justify-end gap-2 pr-16">
              {open.type !== "company" && (
                <Button variant="ghost" onClick={() => (setOpenId(null), act.editUnit(editInput(open)))}>
                  Edit
                </Button>
              )}
              {open.type === "department" && (
                <>
                  <Button variant="ghost" onClick={() => (setOpenId(null), act.editUnit(newUnit("team", open.id)))}>Add team</Button>
                  <Button onClick={() => (setOpenId(null), act.openJob(open.id))}>Add job</Button>
                </>
              )}
              {open.type === "branch" && <Button onClick={() => (setOpenId(null), act.editUnit(newUnit("department", open.id)))}>Add department</Button>}
            </span>
          }
        >
          <div className="flex flex-col gap-5">
            {open.type === "branch" && <p className="text-sm text-ink-2">{open.address || "No address yet"}</p>}
            <div>
              <h3 className="mb-2 text-sm font-semibold">Jobs</h3>
              {jobs.length === 0 ? (
                <p className="text-sm text-ink-3">No jobs yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {jobs.slice(0, 6).map((j) => (
                    <li key={j.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <button type="button" onClick={() => (setOpenId(null), act.openJob(j.departmentId, j))} className="min-w-0 truncate text-left hover:underline">
                        {j.title}
                      </button>
                      <span className="flex flex-none items-center gap-2 text-xs text-ink-2">
                        {j.filled} of {j.slots}
                        {j.open > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/people/new?position=${j.id}`)}>
                            Hire
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">People</h3>
              {staff.length === 0 ? (
                <p className="text-sm text-ink-3">No one here yet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {staff.slice(0, 8).map((e) => (
                    <li key={e.id}>
                      <Link to={`/admin/people/${e.id}`} className="flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-surface-2">
                        <Initials initials={e.initials} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{e.name}</span>
                          <span className="block truncate text-xs text-ink-2">{e.positionTitle}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                  {staff.length > 8 && (
                    <li>
                      <Link to="/admin/people" className="text-xs font-medium text-brand hover:underline">
                        See all {staff.length} in People
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
}
