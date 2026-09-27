import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import clsx from "clsx";
import { MenuIcon, XIcon } from "@/components/icons";

export interface SideNavItem {
  label: string;
  to: string;
  icon: ReactNode;
  end?: boolean;
}

export interface SideNavGroup {
  title: string;
  items: SideNavItem[];
}

function isItemActive(item: SideNavItem, pathname: string) {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function NavGroupList({ groups, onNavigate }: { groups: SideNavGroup[]; onNavigate?: () => void }) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.title}>
          <div className="mb-1.5 px-2.5 text-[0.68rem] font-bold uppercase tracking-wider text-ink-3">
            {group.title}
          </div>
          <ul className="flex flex-col gap-px">
            {group.items.map((item) => (
              <li key={item.label}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    clsx(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-ink-2",
                      isActive && "bg-brand-tint font-bold text-brand-ink [&_svg]:text-brand-ink",
                    )
                  }
                >
                  <span className="text-ink-3 [&>svg]:h-4.5 [&>svg]:w-4.5">{item.icon}</span>
                  {item.label}
                </NavLink>
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

  const allItems = groups.flatMap((g) => g.items);
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
      <aside className="hidden sm:sticky sm:top-13.5 sm:flex sm:w-55 sm:flex-none sm:flex-col sm:gap-4.5 sm:self-stretch sm:border-r sm:border-border sm:px-3.5 sm:py-4.5 md:top-14.5">
        <NavGroupList groups={groups} />
      </aside>
    </>
  );
}
