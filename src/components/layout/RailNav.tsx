// Icon rail: one icon per module, always short enough to fit the screen.
// Hovering (or focusing) a module shows its pages in a panel beside the rail;
// clicking the icon opens the module's first page.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { PinIcon, SlidersIcon } from "@/components/icons";
import { CustomizeNavDialog } from "./CustomizeNavDialog";
import { isItemActive, toSections, type NavSection } from "./navItems";
import { ordered, pinned, type NavPrefs } from "./navPrefs";
import type { SideNavGroup } from "./SideNav";

const sectionActive = (s: NavSection, pathname: string) => s.pages.some((p) => isItemActive(p, pathname));

export function RailNav({ groups, prefs, setPrefs }: { groups: SideNavGroup[]; prefs: NavPrefs; setPrefs: (p: NavPrefs) => void }) {
  const { pathname } = useLocation();
  const [customizing, setCustomizing] = useState(false);
  const all = toSections(groups);
  const sections = ordered(all, prefs.order);
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

  const show = (s: NavSection, el: HTMLElement) => {
    window.clearTimeout(closeTimer.current);
    const r = el.getBoundingClientRect();
    const height = 44 + s.pages.length * 38;
    setOpen({ key: s.key, top: Math.max(8, Math.min(r.top, window.innerHeight - height - 8)) });
  };
  // A short delay lets the pointer travel from the icon to the panel.
  const hide = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(null), 180);
  };
  const keep = () => window.clearTimeout(closeTimer.current);
  const openSection = sections.find((s) => s.key === open?.key);

  return (
    <aside
      data-tour="sidenav"
      className="sidebar sidebar-desktop sidebar-rail no-scrollbar hidden sm:sticky sm:top-0 sm:-mt-[var(--topbar-h)] sm:flex sm:h-dvh sm:w-[var(--sidenav-w)] sm:flex-none sm:flex-col sm:items-center sm:self-start sm:overflow-y-auto sm:border-r sm:border-[var(--sb-border)]"
    >
      <div className="flex w-full flex-none justify-center border-b border-[var(--sb-border)] px-2 pt-5 pb-4">
        <img src="/brand/heyhr-wordmark.svg" alt="HeyHR" className="brand-wordmark !h-[19px]" />
      </div>
      {pins.length > 0 && (
        <nav aria-label="Pinned" className="flex w-full flex-none flex-col items-center gap-0.5 border-b border-[var(--sb-border)] py-2">
          <span className="flex items-center gap-1 text-[9.5px] font-semibold tracking-wide text-[var(--sb-muted)] uppercase">
            <PinIcon className="h-2.5 w-2.5" />
            Pinned
          </span>
          {pins.map(({ section, page }) => (
            <NavLink key={page.to} to={page.to} end={page.end} title={`${section.label} › ${page.label}`} className="group flex w-16 flex-col items-center gap-0.5 rounded-xl py-1">
              {({ isActive }) => (
                <>
                  <span
                    className={clsx("flex h-8 w-8 items-center justify-center rounded-lg transition-colors [&>svg]:h-4 [&>svg]:w-4", isActive ? "text-[var(--sb-lime)]" : "bg-[var(--sb-hover)] text-[var(--sb-text)] group-hover:text-[var(--sb-text)]")}
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
        {sections.map((s) => {
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
              className="group flex w-16 flex-col items-center gap-1 rounded-xl py-1.5"
            >
              <span
                className={clsx(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-colors [&>svg]:h-[18px] [&>svg]:w-[18px]",
                  active ? "text-[var(--sb-lime)] shadow-[0_6px_16px_-6px_var(--sb-active-glow)]" : isOpen ? "bg-[var(--sb-hover)] text-[var(--sb-text)]" : "text-[var(--sb-muted)] group-hover:bg-[var(--sb-hover)] group-hover:text-[var(--sb-text)]",
                )}
                style={active ? { background: "var(--sb-active-bg)" } : undefined}
              >
                {s.icon}
              </span>
              <span className={clsx("w-full truncate px-0.5 text-center text-[10.5px] leading-tight", active ? "font-semibold text-[var(--sb-text)]" : "text-[var(--sb-muted)]")}>{s.short}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto flex w-full flex-none justify-center border-t border-[var(--sb-border)] py-2.5">
        <button type="button" onClick={() => setCustomizing(true)} title="Pin your daily pages and reorder the menu" className="group flex w-16 flex-col items-center gap-1 rounded-xl py-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--sb-muted)] transition-colors group-hover:bg-[var(--sb-hover)] group-hover:text-[var(--sb-text)] [&>svg]:h-[18px] [&>svg]:w-[18px]">
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
            className="sidebar fixed z-50 flex w-56 flex-col gap-0.5 rounded-xl border border-[var(--sb-border)] !bg-surface p-2 shadow-xl"
            style={{ top: open!.top, left: "calc(var(--sidenav-w) + 0.5rem)" }}
          >
            <div className="mb-1 px-2 pt-1 text-xs font-semibold text-[var(--sb-muted)]">{openSection.label}</div>
            {openSection.pages.map((p) => (
              <NavLink key={p.to} to={p.to} end={p.end} role="menuitem" className="sidebar-item">
                {({ isActive }) => (
                  <>
                    <span className="truncate">{p.label}</span>
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
