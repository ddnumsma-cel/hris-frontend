import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { ChevronDownIcon, PinIcon, XIcon } from "@/components/icons";
import { isHome, type NavSection } from "./navItems";
import { MAX_PINS, ordered, type NavPrefs } from "./navPrefs";

/**
 * Let someone pin the pages they use every day and put their most-used modules first.
 * Opens as a panel attached to the sidebar's edge (not a centred modal), so the sidebar being
 * customized stays in view; only the page to its right is dimmed.
 */
export function CustomizeNavDialog({ sections, prefs, onSave, onClose }: { sections: NavSection[]; prefs: NavPrefs; onSave: (p: NavPrefs) => void; onClose: () => void }) {
  const [order, setOrder] = useState(() => ordered(sections, prefs.order).map((s) => s.key));
  const [pins, setPins] = useState(prefs.pins);
  // Home is always first, so it isn't moved or pinned here.
  const list = order.map((k) => sections.find((s) => s.key === k)!).filter((s) => s && !isHome(s));
  const move = (i: number, by: number) => {
    const next = [...order];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    setOrder(next);
  };
  const toggle = (to: string) => setPins((p) => (p.includes(to) ? p.filter((x) => x !== to) : p.length >= MAX_PINS ? p : [...p, to]));
  const full = pins.length >= MAX_PINS;
  const closeRef = useRef<HTMLButtonElement>(null);
  // The sidebars pass a new onClose each render; read the latest without re-running the effect.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // On open, focus moves into the panel; Escape closes it.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <>
      <div aria-hidden="true" onClick={onClose} className="overlay-backdrop overlay-enter fixed inset-y-0 right-0 left-[var(--sidenav-w)] z-50" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu settings"
        className="sidebar glass-surface panel-enter fixed inset-y-0 left-[var(--sidenav-w)] z-50 flex w-[min(28rem,calc(100vw-var(--sidenav-w)))] flex-col rounded-r-[var(--radius-dropdown)] !border-l-0 !bg-transparent !shadow-[var(--shadow-drawer)] !backdrop-filter-none"
      >
        <div className="flex h-14 flex-none items-center justify-between border-b border-[var(--line)] pr-3 pl-5">
          <h2 className="text-[15px] leading-5 font-semibold text-[var(--text)]">Menu settings</h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close menu settings"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-ink-2 hover:bg-[var(--nav-hover-bg)] hover:text-ink"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          <p className="text-sm text-ink-2">
            <span className="font-medium text-ink">Pin</span> up to {MAX_PINS} pages you use every day; they appear at the top of your sidebar (as Bookmarks in the full sidebar). Use the arrows to put the modules you use most first. Home always stays at the top. Only you see these changes.
          </p>
          <div className="flex items-center gap-2 text-xs text-ink-2">
            <PinIcon className="h-3.5 w-3.5" />
            {pins.length} of {MAX_PINS} pinned{full && " · unpin one to pin another"}
          </div>
          <ol className="flex flex-col gap-2">
            {list.map((s, i) => (
              <li key={s.key} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-surface-2 text-ink-2 [&>svg]:h-4 [&>svg]:w-4">{s.icon}</span>
                  <span className="flex-1 text-sm font-semibold">{s.label}</span>
                  <span className="flex gap-1">
                    <button type="button" aria-label={`Move ${s.label} up`} disabled={i === 0} onClick={() => move(i, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-ink-2 hover:border-ink-3 disabled:opacity-30">
                      <ChevronDownIcon className="h-3.5 w-3.5 rotate-180" />
                    </button>
                    <button type="button" aria-label={`Move ${s.label} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-ink-2 hover:border-ink-3 disabled:opacity-30">
                      <ChevronDownIcon className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-11">
                  {s.pages.map((p) => {
                    const on = pins.includes(p.to);
                    return (
                      <button
                        key={p.to}
                        type="button"
                        aria-pressed={on}
                        disabled={!on && full}
                        onClick={() => toggle(p.to)}
                        className={clsx("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40", on ? "border-ink bg-ink text-bg" : "border-border text-ink-2 hover:border-ink-3 hover:text-ink")}
                      >
                        <PinIcon className={clsx("h-3 w-3", !on && "opacity-50")} />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-none items-center justify-between gap-2 border-t border-[var(--line)] px-5 py-3">
          <Button
            variant="ghost"
            onClick={() => {
              setOrder(sections.map((s) => s.key));
              setPins([]);
            }}
          >
            Reset to default
          </Button>
          <span className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSave({ ...prefs, pins, order });
                onClose();
              }}
            >
              Save
            </Button>
          </span>
        </div>
      </aside>
    </>,
    document.body,
  );
}
