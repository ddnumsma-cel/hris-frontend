// Icon rail: the collapsed state of the sidebar. One icon per module with its name underneath;
// hovering (or focusing) a module shows its pages in a drawer beside the rail, and clicking the
// icon opens the module's first page. The toggle under the logo mark expands to the full sidebar.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { PinIcon, SidebarExpandIcon, SlidersIcon } from "@/components/icons";
import { CreateMenu } from "./CreateMenu";
import { CustomizeNavDialog } from "./CustomizeNavDialog";
import { isHome, isItemActive, toSections, type NavSection } from "./navItems";
import { ordered, pinned, type NavPrefs } from "./navPrefs";
import type { CreateGroup, SideNavGroup } from "./SideNav";

const sectionActive = (s: NavSection, pathname: string) => s.pages.some((p) => isItemActive(p, pathname));

export function RailNav({
  groups,
  create,
  prefs,
  setPrefs,
  onExpand,
}: {
  groups: SideNavGroup[];
  create?: CreateGroup[];
  prefs: NavPrefs;
  setPrefs: (p: NavPrefs) => void;
  /** Switches to the full sidebar. */
  onExpand: () => void;
}) {
  const { pathname } = useLocation();
  const [customizing, setCustomizing] = useState(false);
  const all = toSections(groups);
  // Home always comes first; the rest follow the user's order.
  const home = all.filter(isHome);
  const sections = [...home, ...ordered(all.filter((s) => !isHome(s)), prefs.order)];
  const pins = pinned(all, prefs.pins);
  const current = sections.find((s) => sectionActive(s, pathname));
  const [open, setOpen] = useState<{ key: string; top: number } | null>(null);
  const closeTimer = useRef(0);

  // Following a link closes the panel.
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) {
    setSeen(pathname);
    setOpen(null);
  }
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // The drawer opens beside the hovered module: its 48px title band lines up with the module's
  // row (the icon's centre sits 24px down, as does the band's), moved up only to stay on screen.
  const show = (s: NavSection, el: HTMLElement) => {
    window.clearTimeout(closeTimer.current);
    const r = el.getBoundingClientRect();
    // 48px title band + 8px padding above and below + 40px rows 4px apart (+2px border).
    const height = 62 + s.pages.length * 44;
    // -1 for the drawer's top border, so the band's centre meets the icon's exactly.
    setOpen({ key: s.key, top: Math.max(8, Math.min(r.top - 1, window.innerHeight - height - 8)) });
  };

  // A short delay lets the pointer travel from the icon to the panel.
  const hide = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(null), 180);
  };
  const keep = () => window.clearTimeout(closeTimer.current);
  const renderModule = (s: NavSection) => {
          const active = s.key === current?.key;
          const isOpen = s.key === open?.key;
          // A module with a single page needs no pop-out: the icon goes straight there.
          const single = s.pages.length === 1;
          return (
            <NavLink
              key={s.key}
              to={s.pages[0]!.to}
              end={s.pages[0]!.end}
              aria-label={s.label}
              aria-haspopup={single ? undefined : "menu"}
              aria-expanded={single ? undefined : isOpen}
              onMouseEnter={(e) => (single ? hide() : show(s, e.currentTarget))}
              onMouseLeave={hide}
              onFocus={(e) => (single ? hide() : show(s, e.currentTarget))}
              onBlur={hide}
              onKeyDown={(e) => e.key === "Escape" && setOpen(null)}
              className="group flex w-18 flex-col items-center gap-1 rounded-xl py-1.5"
            >
              <span
                className={clsx(
                  "flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] transition-colors [&>svg]:h-[18px] [&>svg]:w-[18px]",
                  active ? "text-[var(--nav-active-icon)] shadow-[var(--shadow-logo)]" : isOpen ? "bg-[var(--sb-hover)] text-[var(--sb-text)]" : "text-[var(--sb-muted)] group-hover:bg-[var(--sb-hover)] group-hover:text-[var(--sb-text)]",
                )}
                style={active ? { background: "var(--sb-active-bg)" } : undefined}
              >
                {s.icon}
              </span>
              <span className={clsx("w-full truncate px-0.5 text-center text-[10.5px] leading-tight", active ? "font-semibold text-[var(--sb-text)]" : "text-[var(--sb-muted)]")}>{s.short}</span>
            </NavLink>
          );
  };
  const openSection = sections.find((s) => s.key === open?.key);

  return (
    <aside
      data-tour="sidenav"
      className="sidebar sidebar-desktop sidebar-rail sidebar-collapsed no-scrollbar hidden sm:sticky sm:top-0 sm:-mt-[var(--topbar-h)] sm:flex sm:h-dvh sm:w-[var(--sidenav-w)] sm:flex-none sm:flex-col sm:items-center sm:self-start sm:overflow-y-auto sm:border-r sm:border-[var(--sb-border)]"
    >
      {/* Logo mark and the expand toggle, in an 80px block like the full sidebar's, so the line
          under it stays put when switching. */}
      <div className="flex h-20 w-full flex-none flex-col items-center justify-center gap-2 border-b border-[var(--sb-border)]">
        <img src="/favicon.svg" alt="HeyHR" className="h-7 w-7" />
        <button type="button" aria-label="Expand sidebar" aria-expanded={false} title="Expand sidebar" onClick={onExpand} className="sidebar-button h-7 w-7">
          <SidebarExpandIcon className="h-4 w-4" />
        </button>
      </div>
      {create && create.length > 0 && (
        <div className="flex w-full flex-none justify-center pt-3">
          <CreateMenu groups={create} variant="rail" onOpen={() => setOpen(null)} />
        </div>
      )}
      {home.length > 0 && <nav aria-label="Home" className="flex flex-none flex-col items-center gap-1 pt-3">{home.map(renderModule)}</nav>}
      {pins.length > 0 && (
        <nav aria-label="Pinned" className="flex w-full flex-none flex-col items-center gap-0.5 border-b border-[var(--sb-border)] py-2">
          <span className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.1em] text-[var(--nav-label)] uppercase">
            <PinIcon className="h-2.5 w-2.5" />
            Pinned
          </span>
          {pins.map(({ section, page }) => (
            <NavLink key={page.to} to={page.to} end={page.end} title={`${section.label} › ${page.label}`} className="group flex w-18 flex-col items-center gap-0.5 rounded-xl py-1">
              {({ isActive }) => (
                <>
                  <span
                    className={clsx("flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] transition-colors [&>svg]:h-4 [&>svg]:w-4", isActive ? "text-[var(--nav-active-icon)] shadow-[var(--shadow-logo)]" : "bg-[var(--sb-hover)] text-[var(--sb-text)] group-hover:text-[var(--sb-text)]")}
                    style={isActive ? { background: "var(--sb-active-bg)" } : undefined}
                  >
                    {section.icon}
                  </span>
                  <span className={clsx("w-full truncate px-0.5 text-center text-[10px] leading-tight", isActive ? "font-semibold text-[var(--sb-text)]" : "text-[var(--sb-muted)]")}>{page.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
      <nav aria-label="Modules" className="flex flex-col items-center gap-1 py-3">
        {sections.filter((s) => !isHome(s)).map(renderModule)}
      </nav>

      <div className="mt-auto flex w-full flex-none justify-center border-t border-[var(--sb-border)] py-2.5">
        <button type="button" onClick={() => setCustomizing(true)} title="Pin your daily pages and reorder the menu" className="group flex w-18 flex-col items-center gap-1 rounded-xl py-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-[var(--sb-muted)] transition-colors group-hover:bg-[var(--sb-hover)] group-hover:text-[var(--sb-text)] [&>svg]:h-[18px] [&>svg]:w-[18px]">
            <SlidersIcon />
          </span>
          <span className="text-[10.5px] leading-tight text-[var(--sb-muted)]">Customize</span>
        </button>
      </div>
      {customizing && <CustomizeNavDialog sections={all} prefs={prefs} onSave={setPrefs} onClose={() => setCustomizing(false)} />}

      {/* In a portal: the sidebar's backdrop blur would otherwise trap the fixed panel inside it. */}
      {openSection &&
        createPortal(
          <div
            role="menu"
            aria-label={openSection.label}
            onMouseEnter={keep}
            onMouseLeave={hide}
            onFocus={keep}
            onBlur={hide}
            onKeyDown={(e) => e.key === "Escape" && setOpen(null)}
            className="sidebar glass-surface fixed left-[var(--sidenav-w)] z-50 flex max-h-[calc(100dvh-1rem)] w-max max-w-80 min-w-60 flex-col overflow-y-auto rounded-r-[var(--radius-dropdown)] !border-l-0 !bg-transparent !shadow-[var(--shadow-drawer)] !backdrop-filter-none"
            style={{ top: open!.top }}
          >
            {/* Drawer attached to the rail beside the hovered module, as tall as its pages. */}
            <div className="flex h-12 flex-none items-center border-b border-[var(--sb-border)] px-5 text-[15px] leading-5 font-semibold text-[var(--text)]">
              {/* One line, so the band stays 48px; the drawer widens to fit (up to 320px). */}
              <span className="truncate whitespace-nowrap" title={openSection.label}>
                {openSection.label}
              </span>
            </div>
            <div className="flex flex-col gap-1 p-2">
              {openSection.pages.map((p) => (
                <NavLink key={p.to} to={p.to} end={p.end} role="menuitem" className="sidebar-item min-h-10 text-[13.5px]">
                  <span className="truncate">{p.label}</span>
                </NavLink>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </aside>
  );
}
