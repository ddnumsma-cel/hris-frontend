import { useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ChevronDownIcon, PinIcon } from "@/components/icons";
import type { NavSection } from "./navItems";
import { MAX_PINS, ordered, type NavPrefs } from "./navPrefs";

/** Let someone pin the pages they use every day and put their most-used modules first. */
export function CustomizeNavDialog({ sections, prefs, onSave, onClose }: { sections: NavSection[]; prefs: NavPrefs; onSave: (p: NavPrefs) => void; onClose: () => void }) {
  const [order, setOrder] = useState(() => ordered(sections, prefs.order).map((s) => s.key));
  const [pins, setPins] = useState(prefs.pins);
  const list = order.map((k) => sections.find((s) => s.key === k)!).filter(Boolean);
  const move = (i: number, by: number) => {
    const next = [...order];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    setOrder(next);
  };
  const toggle = (to: string) => setPins((p) => (p.includes(to) ? p.filter((x) => x !== to) : p.length >= MAX_PINS ? p : [...p, to]));
  const full = pins.length >= MAX_PINS;

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title="Customize your sidebar"
      footer={
        <div className="flex items-center justify-between gap-2">
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
                onSave({ pins, order });
                onClose();
              }}
            >
              Save
            </Button>
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">Pin</span> up to {MAX_PINS} pages you use every day; they appear at the top of your sidebar. Use the arrows to put the modules you use most first. Only you see these changes.
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
                      className={clsx("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40", on ? "border-ink bg-ink text-surface" : "border-border text-ink-2 hover:border-ink-3 hover:text-ink")}
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
    </Dialog>
  );
}
