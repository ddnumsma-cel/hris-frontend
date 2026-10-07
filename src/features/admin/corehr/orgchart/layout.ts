import type { Person, Tree } from "./tree";

export interface Placed {
  p: Person;
  depth: number;
  /** Position along the row, in leaf slots (a parent sits over the middle of its team). */
  slot: number;
  parentId?: string;
}

/** A tidy tree: leaves get one slot each, left to right; every manager sits centered over their team. */
export function layoutTree(tree: Tree) {
  const placed: Placed[] = [];
  let next = 0;
  const place = (p: Person, depth: number, parentId?: string): number => {
    const team = tree.kidsOf(p.id);
    const slots = team.map((k) => place(k, depth + 1, p.id));
    const slot = slots.length ? (slots[0]! + slots[slots.length - 1]!) / 2 : next++;
    placed.push({ p, depth, slot, parentId });
    return slot;
  };
  tree.roots.forEach((r) => place(r, 0));
  const byId = new Map(placed.map((n) => [n.p.id, n]));
  return { placed, byId, leaves: Math.max(1, next), depth: Math.max(0, ...placed.map((n) => n.depth)) };
}

const PALETTE = ["var(--color-cat-1)", "var(--color-cat-2)", "var(--color-cat-3)", "var(--color-cat-4)", "var(--color-brand)", "var(--color-gold)"];

/** A steady color per department, in name order. */
export function departmentColors(people: Person[]) {
  const names = [...new Set(people.map((p) => p.departmentName))].sort();
  return { names, colorOf: (dept: string) => PALETTE[Math.max(0, names.indexOf(dept)) % PALETTE.length]! };
}
