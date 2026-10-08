import { useState, type CSSProperties, type ReactNode } from "react";
import type { Action, Feature } from "@/lib/permissions";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { ChevronDownIcon, MenuIcon, SidebarCollapseIcon, SidebarExpandIcon, XIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/AuthContext";
import { BrandName, WorkspaceLabel } from "./Brand";
import { CreateMenu } from "./CreateMenu";
import { isItemActive } from "./navItems";
import { useSidebarCollapsed } from "./sidebarState";
import { useSidebarTips } from "./SidebarTip";

export interface SideNavItem {
  label: string;
  to: string;
  icon?: ReactNode;
  end?: boolean;
  /** Short name for the icon rail. */
  short?: string;
  /** Sub-pages shown in a collapsible list under this item. */
  children?: SideNavItem[];
}

/** A column in the sidebar's Create menu: a heading and short links, like an accounting app's "+ New". */
export interface CreateGroup {
  title: string;
  /** `action` / `feature`: what the link is for, when more than viewing its page (checked against the access matrix). */
  items: { label: string; to: string; action?: Action; feature?: Feature }[];
}

export interface SideNavGroup {
  title: string;
  items: SideNavItem[];
  /** Set to show the whole group as one icon on the rail, with its pages in a pop-out. */
  short?: string;
  icon?: ReactNode;
}



function NavItemLink({ item, onNavigate, style }: { item: SideNavItem; onNavigate?: () => void; style?: CSSProperties }) {
  return (
    <NavLink to={item.to} end={item.end} onClick={onNavigate} data-tip={item.label} style={style} className="sidebar-item">
      <span className="sidebar-icon">{item.icon}</span>
      <span className="sidebar-label truncate">{item.label}</span>
    </NavLink>
  );
}

function NavItemWithChildren({ item, open, onToggle, onNavigate, style }: { item: SideNavItem; open: boolean; onToggle: () => void; onNavigate?: () => void; style?: CSSProperties }) {
  const { pathname } = useLocation();
  const childActive = isItemActive(item, pathname);
  const listId = `subnav-${item.to.replace(/\W+/g, "-")}`;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        data-child-active={childActive}
        onClick={onToggle}
        data-tip={item.label}
        style={style}
        className="sidebar-item"
      >
        <span className="sidebar-icon">{item.icon}</span>
        <span className="sidebar-label truncate">{item.label}</span>
        <ChevronDownIcon className="sidebar-expand sidebar-chevron" />
      </button>
      {open && (
        <ul id={listId} className="sidebar-sublist">
          {item.children!.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                end={child.end}
                onClick={onNavigate}
                style={style}
                className="sidebar-item sidebar-subitem"
              >
                <span className="sidebar-label truncate">{child.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Dropdowns stay open until the user closes them; several can be open at once.
 * `collapsed` (desktop icon rail): section labels become thin dividers, pages under a dropdown
 * are hidden, and a dropdown's icon calls `onExpand` to open the sidebar with it open.
 */
function NavGroupList({ groups, onNavigate, collapsed = false, onExpand }: { groups: SideNavGroup[]; onNavigate?: () => void; collapsed?: boolean; onExpand?: () => void }) {
  const { pathname } = useLocation();
  const activeParent = groups.flatMap((g) => g.items).find((i) => i.children && isItemActive(i, pathname))?.to ?? null;
  const [openTos, setOpenTos] = useState<string[]>(activeParent ? [activeParent] : []);
  // Moving to a page inside another dropdown opens that one too, without closing the rest.
  const [seenParent, setSeenParent] = useState(activeParent);
  if (seenParent !== activeParent) {
    setSeenParent(activeParent);
    if (activeParent && !openTos.includes(activeParent)) setOpenTos([...openTos, activeParent]);
  }
  const toggle = (to: string) => {
    if (collapsed) {
      if (!openTos.includes(to)) setOpenTos([...openTos, to]);
      return onExpand?.();
    }
    setOpenTos(openTos.includes(to) ? openTos.filter((x) => x !== to) : [...openTos, to]);
  };
  // Each row's position, for the staggered label animation when the sidebar opens.
  let row = 0;
  const stagger = () => ({ "--i": row++ }) as CSSProperties;
  return (
    <>
      {groups.map((group) => (
        <div key={group.title}>
          {collapsed ? <hr aria-hidden="true" className="mx-3 my-2 border-[var(--line)]" /> : <div className="sidebar-section-label">{group.title}</div>}
          <ul className="sidebar-list">
            {group.items.map((item) => (
              <li key={item.label}>
                {item.children ? (
                  <NavItemWithChildren item={item} open={openTos.includes(item.to) && !collapsed} onToggle={() => toggle(item.to)} onNavigate={onNavigate} style={stagger()} />
                ) : (
                  <NavItemLink item={item} onNavigate={onNavigate} style={stagger()} />
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** Pass desktop={false} when another component draws the desktop sidebar; the phone menu still comes from here.
 *  `create` adds a Create menu to the desktop sidebar. */
export function SideNav({ groups, desktop = true, create }: { groups: SideNavGroup[]; desktop?: boolean; create?: CreateGroup[] }) {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const tips = useSidebarTips(collapsed);

  const allItems = groups.flatMap((g) => g.items.flatMap((item) => item.children ?? [item]));
  const activeItem = allItems.find((item) => isItemActive(item, location.pathname));

  return (
    <>
      {/* Mobile: compact trigger bar + slide-in drawer */}
      <div className="sidebar flex items-center justify-between border-b border-[var(--sb-border)] px-3 py-2.5 sm:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2.5 rounded-lg font-semibold tracking-[-0.01em]"
        >
          <MenuIcon className="h-[17px] w-[17px] text-[var(--sb-muted)]" strokeWidth={1.8} />
          {activeItem?.label ?? "Menu"}
        </button>
      </div>

      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="overlay-backdrop fixed inset-0 z-40 sm:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className={clsx(
              "sidebar sidebar-panel fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] overflow-y-auto",
              "border-r border-[var(--sb-border)] sm:hidden",
            )}
          >
            <div className="flex items-center justify-between pl-2">
              <span className="sidebar-section-label mb-0 p-0">Menu</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="sidebar-button h-7 w-7"
              >
                <XIcon className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
            <NavGroupList groups={groups} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      {desktop && (
      /* Desktop: full-height sticky sidebar. It's pulled up beside the top bar,
          which leaves this column free (see .sidebar-desktop in index.css). */
      <aside
        data-tour="sidenav"
        {...tips.handlers}
        className={clsx(
          "sidebar sidebar-desktop hidden no-scrollbar whitespace-nowrap",
          "sm:flex sm:flex-col sm:px-2 sm:pb-3 sm:sticky sm:top-0 sm:-mt-[var(--topbar-h)] sm:h-dvh sm:w-[var(--sidenav-w)] sm:flex-none sm:self-start",
          "sm:overflow-x-hidden sm:overflow-y-auto sm:border-r sm:border-[var(--sb-border)]",
          collapsed && "sidebar-collapsed",
        )}
      >
        {user && (
          <div className="relative -mx-2 flex h-20 flex-none flex-col items-center justify-center gap-1 border-b border-[var(--sb-border)] px-2 text-center">
            {collapsed ? (
              <>
                <img src="/favicon.svg" alt="HeyHR" className="h-7 w-7" />
                <button type="button" aria-label="Expand sidebar" aria-expanded={false} onClick={() => setCollapsed(false)} className="sidebar-button h-7 w-7">
                  <SidebarExpandIcon className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <BrandName />
                <WorkspaceLabel role={user.role} variant="caption" />
                <button type="button" aria-label="Collapse sidebar" aria-expanded onClick={() => setCollapsed(true)} className="sidebar-button absolute top-2 right-2 h-7 w-7">
                  <SidebarCollapseIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}
        <div className="flex flex-col gap-5 pt-3">
          {create && create.length > 0 && <CreateMenu groups={create} />}
          <NavGroupList groups={groups} collapsed={collapsed} onExpand={() => setCollapsed(false)} />
        </div>
        {tips.element}
      </aside>
      )}
    </>
  );
}
