import { useQuery } from "@tanstack/react-query";
import { useFormContext, useWatch } from "react-hook-form";
import { fetchEmployeeDirectory, previewEmployeeId } from "@/lib/api";
import {
  clusterDescriptions,
  employmentStatusOptions,
  hireClusterOptions,
  hireDepartmentOptions,
  officeOptions,
  type AddEmployeeFormValues,
} from "@/lib/schemas";
import { FieldError, FieldGroup, FieldHint, inputClass, Label, StepHeading } from "./fields";
import { describe } from "./fieldProps";

const statusHelp: Record<(typeof employmentStatusOptions)[number], string> = {
  Probationary: "Up to 6 months before regularization (Labor Code Art. 296)",
  Regular: "Already regularized, e.g. a rehire or transfer",
  "Project-Based": "Hired for a specific engagement with a set end",
  Contractual: "Fixed-term contract",
  "Part-Time": "Works fewer than the normal 8 hours a day",
};

function formatLongDate(d: Date) {
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function EmploymentStep() {
  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<AddEmployeeFormValues>();
  const [lastName, firstName, dateHired, department, employmentStatus] = useWatch({
    control,
    name: ["lastName", "firstName", "dateHired", "department", "employmentStatus"],
  });
  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const directory = [...(directoryQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const positions = [...new Set(directory.map((e) => e.position))].sort();
  // Only people who approve requests can be someone's supervisor.
  const approvers = directory.filter((e) => /(lead|manager|partner|head|supervisor|director)/i.test(e.position));

  const idPreview =
    dateHired && lastName.trim() && firstName.trim() ? previewEmployeeId({ dateHired, lastName, firstName }) : null;
  const hired = dateHired ? new Date(dateHired + "T00:00:00") : null;
  const probationEnds =
    hired && employmentStatus === "Probationary" ? new Date(hired.getFullYear(), hired.getMonth() + 6, hired.getDate()) : null;

  return (
    <>
      <StepHeading title="Their role at MSMA" description="Decides their employee ID, payroll group and who approves their requests." />
      <div className="flex flex-col gap-6">
        <FieldGroup title="Position">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="emp-position" required>
                Position
              </Label>
              <input
                id="emp-position"
                list="emp-position-options"
                className={inputClass}
                placeholder="Audit Associate"
                {...describe("emp-position", errors.position?.message)}
                {...register("position")}
              />
              <datalist id="emp-position-options">
                {positions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <FieldError id="emp-position-error" message={errors.position?.message} />
            </div>
            <div>
              <Label htmlFor="emp-department" required>
                Department
              </Label>
              <select
                id="emp-department"
                className={inputClass}
                {...describe("emp-department", errors.department?.message)}
                {...register("department", {
                  // IT staff sit under Admin & Support; Accounting picks a client cluster.
                  onChange: (e) => setValue("cluster", e.target.value === "IT" ? "Admin & Support" : ""),
                })}
              >
                <option value="">Select department…</option>
                {hireDepartmentOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <FieldError id="emp-department-error" message={errors.department?.message} />
            </div>
            {department === "Accounting" ? (
            <div>
              <Label htmlFor="emp-cluster" required>
                Cluster
              </Label>
              <select
                id="emp-cluster"
                className={inputClass}
                {...describe("emp-cluster", errors.cluster?.message, !errors.cluster)}
                {...register("cluster")}
              >
                <option value="">Select cluster…</option>
                {hireClusterOptions.map((c) => (
                  <option key={c} value={c}>
                    {c} · {clusterDescriptions[c].replace(/^Accountants — /, "")}
                  </option>
                ))}
              </select>
              <FieldError id="emp-cluster-error" message={errors.cluster?.message} />
              {!errors.cluster && <FieldHint id="emp-cluster-hint">The client group they're assigned to</FieldHint>}
            </div>
            ) : (
              <div>
                <span className="mb-1.5 block text-[0.82rem] font-semibold text-ink-2">Cluster</span>
                <div className="flex h-[2.625rem] items-center rounded-lg bg-surface-2 px-3 text-sm text-ink-2">
                  {department === "IT" ? "Admin & Support" : "Choose a department first"}
                </div>
                <FieldHint>{department === "IT" ? "IT staff are part of Admin & Support" : "Clusters apply to Accounting only"}</FieldHint>
              </div>
            )}
            <div>
              <Label htmlFor="emp-office" required>
                Office
              </Label>
              <select id="emp-office" className={inputClass} {...register("office")}>
                {officeOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="emp-reports-to">Reports to</Label>
              <select id="emp-reports-to" className={inputClass} {...describe("emp-reports-to", undefined, true)} {...register("reportsToId")}>
                <option value="">HR & People Operations</option>
                {approvers.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · {e.position}
                  </option>
                ))}
              </select>
              <FieldHint id="emp-reports-to-hint">Approves their leave and overtime first</FieldHint>
            </div>
          </div>
        </FieldGroup>

        <FieldGroup title="Hiring">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="emp-hired" required>
                Date hired
              </Label>
              <input
                id="emp-hired"
                type="date"
                className={inputClass}
                {...describe("emp-hired", errors.dateHired?.message)}
                {...register("dateHired")}
              />
              <FieldError id="emp-hired-error" message={errors.dateHired?.message} />
            </div>
            <div>
              <span className="mb-1.5 block text-[0.82rem] font-semibold text-ink-2">Employee ID</span>
              <div aria-live="polite" className="font-num flex h-[2.625rem] items-center rounded-lg bg-surface-2 px-3 text-sm font-semibold">
                {idPreview ? idPreview.id : <span className="font-normal text-ink-3">Fills in from the name and date hired</span>}
              </div>
              <FieldHint>
                {idPreview && idPreview.renumbers > 0
                  ? `${idPreview.renumbers} later hire${idPreview.renumbers === 1 ? "" : "s"} this month will move down one number.`
                  : "Set automatically · same-day hires go alphabetically"}
              </FieldHint>
            </div>
          </div>

          <div role="radiogroup" aria-labelledby="emp-status-label">
            <span id="emp-status-label" className="mb-1.5 block text-[0.82rem] font-semibold text-ink-2">
              Employment status
              <span className="ml-0.5 text-critical" aria-hidden="true">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </span>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {employmentStatusOptions.map((s) => (
                <label key={s} className="choice-card">
                  <input type="radio" value={s} className="choice-radio" {...register("employmentStatus")} />
                  <span>
                    <span className="block text-sm font-semibold text-ink">{s}</span>
                    <span className="block text-xs text-ink-2">{statusHelp[s]}</span>
                  </span>
                </label>
              ))}
            </div>
            {probationEnds && (
              <FieldHint>
                Probation ends <span className="font-semibold text-ink">{formatLongDate(probationEnds)}</span>. Decide on
                regularization before then.
              </FieldHint>
            )}
          </div>
        </FieldGroup>
      </div>
    </>
  );
}
