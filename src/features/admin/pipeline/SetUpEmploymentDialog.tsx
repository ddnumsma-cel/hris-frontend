import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useAuditActor } from "@/components/shared/PersonnelFilePanels";
import { completeOnboarding, fetchEmployeeDirectory } from "@/lib/api";
import { todayIso } from "@/lib/format";
import { employmentSchema, type EmploymentFormValues } from "@/lib/schemas";
import type { Employee, OnboardingSubmission } from "@/lib/types";
import { inputClass, Label } from "@/features/employee/onboarding/fields";
import { EmploymentFields } from "./EmploymentFields";

const MUTATION_KEY = ["pipeline", "complete-onboarding"];

const defaults = (): EmploymentFormValues => ({
  position: "",
  department: "",
  cluster: "",
  office: "Cebu HQ",
  dateHired: todayIso(),
  employmentStatus: "Probationary",
  reportsToId: "",
});

/** HR adds the job details a new hire couldn't know; saving creates their ID and 201 file. */
export function SetUpEmploymentDialog({
  submission,
  onClose,
  onDone,
}: {
  submission: OnboardingSubmission | null;
  onClose: () => void;
  onDone: (employee: Employee) => void;
}) {
  // Disabled while saving so a double click can't add the same person twice.
  const saving = useIsMutating({ mutationKey: MUTATION_KEY }) > 0;
  return (
    <Dialog
      open={Boolean(submission)}
      onClose={onClose}
      title="Set up employment"
      size="lg"
      dismissOnBackdrop={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" className="justify-center" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="set-up-employment" className="justify-center" disabled={saving}>
            {saving ? "Adding…" : "Add to directory"}
          </Button>
        </div>
      }
    >
      {submission && <SetUpForm key={submission.id} submission={submission} onDone={onDone} />}
    </Dialog>
  );
}

function SetUpForm({ submission, onDone }: { submission: OnboardingSubmission; onDone: (employee: Employee) => void }) {
  const queryClient = useQueryClient();
  const actor = useAuditActor();
  const [resolver] = useState(() => zodResolver(employmentSchema));
  const form = useForm<EmploymentFormValues>({ resolver, defaultValues: defaults(), mode: "onTouched" });
  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const { input } = submission;
  const files = new Set([...(input.uploadedDocuments ?? []).map((u) => u.type), ...(input.governmentId ? ["Valid Government ID"] : [])]).size;

  const mutation = useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (v: EmploymentFormValues) =>
      completeOnboarding(
        submission.id,
        {
          position: v.position,
          department: v.department,
          // Only Accounting picks a cluster; IT is set to Admin & Support when the department is chosen.
          cluster: v.cluster as Employee["cluster"],
          office: v.office,
          dateHired: v.dateHired,
          employmentStatus: v.employmentStatus,
          reportsToId: v.reportsToId || undefined,
        },
        actor,
      ),
    onSuccess: (employee) => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["manager"] });
      queryClient.invalidateQueries({ queryKey: ["employee"] });
      onDone(employee);
    },
  });

  return (
    <FormProvider {...form}>
      <form id="set-up-employment" noValidate onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-6">
        <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand-ink">
            {(input.firstName[0] ?? "") + (input.lastName[0] ?? "")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {input.firstName} {input.lastName}
            </p>
            <p className="truncate text-xs text-ink-2">
              Submitted Onboarding · {input.phone ?? "No mobile"} · {files} file{files === 1 ? "" : "s"} uploaded
            </p>
          </div>
        </div>

        <EmploymentFields lastName={input.lastName} firstName={input.firstName} />

        <div className="md:max-w-[calc(50%-0.5rem)]">
          <Label htmlFor="emp-reports">Reports to</Label>
          <select id="emp-reports" className={inputClass} {...form.register("reportsToId")}>
            <option value="">HR & People Operations</option>
            {(directoryQuery.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.position}
              </option>
            ))}
          </select>
        </div>

        {mutation.isError && (
          <p role="alert" className="rounded-lg bg-critical-tint px-4 py-2.5 text-sm text-critical">
            {mutation.error instanceof Error ? mutation.error.message : "Couldn't add them. Try again."}
          </p>
        )}
      </form>
    </FormProvider>
  );
}
