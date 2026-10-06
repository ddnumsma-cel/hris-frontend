import { useState } from "react";
import { Initials } from "../ui";
import type { Org } from "./useOrg";
import type { Person } from "./tree";

/** B: one board per department, its lead on top and everyone else listed with who they report to. */
export function TeamsView({ org }: { org: Org }) {
  const people = org.data!.people;
  const byDept = new Map<string, Person[]>();
  for (const p of people)
    byDept.set(p.departmentName || "No department", [
      ...(byDept.get(p.departmentName || "No department") ?? []),
      p,
    ]);
  const boards = [...byDept.entries()]
    .map(([dept, list]) => {
      // The lead is whoever in the department has the most people under them.
      const lead = [...list].sort(
        (a, b) => org.tree!.count(b.id) - org.tree!.count(a.id),
      )[0]!;
      return {
        dept,
        lead: org.tree!.count(lead.id) > 0 ? lead : undefined,
        members: list.filter(
          (p) => p.id !== lead.id || org.tree!.count(lead.id) === 0,
        ),
      };
    })
    .sort(
      (a, b) =>
        b.members.length - a.members.length || a.dept.localeCompare(b.dept),
    );
  const name = (id?: string) => people.find((p) => p.id === id)?.name;
  const [expanded, setExpanded] = useState<string | null>(null);
  const SHOWN = 4;

  return (
    <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {boards.map((b) => (
        <section
          key={b.dept}
          className="flex flex-col rounded-2xl border border-border bg-surface"
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="truncate text-sm font-semibold">{b.dept}</h2>
            <span className="rounded-full bg-surface-2 px-2 text-xs font-semibold text-ink-2">
              {b.members.length + (b.lead ? 1 : 0)}
            </span>
          </header>
          {b.lead && (
            <button
              type="button"
              onClick={() => org.openPerson(b.lead!)}
              className="m-2.5 mb-1 flex items-center gap-2.5 rounded-xl bg-ink px-3 py-2 text-left text-surface"
            >
              <Initials initials={b.lead.initials} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {b.lead.name}
                </span>
                <span className="block truncate text-xs text-surface/70">
                  {b.lead.positionTitle} · leads {org.tree!.count(b.lead.id)}
                </span>
              </span>
            </button>
          )}
          <ul className="flex flex-col p-2.5 pt-1.5">
            {(expanded === b.dept ? b.members : b.members.slice(0, SHOWN)).map(
              (p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => org.openPerson(p)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1 text-left hover:bg-surface-2"
                  >
                    <Initials initials={p.initials} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {p.name}
                      </span>
                      <span className="block truncate text-xs text-ink-3">
                        {p.positionTitle}
                        {name(p.supervisorId)
                          ? ` · reports to ${name(p.supervisorId)!.split(" ")[0]}`
                          : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ),
            )}
            {b.members.length > SHOWN && (
              <li>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded(expanded === b.dept ? null : b.dept)
                  }
                  className="w-full rounded-xl px-2 py-1 text-left text-xs font-medium text-ink-2 hover:text-ink hover:underline"
                >
                  {expanded === b.dept
                    ? "Show fewer"
                    : `See all ${b.members.length}`}
                </button>
              </li>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
