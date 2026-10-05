import type { ReactNode } from "react";
import type { SideNavGroup, SideNavItem } from "./SideNav";

export function isItemActive(item: SideNavItem, pathname: string): boolean {
  if (item.children) return item.children.some((child) => isItemActive(child, pathname));
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export interface NavSection {
  key: string;
  label: string;
  short: string;
  icon?: ReactNode;
  pages: SideNavItem[];
}

/** A group that is one module with sub-pages becomes that module; any other group lists its items. */
export function toSections(groups: SideNavGroup[]): NavSection[] {
  return groups.map((g) => {
    const only = g.items.length === 1 ? g.items[0]! : null;
    if (only?.children) return { key: only.to, label: only.label, short: g.short ?? only.label, icon: g.icon ?? only.icon, pages: only.children };
    return { key: g.title, label: g.title, short: g.short ?? g.title, icon: g.icon ?? g.items[0]?.icon, pages: g.items };
  });
}
