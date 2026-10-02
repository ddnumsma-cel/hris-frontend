import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { useForm, useWatch, type FieldPath, type RegisterOptions } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastContext";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { createEmployee, listEmployees, listPositions, listUnits, peso, unitPathOf } from "@/lib/corehr/api";
import { newEmployeeSchema, type NewEmployeeValues } from "@/lib/corehr/schemas";
import { isoDate } from "@/lib/corehr/store";
import { EMPLOYMENT_TYPES } from "@/lib/corehr/types";
import { SpecFields } from "./EditSectionDialog";
import { CONTACT_FIELDS, GOVERNMENT_FIELDS, PERSONAL_FIELDS, type FieldSpec } from "./fields";
import { formatDate, keys, mask, softInputClass, useActor } from "./format";
import type { ScannedIdFields } from "@/lib/idScan";
import { IdScanCard } from "./IdScanCard";
import { ErrorNote, Field, Stepper } from "./ui";

const SCANNABLE = ["firstName", "middleName", "lastName", "suffix", "birthDate", "sex"] as const;

const empty: NewEmployeeValues = {
  personal: { firstName: "", middleName: "", lastName: "", suffix: "", birthDate: "", sex: "", civilStatus: "", nationality: "Filipino" },
  contact: { workEmail: "", personalEmail: "", mobile: "", address: "", city: "", province: "", emergencyName: "", emergencyRelationship: "", emergencyPhone: "" },
  government: { sss: "", philhealth: "", pagibig: "", tin: "" },
  job: { positionId: "", teamId: "", supervisorId: "", employmentType: "Probationary", dateHired: isoDate(), monthlySalary: Number.NaN, workSchedule: "Mon–Fri, 8:00 AM – 5:00 PM" },
};

const STEPS = [
  { key: "personal", label: "Personal details", title: "Who are you adding?", description: "Use their name exactly as it reads on their PSA birth certificate." },
  { key: "contact", label: "Contact", title: "How do we reach them?", description: "The work email is required and becomes their sign-in." },
  { key: "government", label: "Government IDs", title: "Government numbers", description: "Optional for now. Payroll needs them before the first cutoff." },
  { key: "job", label: "Job placement", title: "Where will they work?", description: "Only positions with an open slot can be filled." },
  { key: "review", label: "Review and create", title: "Review and create", description: "Check everything once. You can still edit any of it later from their 201 file." },
] as const;
type SectionKey = Exclude<(typeof STEPS)[number]["key"], "review">;

const WORK_EMAIL_REQUIRED: FieldSpec[] = CONTACT_FIELDS.map((f) => (f.name === "workEmail" ? { ...f, required: true } : f));

