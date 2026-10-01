import { useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import clsx from "clsx";
import { FormProvider, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { ChevronDownIcon, FileIcon, LockIcon, PlusIcon, XIcon } from "@/components/icons";
import { ONBOARDING_FORM_QUERY_KEY, saveOnboardingForm } from "@/lib/api";
import {
  FORM_FIELDS,
  FORM_SECTIONS,
  fieldDef,
  includedFieldKeys,
  normalizeConfig,
  sectionDef,
  starterConfig,
  type FormFieldKey,
  type FormSectionKey,
  type OnboardingFormConfig,
} from "@/lib/onboardingForm";
import type { AddEmployeeFormValues } from "@/lib/schemas";
import { prefersReducedMotion, useFlip } from "@/lib/useFlip";
import { FormSection } from "@/features/employee/onboarding/FormFields";
import { GovernmentStep } from "@/features/employee/onboarding/GovernmentStep";
import { emptyValues } from "@/features/employee/onboarding/model";
import type { IdScan } from "@/features/employee/onboarding/useIdScan";

const CLOSE_MS = 160;

type Drag = { kind: "field"; key: FormFieldKey; fromLibrary: boolean } | { kind: "section"; key: FormSectionKey };
type Drop = { kind: "field"; section: FormSectionKey; index: number } | { kind: "section"; index: number };

/** Index to insert at, from the pointer's position over the rows marked `data-drop-row`. */
function indexFromPointer(container: HTMLElement, clientY: number) {
  const rows = [...container.querySelectorAll<HTMLElement>(":scope > [data-drop-row]")];
  const at = rows.findIndex((r) => {
    const box = r.getBoundingClientRect();
    return clientY < box.top + box.height / 2;
  });
  return at === -1 ? rows.length : at;
}

function GripIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      {[4, 8, 12].flatMap((y) => [6, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="currentColor" />))}
    </svg>
  );
}

function IconButton({ label, onClick, disabled, children, focusKey }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode; focusKey?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      data-focus={focusKey}
      className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Switch({ checked, label, onChange, focusKey }: { checked: boolean; label: string; onChange: () => void; focusKey?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} data-focus={focusKey} onClick={onChange} className="cz-switch">
      <span />
    </button>
  );
}

/**
 * HR builds the Onboarding form: drag ready-made fields from the library into sections, reorder
 * sections and fields, and mark fields required. The locked basics, government numbers and 201
 * files are always included. What's saved is exactly what new hires see.
 */
export function FormBuilderDialog({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: OnboardingFormConfig | null;
  onClose: () => void;
  onSaved: (config: OnboardingFormConfig) => void;
}) {
  // Each opening starts from what's saved.
  return open ? <Builder initial={initial} onClose={onClose} onSaved={onSaved} /> : null;
}

