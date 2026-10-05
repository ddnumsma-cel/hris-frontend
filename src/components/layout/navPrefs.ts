import { useState } from "react";
import type { NavSection } from "./navItems";

/** How one user has arranged their sidebar: pages pinned to the top, and module order. */
export interface NavPrefs {
  /** Page paths pinned as shortcuts, in order. */
  pins: string[];
  /** Module keys in the order the user wants them. Unknown or new modules go last. */
  order: string[];
  /** Compact icon rail, or the full sidebar with section headings. */
  style: "rail" | "full";
  /** Full sidebar: section headings the user has folded away. */
  collapsed: string[];
}

export const MAX_PINS = 4;
const EMPTY: NavPrefs = { pins: [], order: [], style: "rail", collapsed: [] };
const keyFor = (who: string) => `heyhr-nav-prefs:${who}`;

/** Saved per signed-in account (or per workspace for older sessions), in this browser. */
export function useNavPrefs(who: string): [NavPrefs, (p: NavPrefs) => void] {
  const [prefs, setPrefs] = useState<NavPrefs>(() => {
    try {
      const raw = localStorage.getItem(keyFor(who));
      if (raw) {
        const p = JSON.parse(raw) as Partial<NavPrefs>;
        return { pins: Array.isArray(p.pins) ? p.pins : [], order: Array.isArray(p.order) ? p.order : [], style: p.style === "full" ? "full" : "rail", collapsed: Array.isArray(p.collapsed) ? p.collapsed : [] };
      }
    } catch {
      // Storage blocked or corrupt: use the default layout.
    }
    return EMPTY;
  });
  return [
    prefs,
    (p) => {
      setPrefs(p);
      try {
        localStorage.setItem(keyFor(who), JSON.stringify(p));
      } catch {
        // Not remembered after reload; still applies now.
      }
    },
  ];
}

/** Modules in the user's order; anything they haven't placed keeps its default position at the end. */
export function ordered(sections: NavSection[], order: string[]) {
  const rank = (k: string) => {
    const i = order.indexOf(k);
    return i < 0 ? order.length + sections.findIndex((s) => s.key === k) : i;
  };
  return [...sections].sort((a, b) => rank(a.key) - rank(b.key));
}

/** Pinned pages that still exist (and the user can still open), with the module they belong to. */
export function pinned(sections: NavSection[], pins: string[]) {
  return pins.flatMap((to) => {
    const section = sections.find((s) => s.pages.some((p) => p.to === to));
    const page = section?.pages.find((p) => p.to === to);
    return section && page ? [{ section, page }] : [];
  });
}
