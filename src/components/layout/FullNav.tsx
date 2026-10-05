// Full sidebar: section headings that fold away, bookmarks (pinned pages) on
// top, and modules whose pages open in a panel beside the sidebar on hover.
// Nothing expands inside the list, so it stays short enough not to scroll.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "@/features/auth/AuthContext";
import { ChevronDownIcon, ChevronRightIcon, EditIcon, PinIcon, SlidersIcon } from "@/components/icons";
import { BrandName, WorkspaceLabel } from "./Brand";
import { CustomizeNavDialog } from "./CustomizeNavDialog";
import { isItemActive, toSections } from "./navItems";

/** The workspace home (Overview) is the item that ends exactly at the workspace root. */
const isHomeItem = (i: SideNavItem) => !!i.end && !i.children;
import { ordered, pinned, type NavPrefs } from "./navPrefs";
import type { SideNavGroup, SideNavItem } from "./SideNav";

function Heading({ title, open, onToggle, onEdit }: { title: string; open: boolean; onToggle: () => void; onEdit?: () => void }) {
  return (
    <div className="flex items-center gap-1 px-2 pt-3 pb-1">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-semibold tracking-wide text-[var(--sb-muted)] uppercase hover:text-[var(--sb-text)]">
        <ChevronDownIcon className={clsx("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
        {title}
      </button>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`} className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]">
          <EditIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function FullNav({ groups, prefs, setPrefs }: { groups: SideNavGroup[]; prefs: NavPrefs; setPrefs: (p: NavPrefs) => void }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [customizing, setCustomizing] = useState(false);
  const [open, setOpen] = useState<{ item: SideNavItem; top: number } | null>(null);
  const closeTimer = useRef(0);
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) {
    setSeen(pathname);
    setOpen(null);
  }
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const sections = toSections(groups);
  const pins = pinned(sections, prefs.pins);
  // Groups follow the user's module order.
  const rank = (g: SideNavGroup) => {
    const keys = ordered(sections, prefs.order).map((s) => s.key);
    const k = g.items.length === 1 && g.items[0]!.children ? g.items[0]!.to : g.short ? g.title : g.items[0]?.to;
    const i = keys.indexOf(k ?? "");
    return i < 0 ? 99 : i;
  };
  // Home (Overview) always sits at the very top, above Bookmarks; groups left empty are dropped.
  const homeItems = groups.flatMap((g) => g.items.filter(isHomeItem));
  const sorted = [...groups]
    .map((g) => ({ ...g, items: g.items.filter((i) => !isHomeItem(i)) }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => rank(a) - rank(b));
  const isCollapsed = (t: string) => prefs.collapsed.includes(t);
  const toggle = (t: string) => setPrefs({ ...prefs, collapsed: isCollapsed(t) ? prefs.collapsed.filter((x) => x !== t) : [...prefs.collapsed, t] });

  const show = (item: SideNavItem, el: HTMLElement) => {
    window.clearTimeout(closeTimer.current);
    const r = el.getBoundingClientRect();
    const height = 44 + (item.children?.length ?? 0) * 38;
    setOpen({ item, top: Math.max(8, Math.min(r.top - 6, window.innerHeight - height - 8)) });
  };
  const hide = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(null), 180);
  };
  const keep = () => window.clearTimeout(closeTimer.current);

  return (
    <aside data-tour="sidenav" className="sidebar sidebar-desktop sidebar-full no-scrollbar hidden sm:sticky sm:top-0 sm:-mt-[var(--topbar-h)] sm:flex sm:h-dvh sm:w-[var(--sidenav-w)] sm:flex-none sm:flex-col sm:self-start sm:overflow-y-auto sm:border-r sm:border-[var(--sb-border)]">
      {user && (
        <div className="flex flex-none flex-col items-center gap-1.5 border-b border-[var(--sb-border)] px-2 pt-4 pb-3 text-center">
          <BrandName />
          <WorkspaceLabel role={user.role} variant="caption" />
        </div>
      )}

      <div className="flex-1 px-2 pb-2">
        {homeItems.length > 0 && (
          <ul className="flex flex-col gap-0.5 pt-3">
            {homeItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className="sidebar-item !py-1.5">
                  {({ isActive }) => (
                    <>
                      <span className="sidebar-icon">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                      {isActive && (
                        <span className="sidebar-active-chevron" aria-hidden="true">
                          ›
                        </span>
                      )}
                    </>
                  )}
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
                <button type="button" onClick={() => setCustomizing(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--sb-muted)] hover:bg-[var(--sb-hover)]">
                  <PinIcon className="h-3.5 w-3.5" />
                  Pin the pages you use daily
                </button>
              </li>
            )}
            {pins.map(({ page, section }) => (
              <li key={page.to}>
                <NavLink to={page.to} end={page.end} title={`${section.label} › ${page.label}`} className="sidebar-item !py-1.5">
                  {({ isActive }) => (
                    <>
                      <span className="sidebar-icon">{section.icon}</span>
                      <span className="truncate">{page.label}</span>
                      {isActive && (
                        <span className="sidebar-active-chevron" aria-hidden="true">
                          ›
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        )}

        {sorted.map((g) => (
          <div key={g.title}>
            <Heading title={g.title} open={!isCollapsed(g.title)} onToggle={() => toggle(g.title)} />
            {!isCollapsed(g.title) && (
              <ul className="flex flex-col gap-0.5">
                {g.items.map((item) => {
                  if (!item.children) {
                    return (
                      <li key={item.to}>
                        <NavLink to={item.to} end={item.end} className="sidebar-item !py-1.5">
                          {({ isActive }) => (
                            <>
                              <span className="sidebar-icon">{item.icon}</span>
                              <span className="truncate">{item.label}</span>
                              {isActive && (
                                <span className="sidebar-active-chevron" aria-hidden="true">
                                  ›
                                </span>
                              )}
                            </>
                          )}
                        </NavLink>
                      </li>
                    );
                  }
                  const active = isItemActive(item, pathname);
                  const current = item.children.find((c) => isItemActive(c, pathname));
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.children[0]!.to}
                        aria-haspopup="menu"
                        aria-expanded={open?.item.to === item.to}
                        onMouseEnter={(e) => show(item, e.currentTarget)}
                        onMouseLeave={hide}
                        onFocus={(e) => show(item, e.currentTarget)}
                        onBlur={hide}
                        onKeyDown={(e) => e.key === "Escape" && setOpen(null)}
                        data-child-active={active}
                        className={clsx("sidebar-item !py-1.5", open?.item.to === item.to && "bg-[var(--sb-hover)]")}
                      >
                        <span className="sidebar-icon">{item.icon}</span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate">{item.label}</span>
                          {current && <span className="truncate text-xs font-normal text-[var(--sb-muted)]">{current.label}</span>}
                        </span>
                        <ChevronRightIcon className="h-3.5 w-3.5 flex-none text-[var(--sb-muted)]" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="flex-none border-t border-[var(--sb-border)] px-2 py-2">
        <button type="button" onClick={() => setCustomizing(true)} className="sidebar-item !py-1.5">
          <span className="sidebar-icon">
            <SlidersIcon />
          </span>
          <span>Menu settings</span>
        </button>
      </div>

      {customizing && <CustomizeNavDialog sections={sections} prefs={prefs} onSave={setPrefs} onClose={() => setCustomizing(false)} />}
      {open &&
        createPortal(
          <div role="menu" aria-label={open.item.label} onMouseEnter={keep} onMouseLeave={hide} onFocus={keep} onBlur={hide} onKeyDown={(e) => e.key === "Escape" && setOpen(null)} className="sidebar fixed z-50 flex w-56 flex-col gap-0.5 rounded-xl border border-[var(--sb-border)] !bg-surface p-2 shadow-xl" style={{ top: open.top, left: "calc(var(--sidenav-w) + 0.5rem)" }}>
            <div className="mb-1 px-2 pt-1 text-xs font-semibold text-[var(--sb-muted)]">{open.item.label}</div>
            {open.item.children!.map((c) => (
              <NavLink key={c.to} to={c.to} end={c.end} role="menuitem" className="sidebar-item">
                {({ isActive }) => (
                  <>
                    <span className="truncate">{c.label}</span>
                    {isActive && (
                      <span className="sidebar-active-chevron" aria-hidden="true">
                        ›
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>,
          document.body,
        )}
    </aside>
  );
}
