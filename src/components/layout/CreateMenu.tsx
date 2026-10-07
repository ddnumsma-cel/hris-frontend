// The sidebar's Create button and its menu, laid out like an accounting app's "+ New":
// a column per area of short action links, in a drawer attached beside the sidebar.
// "row": a row at the top of the full sidebar (only its + circle shows in a collapsed icon-only
// rail, with a tooltip). "rail": the + circle over a "Create" label, for the compact icon rail.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import clsx from "clsx";
import { PlusIcon } from "@/components/icons";
import type { CreateGroup } from "./SideNav";

export function CreateMenu({
  groups,
  variant = "row",
  onOpen,
}: {
  groups: CreateGroup[];
  variant?: "row" | "rail";
  /** Called as the menu opens, e.g. so the rail can close its hover drawer. */
  onOpen?: () => void;
}) {
  const { pathname } = useLocation();
  // The button's top edge while the menu is open (the panel lines up with it); null when closed.
  const [at, setAt] = useState<number | null>(null);
  const isOpen = at !== null;

  // Following a link closes the menu.
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) {
    setSeen(pathname);
    setAt(null);
  }

  // Escape closes it wherever focus is.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAt(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  if (groups.length === 0) return null;

  const toggle = (el: HTMLElement) => {
    if (isOpen) return setAt(null);
    onOpen?.();
    setAt(el.getBoundingClientRect().top);
  };

  // An outlined accent circle at rest; while the menu is open it fills like a selected tile.
  const circle = clsx(
    "flex flex-none items-center justify-center rounded-full border-[1.5px] transition-[background,box-shadow,color]",
    isOpen
      ? "border-transparent bg-[image:var(--grad-primary)] text-[var(--on-accent)] shadow-[var(--shadow-logo)]"
      : "border-[var(--accent)] text-[var(--accent)] group-hover:bg-[var(--accent-tint)] group-hover:shadow-[0_0_0_3px_var(--accent-tint)]",
  );

  return (
    <>
      {variant === "rail" ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={(e) => toggle(e.currentTarget)}
          className="group flex w-18 flex-col items-center gap-1 rounded-xl py-1.5"
        >
          <span className={clsx(circle, "h-9 w-9 [&>svg]:h-[18px] [&>svg]:w-[18px]")}>
            <PlusIcon />
          </span>
          <span className={clsx("text-[10.5px] leading-tight text-[var(--accent)]", isOpen ? "font-bold" : "font-semibold")}>Create</span>
        </button>
      ) : (
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={(e) => toggle(e.currentTarget)}
        data-tip="Create"
        className="group sidebar-item !py-1 font-semibold !text-[var(--accent)]"
      >
        {/* 24px circle in the 20px icon slot (negative margins), so the label lines up with the rows. */}
        <span className={clsx(circle, "-mx-0.5 h-6 w-6 [&>svg]:h-3.5 [&>svg]:w-3.5")}>
          <PlusIcon />
        </span>
        <span className="sidebar-label">Create</span>
      </button>
      )}

      {isOpen &&
        createPortal(
          <>
            <button type="button" aria-label="Close create menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setAt(null)} />
            <div
              role="dialog"
              aria-label="Create"
              className="sidebar glass-surface fixed left-[var(--sidenav-w)] z-50 max-h-[calc(100dvh-1rem)] w-max max-w-[min(76rem,calc(100vw-var(--sidenav-w)-1rem))] overflow-auto rounded-r-[var(--radius-dropdown)] !border-l-0 !bg-transparent !shadow-[var(--shadow-drawer)] !backdrop-filter-none"
              style={{ top: Math.max(8, at - 1) }}
            >
              {/* As wide as its columns side by side; past the window's width they wrap to a new row. */}
              <div className="flex flex-wrap gap-x-10 gap-y-8 px-8 py-7">
                {groups.map((g) => (
                  <section key={g.title} className="flex flex-[1_1_auto] flex-col">
                    <h3 className="pb-3 text-[13px] leading-5 font-semibold text-[var(--text)]">{g.title}</h3>
                    {g.items.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setAt(null)}
                        className="-mx-2 flex min-h-10 items-center rounded-[var(--radius-control)] px-2 text-[13.5px] whitespace-nowrap text-[var(--text)] transition-colors hover:bg-[var(--nav-hover-bg)]"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </section>
                ))}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
