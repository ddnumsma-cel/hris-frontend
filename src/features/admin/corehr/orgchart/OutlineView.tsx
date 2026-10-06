import { useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { ChevronRightIcon } from "@/components/icons";
import { Initials } from "../ui";
import type { Org } from "./useOrg";
import type { Person } from "./tree";

/** C: the whole company as an outline on the left; the person you pick on the right. */
export function OutlineView({ org }: { org: Org }) {
  const people = org.data!.people;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [folded, setFolded] = useState<Set<string>>(() => new Set());
  const selected = people.find((p) => p.id === selectedId) ?? org.roots[0];
  const tree = org.tree!;

  const rows: { p: Person; depth: number }[] = [];
  const walk = (p: Person, depth: number) => {
    rows.push({ p, depth });
    if (!folded.has(p.id)) tree.kidsOf(p.id).forEach((k) => walk(k, depth + 1));
  };
  org.roots.forEach((r) => walk(r, 0));
  const toggle = (id: string) =>
    setFolded((s) =>
      s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id]),
    );

  // Their chain of managers, up to the top.
  const chain: Person[] = [];
  for (let id = selected && tree.parentOf(selected); id;) {
    const boss = people.find((p) => p.id === id);
    if (!boss || chain.includes(boss)) break;
    chain.unshift(boss);
    id = tree.parentOf(boss);
  }
  const team = selected ? tree.kidsOf(selected.id) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <nav
        aria-label="Organization"
        className="no-scrollbar max-h-[calc(100dvh-15.25rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-2"
      >
        {rows.map(({ p, depth }) => {
          const kids = tree.kidsOf(p.id).length;
          return (
            <div
              key={p.id}
              className={clsx(
                "flex items-center rounded-xl",
                p.id === selected?.id
                  ? "bg-ink text-surface"
                  : "hover:bg-surface-2",
              )}
              style={{ paddingLeft: depth * 16 }}
            >
              <button
                type="button"
                aria-label={folded.has(p.id) ? "Show team" : "Hide team"}
                onClick={() => toggle(p.id)}
                className={clsx(
                  "flex h-9 w-6 flex-none items-center justify-center",
                  !kids && "invisible",
                )}
              >
                <ChevronRightIcon
                  className={clsx(
                    "h-3.5 w-3.5 transition-transform",
                    !folded.has(p.id) && "rotate-90",
                  )}
                />
              </button>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left"
              >
                <Initials initials={p.initials} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {p.name}
                  </span>
                  <span
                    className={clsx(
                      "block truncate text-[0.7rem]",
                      p.id === selected?.id ? "text-surface/70" : "text-ink-3",
                    )}
                  >
                    {p.positionTitle}
                  </span>
                </span>
                {kids > 0 && (
                  <span
                    className={clsx(
                      "flex-none text-xs",
                      p.id === selected?.id ? "text-surface/70" : "text-ink-3",
                    )}
                  >
                    {tree.count(p.id)}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {selected && (
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
          {chain.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-xs text-ink-3">
              {chain.map((c) => (
                <span key={c.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className="hover:text-ink hover:underline"
                  >
                    {c.name}
                  </button>
                  <ChevronRightIcon className="h-3 w-3" />
                </span>
              ))}
              <span className="font-medium text-ink">{selected.name}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <Initials initials={selected.initials} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-semibold">
                {selected.name}
              </h2>
              <p className="text-sm text-ink-2">
                {selected.positionTitle} · {selected.departmentName}
                {selected.branchName && ` · ${selected.branchName}`}
              </p>
              <p className="mt-0.5 text-xs text-ink-3">
                {selected.id === org.data!.headId
                  ? "Head of the company"
                  : chain.length
                    ? `Reports to ${chain[chain.length - 1]!.name}`
                    : selected.positionTitle === "Partner"
                      ? "Partner of the firm"
                      : "Reports to no one yet"}
              </p>
            </div>
            <span className="flex gap-2">
              <Link
                to={`/admin/people/${selected.id}`}
                className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium hover:border-ink-3"
              >
                Profile
              </Link>
              {org.canEdit && (
                <Button onClick={() => org.openPerson(selected)}>
                  Change reporting
                </Button>
              )}
            </span>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Direct team{" "}
              {team.length > 0 && (
                <span className="font-normal text-ink-3">· {team.length}</span>
              )}
            </h3>
            {team.length === 0 ? (
              <p className="text-sm text-ink-3">
                No one reports to {selected.name.split(" ")[0]}.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {team.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setSelectedId(k.id)}
                    className="flex items-center gap-2.5 rounded-xl border border-border p-2.5 text-left hover:border-ink-3"
                  >
                    <Initials initials={k.initials} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {k.name}
                      </span>
                      <span className="block truncate text-xs text-ink-3">
                        {k.positionTitle}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
