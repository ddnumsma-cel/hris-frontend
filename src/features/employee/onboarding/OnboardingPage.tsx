import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormProvider, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastContext";
import { CheckCircleIcon, HistoryIcon } from "@/components/icons";
import { createEmployee, findPossibleDuplicates, type PossibleDuplicate } from "@/lib/api";
import type { AddEmployeeFormValues } from "@/lib/schemas";
import type { Employee } from "@/lib/types";
import { ContactStep } from "./ContactStep";
import { EmploymentStep } from "./EmploymentStep";
import { GovernmentStep } from "./GovernmentStep";
import { IdentityStep } from "./IdentityStep";
import { useIdScan } from "./useIdScan";
import {
  clearDraft,
  draftHasInput,
  emptyValues,
  formatSavedAt,
  loadDraft,
  saveDraft,
  isFilled,
  stepProgress,
  steps as baseSteps,
  toCreateInput,
  type Draft,
  type FieldName,
} from "./model";
import { ReviewStep } from "./ReviewStep";
import { BuildingForm } from "./BuildingForm";
import { ChoicesModal } from "./ChoicesModal";
import {
  buildLines,
  ChoicesContext,
  choicesResolver,
  clearChoices,
  documentsFor,
  FULL_FORM,
  hiddenFields,
  loadChoices,
  saveChoices,
  stepsFor,
  type OnboardingChoices,
} from "./choices";
import { StepBar, StepList, type StepStatus } from "./StepList";

// Choices change what's inside each step, never the number of steps.
const REVIEW = baseSteps.length - 1;

function firstStepWithError(errors: FieldErrors<AddEmployeeFormValues>, steps: ReturnType<typeof stepsFor>) {
  const index = steps.findIndex((s) => s.fields.some((f) => errors[f]));
  return index === -1 ? null : index;
}

