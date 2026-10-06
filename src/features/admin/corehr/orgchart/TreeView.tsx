import type { CSSProperties } from "react";
import clsx from "clsx";
import type { Org } from "./useOrg";
import type { Person } from "./tree";

const ACCENTS = [
  "var(--color-cat-1)",
  "var(--color-cat-3)",
  "var(--color-cat-4)",
  "var(--color-cat-2)",
];
const tint = (pct: number) =>
  `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;
const SHOWN = 6;

/** "Antonio D. Sanchez Jr." → ADS, the cluster a partner leads. */
const clusterCode = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => !/^(jr|sr|ii|iii|iv)\.?$/i.test(w))
    .map((w) => w[0])
    .join("")
    .toUpperCase();

function Avatar({ p, solid }: { p: Person; solid?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "flex flex-none items-center justify-center rounded-full font-semibold",
        solid ? "h-10 w-10 text-xs text-white" : "h-8 w-8 text-[0.68rem]",
      )}
      style={
        solid
          ? { background: "var(--accent)" }
          : { background: tint(14), color: "var(--accent)" }
      }
    >
      {p.initials}
    </span>
  );
}

/** The person leading a branch: a white card with their colour across the top. */
function LeadCard({ p, org, label }: { p: Person; org: Org; label?: string }) {
  const n = org.tree!.count(p.id);
  return (
    <button
      type="button"
      onClick={() => org.openPerson(p)}
      className="relative flex w-60 items-center gap-3 overflow-hidden rounded-2xl border border-border bg-surface px-3.5 pt-4 pb-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: "var(--accent)" }}
      />
      <Avatar p={p} solid />
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-tight font-semibold">
          {p.name}
        </span>
        <span className="mt-0.5 block text-xs text-ink-2">
          {p.positionTitle}
        </span>
        <span className="mt-1.5 flex flex-wrap gap-1">
          {label && (
            <span
              className="rounded-full px-1.5 py-px text-[0.65rem] font-bold tracking-wide"
              style={{ background: tint(14), color: "var(--accent)" }}
            >
              {label}
            </span>
          )}
          {n > 0 && (
            <span className="rounded-full bg-surface-2 px-1.5 py-px text-[0.65rem] font-medium text-ink-2">
              {n} {n === 1 ? "person" : "people"}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function MemberCard({ p, org }: { p: Person; org: Org }) {
  return (
    <button
      type="button"
      title={`${p.name} · ${p.positionTitle}`}
      onClick={() => org.openPerson(p)}
      className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-left transition hover:border-(--accent)"
    >
      <Avatar p={p} />
      <span className="min-w-0">
        <span className="block truncate text-[0.8rem] leading-tight font-medium">
          {p.name}
        </span>
        <span className="block truncate text-[0.7rem] text-ink-3">
          {p.positionTitle}
        </span>
      </span>
    </button>
  );
}

/** Their team stacked underneath on a rounded elbow line; teams within teams step in. */
function Team({ lead, org }: { lead: Person; org: Org }) {
  const list = org.tree!.kidsOf(lead.id);
  if (!list.length) return null;
  const rows = list.slice(0, SHOWN);
  const more = list
    .slice(SHOWN)
    .reduce((n, k) => n + 1 + org.tree!.count(k.id), 0);
  const line = { borderColor: tint(45) };
  return (
    <ul className="ml-5 flex flex-col gap-1.5 pt-1.5">
      {rows.map((k, i) => (
        <li key={k.id} className="relative pl-4">
          <span
            className="absolute -top-1.5 left-0 h-[1.45rem] w-3 rounded-bl-lg border-b border-l"
            style={line}
          />
          {(i < rows.length - 1 || more > 0) && (
            <span
              className="absolute top-4 -bottom-1.5 left-0 border-l"
              style={line}
            />
          )}
          <MemberCard p={k} org={org} />
          <Team lead={k} org={org} />
        </li>
      ))}
      {more > 0 && (
        <li className="relative pl-4">
          <span
            className="absolute -top-1.5 left-0 h-3.5 w-3 rounded-bl-lg border-b border-l"
            style={line}
          />
          <button
            type="button"
            onClick={() => org.openPerson(lead)}
            className="text-xs font-medium hover:underline"
            style={{ color: "var(--accent)" }}
          >
            +{more} more
          </button>
        </li>
      )}
    </ul>
  );
}

/** A: the classic top-down chart. Each branch gets its own colour. */
export function TreeView({ org }: { org: Org }) {
  const level2 = org.head ? org.tree!.kidsOf(org.head.id) : org.roots;
  const hasTop = !!org.head || org.partnersLead;
  const line = "bg-ink-3/40";
  return (
    <div className="no-scrollbar overflow-x-auto pb-2">
      <div className="mx-auto flex w-max min-w-full flex-col items-center">
        {hasTop && (
          <>
            {org.head ? (
              <div
                style={
                  { "--accent": "var(--color-brand-dark)" } as CSSProperties
                }
              >
                <LeadCard p={org.head} org={org} label="Head" />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl bg-brand-dark px-4 py-2.5 text-white shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
                  MS
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    MSMA Group
                  </span>
                  <span className="block text-xs text-white/70">
                    Led by {level2.length} partners
                  </span>
                </span>
              </div>
            )}
            <div className={clsx("h-5 w-px", line)} />
          </>
        )}
        <div className="flex items-start gap-8">
          {level2.map((p, i) => (
            <div
              key={p.id}
              className="relative flex flex-col"
              style={
                { "--accent": ACCENTS[i % ACCENTS.length] } as CSSProperties
              }
            >
              {hasTop && level2.length > 1 && (
                <span
                  className={clsx(
                    "absolute top-0 h-px",
                    line,
                    i === 0
                      ? "right-[-1rem] left-1/2"
                      : i === level2.length - 1
                        ? "right-1/2 left-[-1rem]"
                        : "-inset-x-4",
                  )}
                />
              )}
              {hasTop && <span className={clsx("mx-auto h-5 w-px", line)} />}
              <LeadCard
                p={p}
                org={org}
                label={
                  p.positionTitle === "Partner"
                    ? clusterCode(p.name)
                    : undefined
                }
              />
              <div className="w-60">
                <Team lead={p} org={org} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
