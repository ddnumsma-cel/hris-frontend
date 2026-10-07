// The sidebar: section headings that fold away, bookmarks (pinned pages) on top, and modules
// whose pages open underneath them. Modules stay open until the user closes them, and the open
// ones are remembered with the sidebar prefs.
// This is the sidebar's expanded state (260px); the toggle at the top switches to the compact
// icon rail (RailNav).

import { useState, type CSSProperties } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "@/features/auth/AuthContext";
import { ChevronDownIcon, ChevronRightIcon, EditIcon, PinIcon, SidebarCollapseIcon, SlidersIcon } from "@/components/icons";
import { BrandName, WorkspaceLabel } from "./Brand";
import { CreateMenu } from "./CreateMenu";
import { CustomizeNavDialog } from "./CustomizeNavDialog";
import { isItemActive, toSections } from "./navItems";
import { ordered, pinned, type NavPrefs } from "./navPrefs";
import type { CreateGroup, SideNavGroup, SideNavItem } from "./SideNav";

/** The workspace Home is the item that ends exactly at the workspace root. */
const isHomeItem = (i: SideNavItem) => !!i.end && !i.children;
/** A section holding exactly one module (a page with sub-pages). */
const isModuleGroup = (g: SideNavGroup) => g.items.length === 1 && !!g.items[0]!.children;

