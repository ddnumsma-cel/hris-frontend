import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

/**
 * A date and time picker in the app's own look (the browser's datetime-local popup ignores it).
 * The value is the same local "yyyy-mm-ddThh:mm" string a datetime-local field uses. The panel is
 * drawn on <body> so a dialog's scrolling body can't clip it; Escape or a click outside closes it.
 */
export function DateTimeField({ id, value, onChange, min, invalid }: { id?: string; value: string; onChange: (next: string) => void; min?: string; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const date = value.slice(0, 10);
  const [view, setView] = useState(() => (date || today()).slice(0, 7));
  const hour24 = value ? Number(value.slice(11, 13)) : 9;
  const minute = value ? Number(value.slice(14, 16)) : 0;

  const set = (d: string, h: number, m: number) => onChange(`${d}T${pad(h)}:${pad(m)}`);
  const pickDay = (d: string) => set(d, hour24, minute);
  const pickHour = (h12: number) => set(date || today(), (h12 % 12) + (hour24 >= 12 ? 12 : 0), minute);
  const pickMinute = (m: number) => set(date || today(), hour24, m);
  const pickHalf = (pm: boolean) => set(date || today(), (hour24 % 12) + (pm ? 12 : 0), minute);

  // Place the panel under the field (or above it when there's no room), and keep it there on scroll.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trigger.current!.getBoundingClientRect();
      const h = panel.current?.offsetHeight ?? 340;
      const w = panel.current?.offsetWidth ?? 440;
      const below = r.bottom + 6 + h <= window.innerHeight;
      setPos({ top: below ? r.bottom + 6 : Math.max(8, r.top - 6 - h), left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => (window.removeEventListener("resize", place), window.removeEventListener("scroll", place, true));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Capture phase, so Escape closes only the picker and not the dialog under it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown);
    return () => (document.removeEventListener("keydown", onKey, true), document.removeEventListener("mousedown", onDown));
  }, [open]);

  // Scroll the chosen hour and minute into view when the panel opens.
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelectorAll<HTMLElement>("[data-chosen]").forEach((el) => {
      const col = el.parentElement!;
      col.scrollTop = el.offsetTop - col.offsetTop - col.clientHeight / 2 + el.offsetHeight / 2;
    });
  }, [open]);

  const [y, m] = view.split("-").map(Number) as [number, number];
  const first = new Date(y, m - 1, 1);
  const lead = first.getDay(); // Sunday first, like the attendance pages' week
  const days = new Date(y, m, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => {
    const d = new Date(y, m - 1, i - lead + 1);
    return { iso: iso(d), day: d.getDate(), inMonth: d.getMonth() === m - 1 };
  });
  const minDate = min?.slice(0, 10);
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    setView(iso(d).slice(0, 7));
  };
  const h12 = hour24 % 12 || 12;
  const pm = hour24 >= 12;

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => (setView((date || today()).slice(0, 7)), setOpen((o) => !o))}
        className="field flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
      >
        <span className={clsx("truncate whitespace-nowrap", !value && "text-ink-3")}>{value ? label(value) : "Choose date and time"}</span>
        <CalendarIcon className="h-4 w-4 flex-none text-ink-3" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label="Choose date and time"
            style={{ top: pos.top, left: pos.left }}
            className="glass-surface popover-enter fixed z-[200] flex max-w-[calc(100vw-16px)] rounded-[var(--radius-dropdown)] max-sm:flex-col"
          >
            <div className="w-[17rem] p-3">
              <div className="mb-2 flex items-center justify-between">
                <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-ink-2 hover:bg-[var(--nav-hover-bg)]">
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold">{first.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</span>
                <button type="button" aria-label="Next month" onClick={() => shift(1)} className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-ink-2 hover:bg-[var(--nav-hover-bg)]">
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                  <span key={d} className="py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                    {d}
                  </span>
                ))}
                {cells.map((c) => {
                  const chosen = c.iso === date;
                  const disabled = !!minDate && c.iso < minDate;
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      disabled={disabled}
                      aria-pressed={chosen}
                      aria-label={new Date(`${c.iso}T12:00:00`).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      onClick={() => pickDay(c.iso)}
                      className={clsx(
                        "h-8 rounded-[var(--radius-control)] text-sm transition-colors",
                        chosen ? "accent-fill font-semibold" : "hover:bg-[var(--nav-hover-bg)]",
                        !chosen && !c.inMonth && "text-ink-3",
                        !chosen && c.iso === today() && "font-semibold text-brand ring-1 ring-[var(--line-strong)]",
                        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
                      )}
                    >
                      {c.day}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-xs">
                <button type="button" onClick={() => (pickDay(today()), setView(today().slice(0, 7)))} className="rounded-[var(--radius-control)] px-2 py-1 font-medium text-brand hover:bg-[var(--nav-hover-bg)]">
                  Today
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-[var(--radius-control)] px-2 py-1 font-medium text-ink-2 hover:bg-[var(--nav-hover-bg)]">
                  Done
                </button>
              </div>
            </div>
            <div className="flex flex-col border-l border-border p-3 max-sm:border-t max-sm:border-l-0">
              {/* Lines up with the month row and weekday header on the left. */}
              <div className="mb-2 flex h-8 items-center text-sm font-semibold">Time</div>
              <div className="grid grid-cols-[3rem_3rem_3rem] gap-1 text-center">
                {["Hour", "Min", ""].map((h, i) => (
                  <span key={i} className="py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                    {h}
                  </span>
                ))}
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-[3rem_3rem_3rem] gap-1">
                <Column label="Hour" items={Array.from({ length: 12 }, (_, i) => i + 1)} chosen={h12} show={(n) => String(n)} onPick={pickHour} />
                <Column label="Minute" items={Array.from({ length: 60 }, (_, i) => i)} chosen={minute} show={pad} onPick={pickMinute} />
                <div className="flex flex-col gap-1" role="group" aria-label="AM or PM">
                  {(["AM", "PM"] as const).map((h) => (
                    <button key={h} type="button" aria-pressed={(h === "PM") === pm} onClick={() => pickHalf(h === "PM")} className={clsx("h-8 rounded-[var(--radius-control)] text-sm", (h === "PM") === pm ? "bg-surface-2 font-semibold text-brand ring-1 ring-[var(--line-strong)]" : "text-ink-2 hover:bg-[var(--nav-hover-bg)]")}>
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Column({ label, items, chosen, show, onPick }: { label: string; items: number[]; chosen: number; show: (n: number) => string; onPick: (n: number) => void }) {
  return (
    <div role="group" aria-label={label} className="time-column flex h-[15.5rem] flex-col gap-1 overflow-y-auto py-7">
      {items.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={n === chosen}
          data-chosen={n === chosen ? "" : undefined}
          onClick={() => onPick(n)}
          className={clsx("h-8 flex-none rounded-[var(--radius-control)] text-sm tabular-nums", n === chosen ? "bg-surface-2 font-semibold text-brand ring-1 ring-[var(--line-strong)]" : "text-ink-2 hover:bg-[var(--nav-hover-bg)]")}
        >
          {show(n)}
        </button>
      ))}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
/** "Thu, Oct 8 · 5:30 PM", with the year only when it isn't this year. */
const label = (v: string) => {
  const d = new Date(v);
  const year = d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" as const } : {};
  return `${d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", ...year })} · ${d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`;
};