function ReviewGroup({ title, onEdit, rows }: { title: string; onEdit: () => void; rows: [string, ReactNode][] }) {
  return (
    <section className="rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" onClick={onEdit} className="text-xs font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline">
          Edit
        </button>
      </div>
      <dl className="grid gap-x-6 px-4 py-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 py-1.5 text-sm sm:block">
            <dt className="text-xs text-ink-3">{label}</dt>
            <dd className={clsx("text-right sm:text-left", !value && "text-ink-3 italic")}>{value || "Not provided"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Add employee as a short wizard: one topic per step, a review at the end. */
export function NewEmployeePage() {
  const navigate = useNavigate();
  // "Hire" on the Company page arrives with ?position= already chosen.
  const [params] = useSearchParams();
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const unitsQuery = useQuery({ queryKey: keys.units, queryFn: listUnits });
  const positionsQuery = useQuery({ queryKey: keys.positions, queryFn: listPositions });
  const employeesQuery = useQuery({ queryKey: keys.employees, queryFn: listEmployees });
  const units = unitsQuery.data ?? [];
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [fromId, setFromId] = useState<Set<string>>(new Set());
  const [scannedId, setScannedId] = useState<{ idType: string; idNumber?: string; idExpiry?: string; fileName: string } | null>(null);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const {
    register: baseRegister,
    handleSubmit,
    control,
    getFieldState,
    setValue,
    trigger,
    getValues,
    formState: { errors, isDirty },
  } = useForm<NewEmployeeValues>({ resolver: zodResolver(newEmployeeSchema), defaultValues: { ...empty, job: { ...empty.job, positionId: params.get("position") ?? "" } }, mode: "onTouched" });
  // A field showing an error re-checks as you type, so the message clears before the
  // next click instead of on blur (which shifted the layout and swallowed the click).
  const register = (name: FieldPath<NewEmployeeValues>, options?: RegisterOptions<NewEmployeeValues>) =>
    baseRegister(name, {
      ...options,
      onChange: (e) => {
        options?.onChange?.(e);
        // A hand edit means it's no longer "from the ID".
        const short = name.split(".").pop()!;
        if (fromId.has(short)) setFromId((s) => new Set([...s].filter((x) => x !== short)));
        if (getFieldState(name).error) trigger(name);
      },
    });
  const positionId = useWatch({ control, name: "job.positionId" });
  const position = positionsQuery.data?.find((p) => p.id === positionId);
  const branches = units.filter((u) => u.type === "branch" && u.active);
  const departments = units.filter((u) => u.type === "department" && u.active && (!branchId || u.parentId === branchId));
  const positions = (positionsQuery.data ?? []).filter((p) => p.active && (!departmentId ? !branchId || p.branchId === branchId : p.departmentId === departmentId));
  const teams = units.filter((u) => u.type === "team" && u.active && u.parentId === position?.departmentId);
  const people = (employeesQuery.data ?? []).filter((e) => e.status !== "Separated");

  const mutation = useMutation({
    mutationFn: (v: NewEmployeeValues) => createEmployee(v, actor, scannedId ?? undefined),
    onSuccess: (e) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.show(`${e.personal.firstName} ${e.personal.lastName} added as ${e.id}.`);
      navigate(`/admin/people/${e.id}`);
    },
  });

  /** Moving ahead checks the step being left; going back never does. */
  async function goTo(i: number) {
    if (i === step) return;
    const key = STEPS[step]!.key;
    if (i > step && key !== "review" && !(await trigger(key))) return;
    setDirection(i > step ? "forward" : "back");
    setStep(i);
    setFurthest((f) => Math.max(f, i));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const next = () => goTo(step + 1);

  function applyScan(result: ScannedIdFields, file: File) {
    const filled: string[] = [];
    for (const k of SCANNABLE) {
      const value = result[k];
      if (!value) continue;
      setValue(`personal.${k}`, value, { shouldDirty: true, shouldValidate: true });
      filled.push(k);
    }
    setFromId(new Set(filled));
    setScannedId({ idType: result.idType || "Other", idNumber: result.idNumber, idExpiry: result.idExpiry, fileName: file.name });
    return filled.length + (result.idNumber ? 1 : 0);
  }
  const submit = handleSubmit(
    (v) => mutation.mutate(v),
    (errs) => {
      const first = STEPS.findIndex((s) => s.key !== "review" && errs[s.key as SectionKey]);
      if (first >= 0) goTo(first);
    },
  );

  const sectionErrors = (k: SectionKey) => (errors[k] ?? {}) as Record<string, { message?: string }>;
  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;
  const v = getValues();
  const name = [v.personal.firstName, v.personal.middleName, v.personal.lastName, v.personal.suffix].filter(Boolean).join(" ");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div>
        <Link to="/admin/people" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 hover:text-ink">
          <ArrowRightIcon className="h-3.5 w-3.5 rotate-180" />
          People
        </Link>
        <h1 className="font-display mt-2 text-2xl font-semibold tracking-[-0.02em]">Add employee</h1>
        <p className="mt-0.5 text-[0.85rem] text-ink-2">Creates their 201 file, an empty document checklist, and a Hired entry in their history.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-5 pt-6 pb-5 sm:px-8">
          <Stepper steps={STEPS.map((s) => s.label)} current={step} furthest={furthest} onSelect={goTo} />
          <p className="mt-3 text-xs text-ink-3 sm:hidden">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isLast) submit();
            else next();
          }}
          noValidate
        >
          <div key={step} className={clsx("px-5 py-7 sm:px-8", direction === "forward" ? "step-forward" : "step-back")}>
            <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">{current.title}</h2>
            <p className="mt-1 mb-6 text-sm text-ink-2">{current.description}</p>

            {current.key === "personal" && (
              <div className="flex flex-col gap-6">
                <IdScanCard
                  onScanned={applyScan}
                  onCleared={() => {
                    setFromId(new Set());
                    setScannedId(null);
                  }}
                />
                <SpecFields<NewEmployeeValues> fields={PERSONAL_FIELDS} prefix="personal" register={register} errors={sectionErrors("personal")} inputClassName={softInputClass} tagged={fromId} />
              </div>
            )}
            {current.key === "contact" && <SpecFields<NewEmployeeValues> fields={WORK_EMAIL_REQUIRED} prefix="contact" register={register} errors={sectionErrors("contact")} inputClassName={softInputClass} />}
            {current.key === "government" && <SpecFields<NewEmployeeValues> fields={GOVERNMENT_FIELDS} prefix="government" register={register} errors={sectionErrors("government")} inputClassName={softInputClass} />}

            {current.key === "job" && (
              <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
                <Field id="nj-branch" label="Branch">
                  <select
                    id="nj-branch"
                    className={softInputClass}
                    value={branchId}
                    onChange={(e) => {
                      setBranchId(e.target.value);
                      setDepartmentId("");
                      setValue("job.positionId", "");
                      setValue("job.teamId", "");
                    }}
                  >
                    <option value="">Any branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="nj-dept" label="Department">
                  <select
                    id="nj-dept"
                    className={softInputClass}
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value);
                      setValue("job.positionId", "");
                      setValue("job.teamId", "");
                    }}
                  >
                    <option value="">Any department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {branchId ? d.name : unitPathOf(d.id, units)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="f-job-positionId" label="Position" required className="sm:col-span-2" error={errors.job?.positionId?.message} hint={position ? `${position.open} of ${position.slots} slots open` : undefined}>
                  <select
                    id="f-job-positionId"
                    className={softInputClass}
                    aria-invalid={errors.job?.positionId ? true : undefined}
                    {...register("job.positionId", {
                      onChange: (e) => {
                        setValue("job.teamId", "");
                        const p = positionsQuery.data?.find((x) => x.id === e.target.value);
                        if (p) setValue("job.employmentType", p.employmentType === "Regular" ? "Probationary" : p.employmentType);
                      },
                    })}
                  >
                    <option value="">Choose a position</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.open === 0}>
                        {p.title} · {unitPathOf(p.departmentId, units)} {p.open === 0 ? "(full)" : `(${p.open} open)`}
                      </option>
                    ))}
                  </select>
                </Field>
                {teams.length > 0 && (
                  <Field id="f-job-teamId" label="Team">
                    <select id="f-job-teamId" className={softInputClass} {...register("job.teamId")}>
                      <option value="">Department only, no team</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field id="f-job-supervisorId" label="Supervisor" hint="Blank uses whoever holds the position it reports to">
                  <select id="f-job-supervisorId" className={softInputClass} {...register("job.supervisorId")}>
                    <option value="">Automatic</option>
                    {people.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} · {e.positionTitle}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="f-job-employmentType" label="Employment type" required>
                  <select id="f-job-employmentType" className={softInputClass} {...register("job.employmentType")}>
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field id="f-job-dateHired" label="Date hired" required error={errors.job?.dateHired?.message}>
                  <input id="f-job-dateHired" type="date" className={softInputClass} aria-invalid={errors.job?.dateHired ? true : undefined} {...register("job.dateHired")} />
                </Field>
                <Field id="f-job-monthlySalary" label="Monthly salary (₱)" required error={errors.job?.monthlySalary?.message}>
                  <input id="f-job-monthlySalary" type="number" inputMode="numeric" min={1} step={500} className={softInputClass} aria-invalid={errors.job?.monthlySalary ? true : undefined} {...register("job.monthlySalary", { valueAsNumber: true })} />
                </Field>
                <Field id="f-job-workSchedule" label="Work schedule" required error={errors.job?.workSchedule?.message}>
                  <input id="f-job-workSchedule" className={softInputClass} {...register("job.workSchedule")} />
                </Field>
              </div>
            )}

            {current.key === "review" && (
              <div className="flex flex-col gap-3">
                <ReviewGroup
                  title="Personal details"
                  onEdit={() => goTo(0)}
                  rows={[
                    ["Full name", name],
                    ["Birth date", v.personal.birthDate && formatDate(v.personal.birthDate)],
                    ["Sex", v.personal.sex],
                    ["Civil status", v.personal.civilStatus],
                  ]}
                />
                <ReviewGroup
                  title="Contact"
                  onEdit={() => goTo(1)}
                  rows={[
                    ["Work email", v.contact.workEmail],
                    ["Mobile", v.contact.mobile],
                    ["Address", [v.contact.address, v.contact.city, v.contact.province].filter(Boolean).join(", ")],
                    ["Emergency contact", [v.contact.emergencyName, v.contact.emergencyPhone].filter(Boolean).join(" · ")],
                  ]}
                />
                <ReviewGroup
                  title="Government IDs"
                  onEdit={() => goTo(2)}
                  rows={[
                    ["Scanned ID", scannedId && [scannedId.idType, scannedId.idNumber && mask(scannedId.idNumber)].filter(Boolean).join(" · ")],
                    ["SSS", mask(v.government.sss)],
                    ["PhilHealth", mask(v.government.philhealth)],
                    ["Pag-IBIG", mask(v.government.pagibig)],
                    ["TIN", mask(v.government.tin)],
                  ]}
                />
                <ReviewGroup
                  title="Job placement"
                  onEdit={() => goTo(3)}
                  rows={[
                    ["Position", position && `${position.title} · ${unitPathOf(position.departmentId, units)}`],
                    ["Team", units.find((u) => u.id === v.job.teamId)?.name],
                    ["Employment type", v.job.employmentType],
                    ["Date hired", formatDate(v.job.dateHired)],
                    ["Monthly salary", Number.isFinite(v.job.monthlySalary) ? peso(v.job.monthlySalary) : ""],
                    ["Supervisor", people.find((e) => e.id === v.job.supervisorId)?.name ?? (v.job.supervisorId ? "" : "Automatic")],
                  ]}
                />
                <ErrorNote error={mutation.error} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border bg-surface-2/50 px-5 py-4 sm:px-8">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                if (step > 0) goTo(step - 1);
                else if (!isDirty || window.confirm("Discard this new employee?")) navigate("/admin/people");
              }}
            >
              {step > 0 ? "Back" : "Cancel"}
            </Button>
            <span className="font-num ml-auto hidden text-xs text-ink-3 sm:inline">
              Step {step + 1} of {STEPS.length}
            </span>
            {!isLast && furthest === STEPS.length - 1 ? (
              <>
                <Button type="submit" variant="ghost" className="ml-auto sm:ml-3">
                  Next step
                </Button>
                <Button type="button" onClick={() => goTo(STEPS.length - 1)}>
                  Back to review
                </Button>
              </>
            ) : (
              <Button type="submit" className="ml-auto sm:ml-3" disabled={mutation.isPending} icon={isLast ? <CheckIcon className="h-4 w-4" /> : undefined}>
                {isLast ? (mutation.isPending ? "Creating…" : "Create 201 file") : "Continue"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
