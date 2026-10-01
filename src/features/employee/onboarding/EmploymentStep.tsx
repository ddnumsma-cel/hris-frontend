import { useFormContext, useWatch } from "react-hook-form";
import { previewEmployeeId } from "@/lib/api";
import {
  employmentStatusOptions,
  hireClusterOptions,
  hireDepartmentOptions,
  officeOptions,
  positionsByDepartment,
  type AddEmployeeFormValues,
} from "@/lib/schemas";
import { FieldError, FieldGroup, FieldHint, inputClass, Label } from "./fields";
import { useChoices } from "./choices";
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
  const choices = useChoices();
  const [lastName, firstName, dateHired, department, employmentStatus, position] = useWatch({
    control,
    name: ["lastName", "firstName", "dateHired", "department", "employmentStatus", "position"],
  });
  // Positions follow the department; a title from a Recruitment requisition stays selectable.
  const positions = department ? positionsByDepartment[department] : [];
  const extraPosition = position && !positions.includes(position) ? position : null;

  const idPreview =
    dateHired && lastName.trim() && firstName.trim() ? previewEmployeeId({ dateHired, lastName, firstName }) : null;
  const hired = dateHired ? new Date(dateHired + "T00:00:00") : null;
  const probationEnds =
    hired && employmentStatus === "Probationary" ? new Date(hired.getFullYear(), hired.getMonth() + 6, hired.getDate()) : null;

  return (
    <div className="flex flex-col gap-7">
      <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
        <div>
          <Label htmlFor="emp-status" required>
            Employment status
          </Label>
          <select id="emp-status" className={inputClass} {...describe("emp-status", errors.employmentStatus?.message, true)} {...register("employmentStatus")}>
            {employmentStatusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <FieldError id="emp-status-error" message={errors.employmentStatus?.message} />
          <FieldHint id="emp-status-hint">
            {probationEnds ? (
              <>
                Probation ends <span className="font-semibold text-ink">{formatLongDate(probationEnds)}</span>. Decide on regularization before then.
              </>
            ) : (
              employmentStatus && statusHelp[employmentStatus]
            )}
          </FieldHint>
        </div>
        <div>
          <Label htmlFor="emp-hired" required>
            Date hired
          </Label>
          <input id="emp-hired" type="date" className={inputClass} {...describe("emp-hired", errors.dateHired?.message)} {...register("dateHired")} />
          <FieldError id="emp-hired-error" message={errors.dateHired?.message} />
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
              // IT staff sit under Admin & Support; Accounting picks a cluster. A new department means a new position.
              onChange: (e) => {
                setValue("cluster", e.target.value === "IT" ? "Admin & Support" : "");
                setValue("position", "");
              },
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
        <div>
          <Label htmlFor="emp-position" required>
            Position
          </Label>
          <select
            id="emp-position"
            className={inputClass}
            disabled={!department}
            {...describe("emp-position", errors.position?.message)}
            {...register("position")}
          >
            <option value="">{department ? "Select position…" : "Choose a department first"}</option>
            {extraPosition && <option value={extraPosition}>{extraPosition}</option>}
            {positions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <FieldError id="emp-position-error" message={errors.position?.message} />
        </div>

        {department === "Accounting" ? (
          <div>
            <Label htmlFor="emp-cluster" required>
              Cluster
            </Label>
            <select id="emp-cluster" className={inputClass} {...describe("emp-cluster", errors.cluster?.message)} {...register("cluster")}>
              <option value="">Select cluster…</option>
              {hireClusterOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <FieldError id="emp-cluster-error" message={errors.cluster?.message} />
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

      {choices.licensed && (
        <FieldGroup title="Professional license" description="HR tracks the expiry so your license stays valid for client work.">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="emp-license-prof">Profession</Label>
              <select id="emp-license-prof" className={inputClass} {...register("licenseProfession")}>
                <option value="">Select…</option>
                {["Certified Public Accountant", "Lawyer", "Other PRC license"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="emp-license-no" required>
                PRC license number
              </Label>
              <input
                id="emp-license-no"
                inputMode="numeric"
                className={inputClass}
                placeholder="0123456"
                {...describe("emp-license-no", errors.licenseNumber?.message)}
                {...register("licenseNumber")}
              />
              <FieldError id="emp-license-no-error" message={errors.licenseNumber?.message} />
            </div>
            <div>
              <Label htmlFor="emp-license-exp">Valid until</Label>
              <input id="emp-license-exp" type="date" className={inputClass} {...register("licenseExpiry")} />
            </div>
          </div>
        </FieldGroup>
      )}

      {choices.previousEmployer && (
        <FieldGroup title="Previous employer" description="Ask them for your BIR Form 2316 so this year's tax is computed right.">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="emp-prev-company" required>
                Company name
              </Label>
              <input
                id="emp-prev-company"
                className={inputClass}
                placeholder="SGV & Co."
                {...describe("emp-prev-company", errors.previousEmployer?.message)}
                {...register("previousEmployer")}
              />
              <FieldError id="emp-prev-company-error" message={errors.previousEmployer?.message} />
            </div>
            <div>
              <Label htmlFor="emp-prev-last">Last day there</Label>
              <input id="emp-prev-last" type="date" className={inputClass} {...register("previousLastDay")} />
            </div>
          </div>
        </FieldGroup>
      )}
    </div>
  );
}
