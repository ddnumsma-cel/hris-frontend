import { useForm, useWatch, type FieldValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ZodType } from "zod";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { updateEmployeeSection, type EditableSection } from "@/lib/corehr/api";
import { bankSchema, contactSchema, governmentSchema, personalSchema } from "@/lib/corehr/schemas";
import type { CoreEmployee } from "@/lib/corehr/types";
import { BANK_FIELDS, CONTACT_FIELDS, GOVERNMENT_FIELDS, PERSONAL_FIELDS, type FieldSpec } from "./fields";
import { inputClass, useActor } from "./format";
import { ErrorNote, Field } from "./ui";
import { PlaceFields } from "./PlaceFields";

const CONFIG = {
  personal: { title: "Edit personal information", fields: PERSONAL_FIELDS, schema: personalSchema },
  contact: { title: "Edit contact details", fields: CONTACT_FIELDS, schema: contactSchema },
  government: { title: "Edit government numbers", fields: GOVERNMENT_FIELDS, schema: governmentSchema },
  bank: { title: "Edit bank account", fields: BANK_FIELDS, schema: bankSchema },
} satisfies Record<EditableSection, { title: string; fields: FieldSpec[]; schema: ZodType }>;

/** A grid of inputs driven by FieldSpecs; used by the edit dialogs and the hire form. */
export function SpecFields<T extends FieldValues>({
  fields,
  prefix,
  register,
  errors,
  inputClassName = inputClass,
  tagged,
}: {
  /** Field names to mark "From ID" after a scan. */
  tagged?: ReadonlySet<string>;
  fields: FieldSpec[];
  prefix?: string;
  inputClassName?: string;
  register: (name: Path<T>) => object;
  errors: Record<string, { message?: string } | undefined>;
}) {
  return (
    <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
      {fields.map((f) => {
        const name = (prefix ? `${prefix}.${f.name}` : f.name) as Path<T>;
        const id = `f-${name.replace(/\./g, "-")}`;
        const error = errors[f.name]?.message;
        const common = { id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : undefined, ...register(name) };
        return (
          <Field
            key={f.name}
            id={id}
            label={f.label}
            required={f.required}
            hint={f.hint}
            error={error}
            className={clsx(f.wide && "sm:col-span-2")}
            badge={tagged?.has(f.name) && <span className="ml-1.5 rounded-full bg-good-tint px-1.5 py-px text-[0.62rem] font-semibold text-good">From ID</span>}
          >
            {f.type === "select" ? (
              <select className={inputClassName} {...common}>
                <option value="">Not set</option>
                {f.options!.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input type={f.type ?? "text"} className={inputClassName} placeholder={f.placeholder} {...common} />
            )}
          </Field>
        );
      })}
    </div>
  );
}

export function EditSectionDialog({ employee, section, onClose }: { employee: CoreEmployee; section: EditableSection; onClose: () => void }) {
  const config = CONFIG[section];
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<FieldValues>({ resolver: zodResolver(config.schema as ZodType<FieldValues, FieldValues>), defaultValues: (employee[section] ?? (section === "bank" ? { bank: "", accountName: "", accountNumber: "" } : {})) as FieldValues });
  const mutation = useMutation({
    mutationFn: (values: FieldValues) => updateEmployeeSection(employee.id, section, values as CoreEmployee[typeof section], actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.show("Saved.");
      onClose();
    },
  });
  const submit = handleSubmit((v) => mutation.mutate(v));
  const province = useWatch({ control, name: "province" }) as string | undefined;
  const city = useWatch({ control, name: "city" }) as string | undefined;
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={config.title}
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || !isDirty}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {section === "government" && <p className="text-xs text-ink-2">Changes to these numbers are recorded in the audit trail. The numbers themselves are never written into it.</p>}
        {section === "bank" && <p className="text-xs text-ink-2">Take-home pay is sent here. Accounting sees it in Pay details and the bank file; changes are recorded in the audit trail without the number.</p>}
        {section === "contact" ? (
          <>
            <SpecFields fields={config.fields.filter((f) => ["workEmail", "personalEmail", "mobile", "address"].includes(f.name))} register={register} errors={errors as Record<string, { message?: string }>} />
            <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
              <PlaceFields
                province={register("province")}
                city={register("city")}
                provinceValue={String(province ?? "")}
                cityValue={String(city ?? "")}
                errors={{ province: errors.province?.message as string | undefined, city: errors.city?.message as string | undefined }}
                inputClassName={inputClass}
                onProvinceChange={() => setValue("city", "", { shouldDirty: true })}
              />
            </div>
            <SpecFields fields={config.fields.filter((f) => f.name.startsWith("emergency"))} register={register} errors={errors as Record<string, { message?: string }>} />
          </>
        ) : (
          <SpecFields fields={config.fields} register={register} errors={errors as Record<string, { message?: string }>} />
        )}
        <ErrorNote error={mutation.error} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
