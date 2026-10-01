import { useFormContext, useWatch } from "react-hook-form";
import { getAge } from "@/lib/automation";
import {
  bloodTypeOptions,
  civilStatusOptions,
  sexOptions,
  suffixOptions,
  type AddEmployeeFormValues,
} from "@/lib/schemas";
import { FieldError, FieldGroup, FieldHint, inputClass, Label } from "./fields";
import { describe } from "./fieldProps";
import { IdScanPanel } from "./IdScanPanel";
import type { IdScan } from "./useIdScan";

export function IdentityStep({ idScan }: { idScan: IdScan }) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<AddEmployeeFormValues>();
  const birthDate = useWatch({ control, name: "birthDate" });
  const age = birthDate ? getAge(birthDate) : null;

  // A manual edit clears the "From ID" tag on that field.
  const field = (name: keyof AddEmployeeFormValues) => register(name, { onChange: () => idScan.clearMark(name) });
  const fromId = (name: string) => idScan.autoFilled.has(name);

  return (
    <>
      <div className="flex flex-col gap-7">
        <IdScanPanel idScan={idScan} />

        <FieldGroup title="Legal name">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="emp-last" required fromId={fromId("lastName")}>
                Last name
              </Label>
              <input
                id="emp-last"
                className={inputClass}
                placeholder="Dela Cruz"
                autoComplete="family-name"
                {...describe("emp-last", errors.lastName?.message)}
                {...field("lastName")}
              />
              <FieldError id="emp-last-error" message={errors.lastName?.message} />
            </div>
            <div>
              <Label htmlFor="emp-first" required fromId={fromId("firstName")}>
                First name
              </Label>
              <input
                id="emp-first"
                className={inputClass}
                placeholder="Juan"
                autoComplete="given-name"
                {...describe("emp-first", errors.firstName?.message)}
                {...field("firstName")}
              />
              <FieldError id="emp-first-error" message={errors.firstName?.message} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <div>
              <Label htmlFor="emp-middle" fromId={fromId("middleName")}>
                Middle name
              </Label>
              <input
                id="emp-middle"
                className={inputClass}
                placeholder="Perez"
                autoComplete="additional-name"
                {...describe("emp-middle", undefined, true)}
                {...field("middleName")}
              />
              <FieldHint id="emp-middle-hint">Mother's maiden surname, in full. Leave blank if you have none.</FieldHint>
            </div>
            <div>
              <Label htmlFor="emp-suffix" fromId={fromId("suffix")}>
                Suffix
              </Label>
              <select id="emp-suffix" className={inputClass} {...field("suffix")}>
                <option value="">None</option>
                {suffixOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </FieldGroup>

        <FieldGroup title="Personal details" description="Used to register SSS and PhilHealth, and for the 201 file.">
          <div className="grid gap-4 md:grid-cols-[2fr_6rem_2fr]">
            <div>
              <Label htmlFor="emp-birth" required fromId={fromId("birthDate")}>
                Birth date
              </Label>
              <input
                id="emp-birth"
                type="date"
                className={inputClass}
                {...describe("emp-birth", errors.birthDate?.message)}
                {...field("birthDate")}
              />
              <FieldError id="emp-birth-error" message={errors.birthDate?.message} />
            </div>
            <div>
              <span className="mb-1.5 block text-[0.82rem] font-semibold text-ink-2">Age</span>
              <div aria-live="polite" className="font-num flex h-[2.625rem] items-center rounded-lg bg-surface-2 px-3 text-sm">
                {age !== null && age >= 0 ? age : <span className="text-ink-3">—</span>}
              </div>
            </div>
            <div>
              <Label htmlFor="emp-sex" required fromId={fromId("sex")}>
                Sex
              </Label>
              <select id="emp-sex" className={inputClass} {...describe("emp-sex", errors.sex?.message)} {...field("sex")}>
                <option value="">Select…</option>
                {sexOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <FieldError id="emp-sex-error" message={errors.sex?.message} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="emp-civil">Civil status</Label>
              <select id="emp-civil" className={inputClass} {...describe("emp-civil", undefined, true)} {...field("civilStatus")}>
                <option value="">Select…</option>
                {civilStatusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <FieldHint id="emp-civil-hint">Decides if a marriage certificate is needed</FieldHint>
            </div>
            <div>
              <Label htmlFor="emp-blood">Blood type</Label>
              <select id="emp-blood" className={inputClass} {...field("bloodType")}>
                <option value="">Select…</option>
                {bloodTypeOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </FieldGroup>
      </div>
    </>
  );
}
