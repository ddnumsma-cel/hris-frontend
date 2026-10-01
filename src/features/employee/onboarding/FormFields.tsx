import type { ReactNode } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { IdCardIcon, PlusIcon, XIcon } from "@/components/icons";
import { getAge } from "@/lib/automation";
import { formatPhMobile, isValidPhMobile } from "@/lib/govIds";
import { sectionDef, type FormFieldConfig, type FormFieldKey, type FormSectionConfig } from "@/lib/onboardingForm";
import {
  bloodTypeOptions,
  civilStatusOptions,
  emergencyRelationshipOptions,
  sexOptions,
  suffixOptions,
  type AddEmployeeFormValues,
} from "@/lib/schemas";
import { describe } from "./fieldProps";
import { FieldError, FieldGroup, FieldHint, inputClass, Label } from "./fields";
import { IdScanPanel } from "./IdScanPanel";
import type { IdScan } from "./useIdScan";

/** Fields that take the full width; the rest sit two to a row. */
const WIDE = new Set<FormFieldKey>(["legalName", "address", "emergencyContact", "dependents"]);

function Select({ id, options, empty = "Select…", ...rest }: { id: string; options: readonly string[]; empty?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select id={id} className={inputClass} {...rest}>
      <option value="">{empty}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Field({ field, idScan }: { field: FormFieldConfig; idScan?: IdScan }) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<AddEmployeeFormValues>();
  const [birthDate, civilStatus] = useWatch({ control, name: ["birthDate", "civilStatus"] });
  const req = field.required;
  // A manual edit clears the "From ID" tag on that field.
  const reg = (name: keyof AddEmployeeFormValues) => register(name, { onChange: () => idScan?.clearMark(name) });
  const fromId = (name: string) => Boolean(idScan?.autoFilled.has(name));
  // Any accepted way of typing a mobile number is tidied to +63 9XX XXX XXXX on leaving the field.
  const mobile = (name: "phone" | "emergencyPhone") =>
    register(name, {
      onBlur: (e) => {
        const value = (e.target as HTMLInputElement).value;
        if (isValidPhMobile(value)) setValue(name, formatPhMobile(value), { shouldValidate: true });
      },
    });

  switch (field.key) {
    case "legalName":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="emp-last" required fromId={fromId("lastName")}>
              Last name
            </Label>
            <input id="emp-last" className={inputClass} placeholder="Dela Cruz" autoComplete="family-name" {...describe("emp-last", errors.lastName?.message)} {...reg("lastName")} />
            <FieldError id="emp-last-error" message={errors.lastName?.message} />
          </div>
          <div>
            <Label htmlFor="emp-first" required fromId={fromId("firstName")}>
              First name
            </Label>
            <input id="emp-first" className={inputClass} placeholder="Juan" autoComplete="given-name" {...describe("emp-first", errors.firstName?.message)} {...reg("firstName")} />
            <FieldError id="emp-first-error" message={errors.firstName?.message} />
          </div>
        </div>
      );
    case "middleName":
      return (
        <div>
          <Label htmlFor="emp-middle" required={req} fromId={fromId("middleName")}>
            Middle name
          </Label>
          <input id="emp-middle" className={inputClass} placeholder="Perez" autoComplete="additional-name" {...describe("emp-middle", errors.middleName?.message, true)} {...reg("middleName")} />
          <FieldError id="emp-middle-error" message={errors.middleName?.message} />
          <FieldHint id="emp-middle-hint">Mother's maiden surname, in full.{req ? "" : " Leave blank if you have none."}</FieldHint>
        </div>
      );
    case "suffix":
      return (
        <div>
          <Label htmlFor="emp-suffix" required={req} fromId={fromId("suffix")}>
            Suffix
          </Label>
          <Select id="emp-suffix" options={suffixOptions} empty={req ? "Select…" : "None"} {...describe("emp-suffix", errors.suffix?.message)} {...reg("suffix")} />
          <FieldError id="emp-suffix-error" message={errors.suffix?.message} />
        </div>
      );
    case "birthDate": {
      const age = birthDate ? getAge(birthDate) : null;
      return (
        <div>
          <Label htmlFor="emp-birth" required fromId={fromId("birthDate")}>
            Birth date
          </Label>
          <input id="emp-birth" type="date" className={inputClass} {...describe("emp-birth", errors.birthDate?.message, true)} {...reg("birthDate")} />
          <FieldError id="emp-birth-error" message={errors.birthDate?.message} />
          <FieldHint id="emp-birth-hint">
            <span aria-live="polite">{age !== null && age >= 0 ? `Age ${age}` : "Your age shows here"}</span>
          </FieldHint>
        </div>
      );
    }
    case "sex":
      return (
        <div>
          <Label htmlFor="emp-sex" required fromId={fromId("sex")}>
            Sex
          </Label>
          <Select id="emp-sex" options={sexOptions} {...describe("emp-sex", errors.sex?.message)} {...reg("sex")} />
          <FieldError id="emp-sex-error" message={errors.sex?.message} />
        </div>
      );
    case "civilStatus":
      return (
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="emp-civil" required={req}>
              Civil status
            </Label>
            <Select id="emp-civil" options={civilStatusOptions} {...describe("emp-civil", errors.civilStatus?.message, true)} {...reg("civilStatus")} />
            <FieldError id="emp-civil-error" message={errors.civilStatus?.message} />
            <FieldHint id="emp-civil-hint">Decides if a marriage certificate is needed</FieldHint>
          </div>
          {civilStatus === "Married" && (
            <div className="item-enter">
              <Label htmlFor="emp-spouse" required>
                Spouse's full name
              </Label>
              <input id="emp-spouse" className={inputClass} placeholder="Maria Santos Dela Cruz" {...describe("emp-spouse", errors.spouseName?.message)} {...register("spouseName")} />
              <FieldError id="emp-spouse-error" message={errors.spouseName?.message} />
            </div>
          )}
        </div>
      );
    case "bloodType":
      return (
        <div>
          <Label htmlFor="emp-blood" required={req}>
            Blood type
          </Label>
          <Select id="emp-blood" options={bloodTypeOptions} {...describe("emp-blood", errors.bloodType?.message)} {...reg("bloodType")} />
          <FieldError id="emp-blood-error" message={errors.bloodType?.message} />
        </div>
      );
    case "phone":
      return (
        <div>
          <Label htmlFor="emp-phone" required>
            Mobile number
          </Label>
          <input id="emp-phone" type="tel" inputMode="tel" className={inputClass} placeholder="0917 552 0184" autoComplete="tel" {...describe("emp-phone", errors.phone?.message)} {...mobile("phone")} />
          <FieldError id="emp-phone-error" message={errors.phone?.message} />
        </div>
      );
    case "personalEmail":
      return (
        <div>
          <Label htmlFor="emp-personal-email" required={req}>
            Personal email
          </Label>
          <input id="emp-personal-email" type="email" className={inputClass} placeholder="juan.delacruz@gmail.com" autoComplete="email" {...describe("emp-personal-email", errors.personalEmail?.message)} {...register("personalEmail")} />
          <FieldError id="emp-personal-email-error" message={errors.personalEmail?.message} />
        </div>
      );
    case "workEmail":
      return (
        <div>
          <Label htmlFor="emp-email" required={req}>
            Work email
          </Label>
          <input id="emp-email" type="email" className={inputClass} placeholder="juan.delacruz@msma.ph" {...describe("emp-email", errors.email?.message, true)} {...register("email")} />
          <FieldError id="emp-email-error" message={errors.email?.message} />
          {!errors.email && !req && <FieldHint id="emp-email-hint">Leave blank if IT hasn't set it up yet</FieldHint>}
        </div>
      );
    case "address":
      return (
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="emp-street" required={req}>
              House no., street, subdivision
            </Label>
            <input id="emp-street" className={inputClass} placeholder="123 Mango Ave., Villa Aurora" autoComplete="address-line1" {...describe("emp-street", errors.street?.message)} {...register("street")} />
            <FieldError id="emp-street-error" message={errors.street?.message} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="emp-barangay">Barangay</Label>
              <input id="emp-barangay" className={inputClass} placeholder="Lahug" {...register("barangay")} />
            </div>
            <div>
              <Label htmlFor="emp-city" required={req}>
                City / municipality
              </Label>
              <input id="emp-city" className={inputClass} placeholder="Cebu City" autoComplete="address-level2" {...describe("emp-city", errors.city?.message)} {...register("city")} />
              <FieldError id="emp-city-error" message={errors.city?.message} />
            </div>
            <div>
              <Label htmlFor="emp-province" required={req}>
                Province
              </Label>
              <input id="emp-province" className={inputClass} placeholder="Cebu" autoComplete="address-level1" {...describe("emp-province", errors.province?.message)} {...register("province")} />
              <FieldError id="emp-province-error" message={errors.province?.message} />
            </div>
          </div>
        </div>
      );
    case "emergencyContact":
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="emp-emergency-name" required={req}>
              Full name
            </Label>
            <input id="emp-emergency-name" className={inputClass} placeholder="Maria Dela Cruz" {...describe("emp-emergency-name", errors.emergencyName?.message)} {...register("emergencyName")} />
            <FieldError id="emp-emergency-name-error" message={errors.emergencyName?.message} />
          </div>
          <div>
            <Label htmlFor="emp-emergency-rel">Relationship</Label>
            <Select id="emp-emergency-rel" options={emergencyRelationshipOptions} {...register("emergencyRelationship")} />
          </div>
          <div>
            <Label htmlFor="emp-emergency-phone" required={req}>
              Mobile number
            </Label>
            <input id="emp-emergency-phone" type="tel" inputMode="tel" className={inputClass} placeholder="0917 000 0000" {...describe("emp-emergency-phone", errors.emergencyPhone?.message)} {...mobile("emergencyPhone")} />
            <FieldError id="emp-emergency-phone-error" message={errors.emergencyPhone?.message} />
          </div>
        </div>
      );
    case "dependents":
      return <DependentsField required={req} />;
  }
}

