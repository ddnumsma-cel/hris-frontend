import type { OrgChart } from "@/lib/corehr/api";

export type Person = OrgChart["people"][number];

/** Who each person reports to on the chart: their supervisor, or the head of the company if none is set. */
export function buildTree(chart: OrgChart) {
  const ids = new Set(chart.people.map((p) => p.id));
  const parentOf = (p: Person) => (p.id === chart.headId ? undefined : p.supervisorId && ids.has(p.supervisorId) ? p.supervisorId : chart.headId);
  const kids = new Map<string | undefined, Person[]>();
  for (const p of chart.people) {
    const parent = parentOf(p);
    kids.set(parent, [...(kids.get(parent) ?? []), p]);
  }
  // Leads first, then by name.
  const count = (id: string): number => (kids.get(id) ?? []).reduce((n, k) => n + 1 + count(k.id), 0);
  for (const list of kids.values()) list.sort((a, b) => count(b.id) - count(a.id) || a.name.localeCompare(b.name));
  const byId = new Map(chart.people.map((p) => [p.id, p]));
  /** Managers above someone, nearest first. */
  const chainOf = (p: Person) => {
    const out: Person[] = [];
    for (let id = parentOf(p); id && out.length < 20; id = parentOf(byId.get(id)!)) out.push(byId.get(id)!);
    return out;
  };
  /** The top of the chart: the head, or everyone without a manager when no head is set. */
  const roots = chart.headId && byId.has(chart.headId) ? [byId.get(chart.headId)!] : (kids.get(undefined) ?? []);
  return { kidsOf: (id: string | undefined) => kids.get(id) ?? [], count, parentOf, chainOf, roots, byId };
}

export type Tree = ReturnType<typeof buildTree>;

/** What every org chart layout gets from the page. */
export interface OrgViewProps {
  chart: OrgChart;
  tree: Tree;
  /** Opens the person's panel (team, who they report to). */
  onOpen: (id: string) => void;
}
