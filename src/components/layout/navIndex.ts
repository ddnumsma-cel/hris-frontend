// The pages in the signed-in person's sidebar, for the top bar's page search. AppNav publishes the
// sidebar it draws (already filtered to what this person may open), so the search never offers
// a page their sidebar doesn't.

import { useSyncExternalStore } from "react";
import type { SideNavGroup } from "./SideNav";

export interface NavPage {
  label: string;
  to: string;
  /** Where it lives in the sidebar, e.g. "Maintenance › Leave". */
  trail: string;
}

/** Every page and sub-page once, in sidebar order. The Pinned group only repeats other pages. */
export function flattenNav(groups: SideNavGroup[]): NavPage[] {
  const pages: NavPage[] = [];
  const add = (label: string, to: string, parts: string[]) => {
    if (pages.some((p) => p.to === to)) return;
    // "Attendance › Attendance" (a one-module group) reads as just "Attendance".
    const trail = parts.filter((x, i) => x && x !== parts[i - 1]).join(" › ");
    pages.push({ label, to, trail: trail === label ? "" : trail });
  };
  for (const g of groups) {
    if (g.title === "Pinned") continue;
    for (const item of g.items) {
      add(item.label, item.to, [g.title]);
      for (const child of item.children ?? []) add(child.label, child.to, [g.title, item.label]);
    }
  }
  return pages;
}

/** Pages whose name or place matches, names that start with the text first; at most `limit`. */
export function matchPages(pages: NavPage[], text: string, limit = 8): NavPage[] {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const rank = (p: NavPage) => {
    const label = p.label.toLowerCase();
    return label.startsWith(q) ? 0 : label.includes(q) ? 1 : p.trail.toLowerCase().includes(q) ? 2 : 3;
  };
  return pages
    .map((p) => ({ p, r: rank(p) }))
    .filter((x) => x.r < 3)
    .sort((a, b) => a.r - b.r)
    .slice(0, limit)
    .map((x) => x.p);
}

let current: NavPage[] = [];
let currentKey = "";
const listeners = new Set<() => void>();

/** Called by AppNav with the sidebar it draws. */
export function publishNav(groups: SideNavGroup[]) {
  const next = flattenNav(groups);
  const key = next.map((p) => `${p.to}|${p.label}|${p.trail}`).join("\n");
  if (key === currentKey) return;
  current = next;
  currentKey = key;
  listeners.forEach((l) => l());
}

/** The current sidebar's pages, kept up to date. */
export function useNavPages(): NavPage[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