function Builder({ initial, onClose, onSaved }: { initial: OnboardingFormConfig | null; onClose: () => void; onSaved: (config: OnboardingFormConfig) => void }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<OnboardingFormConfig>(() => initial ?? starterConfig());
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [drag, setDrag] = useState<Drag | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [glow, setGlow] = useState<{ key: string; n: number } | null>(null);
  const [closing, setClosing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const finishing = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const refocus = useRef<string[] | null>(null);
  // Sections slide within the form; fields slide within their section (so a moving section doesn't double up).
  useFlip(canvasRef);
  useFlip(canvasRef, { attr: "flipField", originOf: (el) => el.closest("ul") });

  // Moving a row re-mounts it; give keyboard focus back to the same control.
  useLayoutEffect(() => {
    const wanted = refocus.current;
    if (!wanted || !canvasRef.current) return;
    refocus.current = null;
    for (const key of wanted) {
      const el = document.querySelector<HTMLButtonElement>(`[data-focus="${key}"]`);
      if (el && !el.disabled) return el.focus();
    }
  });

  const included = includedFieldKeys(config);
  const library = FORM_SECTIONS.map((s) => ({ section: s, fields: FORM_FIELDS.filter((f) => f.section === s.key && !included.has(f.key)) })).filter(
    (g) => g.fields.length > 0,
  );
  const dirty = JSON.stringify(config.sections) !== JSON.stringify((initial ?? starterConfig()).sections);
  const flash = (key: string) => setGlow((g) => ({ key, n: (g?.n ?? 0) + 1 }));

  // ---- Edits (all return a repaired config, so locked fields can't be lost) ----
  const update = (fn: (sections: OnboardingFormConfig["sections"]) => OnboardingFormConfig["sections"]) =>
    setConfig((c) => normalizeConfig({ ...c, sections: fn(structuredClone(c.sections)) }));

  function addField(key: FormFieldKey, index?: number) {
    const home = fieldDef(key).section;
    update((sections) => {
      let section = sections.find((s) => s.key === home);
      if (!section) {
        section = { key: home, fields: [] };
        sections.push(section);
      }
      section.fields.splice(index ?? section.fields.length, 0, { key, required: false });
      return sections;
    });
    flash(key);
    refocus.current = [`up-${key}`, `down-${key}`, `remove-${key}`];
  }

  function moveFieldTo(key: FormFieldKey, index: number) {
    update((sections) => {
      const section = sections.find((s) => s.fields.some((f) => f.key === key))!;
      const from = section.fields.findIndex((f) => f.key === key);
      const [item] = section.fields.splice(from, 1);
      section.fields.splice(index > from ? index - 1 : index, 0, item);
      return sections;
    });
    flash(key);
  }

  function moveField(key: FormFieldKey, by: -1 | 1) {
    const section = config.sections.find((s) => s.fields.some((f) => f.key === key))!;
    const from = section.fields.findIndex((f) => f.key === key);
    const to = from + by;
    if (to < 0 || to >= section.fields.length) return;
    refocus.current = by < 0 ? [`up-${key}`, `down-${key}`] : [`down-${key}`, `up-${key}`];
    moveFieldTo(key, by > 0 ? to + 1 : to);
  }

  function removeField(key: FormFieldKey) {
    update((sections) => sections.map((s) => ({ ...s, fields: s.fields.filter((f) => f.key !== key) })));
    refocus.current = [`add-${key}`];
  }

  function toggleRequired(key: FormFieldKey) {
    update((sections) => sections.map((s) => ({ ...s, fields: s.fields.map((f) => (f.key === key ? { ...f, required: !f.required } : f)) })));
    refocus.current = [`required-${key}`];
  }

  function moveSectionTo(key: FormSectionKey, index: number) {
    update((sections) => {
      const from = sections.findIndex((s) => s.key === key);
      const [item] = sections.splice(from, 1);
      sections.splice(index > from ? index - 1 : index, 0, item);
      return sections;
    });
    flash(`section-${key}`);
  }

  function moveSection(key: FormSectionKey, by: -1 | 1) {
    const from = config.sections.findIndex((s) => s.key === key);
    const to = from + by;
    if (to < 0 || to >= config.sections.length) return;
    refocus.current = by < 0 ? [`sup-${key}`, `sdown-${key}`] : [`sdown-${key}`, `sup-${key}`];
    moveSectionTo(key, by > 0 ? to + 1 : to);
  }

  function removeSection(key: FormSectionKey) {
    update((sections) => sections.filter((s) => s.key !== key));
  }

  // ---- Drag and drop ----
  function startDrag(e: DragEvent, d: Drag) {
    e.dataTransfer.effectAllowed = "move";
    // Firefox only starts a drag with some data set.
    e.dataTransfer.setData("text/plain", d.key);
    // Let the browser take its drag snapshot before the source fades.
    requestAnimationFrame(() => setDrag(d));
  }

  function endDrag() {
    setDrag(null);
    setDrop(null);
  }

  function overFields(e: DragEvent<HTMLElement>, section: FormSectionKey) {
    if (drag?.kind !== "field") return;
    e.preventDefault();
    e.stopPropagation();
    const home = fieldDef(drag.key).section;
    // A field always lives in its own section; dropping elsewhere puts it at the end of that one.
    const index = home === section ? indexFromPointer(e.currentTarget, e.clientY) : (config.sections.find((s) => s.key === home)?.fields.length ?? 0);
    if (drop?.kind !== "field" || drop.section !== home || drop.index !== index) setDrop({ kind: "field", section: home, index });
  }

  function overSections(e: DragEvent<HTMLElement>) {
    if (!drag) return;
    e.preventDefault();
    if (drag.kind === "field") {
      const home = fieldDef(drag.key).section;
      const index = config.sections.find((s) => s.key === home)?.fields.length ?? 0;
      if (drop?.kind !== "field" || drop.section !== home || drop.index !== index) setDrop({ kind: "field", section: home, index });
      return;
    }
    const index = indexFromPointer(e.currentTarget, e.clientY);
    if (drop?.kind !== "section" || drop.index !== index) setDrop({ kind: "section", index });
  }

  function dropHere(e: DragEvent) {
    e.preventDefault();
    // The field list and the canvas both listen; handle the drop once.
    e.stopPropagation();
    if (!drag || !drop) return endDrag();
    if (drag.kind === "field" && drop.kind === "field") {
      if (drag.fromLibrary) addField(drag.key, drop.index);
      else moveFieldTo(drag.key, drop.index);
    } else if (drag.kind === "section" && drop.kind === "section") {
      moveSectionTo(drag.key, drop.index);
    }
    endDrag();
  }

  // ---- Save / close ----
  const mutation = useMutation({
    mutationFn: saveOnboardingForm,
    onSuccess: (saved) => {
      queryClient.setQueryData(ONBOARDING_FORM_QUERY_KEY, saved);
      close(() => onSaved(saved));
    },
  });

  function close(after?: () => void) {
    if (finishing.current) return;
    finishing.current = true;
    const done = () => {
      after?.();
      onClose();
    };
    if (prefersReducedMotion()) return done();
    setClosing(true);
    window.setTimeout(done, CLOSE_MS);
  }

  function requestClose() {
    if (mutation.isPending) return;
    if (dirty) setConfirmDiscard(true);
    else close();
  }

  // The drop line, shown where a dragged field or section will land.
  const line = (key: string) => <div key={key} className="fb-drop-line" aria-hidden="true" />;
  const glowLayer = (key: string) => glow?.key === key && <span key={glow.n} className="cz-flash-layer" aria-hidden="true" />;
  let groupIndex = 0;
  const stagger = (): CSSProperties => ({ "--i": groupIndex++ }) as CSSProperties;

  return (
    <>
      <Dialog
        open
        closing={closing}
        // While the discard question is open, Escape belongs to it.
        onClose={confirmDiscard ? () => {} : requestClose}
        title={initial ? "Edit onboarding form" : "Set up onboarding form"}
        description="Drag in what new hires should fill in. They'll see exactly this form in Onboarding."
        size="full"
        dismissOnBackdrop={false}
        header={
          <div role="radiogroup" aria-label="Builder view" className="-mt-1 mb-3 inline-flex rounded-full border border-border bg-surface-2 p-0.5">
            {(["edit", "preview"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={clsx(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
                )}
              >
                {m === "edit" ? "Edit" : "Preview as new hire"}
              </button>
            ))}
          </div>
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <p className="text-xs text-ink-2 sm:mr-auto">
              {config.sections.length} {config.sections.length === 1 ? "section" : "sections"} · {included.size} fields · then Gov't IDs & 201 files
            </p>
            {mutation.isError && <p className="text-xs font-semibold text-critical">{(mutation.error as Error).message}</p>}
            <Button variant="ghost" className="justify-center" onClick={requestClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button className="justify-center sm:min-w-28" onClick={() => mutation.mutate(config)} disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save form"}
            </Button>
          </div>
        }
      >
        {mode === "preview" ? (
          <Preview config={config} />
        ) : (
          <div className="grid h-full min-h-0 gap-5 md:grid-cols-[17rem_minmax(0,1fr)]">
            {/* Library */}
            <aside aria-label="Field library" className="flex min-h-0 flex-col gap-4 md:overflow-y-auto md:pr-1">
              <div className="cz-stagger" style={stagger()}>
                <h3 className="text-sm font-semibold">Field library</h3>
                <p className="text-xs text-ink-2">Drag a field into your form, or press Add.</p>
              </div>
              {library.length === 0 && (
                <p className="cz-stagger rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-ink-2" style={stagger()}>
                  Every field is in your form.
                </p>
              )}
              {library.map(({ section, fields }) => (
                <section key={section.key} className="cz-stagger" style={stagger()} aria-label={section.title}>
                  <h4 className="mb-1.5 text-[0.7rem] font-semibold tracking-[0.06em] text-ink-3 uppercase">{section.title}</h4>
                  <ul className="flex flex-col gap-1.5">
                    {fields.map((f) => (
                      <li
                        key={f.key}
                        draggable
                        onDragStart={(e) => startDrag(e, { kind: "field", key: f.key, fromLibrary: true })}
                        onDragEnd={endDrag}
                        className={clsx(
                          "group flex cursor-grab items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 shadow-sm transition-[border-color,box-shadow] hover:border-brand hover:shadow active:cursor-grabbing",
                          drag?.kind === "field" && drag.key === f.key && "fb-dragging",
                        )}
                      >
                        <GripIcon className="h-4 w-4 flex-none text-ink-3" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{f.label}</p>
                          <p className="truncate text-[0.7rem] text-ink-3">{f.hint}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addField(f.key)}
                          data-focus={`add-${f.key}`}
                          aria-label={`Add ${f.label}`}
                          className="flex flex-none items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-brand-ink hover:bg-brand-tint"
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                          Add
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </aside>

            {/* Canvas */}
            <div className="min-h-0 rounded-2xl bg-surface-2/70 p-3 md:overflow-y-auto md:p-4">
              <div ref={canvasRef} className="flex flex-col gap-3" onDragOver={overSections} onDrop={dropHere} aria-label="Your form">
                {config.sections.map((s, si) => {
                  const def = sectionDef(s.key);
                  return (
                    <div key={s.key} data-drop-row data-flip-key={`section-${s.key}`} className="flex flex-col gap-3">
                      {drop?.kind === "section" && drop.index === si && line("sline")}
                      <section
                        aria-label={def.title}
                        className={clsx(
                          "relative isolate overflow-hidden rounded-xl border border-border bg-surface shadow-sm",
                          drag?.kind === "section" && drag.key === s.key && "fb-dragging",
                        )}
                      >
                        {glowLayer(`section-${s.key}`)}
                        <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                          <span
                            draggable
                            onDragStart={(e) => startDrag(e, { kind: "section", key: s.key })}
                            onDragEnd={endDrag}
                            title="Drag to reorder"
                            className="flex h-7 w-6 flex-none cursor-grab items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 active:cursor-grabbing"
                          >
                            <GripIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 text-sm font-semibold">
                              <span className="font-num text-ink-3">{si + 1}</span>
                              {def.title}
                            </p>
                            <p className="truncate text-xs text-ink-2">{def.description}</p>
                          </div>
                          <IconButton label={`Move ${def.title} up`} focusKey={`sup-${s.key}`} disabled={si === 0} onClick={() => moveSection(s.key, -1)}>
                            <ChevronDownIcon className="h-4 w-4 rotate-180" />
                          </IconButton>
                          <IconButton label={`Move ${def.title} down`} focusKey={`sdown-${s.key}`} disabled={si === config.sections.length - 1} onClick={() => moveSection(s.key, 1)}>
                            <ChevronDownIcon className="h-4 w-4" />
                          </IconButton>
                          {def.locked ? (
                            <span title="Always included" className="flex h-7 w-7 items-center justify-center text-ink-3">
                              <LockIcon className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <IconButton label={`Remove ${def.title} section`} onClick={() => removeSection(s.key)}>
                              <XIcon className="h-4 w-4" />
                            </IconButton>
                          )}
                        </header>
                        <ul className="flex flex-col px-1.5 py-1.5" onDragOver={(e) => overFields(e, s.key)} onDrop={dropHere}>
                          {s.fields.map((f, fi) => {
                            const fd = fieldDef(f.key);
                            return (
                              <FieldRow key={f.key} flipKey={f.key}>
                                {drop?.kind === "field" && drop.section === s.key && drop.index === fi && line("fline")}
                                <div
                                  draggable
                                  onDragStart={(e) => startDrag(e, { kind: "field", key: f.key, fromLibrary: false })}
                                  onDragEnd={endDrag}
                                  className={clsx(
                                    "item-enter relative isolate flex min-h-12 items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface-2/70",
                                    drag?.kind === "field" && drag.key === f.key && "fb-dragging",
                                  )}
                                >
                                  {glowLayer(f.key)}
                                  <span className="flex h-7 w-5 flex-none cursor-grab items-center justify-center text-ink-3 active:cursor-grabbing" title="Drag to reorder">
                                    <GripIcon className="h-4 w-4" />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{fd.label}</p>
                                    <p className="truncate text-xs text-ink-3">{fd.hint}</p>
                                  </div>
                                  {fd.locked ? (
                                    <span className="flex flex-none items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] font-semibold text-ink-2">
                                      <LockIcon className="h-3 w-3" />
                                      Always required
                                    </span>
                                  ) : (
                                    <label className="flex flex-none items-center gap-2 text-xs font-medium text-ink-2">
                                      <span className="hidden sm:inline">Required</span>
                                      <Switch checked={f.required} label={`${fd.label} required`} focusKey={`required-${f.key}`} onChange={() => toggleRequired(f.key)} />
                                    </label>
                                  )}
                                  <div className="flex flex-none items-center">
                                    <IconButton label={`Move ${fd.label} up`} focusKey={`up-${f.key}`} disabled={fi === 0} onClick={() => moveField(f.key, -1)}>
                                      <ChevronDownIcon className="h-4 w-4 rotate-180" />
                                    </IconButton>
                                    <IconButton label={`Move ${fd.label} down`} focusKey={`down-${f.key}`} disabled={fi === s.fields.length - 1} onClick={() => moveField(f.key, 1)}>
                                      <ChevronDownIcon className="h-4 w-4" />
                                    </IconButton>
                                    {fd.locked ? (
                                      <span className="h-7 w-7" aria-hidden="true" />
                                    ) : (
                                      <IconButton label={`Remove ${fd.label}`} focusKey={`remove-${f.key}`} onClick={() => removeField(f.key)}>
                                        <XIcon className="h-4 w-4" />
                                      </IconButton>
                                    )}
                                  </div>
                                </div>
                              </FieldRow>
                            );
                          })}
                          {drop?.kind === "field" && drop.section === s.key && drop.index === s.fields.length && line("fline-end")}
                        </ul>
                      </section>
                    </div>
                  );
                })}

                {drop?.kind === "section" && drop.index === config.sections.length && line("sline-end")}
                {drag?.kind === "field" && drag.fromLibrary && !config.sections.some((s) => s.key === fieldDef(drag.key).section) && (
                  <div className="fb-new-section rounded-xl border-2 border-dashed border-brand/60 bg-brand-tint/50 px-4 py-5 text-center text-sm font-semibold text-brand-ink">
                    Drop to add a “{sectionDef(fieldDef(drag.key).section).title}” section
                  </div>
                )}

                {/* Always the last step for new hires. */}
                <section aria-label="Gov't numbers and 201 files" className="rounded-xl border border-dashed border-border bg-surface/70 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-6 flex-none items-center justify-center text-ink-3">
                      <LockIcon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Gov't numbers & 201 files</p>
                      <p className="text-xs text-ink-2">TIN, SSS, PhilHealth, Pag-IBIG and every 201 document upload · Always included, always last</p>
                    </div>
                    <FileIcon className="h-4 w-4 flex-none text-ink-3" />
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard your changes?"
        message="The form new hires see stays as it was."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmDiscard(false);
          close();
        }}
        onClose={() => setConfirmDiscard(false)}
      />
    </>
  );
}

function FieldRow({ flipKey, children }: { flipKey: string; children: ReactNode }) {
  return (
    <li data-drop-row data-flip-field={flipKey} className="flex flex-col">
      {children}
    </li>
  );
}

/** The form exactly as new hires see it, every step stacked, inputs disabled. */
function Preview({ config }: { config: OnboardingFormConfig }) {
  const form = useForm<AddEmployeeFormValues>({ defaultValues: emptyValues() });
  const noScan = { governmentId: undefined } as unknown as IdScan;
  const steps = [...config.sections.map((s) => sectionDef(s.key).title), "Gov't IDs & 201 files"];
  return (
    <FormProvider {...form}>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <ol className="flex flex-wrap gap-1.5 text-xs" aria-label="Steps new hires see">
          {[...steps, "Review"].map((t, i) => (
            <li key={t} className="rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-ink-2">
              <span className="font-num text-ink-3">{i + 1}</span> {t}
            </li>
          ))}
        </ol>
        <fieldset disabled className="flex flex-col gap-4">
          {config.sections.map((s, i) => (
            <div key={s.key} className="tab-enter rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7" style={{ animationDelay: `${i * 40}ms` }}>
              <FormSection section={s} preview />
            </div>
          ))}
          <div className="tab-enter rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7">
            <GovernmentStep idScan={noScan} />
          </div>
        </fieldset>
      </div>
    </FormProvider>
  );
}
