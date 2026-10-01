import type { ReactNode } from "react";
import clsx from "clsx";
import { useFormContext, useWatch, type FieldPath } from "react-hook-form";
import { IdCardIcon } from "@/components/icons";
import { getAge } from "@/lib/automation";
import { formatPhMobile, isValidPhMobile } from "@/lib/govIds";
import { fieldDef, sectionDef, type FormFieldConfig, type FormFieldKey, type FormSectionConfig } from "@/lib/onboardingForm";
import {
  bloodTypeOptions,
  civilStatusOptions,
  emergencyRelationshipOptions,
  sexOptions,
  suffixOptions,
  type AddEmployeeFormValues,
} from "@/lib/schemas";
import { AddressFields } from "./AddressFields";
import { describe, errorAt } from "./fieldProps";
import { FieldError, FieldGroup, FieldHint, inputClass, Label } from "./fields";
import { IdScanPanel } from "./IdScanPanel";
import type { IdScan } from "./useIdScan";

/** Fields that take the full width; the rest sit two to a row. */
const WIDE = new Set<FormFieldKey>(["legalName", "address", "provincialAddress", "emergencyContact", "medicalConditions", "pwd"]);

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

  if (fieldDef(field.key).kind) return <SimpleField field={field} />;
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
      return <AddressFields names={{ street: "street", barangay: "barangay", city: "city", province: "province" }} idPrefix="emp-home" required={req} />;
    case "provincialAddress":
      return <ProvincialAddress required={req} />;
    case "pwd":
      return <PwdField required={req} />;
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
  }
}

/** A simple one-input field (nickname, school, bank…) drawn from its catalog entry. */
function SimpleField({ field }: { field: FormFieldConfig }) {
  const {
    register,
    formState: { errors },
  } = useFormContext<AddEmployeeFormValues>();
  const def = fieldDef(field.key);
  const path = def.values[0] as FieldPath<AddEmployeeFormValues>;
  const id = `emp-${field.key}`;
  const message = errorAt(errors, path);
  const common = { id, className: inputClass, ...describe(id, message, true), ...register(path) };
  return (
    <div>
      <Label htmlFor={id} required={field.required}>
        {def.label}
      </Label>
      {def.kind === "select" ? (
        <Select options={def.options ?? []} {...common} />
      ) : def.kind === "textarea" ? (
        <textarea rows={3} placeholder={def.placeholder} {...common} className={clsx(inputClass, "resize-y")} />
      ) : (
        <div className="relative">
          <input
            type={def.kind === "number" ? "number" : def.kind === "tel" ? "tel" : "text"}
            inputMode={def.kind === "number" ? "numeric" : def.kind === "tel" ? "tel" : undefined}
            placeholder={def.placeholder}
            {...common}
            className={clsx(inputClass, def.unit && "pr-10")}
          />
          {def.unit && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-3">{def.unit}</span>}
        </div>
      )}
      <FieldError id={`${id}-error`} message={message} />
      {!message && <FieldHint id={`${id}-hint`}>{def.hint}</FieldHint>}
    </div>
  );
}

function ProvincialAddress({ required }: { required: boolean }) {
  const { setValue, control } = useFormContext<AddEmployeeFormValues>();
  const same = useWatch({ control, name: "extras.provSame" }) === "yes";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[0.82rem] font-semibold text-ink-2">
          Provincial / permanent address
          {required && !same && <span className="ml-0.5 text-critical" aria-hidden="true">*</span>}
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-brand)]"
            checked={same}
            onChange={(e) => {
              // Stored as text with the other extras.
              const value = e.target.checked ? "yes" : "";
              setValue("extras.provSame", value, { shouldDirty: true });
            }}
          />
          Same as home address
        </label>
      </div>
      {!same && (
        <div className="item-enter">
          <AddressFields
            names={{ street: "extras.provStreet", barangay: "extras.provBarangay", city: "extras.provCity", province: "extras.provProvince" }}
            idPrefix="emp-prov"
            required={required}
          />
        </div>
      )}
    </div>
  );
}

function PwdField({ required }: { required: boolean }) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<AddEmployeeFormValues>();
  const pwd = useWatch({ control, name: "extras.pwd" });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Label htmlFor="emp-pwd" required={required}>
          Person with disability (PWD)
        </Label>
        <Select id="emp-pwd" options={["No", "Yes"]} className={inputClass} {...describe("emp-pwd", errorAt(errors, "extras.pwd"), true)} {...register("extras.pwd")} />
        <FieldError id="emp-pwd-error" message={errorAt(errors, "extras.pwd")} />
        <FieldHint id="emp-pwd-hint">So HR can arrange support at work and apply PWD benefits</FieldHint>
      </div>
      {pwd === "Yes" && (
        <div className="item-enter">
          <Label htmlFor="emp-pwd-id" required>
            PWD ID number
          </Label>
          <input id="emp-pwd-id" className={inputClass} placeholder="07-2217-000-0000000" {...describe("emp-pwd-id", errorAt(errors, "extras.pwdId"))} {...register("extras.pwdId")} />
          <FieldError id="emp-pwd-id-error" message={errorAt(errors, "extras.pwdId")} />
        </div>
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

