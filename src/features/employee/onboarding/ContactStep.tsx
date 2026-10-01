import { useFormContext } from "react-hook-form";
import { formatPhMobile, isValidPhMobile } from "@/lib/govIds";
import { emergencyRelationshipOptions, type AddEmployeeFormValues } from "@/lib/schemas";
import { FieldError, FieldGroup, FieldHint, inputClass, Label } from "./fields";
import { describe } from "./fieldProps";
import { useChoices } from "./choices";

export function ContactStep() {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<AddEmployeeFormValues>();
  const choices = useChoices();

  // Any accepted way of typing a mobile number is tidied to +63 9XX XXX XXXX on leaving the field.
  const mobile = (name: "phone" | "emergencyPhone") =>
    register(name, {
      onBlur: (e) => {
        const value = (e.target as HTMLInputElement).value;
        if (isValidPhMobile(value)) setValue(name, formatPhMobile(value), { shouldValidate: true });
      },
    });

  return (
    <>
      <div className="flex flex-col gap-6">
        <FieldGroup title="Phone and email">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="emp-phone" required>
                Mobile number
              </Label>
              <input
                id="emp-phone"
                type="tel"
                inputMode="tel"
                className={inputClass}
                placeholder="0917 552 0184"
                autoComplete="tel"
                {...describe("emp-phone", errors.phone?.message)}
                {...mobile("phone")}
              />
              <FieldError id="emp-phone-error" message={errors.phone?.message} />
            </div>
            <div>
              <Label htmlFor="emp-personal-email">
                Personal email
              </Label>
              <input
                id="emp-personal-email"
                type="email"
                className={inputClass}
                placeholder="juan.delacruz@gmail.com"
                autoComplete="email"
                {...describe("emp-personal-email", errors.personalEmail?.message)}
                {...register("personalEmail")}
              />
              <FieldError id="emp-personal-email-error" message={errors.personalEmail?.message} />
            </div>
            <div>
              <Label htmlFor="emp-email">
                Work email
              </Label>
              <input
                id="emp-email"
                type="email"
                className={inputClass}
                placeholder="juan.delacruz@msma.ph"
                {...describe("emp-email", errors.email?.message, true)}
                {...register("email")}
              />
              <FieldError id="emp-email-error" message={errors.email?.message} />
              {!errors.email && <FieldHint id="emp-email-hint">Leave blank if IT hasn't set it up yet</FieldHint>}
            </div>
          </div>
        </FieldGroup>

        {choices.address && (
        <FieldGroup title="Home address">
          <div>
            <Label htmlFor="emp-street">
              House no., street, subdivision
            </Label>
            <input id="emp-street" className={inputClass} placeholder="123 Mango Ave., Villa Aurora" autoComplete="address-line1" {...register("street")} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="emp-barangay">
                Barangay
              </Label>
              <input id="emp-barangay" className={inputClass} placeholder="Lahug" {...register("barangay")} />
            </div>
            <div>
              <Label htmlFor="emp-city">
                City / municipality
              </Label>
              <input id="emp-city" className={inputClass} placeholder="Cebu City" autoComplete="address-level2" {...register("city")} />
            </div>
            <div>
              <Label htmlFor="emp-province">
                Province
              </Label>
              <input id="emp-province" className={inputClass} placeholder="Cebu" autoComplete="address-level1" {...register("province")} />
            </div>
          </div>
        </FieldGroup>
        )}

        {choices.emergency && (
        <FieldGroup title="Emergency contact">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="emp-emergency-name">
                Full name
              </Label>
              <input id="emp-emergency-name" className={inputClass} placeholder="Maria Dela Cruz" {...register("emergencyName")} />
            </div>
            <div>
              <Label htmlFor="emp-emergency-rel">
                Relationship
              </Label>
              <select id="emp-emergency-rel" className={inputClass} {...register("emergencyRelationship")}>
                <option value="">Select…</option>
                {emergencyRelationshipOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="emp-emergency-phone">
                Mobile number
              </Label>
              <input
                id="emp-emergency-phone"
                type="tel"
                inputMode="tel"
                className={inputClass}
                placeholder="0917 000 0000"
                {...describe("emp-emergency-phone", errors.emergencyPhone?.message)}
                {...mobile("emergencyPhone")}
              />
              <FieldError id="emp-emergency-phone-error" message={errors.emergencyPhone?.message} />
            </div>
          </div>
        </FieldGroup>
        )}
      </div>
    </>
  );
}
