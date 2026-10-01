import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { CheckIcon, ChevronDownIcon, LockIcon } from "@/components/icons";
import type { Employee } from "@/lib/types";
import { DirectoryDetails } from "./DirectoryDetails";
import {
  DEFAULT_DIRECTORY_FIELDS,
  DIRECTORY_FIELD_GROUPS,
  DIRECTORY_FIELDS,
  fieldByKey,
  type DirectoryRowData,
} from "./directoryFields";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const CLOSE_MS = 160;
const SAVED_MS = 420;

/** A made-up person, so the preview shows every kind of detail. */
const sample: DirectoryRowData = {
  employee: {
    id: "2026-10-01",
    name: "Juan Dela Cruz",
    initials: "JD",
    position: "Tax Associate",
    department: "Accounting",
    office: "Cebu HQ",
    cluster: "RPM",
    status: "Active",
    email: "juan.delacruz@msma.ph",
    phone: "+63 917 552 0184",
    personalEmail: "juan.dc@gmail.com",
    emergencyContact: "Maria Dela Cruz (Spouse)",
    employmentStatus: "Probationary",
    governmentNumbers: { tin: "123-456-789-000", sss: "34-5678901-2", philHealth: "12-345678901-2" },
  } satisfies Employee,
  profile: { employeeId: "2026-10-01", birthDate: "1998-03-14", civilStatus: "Married", bloodType: "O+", dependents: [] },
  hiredOn: "Oct 1, 2026",
  completion: { applicable: 9, verified: 6, pending: 2, missing: 1, pct: 67 },
  managerName: "Rafael Ortiz",
};

/**
 * Moves elements marked `data-flip-key` from where they were to where they are now (FLIP), so
 * reordering and toggling slide instead of jumping.
 */
function useFlip(ref: RefObject<HTMLElement | null>) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const next = new Map<string, number>();
    const motion = !reducedMotion();
    for (const el of root.querySelectorAll<HTMLElement>("[data-flip-key]")) {
      const key = el.dataset.flipKey!;
      const top = el.getBoundingClientRect().top;
      next.set(key, top);
      const before = last.current.get(key);
      if (motion && before !== undefined && Math.abs(before - top) > 1) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], {
          duration: 200,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      }
    }
    last.current = next;
  });
}

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className="cz-switch">
      <span />
    </button>
  );
}

function MoveButton({ direction, label, disabled, onClick }: { direction: "up" | "down"; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      <ChevronDownIcon className={clsx("h-4 w-4", direction === "up" && "rotate-180")} />
    </button>
  );
}

/**
 * "Customize Directory": HR picks which details show for each person and in what order. Opens by
 * itself on HR's first visit; afterwards from the page header.
 */
export function CustomizeDirectoryDialog({
  open,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  initial: string[];
  onSave: (keys: string[]) => void;
  onClose: () => void;
}) {
  // Each opening starts fresh from what's saved.
  return open ? <CustomizeSession initial={initial} onSave={onSave} onClose={onClose} /> : null;
}

