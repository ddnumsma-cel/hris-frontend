import type { ReactNode } from "react";
import type { SideNavGroup, SideNavItem } from "./SideNav";

export function isItemActive(item: SideNavItem, pathname: string): boolean {
  if (item.children) return item.children.some((child) => isItemActive(child, pathname));
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/** The workspace Home: a single page ending exactly at the workspace root. */
export const isHome = (s: NavSection) => s.pages.length === 1 && !!s.pages[0]!.end;

export interface NavSection {
  key: string;
  label: string;
  short: string;
  icon?: ReactNode;
  pages: SideNavItem[];
}

/**
 * Rail icons: a group with a short name is one icon (its module's pages pop out);
 * a group without one shows each of its items as its own icon.
 */
export function toSections(groups: SideNavGroup[]): NavSection[] {
  return groups.flatMap((g) => {
    if (!g.short) return g.items.map((i) => ({ key: i.to, label: i.label, short: i.short ?? i.label, icon: i.icon, pages: i.children ?? [i] }));
    const only = g.items.length === 1 ? g.items[0]! : null;
    if (only?.children) return [{ key: only.to, label: only.label, short: g.short, icon: g.icon ?? only.icon, pages: only.children }];
    return [{ key: g.title, label: g.title, short: g.short, icon: g.icon ?? g.items[0]?.icon, pages: g.items }];
  });
}
