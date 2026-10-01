import { useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { CheckIcon, LockIcon } from "@/components/icons";
import { STARTING_CHOICES, type OnboardingChoices } from "./choices";

type QuestionKey = "married" | "dependents" | "licensed" | "previousEmployer";
type OptionalKey = "address" | "emergency" | "bloodType";

const questions: { key: QuestionKey; question: string; hint: string }[] = [
  { key: "married", question: "Are you married?", hint: "We'll ask for your spouse's name and PSA marriage certificate." },
  { key: "dependents", question: "Do you have children or dependents to declare?", hint: "For HMO coverage and tax records. You'll add each one." },
  { key: "licensed", question: "Are you a licensed professional?", hint: "CPA, lawyer, or any PRC license. We'll track its expiry for you." },
  { key: "previousEmployer", question: "Have you worked somewhere before?", hint: "Your last employer's BIR Form 2316 is needed for this year's tax." },
];

const optional: { key: OptionalKey; label: string; hint: string }[] = [
  { key: "address", label: "Home address", hint: "Printed on your BIR Form 2316" },
  { key: "emergency", label: "Emergency contact", hint: "Who HR calls if something happens" },
  { key: "bloodType", label: "Blood type", hint: "For emergencies at work" },
];

const alwaysIncluded = [
  "Legal name, birth date and sex",
  "Mobile number",
  "TIN, SSS, PhilHealth and Pag-IBIG (or “not yet”)",
  "A valid government ID",
  "Your role: department, position and start date",
];

function YesNo({ name, value, onChange, labelledBy }: { name: string; value: boolean; onChange: (v: boolean) => void; labelledBy: string }) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="inline-flex flex-none self-start rounded-full border border-border bg-surface-2 p-0.5 sm:self-auto">
      {[true, false].map((v) => (
        <label
          key={String(v)}
          className={clsx(
            "flex min-h-9 min-w-14 cursor-pointer items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-cat-1)]",
            value === v ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          <input type="radio" name={name} className="sr-only" checked={value === v} onChange={() => onChange(v)} />
          {v ? "Yes" : "No"}
        </label>
      ))}
    </div>
  );
}

/**
 * "Let's set up your form": a few questions decide which extra sections and 201 documents
 * the new hire sees. The legal core is listed as always included so nobody wonders why
 * it can't be removed.
 */
export function ChoicesModal({
  open,
  initial,
  onBuild,
  onFullForm,
  onClose,
}: {
  open: boolean;
  initial: OnboardingChoices | null;
  onBuild: (c: OnboardingChoices) => void;
  onFullForm: () => void;
  /** Escape or ×: keeps what they had, or the full form on a first visit — never a dead end. */
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Let's set up your form"
      size="lg"
      dismissOnBackdrop={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="ghost" className="justify-center" onClick={onFullForm}>
            Use the full form
          </Button>
          <Button type="submit" form="choices-form" className="justify-center">
            Build my form
          </Button>
        </div>
      }
    >
      {open && <ChoicesBody initial={initial ?? STARTING_CHOICES} onBuild={onBuild} />}
    </Dialog>
  );
}

function ChoicesBody({ initial, onBuild }: { initial: OnboardingChoices; onBuild: (c: OnboardingChoices) => void }) {
  const [c, setC] = useState<OnboardingChoices>(initial);
  const set = (key: keyof OnboardingChoices, v: boolean) => setC((prev) => ({ ...prev, [key]: v }));

  return (
    <form
      id="choices-form"
      onSubmit={(e) => {
        e.preventDefault();
        onBuild(c);
      }}
      className="flex flex-col gap-6"
    >
      <p className="text-sm text-ink-2">
        Answer a few questions and we'll only ask for what applies to you. You can change these anytime while filling in the form.
      </p>

      <section aria-labelledby="choices-core" className="rounded-xl border border-border bg-surface-2/60 px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="choices-core" className="text-sm font-semibold">
            Always included
          </h3>
          <span className="flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[0.7rem] font-semibold text-ink-2">
            <LockIcon className="h-3 w-3" />
            Required by HR
          </span>
        </div>
        <p className="mt-0.5 text-xs text-ink-2">Needed for your 201 file, government contributions and payroll.</p>
        <ul className="mt-2.5 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
          {alwaysIncluded.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckIcon className="mt-0.5 h-4 w-4 flex-none text-good" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="choices-about">
        <h3 id="choices-about" className="text-sm font-semibold">
          About you
        </h3>
        <ul className="mt-2 flex flex-col divide-y divide-border rounded-xl border border-border">
          {questions.map((q) => (
            <li key={q.key} className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p id={`q-${q.key}`} className="text-sm font-semibold">
                  {q.question}
                </p>
                <p className="text-xs text-ink-2">{q.hint}</p>
              </div>
              <YesNo name={q.key} value={c[q.key]} onChange={(v) => set(q.key, v)} labelledBy={`q-${q.key}`} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="choices-optional">
        <h3 id="choices-optional" className="text-sm font-semibold">
          Add these now?
        </h3>
        <p className="text-xs text-ink-2">Optional. If you skip one, HR will ask for it later.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {optional.map((o) => (
            <label
              key={o.key}
              className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-3 text-sm transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand-tint"
            >
              <input type="checkbox" className="mt-0.5 h-4 w-4 flex-none accent-[var(--color-brand)]" checked={c[o.key]} onChange={(e) => set(o.key, e.target.checked)} />
              <span>
                <span className="block font-semibold">{o.label}</span>
                <span className="block text-xs text-ink-2">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>
    </form>
  );
}