function Heading({ title, open, onToggle, onEdit }: { title: string; open: boolean; onToggle: () => void; onEdit?: () => void }) {
  return (
    <div className="mt-4 mb-1 flex items-center gap-1">
      {/* Starts at the same 12px inset as the page rows; the fold arrow sits on the right like a module's. */}
      <button type="button" onClick={onToggle} aria-expanded={open} className="sidebar-heading flex min-h-7 flex-1 items-center gap-1.5 rounded-[var(--radius-control)] pr-2 pl-3 text-left text-xs font-semibold text-[var(--nav-label)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-hover-text)]">
        {title}
        <ChevronDownIcon className={clsx("ml-auto h-3.5 w-3.5 flex-none transition-transform", !open && "-rotate-90")} />
      </button>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`} className="flex h-7 w-7 flex-none items-center justify-center rounded-[var(--radius-control)] text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]">
          <EditIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function FullNav({
  groups,
  create,
  prefs,
  setPrefs,
  onCollapse,
}: {
  groups: SideNavGroup[];
  create?: CreateGroup[];
  prefs: NavPrefs;
  setPrefs: (p: NavPrefs) => void;
  /** Switches to the compact icon rail. */
  onCollapse: () => void;
}) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [customizing, setCustomizing] = useState(false);
  // Modules stay open until the user closes them (several can be open), and are remembered
  // across visits. The one holding the current page opens by itself.
  const activeModule = groups.flatMap((g) => g.items).find((i) => i.children && isItemActive(i, pathname))?.to ?? null;
  const [expanded, setExpanded] = useState<string[]>(() =>
    activeModule && !prefs.opened.includes(activeModule) ? [...prefs.opened, activeModule] : prefs.opened,
  );
  const [seen, setSeen] = useState(activeModule);
  if (seen !== activeModule) {
    setSeen(activeModule);
    if (activeModule && !expanded.includes(activeModule)) setExpanded([...expanded, activeModule]);
  }
  const toggleModule = (to: string) => {
    const next = expanded.includes(to) ? expanded.filter((x) => x !== to) : [...expanded, to];
    setExpanded(next);
    setPrefs({ ...prefs, opened: next });
  };
  const sections = toSections(groups);
  const pins = pinned(sections, prefs.pins);
  // Groups follow the user's module order.
  const rank = (g: SideNavGroup) => {
    const keys = ordered(sections, prefs.order).map((s) => s.key);
    const k = g.items.length === 1 && g.items[0]!.children ? g.items[0]!.to : g.short ? g.title : g.items[0]?.to;
    const i = keys.indexOf(k ?? "");
    return i < 0 ? 99 : i;
  };
  // Home always sits at the very top, above Bookmarks; groups left empty are dropped.
  const homeItems = groups.flatMap((g) => g.items.filter(isHomeItem));
  const sorted = [...groups]
    .map((g) => ({ ...g, items: g.items.filter((i) => !isHomeItem(i)) }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => rank(a) - rank(b));
  const isCollapsed = (t: string) => prefs.collapsed.includes(t);
  const toggle = (t: string) => setPrefs({ ...prefs, collapsed: isCollapsed(t) ? prefs.collapsed.filter((x) => x !== t) : [...prefs.collapsed, t] });
  // Each row's position, for the staggered label animation when the drawer opens.
  let row = 0;
  const stagger = () => ({ "--i": row++ }) as CSSProperties;

  return (
    <aside
      data-tour="sidenav"
      className={clsx(
        "sidebar sidebar-desktop sidebar-full no-scrollbar hidden whitespace-nowrap sm:sticky sm:top-0 sm:-mt-[var(--topbar-h)] sm:flex sm:h-dvh sm:w-[var(--sidenav-w)] sm:flex-none sm:flex-col sm:self-start sm:overflow-hidden sm:border-r sm:border-[var(--sb-border)]",
      )}
    >
      {user && (
        <div className="relative flex h-20 flex-none flex-col items-center justify-center gap-1 border-b border-[var(--sb-border)] px-2 text-center">
          <BrandName />
          <WorkspaceLabel role={user.role} variant="caption" />
          <button type="button" aria-label="Collapse sidebar" aria-expanded title="Collapse sidebar" onClick={onCollapse} className="sidebar-button absolute top-2 right-2 h-7 w-7">
            <SidebarCollapseIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {create && create.length > 0 && (
          <div className="pt-2">
            <CreateMenu groups={create} />
          </div>
        )}
        {homeItems.length > 0 && (
          <ul className="flex flex-col gap-0.5 pt-2">
            {homeItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} style={stagger()} className="sidebar-item !py-1">
                  <span className="sidebar-icon">{item.icon}</span>
                  <span className="sidebar-label truncate">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        )}
        <Heading title="Bookmarks" open={!isCollapsed("Bookmarks")} onToggle={() => toggle("Bookmarks")} onEdit={() => setCustomizing(true)} />
        {!isCollapsed("Bookmarks") && (
          <ul className="flex flex-col gap-0.5">
            {pins.length === 0 && (
              <li>
                <button type="button" onClick={() => setCustomizing(true)} className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-1.5 text-left text-xs text-[var(--sb-muted)] hover:bg-[var(--sb-hover)]">
                  <PinIcon className="h-3.5 w-3.5" />
                  Pin the pages you use daily
                </button>
              </li>
            )}
            {pins.map(({ page, section }) => (
              <li key={page.to}>
                <NavLink to={page.to} end={page.end} title={`${section.label} › ${page.label}`} style={stagger()} className="sidebar-item !py-1">
                  <span className="sidebar-icon">{section.icon}</span>
                  <span className="sidebar-label truncate">{page.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        )}

        {sorted.map((g, i) => {
          // A section that is just one module: shown as a row with the module's icon (so a folded
          // section still reads as a place you can open), and its pages sit right under it.
          const module = isModuleGroup(g) ? g.items[0] : undefined;
          if (module) {
            // Module rows stacked together read as one list (2px apart); the first one after a
            // group gets the same 16px a group heading has.
            const afterModule = i > 0 && isModuleGroup(sorted[i - 1]!);
            const isOpen = expanded.includes(module.to);
            const current = module.children!.find((c) => isItemActive(c, pathname));
            return (
              <div key={g.title} className={afterModule ? "mt-0.5" : "mt-4"}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggleModule(module.to)}
                  data-child-active={!!current}
                 
                  style={stagger()}
                  className="sidebar-item !py-1"
                >
                  <span className="sidebar-icon">{module.icon}</span>
                  <span className="sidebar-label flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{g.title}</span>
                    {current && !isOpen && <span className="truncate text-xs font-normal text-[var(--sb-muted)]">{current.label}</span>}
                  </span>
                  <ChevronRightIcon className={clsx("sidebar-chevron h-3.5 w-3.5 flex-none text-[var(--sb-muted)] transition-transform", isOpen && "rotate-90")} />
                </button>
                {isOpen && (
                  <ul className="mt-0.5 mb-1 ml-[22px] flex flex-col gap-0.5 border-l border-[var(--sb-border)] pl-[7px]">
                    {module.children!.map((c) => (
                      <li key={c.to}>
                        <NavLink to={c.to} end={c.end} style={stagger()} className="sidebar-item sidebar-subitem !py-0.5">
                          <span className="sidebar-label truncate">{c.label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }
          return (
          <div key={g.title}>
            <Heading title={g.title} open={!isCollapsed(g.title)} onToggle={() => toggle(g.title)} />
            {!isCollapsed(g.title) && (
              <ul className="flex flex-col gap-0.5">
                {g.items.map((item) => {
                  if (!item.children) {
                    return (
                      <li key={item.to}>
                        <NavLink to={item.to} end={item.end} style={stagger()} className="sidebar-item !py-1">
                          <span className="sidebar-icon">{item.icon}</span>
                          <span className="sidebar-label truncate">{item.label}</span>
                        </NavLink>
                      </li>
                    );
                  }
                  const active = isItemActive(item, pathname);
                  const current = item.children.find((c) => isItemActive(c, pathname));
                  const isOpen = expanded.includes(item.to);
                  return (
                    <li key={item.to}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggleModule(item.to)}
                        data-child-active={active}
                       
                        style={stagger()}
                        className="sidebar-item !py-1"
                      >
                        <span className="sidebar-icon">{item.icon}</span>
                        <span className="sidebar-label flex min-w-0 flex-1 flex-col">
                          <span className="truncate">{item.label}</span>
                          {current && !isOpen && <span className="truncate text-xs font-normal text-[var(--sb-muted)]">{current.label}</span>}
                        </span>
                        <ChevronRightIcon className={clsx("sidebar-chevron h-3.5 w-3.5 flex-none text-[var(--sb-muted)] transition-transform", isOpen && "rotate-90")} />
                      </button>
                      {isOpen && (
                        <ul className="mt-0.5 mb-1 ml-[22px] flex flex-col gap-0.5 border-l border-[var(--sb-border)] pl-[7px]">
                          {item.children.map((c) => (
                            <li key={c.to}>
                              <NavLink to={c.to} end={c.end} style={stagger()} className="sidebar-item sidebar-subitem !py-0.5">
                                <span className="sidebar-label truncate">{c.label}</span>
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          );
        })}
      </div>

      <div className="flex-none border-t border-[var(--sb-border)] px-2 py-2">
        <button type="button" onClick={() => setCustomizing(true)} className="sidebar-item !py-1">
          <span className="sidebar-icon">
            <SlidersIcon />
          </span>
          <span className="sidebar-label">Menu settings</span>
        </button>
      </div>

      {customizing && <CustomizeNavDialog sections={sections} prefs={prefs} onSave={setPrefs} onClose={() => setCustomizing(false)} />}
    </aside>
  );
}
