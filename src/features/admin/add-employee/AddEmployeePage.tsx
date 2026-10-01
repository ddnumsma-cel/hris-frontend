import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormProvider, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastContext";
import { useAuditActor } from "@/components/shared/PersonnelFilePanels";
import { CheckCircleIcon, ChevronLeftIcon, HistoryIcon } from "@/components/icons";
import {
  createEmployee,
  fetchApplicants,
  fetchJobRequisitions,
  findPossibleDuplicates,
  type PossibleDuplicate,
} from "@/lib/api";
import { addEmployeeSchema, hireClusterOptions, type AddEmployeeFormValues } from "@/lib/schemas";
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
  stepProgress,
  steps,
  toCreateInput,
  type Draft,
  type FieldName,
} from "./model";
import { ReviewStep } from "./ReviewStep";
import { StepBar, StepList, type StepStatus } from "./StepList";

const REVIEW = steps.length - 1;

function firstStepWithError(errors: FieldErrors<AddEmployeeFormValues>) {
  const index = steps.findIndex((s) => s.fields.some((f) => errors[f]));
  return index === -1 ? null : index;
}

export function AddEmployeePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const actor = useAuditActor();
  const [searchParams] = useSearchParams();
  const applicantId = searchParams.get("applicant") ?? undefined;

  const form = useForm<AddEmployeeFormValues>({
    resolver: zodResolver(addEmployeeSchema),
    defaultValues: emptyValues(),
    mode: "onTouched",
  });
  const { control, trigger, reset, handleSubmit, getValues, setFocus, formState } = form;
  const idScan = useIdScan(form);

  const [step, setStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  // A saved draft is only offered back, never applied without asking.
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(() => {
    const draft = applicantId ? null : loadDraft();
    return draft && draftHasInput(draft.values) ? draft : null;
  });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<PossibleDuplicate[]>([]);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [created, setCreated] = useState<Employee | null>(null);
  
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

  // ---- Prefill from a Recruitment hire ----
  const applicantsQuery = useQuery({ queryKey: ["admin", "applicants"], queryFn: fetchApplicants, enabled: Boolean(applicantId) });
  const requisitionsQuery = useQuery({
    queryKey: ["admin", "job-requisitions"],
    queryFn: fetchJobRequisitions,
    enabled: Boolean(applicantId),
  });
  const applicant = applicantsQuery.data?.find((a) => a.id === applicantId);
  const prefilledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!applicant || !requisitionsQuery.data || prefilledFor.current === applicant.id) return;
    const requisition = requisitionsQuery.data.find((r) => r.id === applicant.requisitionId);
    const cluster = hireClusterOptions.find((c) => c === requisition?.cluster);
    prefilledFor.current = applicant.id;
    reset({
      ...emptyValues(),
      firstName: applicant.firstName,
      lastName: applicant.lastName,
      personalEmail: applicant.email ?? "",
      phone: applicant.phone ?? "",
      position: requisition?.title ?? "",
      // Client clusters sit under Accounting; anything else HR picks.
      department: cluster ? "Accounting" : "",
      cluster: cluster ?? "",
      office: requisition?.office ?? "Cebu HQ",
      dateHired: applicant.startDate ?? emptyValues().dateHired,
    });
  }, [applicant, requisitionsQuery.data, reset]);

  // ---- Draft auto-save (paused while a saved draft is waiting for Resume / Start over) ----
  useEffect(() => {
    if (pendingDraft || created) return;
    if (!draftHasInput(values)) return;
    const t = window.setTimeout(() => {
      const at = saveDraft({ values: getValues(), step, applicantId });
      if (at) setSavedAt(at);
    }, 600);
    return () => window.clearTimeout(t);
  }, [values, step, pendingDraft, created, applicantId, getValues]);

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
        const hasErrors = s.fields.some((f) => formState.errors[f]);
        const requiredDone = s.required.every((f) => {
          const v = values[f as FieldName];
          return Array.isArray(v) ? v.length > 0 : String(v ?? "").trim().length > 0;
        });
        return { step: s, filled, total, hasErrors, complete: i < maxVisited && requiredDone && !hasErrors };
      }),
    [values, formState.errors, maxVisited],
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
    if (!ok) return;
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
      setCreated(employee);
      scrollToTop(false);
    },
  });

  function submit() {
    handleSubmit(
    (v) => {
      if (duplicates.length > 0 && !duplicateAcknowledged) {
        scrollToTop();
        toast.show("Check the possible duplicate before creating this employee.");
        return;
      }
      mutation.mutate(toCreateInput(v, { governmentId: idScan.governmentId, applicantId, actor }));
    },
    (errors) => {
      // Something on an earlier step is wrong: take them there and put the cursor on it.
      const index = firstStepWithError(errors);
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
    else navigate("/admin/directory");
  }

  function discard() {
    clearDraft();
    idScan.reset();
    navigate("/admin/directory");
  }

  function addAnother() {
    idScan.reset();
    reset(emptyValues());
    setCreated(null);
    setStep(0);
    setMaxVisited(0);
    setSavedAt(null);
    setDuplicates([]);
    navigate("/admin/directory/new", { replace: true });
  }

  if (created) {
    return (
      <div className="mx-auto w-full max-w-xl py-6">
        <div className="success-enter rounded-2xl border border-border bg-surface p-6 text-center shadow-sm sm:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-good-tint text-good">
            <CheckCircleIcon className="h-7 w-7" />
          </span>
          <h1 className="font-display mt-4 text-2xl font-semibold tracking-[-0.02em]">{created.name} is in the directory</h1>
          <p className="mt-1 text-sm text-ink-2">
            Employee ID <span className="font-num font-semibold text-ink">{created.id}</span> · {created.position} · {created.office}
          </p>
          <ul className="mx-auto mt-5 flex max-w-sm flex-col gap-1.5 text-left text-sm text-ink-2">
            <li>• 201 file created with the details you entered</li>
            <li>• Added to the onboarding pipeline</li>
            {applicantId && <li>• Linked to their Recruitment application</li>}
          </ul>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => navigate(`/admin/directory?employee=${created.id}`)}>Open 201 file</Button>
            <Button variant="ghost" onClick={() => navigate("/admin/onboarding")}>
              Start onboarding
            </Button>
            <Button variant="ghost" onClick={addAnother}>
              Add another employee
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isReview = step === REVIEW;

  function saveDraftNow() {
    const at = saveDraft({ values: getValues(), step, applicantId });
    if (at) {
      setSavedAt(at);
      toast.show("Draft saved. You can come back to it from Add employee.");
    } else {
      toast.show("This browser won't let us save a draft. Finish in one go, or allow site storage.");
    }
  }

  const primaryLabel = isReview ? (mutation.isPending ? "Creating…" : "Create employee") : "Next";

  return (
    <FormProvider {...form}>
      <div className="add-employee mx-auto flex w-full max-w-[1200px] flex-col gap-5">
        <div>
          <Link to="/admin/directory" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink">
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            Employee Directory
          </Link>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
              {applicant ? `Add ${applicant.firstName} ${applicant.lastName}` : "Add employee"}
            </h1>
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
          {applicant && (
            <p className="mt-0.5 text-sm text-ink-2">Details from their Recruitment application are filled in. Check them and add the rest.</p>
          )}
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
                      <span className="font-semibold">You have an unfinished employee</span>
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
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard new employee?"
        message="What you've entered will be deleted, including the saved draft."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={discard}
        onClose={() => setConfirmDiscard(false)}
      />
    </FormProvider>
  );
}
