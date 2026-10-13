// The sidebar's Start button and its menu. The button is a pen-over-page mark in a rounded-square
// tile (the app's control radius) over the word "Start". The menu opens level with it, joined by a
// small notch: underline tabs, one per area, carry how many things there are waiting on you; under
// them "Start something" lists what you can begin and "Waiting on you" what other people sent you
// to decide, each with a one-line hint. ←/→ switch area, ↑/↓ move between links, Esc closes.
// "row": a row at the top of the full sidebar (only its tile shows in a collapsed icon-only
// rail, with a tooltip). "rail": the tile over the word, for the compact icon rail.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { CheckIcon, ComposeIcon, XIcon } from "@/components/icons";
import { Chip } from "@/components/ui/Chip";
import { listDocuments } from "@/lib/corehr/api";
import { listRequests as listLeaveRequests } from "@/lib/leave/api";
import { listClaims } from "@/lib/reimbursements/api";
import { listFixes, listRequests as listTimeRequests } from "@/lib/timekeeping/api";
import { can } from "@/lib/permissions";
import { useWho } from "@/lib/useCan";
import type { CreateGroup, WaitingKind } from "./SideNav";

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
  // Where the button's tile is centred while the menu is open (the panel lines up with it); null when closed.
  const [at, setAt] = useState<number | null>(null);
  const isOpen = at !== null;
  const tileRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Following a link closes the menu.
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) {
    setSeen(pathname);
    setAt(null);
  }

  // Escape closes it wherever focus is, and focus goes back to the button.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAt(null);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  if (groups.length === 0) return null;

  const close = () => setAt(null);
  const toggle = () => {
    if (isOpen) return setAt(null);
    onOpen?.();
    const r = tileRef.current?.getBoundingClientRect();
    setAt(r ? r.top + r.height / 2 : 48);
  };

  // An outlined accent tile at rest; while the menu is open it fills like a selected tile.
  const tile = clsx(
    "flex flex-none items-center justify-center border-[1.5px] transition-[background,box-shadow,color]",
    isOpen
      ? "border-transparent bg-[image:var(--grad-primary)] text-[var(--on-accent)] shadow-[var(--shadow-logo)]"
      : "border-[var(--accent)] text-[var(--accent)] group-hover:bg-[var(--accent-tint)] group-hover:shadow-[0_0_0_3px_var(--accent-tint)]",
  );

  return (
    <>
      {variant === "rail" ? (
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={toggle}
          className="group flex w-18 flex-col items-center gap-1 rounded-xl py-1.5"
        >
          <span ref={tileRef} className={clsx(tile, "h-9 w-9 rounded-[var(--radius-control)] [&>svg]:h-[18px] [&>svg]:w-[18px]")}>
            <ComposeIcon />
          </span>
          <span className={clsx("text-[10.5px] leading-tight text-[var(--accent)]", isOpen ? "font-bold" : "font-semibold")}>Start</span>
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={toggle}
          data-tip="Start"
          className="group sidebar-item !py-1 font-semibold !text-[var(--accent)]"
        >
          {/* 24px tile in the 20px icon slot (negative margins), so the label lines up with the rows. */}
          <span ref={tileRef} className={clsx(tile, "-mx-0.5 h-6 w-6 rounded-[var(--radius-logo)] [&>svg]:h-3.5 [&>svg]:w-3.5")}>
            <ComposeIcon />
          </span>
          <span className="sidebar-label">Start</span>
        </button>
      )}

      {isOpen &&
        createPortal(
          <>
            <button type="button" aria-label="Close start menu" tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={close} />
            <StartPanel groups={groups} centre={at} onClose={close} />
          </>,
          document.body,
        )}
    </>
  );
}

/** A query counting the rows of one list still waiting; a list the person can't open counts as nothing. */
function counting<T>(kinds: Set<WaitingKind>, kind: WaitingKind, load: () => Promise<T[]>, waiting: (row: T) => boolean, per?: (row: T) => string) {
  return {
    queryKey: ["start-menu", "waiting", kind],
    // `per`: count distinct people rather than rows (one person's several papers are one review).
    queryFn: () => load().then((rows) => (per ? new Set(rows.filter(waiting).map(per)).size : rows.filter(waiting).length), () => 0),
    enabled: kinds.has(kind),
    staleTime: 0,
  };
}

/** How many things of each kind wait on the signed-in person, counted from the same lists the approval pages use. */
function useWaiting(kinds: Set<WaitingKind>): Partial<Record<WaitingKind, number>> {
  const who = useWho();
  const approves = can(who, "approve", "claims");
  const finalises = can(who, "final", "claims");
  const leave = useQuery(counting(kinds, "leave", listLeaveRequests, (r) => r.status === "pending"));
  const time = useQuery(counting(kinds, "time", listTimeRequests, (r) => r.status === "pending"));
  const fixes = useQuery(counting(kinds, "fixes", listFixes, (r) => r.status === "pending"));
  const claims = useQuery(counting(kinds, "claims", listClaims, (c) => (approves && c.status === "pending") || (finalises && c.status === "endorsed")));
  const documents = useQuery(counting(kinds, "documents", () => listDocuments(), (d) => d.status === "Submitted", (d) => d.employeeId));
  return { leave: leave.data, time: time.data, fixes: fixes.data, claims: claims.data, documents: documents.data };
}

