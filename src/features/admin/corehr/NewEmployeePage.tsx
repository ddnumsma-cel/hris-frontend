import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { useForm, useWatch, type FieldPath, type RegisterOptions } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastContext";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { listShifts, setUsualShift } from "@/lib/timekeeping/api";
import type { ShiftTemplate } from "@/lib/timekeeping/types";
import { hhmm } from "../timekeeping/format";
import { createEmployee, listEmployees, listPositions, listUnits, peso, unitPathOf } from "@/lib/corehr/api";
import { CLUSTERS, newEmployeeSchema, type NewEmployeeValues } from "@/lib/corehr/schemas";
import { isoDate } from "@/lib/corehr/store";
import { EMPLOYMENT_TYPES } from "@/lib/corehr/types";
import { SpecFields } from "./EditSectionDialog";
import { CONTACT_FIELDS, GOVERNMENT_FIELDS, PERSONAL_FIELDS, type FieldSpec } from "./fields";
import { formatDate, keys, mask, softInputClass, useActor } from "./format";
import type { ScannedIdFields } from "@/lib/idScan";
import { IdScanCard } from "./IdScanCard";
import { PlaceFields } from "./PlaceFields";
import { ErrorNote, Field, Initials, Stepper } from "./ui";

const SCANNABLE = ["firstName", "middleName", "lastName", "suffix", "birthDate", "sex"] as const;

const empty: NewEmployeeValues = {
  personal: { firstName: "", middleName: "", lastName: "", suffix: "", birthDate: "", sex: "", civilStatus: "", nationality: "Filipino" },
  contact: { workEmail: "", personalEmail: "", mobile: "", address: "", city: "", province: "", emergencyName: "", emergencyRelationship: "", emergencyPhone: "" },
  government: { sss: "", philhealth: "", pagibig: "", tin: "" },
  job: { cluster: "", positionId: "", teamId: "", supervisorId: "", employmentType: "Probationary", dateHired: isoDate(), monthlySalary: Number.NaN, workSchedule: "", shiftId: "" },
};

const STEPS = [
  { key: "personal", label: "Personal details", title: "Who are you adding?", description: "Use their name exactly as it reads on their PSA birth certificate." },
  { key: "contact", label: "Contact", title: "How do we reach them?", description: "All fields are required. The work email becomes their sign-in." },
  { key: "government", label: "Government IDs", title: "Government numbers", description: "Enter at least one now; payroll needs all four before the first cut-off." },
  { key: "job", label: "Job placement", title: "Where will they work?", description: "Choose their cluster, position and the shift they will work." },
  { key: "review", label: "Review", title: "Review and create", description: "Check the details below, then create the employee. Everything can still be edited later." },
] as const;
type SectionKey = Exclude<(typeof STEPS)[number]["key"], "review">;

const ALL_REQUIRED: FieldSpec[] = CONTACT_FIELDS.map((f) => ({ ...f, required: true }));
const CONTACT_TOP = ALL_REQUIRED.filter((f) => ["workEmail", "personalEmail", "mobile", "address"].includes(f.name));
const CONTACT_EMERGENCY = ALL_REQUIRED.filter((f) => f.name.startsWith("emergency"));

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Busy season · Mon–Fri, 8:30 AM – 5:00 PM" */
function scheduleLabel(s: ShiftTemplate) {
  const work = [1, 2, 3, 4, 5, 6, 0].filter((d) => !s.restDays.includes(d));
  const days = work.length && work.every((d, i) => i === 0 || d === (work[i - 1]! + 1) % 7) ? `${DAY[work[0]!]}–${DAY[work[work.length - 1]!]}` : work.map((d) => DAY[d]).join(", ");
  return `${s.name} · ${days}, ${hhmm(s.start)} – ${hhmm(s.end)}`;
}

