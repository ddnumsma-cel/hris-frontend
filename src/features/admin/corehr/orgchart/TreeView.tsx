import clsx from "clsx";
import { Initials } from "../ui";
import type { Org } from "./useOrg";
import type { Person } from "./tree";

const LINE = "bg-ink-3/35";
const SHOWN = 4;

/** A small card: initials on the left, name and title on the right. */
function Node({
  p,
  org,
  top,
  sub,
}: {
  p: Person;
  org: Org;
  top?: boolean;
  sub?: boolean;
}) {
  return (
    <button
      type="button"
      title={`${p.name} · ${p.positionTitle}`}
      onClick={() => org.openPerson(p)}
      className={clsx(
        "flex items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition-colors",
        top
          ? "w-44 border-transparent bg-ink text-surface"
          : sub
            ? "w-36 border-border bg-surface-2/60 hover:border-ink-3"
            : "w-40 border-border bg-surface shadow-sm hover:border-ink-3",
      )}
    >
      <Initials initials={p.initials} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">{p.name}</span>
        <span
          className={clsx(
            "block truncate text-[0.68rem]",
            top ? "text-surface/70" : "text-ink-3",
          )}
        >
          {p.positionTitle}
        </span>
      </span>
    </button>
  );
}

/** Their team stacked underneath, each on an elbow off one vertical line. */
function Team({ lead, org }: { lead: Person; org: Org }) {
  const list = org.tree!.kidsOf(lead.id);
  const more = org.tree!.count(lead.id) - Math.min(list.length, SHOWN);
  if (!list.length) return null;
  const rows = list.slice(0, SHOWN);
  const elbow = (last: boolean) => (
    <>
      <span
        className={clsx(
          "absolute -top-1.5 left-0 w-px",
          LINE,
          last ? "h-[calc(50%+0.375rem)]" : "h-[calc(100%+0.375rem)]",
        )}
      />
      <span className={clsx("absolute top-1/2 left-0 h-px w-2.5", LINE)} />
    </>
  );
  return (
    <ul className="ml-3 flex flex-col gap-1.5 pt-1.5">
      {rows.map((k, i) => (
        <li key={k.id} className="relative pl-2.5">
          {elbow(i === rows.length - 1 && !more)}
          <Node p={k} org={org} sub />
        </li>
      ))}
      {more > 0 && (
        <li className="relative pl-2.5">
          {elbow(true)}
          <button
            type="button"
            onClick={() => org.openPerson(lead)}
            className="px-1 text-[0.7rem] font-medium text-ink-2 hover:text-ink hover:underline"
          >
            +{more} more
          </button>
        </li>
      )}
    </ul>
  );
}

/** A: the classic top-down chart, kept small so the whole company fits. */
export function TreeView({ org }: { org: Org }) {
  const level2 = org.head ? org.tree!.kidsOf(org.head.id) : org.roots;
  return (
    <div className="no-scrollbar overflow-x-auto pb-2">
      <div className="mx-auto flex w-max min-w-full flex-col items-center">
        {org.head && (
          <>
            <Node p={org.head} org={org} top />
            <div className={clsx("h-4 w-px", LINE)} />
          </>
        )}
        <div className="flex items-start gap-2">
          {level2.map((p, i) => (
            <div key={p.id} className="relative flex flex-col">
              {org.head && level2.length > 1 && (
                <span
                  className={clsx(
                    "absolute top-0 h-px",
                    LINE,
                    i === 0
                      ? "right-[-0.25rem] left-1/2"
                      : i === level2.length - 1
                        ? "right-1/2 left-[-0.25rem]"
                        : "-inset-x-1",
                  )}
                />
              )}
              {org.head && <span className={clsx("mx-auto h-4 w-px", LINE)} />}
              <Node p={p} org={org} />
              <Team lead={p} org={org} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