function CustomizeSession({ initial, onSave, onClose }: { initial: string[]; onSave: (keys: string[]) => void; onClose: () => void }) {
  const [closing, setClosing] = useState(false);
  const [shown, setShown] = useState<string[]>(initial);
  const [flash, setFlash] = useState<{ key: string; n: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  useFlip(listRef);
  useFlip(previewRef);

  const shownSet = new Set(shown);
  const hidden = DIRECTORY_FIELDS.filter((f) => !shownSet.has(f.key));
  const isDefault = shown.join() === DEFAULT_DIRECTORY_FIELDS.join();

  const glow = (key: string) => setFlash((f) => ({ key, n: (f?.n ?? 0) + 1 }));

  function toggle(key: string) {
    if (shownSet.has(key)) setShown(shown.filter((k) => k !== key));
    else {
      setShown([...shown, key]);
      glow(key);
    }
  }

  function move(key: string, by: -1 | 1) {
    const i = shown.indexOf(key);
    const j = i + by;
    if (j < 0 || j >= shown.length) return;
    const next = [...shown];
    [next[i], next[j]] = [next[j], next[i]];
    setShown(next);
    glow(key);
  }

  function close(after?: () => void) {
    if (closing) return;
    const done = () => {
      after?.();
      onClose();
    };
    if (reducedMotion()) return done();
    setClosing(true);
    window.setTimeout(done, CLOSE_MS);
  }

  function save() {
    if (saved) return;
    setSaved(true);
    window.setTimeout(() => close(() => onSave(shown)), reducedMotion() ? 0 : SAVED_MS);
  }

  // The preview lists every field: chosen ones open in order, the rest collapsed after them.
  const previewKeys = [...shown, ...hidden.map((f) => f.key)];
  let section = 0;
  const stagger = (): CSSProperties => ({ "--i": section++ }) as CSSProperties;

  const rowClass = "relative isolate flex min-h-11 items-center gap-3 rounded-lg px-2.5 py-1.5";
  const flashLayer = (key: string) => flash?.key === key && <span key={flash.n} className="cz-flash-layer -z-10" aria-hidden="true" />;

  return (
    <Dialog
      open
      closing={closing}
      onClose={() => close()}
      title="Customize Directory"
      description="Choose which details HR sees for each person. You can change this anytime."
      size="xl"
      dismissOnBackdrop={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button type="button" variant="ghost" className="justify-center sm:mr-auto" disabled={isDefault || saved} onClick={() => setShown(DEFAULT_DIRECTORY_FIELDS)}>
            Reset to default
          </Button>
          <Button type="button" variant="ghost" className="justify-center" disabled={saved} onClick={() => close()}>
            Cancel
          </Button>
          <Button type="button" className={clsx("justify-center sm:min-w-28", saved && "cz-saved")} onClick={save} icon={saved ? <CheckIcon className="h-4 w-4" /> : undefined}>
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_19rem]">
        <div ref={listRef} className="flex min-w-0 flex-col gap-5">
          <section className="cz-stagger" style={stagger()} aria-labelledby="cz-shown">
            <div className="flex items-baseline justify-between gap-2 px-2.5">
              <h3 id="cz-shown" className="text-[0.7rem] font-semibold tracking-[0.06em] text-ink-3 uppercase">
                Shown, in this order
              </h3>
              <span className="font-num text-[0.7rem] text-ink-3">{shown.length} of {DIRECTORY_FIELDS.length}</span>
            </div>
            <ul className="mt-1.5 flex flex-col">
              <li className={clsx(rowClass, "text-ink-2")}>
                <LockIcon className="h-3.5 w-3.5 flex-none text-ink-3" />
                <span className="min-w-0 flex-1 text-sm">Name, photo and status</span>
                <span className="text-[0.7rem] font-semibold text-ink-3">Always shown</span>
              </li>
              {shown.map((key, i) => {
                const f = fieldByKey(key)!;
                return (
                  <li key={key} data-flip-key={key} className={clsx(rowClass, "border-t border-border/70")}>
                    {flashLayer(key)}
                    <span className="font-num w-4 flex-none text-center text-[0.7rem] text-ink-3">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.label}</p>
                      <p className="truncate text-xs text-ink-2">{f.hint}</p>
                    </div>
                    <div className="flex flex-none items-center">
                      <MoveButton direction="up" label={`Move ${f.label} up`} disabled={i === 0} onClick={() => move(key, -1)} />
                      <MoveButton direction="down" label={`Move ${f.label} down`} disabled={i === shown.length - 1} onClick={() => move(key, 1)} />
                    </div>
                    <Switch checked label={`Show ${f.label}`} onChange={() => toggle(key)} />
                  </li>
                );
              })}
              {shown.length === 0 && (
                <li className="border-t border-border/70 px-2.5 py-3 text-xs text-ink-2">Only names and status will show. Turn on a detail below to add it.</li>
              )}
            </ul>
          </section>

          {DIRECTORY_FIELD_GROUPS.map((group) => {
            const items = hidden.filter((f) => f.group === group);
            if (items.length === 0) return null;
            return (
              <section key={group} className="cz-stagger" style={stagger()} aria-labelledby={`cz-${group}`}>
                <h3 id={`cz-${group}`} className="px-2.5 text-[0.7rem] font-semibold tracking-[0.06em] text-ink-3 uppercase">
                  {group}
                </h3>
                <ul className="mt-1.5 flex flex-col">
                  {items.map((f, i) => (
                    <li key={f.key} data-flip-key={f.key} className={clsx(rowClass, i > 0 && "border-t border-border/70")}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-2">{f.label}</p>
                        <p className="truncate text-xs text-ink-3">{f.hint}</p>
                      </div>
                      <Switch checked={false} label={`Show ${f.label}`} onChange={() => toggle(f.key)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <aside className="cz-stagger md:sticky md:top-0 md:self-start" style={stagger()} aria-label="Preview">
          <p className="mb-2 text-[0.7rem] font-semibold tracking-[0.06em] text-ink-3 uppercase">Preview</p>
          <article className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand-ink">
                {sample.employee.initials}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-[0.95rem] font-semibold">{sample.employee.name}</p>
                <p className="truncate text-xs text-ink-2">{sample.employee.position}</p>
              </div>
              <Chip variant="good">Active</Chip>
            </div>
            <div ref={previewRef} className={clsx("mt-3", shown.length > 0 && "border-t border-border pt-3")}>
              <DirectoryDetails keys={previewKeys} open={shownSet} data={sample} />
            </div>
          </article>
          <p className="mt-2 text-xs text-ink-3">The table shows the same details as columns, in this order.</p>
        </aside>
      </div>

    </Dialog>
  );
}