/** The new hire fills in their own details; submitting adds them to HR's Employee Directory. */
export function OnboardingPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  // What the employee chose to provide. None yet = first visit, so the choice modal opens.
  const [choices, setChoices] = useState<OnboardingChoices | null>(() => loadChoices());
  const active = choices ?? FULL_FORM;
  const steps = useMemo(() => stepsFor(active), [active]);
  const [resolver] = useState(choicesResolver);

  const form = useForm<AddEmployeeFormValues, OnboardingChoices>({
    resolver,
    context: active,
    defaultValues: emptyValues(),
    mode: "onTouched",
  });
  const { control, trigger, reset, handleSubmit, getValues, setFocus, formState } = form;
  const idScan = useIdScan(form);

  const [step, setStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  // A saved draft is only offered back, never applied without asking.
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(() => {
    const draft = loadDraft();
    return draft && draftHasInput(draft.values) ? draft : null;
  });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<PossibleDuplicate[]>([]);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [created, setCreated] = useState<Employee | null>(null);
  const [modalOpen, setModalOpen] = useState(() => !loadChoices() && !pendingDraft);
  const [buildingLines, setBuildingLines] = useState<string[] | null>(null);

  const values = useWatch({ control }) as AddEmployeeFormValues;

  useEffect(() => {
    // The assistant button would sit on top of this form's buttons; hide it here.
    document.body.dataset.hideAssistant = "";
    return () => {
      delete document.body.dataset.hideAssistant;
    };
  }, []);

  // Back to the top of the page (not scrollIntoView, which tucks the heading under the sticky top bar).
  function scrollToTop(smooth = true) {
    window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
  }

  // ---- Draft auto-save (paused while a saved draft is waiting for Resume / Start over) ----
  useEffect(() => {
    if (pendingDraft || created) return;
    if (!draftHasInput(values)) return;
    const t = window.setTimeout(() => {
      const at = saveDraft({ values: getValues(), step });
      if (at) setSavedAt(at);
    }, 600);
    return () => window.clearTimeout(t);
  }, [values, step, pendingDraft, created, getValues]);

  function resumeDraft() {
    if (!pendingDraft) return;
    reset(pendingDraft.values);
    const at = Math.min(pendingDraft.step, REVIEW - 1);
    setStep(at);
    setMaxVisited(at);
    setSavedAt(pendingDraft.savedAt);
    setPendingDraft(null);
    // Drafts from before choices existed keep every section.
    if (!choices) setChoices(FULL_FORM);
  }

  function startOver() {
    clearDraft();
    clearChoices();
    setChoices(null);
    setPendingDraft(null);
    setModalOpen(true);
  }

  // ---- Choices ----
  function applyChoices(c: OnboardingChoices) {
    saveChoices(c);
    setChoices(c);
    setModalOpen(false);
    const civil = form.getValues("civilStatus");
    if (c.married && !civil) form.setValue("civilStatus", "Married");
    if (!c.married && civil === "Married") form.setValue("civilStatus", "");
    if (c.dependents && form.getValues("dependents").length === 0) form.setValue("dependents", [{ name: "", birthDate: "" }]);
    // Errors on sections that are now hidden shouldn't linger.
    form.clearErrors(hiddenFields(c));
  }

  function buildForm(c: OnboardingChoices) {
    applyChoices(c);
    setBuildingLines(buildLines(c, form.getValues("firstName").trim() || undefined));
  }

  function closeChoices() {
    if (choices) setModalOpen(false);
    else applyChoices(FULL_FORM);
  }

  // ---- Step navigation ----
  const statuses: StepStatus[] = useMemo(
    () =>
      steps.map((s, i) => {
        const { filled, total } = stepProgress(s, values);
        const hasErrors = s.fields.some((f) => formState.errors[f]);
        const requiredDone = s.required.every((f) => isFilled(values[f as FieldName]));
        return { step: s, filled, total, hasErrors, complete: i < maxVisited && requiredDone && !hasErrors };
      }),
    [steps, values, formState.errors, maxVisited],
  );

  function goTo(index: number) {
    setStep(index);
    setMaxVisited((m) => Math.max(m, index));
    scrollToTop();
  }

  async function enterReview() {
    const v = getValues();
    const found = await findPossibleDuplicates({
      lastName: v.lastName,
      firstName: v.firstName,
      birthDate: v.birthDate,
      governmentNumbers: { tin: v.tin, sss: v.sss, philHealth: v.philHealth, pagIbig: v.pagIbig },
    });
    setDuplicates(found);
    setDuplicateAcknowledged(false);
    goTo(REVIEW);
  }

  async function next() {
    const ok = await trigger(steps[step].fields, { shouldFocus: true });
    if (!ok) {
      // Mark the step's fields as visited so each error clears as soon as it's fixed. Otherwise the
      // message only goes on blur, the layout jumps, and the next click on Next misses the button.
      for (const f of steps[step].fields) form.setValue(f, getValues(f), { shouldTouch: true });
      return;
    }
    if (step + 1 === REVIEW) await enterReview();
    else goTo(step + 1);
  }

  function selectStep(index: number) {
    if (index === REVIEW) enterReview();
    else goTo(index);
  }

  // ---- Create ----
  const mutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: (employee) => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["manager"] });
      clearDraft();
      clearChoices();
      setCreated(employee);
      scrollToTop(false);
    },
  });

  function submit() {
    handleSubmit(
    (v) => {
      if (duplicates.length > 0 && !duplicateAcknowledged) {
        scrollToTop();
        toast.show("Check the possible duplicate before you submit.");
        return;
      }
      // Sections they chose to leave out aren't sent, even if something was typed there earlier.
      const blank = emptyValues();
      const clean = { ...v } as Record<string, unknown>;
      for (const f of hiddenFields(active)) clean[f] = blank[f];
      mutation.mutate(
        toCreateInput(clean as AddEmployeeFormValues, { governmentId: idScan.governmentId, applicableDocuments: documentsFor(active).situational }),
      );
    },
    (errors) => {
      // Something on an earlier step is wrong: take them there and put the cursor on it.
      const index = firstStepWithError(errors, steps);
      if (index === null) return;
      goTo(index);
      const field = steps[index].fields.find((f) => errors[f]);
      if (field) window.setTimeout(() => setFocus(field), 50);
    },
    )();
  }

  const hasInput = draftHasInput(values) || idScan.images.length > 0;

  function cancel() {
    if (hasInput && !mutation.isPending) setConfirmDiscard(true);
    else navigate("/employee");
  }

  function discard() {
    clearDraft();
    clearChoices();
    idScan.reset();
    navigate("/employee");
  }

  if (created) {
    return (
      <div className="mx-auto w-full max-w-xl py-6">
        <div className="success-enter rounded-2xl border border-border bg-surface p-6 text-center shadow-sm sm:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-good-tint text-good">
            <CheckCircleIcon className="h-7 w-7" />
          </span>
          <h1 className="font-display mt-4 text-2xl font-semibold tracking-[-0.02em]">You're all set, {created.firstName ?? created.name}</h1>
          <p className="mt-1 text-sm text-ink-2">
            Your employee ID is <span className="font-num font-semibold text-ink">{created.id}</span> · {created.position} · {created.office}
          </p>
          <ul className="mx-auto mt-5 flex max-w-sm flex-col gap-1.5 text-left text-sm text-ink-2">
            <li>• HR now has your details in the Employee Directory</li>
            <li>• Your 201 file is open; HR will check your documents</li>
            <li>• Anything still missing is listed in your 201 file</li>
          </ul>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => navigate("/employee/201-file")}>Open my 201 file</Button>
            <Button variant="ghost" onClick={() => navigate("/employee")}>
              Go to Overview
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isReview = step === REVIEW;

  function saveDraftNow() {
    const at = saveDraft({ values: getValues(), step });
    if (at) {
      setSavedAt(at);
      toast.show("Draft saved. Come back to Onboarding anytime to finish.");
    } else {
      toast.show("This browser won't let us save a draft. Finish in one go, or allow site storage.");
    }
  }

  const primaryLabel = isReview ? (mutation.isPending ? "Submitting…" : "Submit to HR") : "Next";

  return (
    <FormProvider {...form}>
      <ChoicesContext.Provider value={active}>
      <div className="add-employee mx-auto flex w-full max-w-[1200px] flex-col gap-5">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">Onboarding</h1>
              <p className="mt-0.5 text-sm text-ink-2">Fill in your details for HR. Your progress saves as you go, so you can finish later.</p>
            </div>
            <div className="flex items-center gap-3">
              {savedAt && (
                <span className="text-xs text-ink-2" aria-live="polite">
                  Draft saved · {formatSavedAt(savedAt)}
                </span>
              )}
              <Button type="button" variant="ghost" size="sm" disabled={!hasInput || mutation.isPending || Boolean(pendingDraft)} onClick={saveDraftNow}>
                Save draft
              </Button>
            </div>
          </div>
        </div>

        {buildingLines ? (
          <BuildingForm
            lines={buildingLines}
            onDone={() => {
              setBuildingLines(null);
              scrollToTop(false);
            }}
          />
        ) : (
        <>
        <div className="lg:hidden">
          <StepBar statuses={statuses} current={step} />
          {choices && (
            <button type="button" onClick={() => setModalOpen(true)} disabled={Boolean(pendingDraft)} className="mt-2 text-xs font-semibold text-brand-ink hover:underline disabled:opacity-50">
              Change what I'll provide
            </button>
          )}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          {/* Stays at the top of the page and scrolls away with it. */}
          <aside className="hidden lg:block">
            <StepList statuses={statuses} current={step} maxVisited={maxVisited} onSelect={selectStep} />
            {choices && (
              <div className="mt-4 rounded-xl border border-border bg-surface px-3.5 py-3">
                <p className="text-xs text-ink-2">Your form only asks for what applies to you.</p>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  disabled={Boolean(pendingDraft)}
                  className="mt-1 text-xs font-semibold text-brand-ink hover:underline disabled:opacity-50"
                >
                  Change what I'll provide
                </button>
              </div>
            )}
          </aside>

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              // Enter moves to the next step; only the Review step creates the record.
              if (isReview) submit();
              else next();
            }}
            className="min-w-0 rounded-2xl border border-border bg-surface shadow-sm"
          >
            <div key={step} className="tab-enter p-5 sm:p-7">
              {pendingDraft && (
                <div role="alert" className="item-enter mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand-tint px-4 py-3">
                  <div className="flex items-start gap-2.5 text-sm">
                    <HistoryIcon className="mt-0.5 h-4 w-4 flex-none text-ink-2" />
                    <span>
                            <span className="font-semibold">You have an unfinished form</span>
                      {pendingDraft.values.firstName || pendingDraft.values.lastName
                        ? ` (${[pendingDraft.values.firstName, pendingDraft.values.lastName].filter(Boolean).join(" ")})`
                        : ""}
                      , saved {formatSavedAt(pendingDraft.savedAt)}. Pick one to continue.
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={startOver}>
                      Start over
                    </Button>
                    <Button type="button" size="sm" onClick={resumeDraft}>
                      Resume draft
                    </Button>
                  </div>
                </div>
              )}
              {/* Locked until the saved draft is resumed or discarded, so nothing typed here is lost. */}
              <fieldset disabled={Boolean(pendingDraft)} className={pendingDraft ? "opacity-50" : undefined}>
              {step === 0 && <IdentityStep idScan={idScan} />}
              {step === 1 && <ContactStep />}
              {step === 2 && <EmploymentStep />}
              {step === 3 && <GovernmentStep idScan={idScan} />}
              {isReview && (
                <ReviewStep
                  idScan={idScan}
                  duplicates={duplicates}
                  duplicateAcknowledged={duplicateAcknowledged}
                  onAcknowledgeDuplicate={() => setDuplicateAcknowledged(true)}
                  onEdit={goTo}
                />
              )}
              </fieldset>

              {mutation.isError && (
                <p role="alert" className="mt-5 rounded-lg bg-critical-tint px-4 py-2.5 text-sm text-critical">
                  We couldn't create the employee. Nothing you entered was lost — try again.
                </p>
              )}
            </div>

            {/* Actions close the card: part of the form, not a bar floating over it. */}
            <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <button
                type="button"
                onClick={cancel}
                disabled={mutation.isPending}
                className="rounded-full px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-50"
              >
                Cancel
              </button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                {step > 0 && (
                  <Button type="button" variant="ghost" className="justify-center" onClick={() => goTo(step - 1)} disabled={mutation.isPending}>
                    Back
                  </Button>
                )}
                <Button
                  type="submit"
                  className="justify-center sm:min-w-32"
                  disabled={mutation.isPending || idScan.scanning || Boolean(pendingDraft)}
                >
                  {primaryLabel}
                </Button>
              </div>
            </div>
          </form>
        </div>
        </>
        )}
      </div>

      <ChoicesModal open={modalOpen} initial={choices} onBuild={buildForm} onFullForm={() => applyChoices(FULL_FORM)} onClose={closeChoices} />

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard your onboarding form?"
        message="What you've entered will be deleted, including the saved draft."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={discard}
        onClose={() => setConfirmDiscard(false)}
      />
      </ChoicesContext.Provider>
    </FormProvider>
  );
}