function ReviewGroup({ title, onEdit, rows }: { title: string; onEdit: () => void; rows: [string, ReactNode][] }) {
  return (
    <section className="rounded-xl border border-border">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{title}</h3>
        <button type="button" onClick={onEdit} className="rounded-full px-2 py-0.5 text-xs font-medium text-brand hover:bg-surface-2">
          Edit
        </button>
      </div>
      <dl className="px-4 pb-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-border/60 py-1.5 text-sm last:border-0">
            <dt className="flex-none text-ink-2">{label}</dt>
            <dd className={clsx("min-w-0 text-right font-medium break-words", !value && "font-normal text-ink-3")}>{value || "—"}</dd>
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
  const shiftsQuery = useQuery({ queryKey: ["timekeeping", "shifts"], queryFn: listShifts });
  const shifts = (shiftsQuery.data ?? []).filter((s) => s.active);
  const units = unitsQuery.data ?? [];
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [fromId, setFromId] = useState<Set<string>>(new Set());
  const [scannedId, setScannedId] = useState<{ idType: string; idNumber?: string; idExpiry?: string; fileName: string } | null>(null);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [branchId, setBranchId] = useState("");

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
  const province = useWatch({ control, name: "contact.province" });
  const city = useWatch({ control, name: "contact.city" });
  const position = positionsQuery.data?.find((p) => p.id === positionId);
  const branches = units.filter((u) => u.type === "branch" && u.active);
  const positions = (positionsQuery.data ?? []).filter((p) => p.active && (!branchId || p.branchId === branchId));
  const people = (employeesQuery.data ?? []).filter((e) => e.status !== "Separated");

  const mutation = useMutation({
    mutationFn: async (v: NewEmployeeValues) => {
      const e = await createEmployee(v, actor, scannedId ?? undefined);
      // Timekeeping starts using their shift right away.
      if (v.job.shiftId) await setUsualShift([e.id], v.job.shiftId, actor);
      return e;
    },
    onSuccess: (e) => {
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.show(`${e.personal.firstName} ${e.personal.lastName} added as ${e.id}.`);
      navigate(`/admin/maintenance/people/${e.id}`);
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
        <Link to="/admin/maintenance/people" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 hover:text-ink">
          <ArrowRightIcon className="h-3.5 w-3.5 rotate-180" />
          People
        </Link>
        <h1 className="font-display mt-2 text-2xl font-semibold tracking-[-0.02em]">Add employee</h1>
        <p className="mt-0.5 text-[0.85rem] text-ink-2">Five short steps. Fields marked with * are required.</p>
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
            {current.key === "contact" && (
              <div className="flex flex-col gap-3.5">
                <SpecFields<NewEmployeeValues> fields={CONTACT_TOP} prefix="contact" register={register} errors={sectionErrors("contact")} inputClassName={softInputClass} />
                <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
                  <PlaceFields
                    province={register("contact.province")}
                    city={register("contact.city")}
                    provinceValue={province}
                    cityValue={city}
                    errors={{ province: errors.contact?.province?.message, city: errors.contact?.city?.message }}
                    inputClassName={softInputClass}
                    onProvinceChange={() => setValue("contact.city", "")}
                  />
                </div>
                <SpecFields<NewEmployeeValues> fields={CONTACT_EMERGENCY} prefix="contact" register={register} errors={sectionErrors("contact")} inputClassName={softInputClass} />
              </div>
            )}
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
                <Field id="f-job-cluster" label="Department" required error={errors.job?.cluster?.message}>
                  <select id="f-job-cluster" className={softInputClass} aria-invalid={errors.job?.cluster ? true : undefined} {...register("job.cluster")}>
                    <option value="">Select an option</option>
                    {CLUSTERS.map((c) => (
                      <option key={c} value={c}>
                        {c}
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
                    <option value="">Select an option</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.open === 0}>
                        {p.title} · {unitPathOf(p.departmentId, units)} {p.open === 0 ? "(full)" : `(${p.open} open)`}
                      </option>
                    ))}
                  </select>
                </Field>
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
                <Field id="f-job-workSchedule" label="Work schedule" required error={errors.job?.workSchedule?.message} hint="The shifts set up in Timekeeping › Shifts">
                  <select
                    id="f-job-workSchedule"
                    className={softInputClass}
                    aria-invalid={errors.job?.workSchedule ? true : undefined}
                    {...register("job.workSchedule", {
                      onChange: (e) => setValue("job.shiftId", shifts.find((s) => scheduleLabel(s) === e.target.value)?.id ?? ""),
                    })}
                  >
                    <option value="">Select an option</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={scheduleLabel(s)}>
                        {scheduleLabel(s)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            {current.key === "review" && (
              <div className="flex flex-col gap-4">
                {/* Who: the person at a glance */}
                <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface-2 p-5">
                  <Initials initials={[v.personal.firstName, v.personal.lastName].map((s) => s.trim()[0] ?? "").join("").toUpperCase()} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-xl font-semibold">{name || "New employee"}</div>
                    <div className="text-sm text-ink-2">
                      {position?.title ?? "No position"} · {v.job.cluster || "No department"}
                      {position && ` · ${position.branchName}`}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-full bg-surface px-2.5 py-1 font-medium">{v.job.employmentType}</span>
                      <span className="rounded-full bg-surface px-2.5 py-1 font-medium">Starts {formatDate(v.job.dateHired)}</span>
                      {Number.isFinite(v.job.monthlySalary) && <span className="rounded-full bg-surface px-2.5 py-1 font-medium">{peso(v.job.monthlySalary)} / month</span>}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <ReviewGroup
                    title="Personal"
                    onEdit={() => goTo(0)}
                    rows={[
                      ["Birth date", v.personal.birthDate && formatDate(v.personal.birthDate)],
                      ["Sex", v.personal.sex],
                      ["Civil status", v.personal.civilStatus],
                      ["Nationality", v.personal.nationality],
                    ]}
                  />
                  <ReviewGroup
                    title="Contact"
                    onEdit={() => goTo(1)}
                    rows={[
                      ["Work email", v.contact.workEmail],
                      ["Personal email", v.contact.personalEmail],
                      ["Mobile", v.contact.mobile],
                      ["Address", [v.contact.address, v.contact.city, v.contact.province].filter(Boolean).join(", ")],
                      ["Emergency", [v.contact.emergencyName, v.contact.emergencyRelationship && `(${v.contact.emergencyRelationship})`, v.contact.emergencyPhone].filter(Boolean).join(" ")],
                    ]}
                  />
                  <ReviewGroup
                    title="Government IDs"
                    onEdit={() => goTo(2)}
                    rows={[
                      ["SSS", mask(v.government.sss)],
                      ["PhilHealth", mask(v.government.philhealth)],
                      ["Pag-IBIG", mask(v.government.pagibig)],
                      ["TIN", mask(v.government.tin)],
                      ...(scannedId ? ([["Scanned ID", [scannedId.idType, scannedId.idNumber && mask(scannedId.idNumber)].filter(Boolean).join(" · ")]] as [string, ReactNode][]) : []),
                    ]}
                  />
                  <ReviewGroup
                    title="Job"
                    onEdit={() => goTo(3)}
                    rows={[
                      ["Position", position?.title],
                      ["Department", v.job.cluster],
                      ["Work schedule", v.job.workSchedule],
                      ["Reports to", people.find((e) => e.id === v.job.supervisorId)?.name ?? (v.job.supervisorId ? "" : "Set automatically")],
                    ]}
                  />
                </div>

                <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-ink-2">
                  <span className="font-medium text-ink">When you create the employee:</span> they get an employee ID and a 201 document checklist, appear in People and Timekeeping, and can sign in with their work email.
                </div>
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
                else if (!isDirty || window.confirm("Discard this new employee?")) navigate("/admin/maintenance/people");
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
                {isLast ? (mutation.isPending ? "Creating…" : "Create employee") : "Continue"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
