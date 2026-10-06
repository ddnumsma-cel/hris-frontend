import type { OrgChart } from "@/lib/corehr/api";

export type Person = OrgChart["people"][number];
export const ORG_KEY = ["corehr", "org-chart"] as const;

/** Who each person reports to on the chart: their supervisor, or the head of the company if none is set. */
export function buildTree(chart: OrgChart) {
  const ids = new Set(chart.people.map((p) => p.id));
  const parentOf = (p: Person) =>
    p.id === chart.headId
      ? undefined
      : p.supervisorId && ids.has(p.supervisorId)
        ? p.supervisorId
        : chart.headId;
  const kids = new Map<string | undefined, Person[]>();
  for (const p of chart.people) {
    const parent = parentOf(p);
    kids.set(parent, [...(kids.get(parent) ?? []), p]);
  }
  // Leads first, then by name.
  const count = (id: string): number =>
    (kids.get(id) ?? []).reduce((n, k) => n + 1 + count(k.id), 0);
  for (const list of kids.values())
    list.sort(
      (a, b) => count(b.id) - count(a.id) || a.name.localeCompare(b.name),
    );
  return {
    kidsOf: (id: string | undefined) => kids.get(id) ?? [],
    count,
    parentOf,
  };
}

export type Tree = ReturnType<typeof buildTree>;