/** Its own component: only one useFieldArray may own the dependents list. */
function DependentsField({ required: req }: { required: boolean }) {
  const {
    register,
    control,
    clearErrors,
    formState: { errors },
  } = useFormContext<AddEmployeeFormValues>();
  const dependents = useFieldArray({ control, name: "dependents" });
  return (
        <div className="flex flex-col gap-3">
          <p className="text-[0.82rem] font-semibold text-ink-2">
            Children and dependents
            {req && <span className="ml-0.5 text-critical" aria-hidden="true">*</span>}
          </p>
          {dependents.fields.length === 0 && <p className="text-xs text-ink-2">{req ? "Add at least one child or dependent." : "None added. Add each child or dependent you want covered."}</p>}
          {dependents.fields.map((row, i) => (
            <div key={row.id} className="item-enter grid items-start gap-3 md:grid-cols-[2fr_1fr_auto]">
              <div>
                <Label htmlFor={`emp-dep-${i}`}>Full name</Label>
                <input id={`emp-dep-${i}`} className={inputClass} placeholder="Miguel Dela Cruz" {...describe(`emp-dep-${i}`, errors.dependents?.[i]?.name?.message)} {...register(`dependents.${i}.name`, { onChange: () => clearErrors("dependents") })} />
                <FieldError id={`emp-dep-${i}-error`} message={errors.dependents?.[i]?.name?.message} />
              </div>
              <div>
                <Label htmlFor={`emp-dep-birth-${i}`}>Birth date</Label>
                <input id={`emp-dep-birth-${i}`} type="date" className={inputClass} {...register(`dependents.${i}.birthDate`)} />
              </div>
              <button
                type="button"
                onClick={() => dependents.remove(i)}
                aria-label={`Remove dependent ${i + 1}`}
                className="mt-7 flex h-10 w-10 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          <FieldError id="emp-dependents-error" message={(errors.dependents as { message?: string } | undefined)?.message} />
          {dependents.fields.length < 8 && (
            <button
              type="button"
              onClick={() => dependents.append({ name: "", birthDate: "" })}
              className="flex items-center gap-1.5 self-start rounded-full px-2 py-1.5 text-sm font-semibold text-brand-ink hover:bg-surface-2"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {dependents.fields.length === 0 ? "Add dependent" : "Add another"}
            </button>
          )}
        </div>
      );
}

/** One section of HR's form: its title, then its fields in HR's order. */
export function FormSection({ section, idScan, preview = false }: { section: FormSectionConfig; idScan?: IdScan; preview?: boolean }) {
  const def = sectionDef(section.key);
  // Consecutive short fields share a row; wide ones (name, address…) take a row of their own.
  const rows: ReactNode[] = [];
  let pair: FormFieldConfig[] = [];
  const flush = () => {
    if (pair.length) {
      const fields = pair;
      rows.push(
        <div key={fields.map((f) => f.key).join()} className="grid gap-4 md:grid-cols-2">
          {fields.map((f) => (
            <Field key={f.key} field={f} idScan={idScan} />
          ))}
        </div>,
      );
    }
    pair = [];
  };
  for (const f of section.fields) {
    if (WIDE.has(f.key)) {
      flush();
      rows.push(<Field key={f.key} field={f} idScan={idScan} />);
    } else pair.push(f);
  }
  flush();

  return (
    <div className="flex flex-col gap-7">
      {section.key === "personal" &&
        (idScan && !preview ? (
          <IdScanPanel idScan={idScan} />
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-ink-2">
            <IdCardIcon className="h-5 w-5 flex-none text-ink-3" />
            New hires can upload a valid ID here to fill in their name and birth date.
          </div>
        ))}
      <FieldGroup title={def.title} description={def.description}>
        {rows}
      </FieldGroup>
    </div>
  );
}

