import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormProvider, useForm, useWatch, type FieldErrors, type FieldPath } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastContext";
import { CheckCircleIcon, FileQuestionIcon, HistoryIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  fetchOnboardingForm,
  findPossibleDuplicates,
  ONBOARDING_FORM_QUERY_KEY,
  ONBOARDING_FORM_STORAGE_KEY,
  submitOnboarding,
  type PossibleDuplicate,
} from "@/lib/api";
import type { OnboardingFormConfig } from "@/lib/onboardingForm";
import type { AddEmployeeFormValues } from "@/lib/schemas";
import type { OnboardingSubmission } from "@/lib/types";
import { FormSection } from "./FormFields";
import { GovernmentStep } from "./GovernmentStep";
import { useIdScan } from "./useIdScan";
import {
  clearDraft,
  draftHasInput,
  emptyValues,
  formatSavedAt,
  loadDraft,
  saveDraft,
  isFilled,
  onboardingResolver,
  stepProgress,
  stepsFor,
  toSubmissionInput,
  type StepDef,
  valueAt,
  type Draft,
  type FieldName,
} from "./model";
import { ReviewStep } from "./ReviewStep";
import { StepBar, StepList, type StepStatus } from "./StepList";

function firstStepWithError(errors: FieldErrors<AddEmployeeFormValues>, steps: StepDef[]) {
  const index = steps.findIndex((s) => s.fields.some((f) => valueAt(errors, f)));
  return index === -1 ? null : index;
}

/** HR builds the form in the Employee Directory; until then there's nothing to fill in. */
export function OnboardingPage() {
  const queryClient = useQueryClient();
  const formQuery = useQuery({ queryKey: ONBOARDING_FORM_QUERY_KEY, queryFn: fetchOnboardingForm });

  // HR saving the form in another tab shows up here straight away.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === ONBOARDING_FORM_STORAGE_KEY) queryClient.invalidateQueries({ queryKey: ONBOARDING_FORM_QUERY_KEY });
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);

  if (formQuery.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!formQuery.data) {
    return (
      <div className="mx-auto w-full max-w-xl py-10">
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-ink-2">
            <FileQuestionIcon className="h-7 w-7" />
          </span>
          <h1 className="font-display mt-4 text-xl font-semibold tracking-[-0.02em]">HR is preparing your onboarding form</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-2">You'll be able to fill in your details and upload your 201 files here once it's ready.</p>
        </div>
      </div>
    );
  }

  return <OnboardingForm config={formQuery.data} />;
}

function OnboardingForm({ config }: { config: OnboardingFormConfig }) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [resolver] = useState(onboardingResolver);
  // HR's sections become the steps; edits HR makes re-shape them live.
  const steps = useMemo(() => stepsFor(config), [config]);
  const REVIEW = steps.length - 1;

  const form = useForm<AddEmployeeFormValues, OnboardingFormConfig>({
    resolver,
    context: config,
    defaultValues: emptyValues(),
    mode: "onTouched",
  });
  const { control, trigger, reset, handleSubmit, getValues, setFocus, formState } = form;
  const idScan = useIdScan(form as unknown as Parameters<typeof useIdScan>[0]);

  const [rawStep, setStep] = useState(0);
  // HR may remove a section while this page is open; never point past the steps that exist.
  const step = Math.min(rawStep, REVIEW);
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
  const [created, setCreated] = useState<OnboardingSubmission | null>(null);

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
  }

  function startOver() {
    clearDraft();
    setPendingDraft(null);
  }

  // ---- Step navigation ----
  const statuses: StepStatus[] = useMemo(
    () =>
      steps.map((s, i) => {
        const { filled, total } = stepProgress(s, values);
        const hasErrors = s.fields.some((f) => valueAt(formState.errors, f));
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
    const ok = await trigger(steps[step].fields as FieldPath<AddEmployeeFormValues>[], { shouldFocus: true });
    if (!ok) {
      // Mark the step's fields as visited so each error clears as soon as it's fixed. Otherwise the
      // message only goes on blur, the layout jumps, and the next click on Next misses the button.
      for (const f of steps[step].fields as FieldPath<AddEmployeeFormValues>[]) form.setValue(f, getValues(f), { shouldTouch: true });
      return;
    }
    if (step + 1 === REVIEW) await enterReview();
    else goTo(step + 1);
  }

  function selectStep(index: number) {
    if (index === REVIEW) enterReview();
    else goTo(index);
  }

  // ---- Submit ----
  const mutation = useMutation({
    mutationFn: submitOnboarding,
    onSuccess: (submission) => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["employee"] });
      clearDraft();
      setCreated(submission);
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
      mutation.mutate(toSubmissionInput(v, idScan.governmentId, config));
    },
    (errors) => {
      // Something on an earlier step is wrong: take them there and put the cursor on it.
      const index = firstStepWithError(errors, steps);
      if (index === null) return;
      goTo(index);
      const field = steps[index].fields.find((f) => valueAt(errors, f)) as FieldPath<AddEmployeeFormValues> | undefined;
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
          <h1 className="font-display mt-4 text-2xl font-semibold tracking-[-0.02em]">Sent to HR, {created.input.firstName}</h1>
          <p className="mt-1 text-sm text-ink-2">HR will add your role and start date, then your 201 file opens.</p>
          <ul className="mx-auto mt-5 flex max-w-sm flex-col gap-1.5 text-left text-sm text-ink-2">
            <li>
              • {created.input.uploadedDocuments?.length || created.input.governmentId ? "Your uploaded files are with HR for checking" : "HR will check your files once you upload them"}
            </li>
            <li>• Anything still missing can be uploaded from your 201 file later</li>
          </ul>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => navigate("/employee")}>Back to Overview</Button>
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
      <div className="add-employee mx-auto flex w-full max-w-[1200px] flex-col gap-5">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">Onboarding</h1>
              <p className="mt-0.5 text-sm text-ink-2">Fill in your details and upload your 201 files. Your progress saves as you go, so you can finish later.</p>
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

        <div className="lg:hidden">
          <StepBar statuses={statuses} current={step} />
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          {/* Stays at the top of the page and scrolls away with it. */}
          <aside className="hidden lg:block">
            <StepList statuses={statuses} current={step} maxVisited={maxVisited} onSelect={selectStep} />
          </aside>

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              // Enter moves to the next step; only the Review step sends it to HR.
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
              {steps[step]?.section && <FormSection section={steps[step].section!} idScan={idScan} />}
              {steps[step]?.id === "government" && <GovernmentStep idScan={idScan} />}
              {isReview && (
                <ReviewStep
                  steps={steps}
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
                  We couldn't send this to HR. Nothing you entered was lost — try again.
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
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard your onboarding form?"
        message="What you've entered will be deleted, including the saved draft."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={discard}
        onClose={() => setConfirmDiscard(false)}
      />
    </FormProvider>
  );
}
