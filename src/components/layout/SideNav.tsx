import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { ChevronDownIcon, MenuIcon, XIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/AuthContext";
import { BrandName, WorkspaceLabel } from "./Brand";
import { isItemActive } from "./navItems";

export interface SideNavItem {
  label: string;
  to: string;
  icon?: ReactNode;
  end?: boolean;
  /** Sub-pages shown in a collapsible list under this item. */
  children?: SideNavItem[];
}

export interface SideNavGroup {
  title: string;
  items: SideNavItem[];
  /** Short name for tight places, e.g. the icon rail. */
  short?: string;
  icon?: ReactNode;
}


/** Lime "›" marker shown on the selected item. Styling is in index.css (.sidebar-*). */
function ActiveChevron() {
  return (
    <span className="sidebar-active-chevron" aria-hidden="true">
      ›
    </span>
  );
}

function NavItemLink({ item, onNavigate }: { item: SideNavItem; onNavigate?: () => void }) {
  return (
    <NavLink to={item.to} end={item.end} onClick={onNavigate} className="sidebar-item">
      {({ isActive }) => (
        <>
          <span className="sidebar-icon">{item.icon}</span>
          <span className="truncate">{item.label}</span>
          {isActive && <ActiveChevron />}
        </>
      )}
    </NavLink>
  );
}

function NavItemWithChildren({ item, open, onToggle, onNavigate }: { item: SideNavItem; open: boolean; onToggle: () => void; onNavigate?: () => void }) {
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
        className="sidebar-item"
      >
        <span className="sidebar-icon">{item.icon}</span>
        <span className="truncate">{item.label}</span>
        <ChevronDownIcon className="sidebar-expand" />
      </button>
      {open && (
        <ul id={listId} className="sidebar-sublist">
          {item.children!.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                end={child.end}
                onClick={onNavigate}
                className="sidebar-item sidebar-subitem"
              >
                {({ isActive }) => (
                  <>
                    <span className="truncate">{child.label}</span>
                    {isActive && <ActiveChevron />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Only one dropdown is open at a time. Opening one closes the others, even one whose page is showing. */
function NavGroupList({ groups, onNavigate }: { groups: SideNavGroup[]; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const activeParent = groups.flatMap((g) => g.items).find((i) => i.children && isItemActive(i, pathname))?.to ?? null;
  const [openTo, setOpenTo] = useState(activeParent);
  // Moving to a page inside another dropdown opens that one instead.
  const [seenParent, setSeenParent] = useState(activeParent);
  if (seenParent !== activeParent) {
    setSeenParent(activeParent);
    if (activeParent) setOpenTo(activeParent);
  }
  return (
    <>
      {groups.map((group) => (
        <div key={group.title}>
          <div className="sidebar-section-label">{group.title}</div>
          <ul className="sidebar-list">
            {group.items.map((item) => (
              <li key={item.label}>
                {item.children ? (
                  <NavItemWithChildren item={item} open={openTo === item.to} onToggle={() => setOpenTo(openTo === item.to ? null : item.to)} onNavigate={onNavigate} />
                ) : (
                  <NavItemLink item={item} onNavigate={onNavigate} />
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** Pass desktop={false} when another component draws the desktop sidebar; the phone menu still comes from here. */
export function SideNav({ groups, desktop = true }: { groups: SideNavGroup[]; desktop?: boolean }) {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
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
        className={clsx(
          "sidebar sidebar-desktop hidden no-scrollbar",
          "sm:flex sm:flex-col sm:gap-5 sm:px-3 sm:pt-4 sm:pb-3 sm:sticky sm:top-0 sm:-mt-[var(--topbar-h)] sm:h-dvh sm:w-60 sm:flex-none sm:self-start",
          "sm:overflow-y-auto sm:border-r sm:border-[var(--sb-border)]",
        )}
      >
        {user && (
          <div className="flex flex-col items-center gap-1.5 border-b border-[var(--sb-border)] px-2 pb-4 text-center">
            <BrandName />
            <WorkspaceLabel role={user.role} variant="caption" />
          </div>
        )}
        <NavGroupList groups={groups} />
      </aside>
      )}
    </>
  );
}
