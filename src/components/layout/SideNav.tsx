import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { ChevronDownIcon, MenuIcon, XIcon } from "@/components/icons";

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
}

function isItemActive(item: SideNavItem, pathname: string): boolean {
  if (item.children) return item.children.some((child) => isItemActive(child, pathname));
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

const itemClass = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium";

function NavItemLink({ item, onNavigate }: { item: SideNavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(itemClass, isActive ? "bg-brand-tint font-bold text-brand-ink [&_svg]:text-brand-ink" : "text-ink-2")
      }
    >
      <span className="flex-none text-ink-3 [&>svg]:h-4.5 [&>svg]:w-4.5">{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function NavItemWithChildren({ item, onNavigate }: { item: SideNavItem; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const childActive = isItemActive(item, pathname);
  const [expanded, setExpanded] = useState(childActive);
  // Always show the list while one of its pages is open, e.g. after following a link.
  const open = expanded || childActive;
  const listId = `subnav-${item.to.replace(/\W+/g, "-")}`;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setExpanded(!open)}
        className={clsx(
          itemClass,
          "transition-colors hover:bg-surface-2/70",
          childActive ? "font-bold text-brand-ink [&_svg]:text-brand-ink" : "text-ink-2",
        )}
      >
        <span className="flex-none text-ink-3 [&>svg]:h-4.5 [&>svg]:w-4.5">{item.icon}</span>
        <span className="truncate">{item.label}</span>
        <ChevronDownIcon
          className={clsx("ml-auto h-3.5 w-3.5 flex-none transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul id={listId} className="mt-0.5 mb-1 ml-[1.1rem] flex flex-col gap-px border-l border-border pl-2">
          {item.children!.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                end={child.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  clsx(
                    "relative flex w-full items-center rounded-md px-2.5 py-1 text-[0.8rem] transition-colors",
                    isActive
                      ? "bg-brand-tint font-bold text-brand-ink before:absolute before:top-1/2 before:-left-[calc(0.5rem+1px)] before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand"
                      : "font-medium text-ink-2 hover:bg-surface-2/70 hover:text-ink",
                  )
                }
              >
                <span className="truncate">{child.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function NavGroupList({ groups, onNavigate }: { groups: SideNavGroup[]; onNavigate?: () => void }) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.title}>
          <div className="mb-1 px-2.5 text-[0.68rem] font-bold uppercase tracking-wider text-ink-3">
            {group.title}
          </div>
          <ul className="flex flex-col gap-px">
            {group.items.map((item) => (
              <li key={item.label}>
                {item.children ? (
                  <NavItemWithChildren item={item} onNavigate={onNavigate} />
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

export function SideNav({ groups }: { groups: SideNavGroup[] }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const allItems = groups.flatMap((g) => g.items.flatMap((item) => item.children ?? [item]));
  const activeItem = allItems.find((item) => isItemActive(item, location.pathname));

  return (
    <>
      {/* Mobile: compact trigger bar + slide-in drawer */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-3.5 py-2.5 sm:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 text-sm font-bold text-ink"
        >
          <MenuIcon className="h-4.5 w-4.5 text-ink-2" />
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
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col gap-4.5 overflow-y-auto bg-surface px-3.5 py-4.5 shadow-lg sm:hidden">
            <div className="flex items-center justify-between px-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-3">Menu</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <NavGroupList groups={groups} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      {/* Desktop: sticky sidebar */}
      <aside
        data-tour="sidenav"
        className="hidden sm:sticky sm:top-(--topbar-h) sm:flex sm:h-[calc(100dvh-var(--topbar-h))] sm:self-start sm:w-60 sm:flex-none sm:flex-col sm:gap-3 sm:overflow-y-auto sm:border-r sm:border-border sm:px-3.5 sm:py-3 no-scrollbar"
      >
        <NavGroupList groups={groups} />
      </aside>
    </>
  );
}