function StartPanel({ groups, centre, onClose }: { groups: CreateGroup[]; centre: number; onClose: () => void }) {
  const kinds = new Set(groups.flatMap((g) => g.items.flatMap((i) => (i.waiting ? [i.waiting] : []))));
  const waiting = useWaiting(kinds);
  const waitingIn = (g: CreateGroup) => g.items.reduce((n, i) => n + (i.waiting ? (waiting[i.waiting] ?? 0) : 0), 0);

  const [index, setIndex] = useState(0);
  const group = groups[Math.min(index, groups.length - 1)]!;
  const starts = group.items.filter((i) => !i.waiting);
  const decides = group.items.filter((i) => i.waiting);
  // Workspaces where nobody decides anything (employees) get one column, not an empty "Waiting" one;
  // an area with nothing to start shows only what's waiting.
  const hasWaitingColumn = kinds.size > 0;
  const hasStartColumn = starts.length > 0 || !hasWaitingColumn;
  const twoColumns = hasWaitingColumn && hasStartColumn;

  const bodyRef = useRef<HTMLDivElement>(null);
  const links = () => Array.from(bodyRef.current?.querySelectorAll<HTMLAnchorElement>("[data-start-link]") ?? []);
  // Opening the menu (or switching area) puts focus on the first link.
  useEffect(() => links()[0]?.focus(), [index]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = (index + (e.key === "ArrowRight" ? 1 : -1) + groups.length) % groups.length;
      setIndex(next);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const all = links();
      if (all.length === 0) return;
      e.preventDefault();
      const at = all.indexOf(document.activeElement as HTMLAnchorElement);
      const next = at < 0 ? 0 : (at + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length;
      all[next]?.focus();
    }
  };

  // Level with the button's tile: the 56px tab row is centred on it.
  const top = Math.max(8, centre - 28);

  return (
    <div
      role="dialog"
      aria-label="Start"
      onKeyDown={onKeyDown}
      className="start-panel glass-surface fixed z-50 flex flex-col rounded-[var(--radius-modal)] shadow-[var(--shadow-panel)]"
      style={{ top, maxHeight: `calc(100dvh - ${top + 8}px)` }}
    >
      <span aria-hidden="true" className="start-notch" />
      {/* The app's underline tabs, each with the number of things waiting in that area. */}
      <div className="flex h-14 flex-none items-end gap-3 border-b border-border pr-2 pl-3">
        <div role="tablist" aria-label="Areas" className="no-scrollbar flex min-w-0 gap-1 overflow-x-auto">
          {groups.map((g, i) => {
            const on = g === group;
            const n = waitingIn(g);
            return (
              <button
                key={g.title}
                type="button"
                role="tab"
                id={`start-tab-${i}`}
                aria-selected={on}
                aria-controls="start-tabpanel"
                tabIndex={on ? 0 : -1}
                onClick={() => setIndex(i)}
                className={clsx("start-tab -mb-px inline-flex items-center gap-2 border-b-2 px-3 pt-2 pb-3 text-sm font-medium whitespace-nowrap", on ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink")}
              >
                {g.title}
                {n > 0 && <span className="start-count">{n > 99 ? "99+" : n}</span>}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="mb-3 ml-auto flex h-8 w-8 flex-none items-center justify-center rounded-[var(--radius-control)] text-ink-2 hover:bg-[var(--nav-hover-bg)] hover:text-ink">
          <XIcon className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div ref={bodyRef} id="start-tabpanel" role="tabpanel" aria-labelledby={`start-tab-${index}`} className={clsx("grid min-h-0 flex-1 overflow-y-auto px-2 pt-4 pb-2", twoColumns && "sm:grid-cols-2")}>
        {hasStartColumn && (
          <section aria-label="Start something" className={clsx("flex flex-col gap-0.5", twoColumns && "sm:border-r sm:border-[var(--line)] sm:pr-2")}>
            <h3 className="start-label">Start something</h3>
            {starts.map((item) => (
              <StartLink key={item.to + item.label} item={item} onClose={onClose} />
            ))}
          </section>
        )}
        {hasWaitingColumn && (
          <section aria-label="Waiting on you" className={clsx("flex flex-col gap-0.5", twoColumns && "mt-4 sm:mt-0 sm:pl-2")}>
            <h3 className="start-label">Waiting on you</h3>
            {decides.length > 0 ? (
              decides.map((item) => <StartLink key={item.to + item.label} item={item} count={item.waiting ? waiting[item.waiting] : undefined} onClose={onClose} />)
            ) : (
              <div className="mx-1 flex min-h-40 flex-1 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border p-4 text-center">
                <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-good-tint text-good">
                  <CheckIcon className="h-4 w-4" />
                </span>
                <span className="text-[13px] font-semibold text-ink">Nothing waiting on you</span>
                <span className="max-w-56 text-xs text-ink-2">Requests to decide in {group.title} show up here when someone sends one.</span>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--line)] px-4 py-2 text-xs text-ink-2">
        <span>
          <kbd className="start-kbd">←</kbd>
          <kbd className="start-kbd">→</kbd> switch area
        </span>
        <span>
          <kbd className="start-kbd">↑</kbd>
          <kbd className="start-kbd">↓</kbd> choose
        </span>
        <span>
          <kbd className="start-kbd">Enter</kbd> open
        </span>
        <span className="sm:ml-auto">
          <kbd className="start-kbd">Esc</kbd> close
        </span>
      </div>
    </div>
  );
}

function StartLink({ item, count, onClose }: { item: CreateGroup["items"][number]; count?: number; onClose: () => void }) {
  return (
    <Link to={item.to} onClick={onClose} data-start-link className="start-link flex min-h-13 items-center gap-3 rounded-[var(--radius-control)] px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink">{item.label}</span>
        {item.hint && <span className="mt-0.5 block text-xs text-ink-2">{item.hint}</span>}
      </span>
      {count !== undefined && count > 0 && <Chip variant="warn">{count} waiting</Chip>}
    </Link>
  );
}
