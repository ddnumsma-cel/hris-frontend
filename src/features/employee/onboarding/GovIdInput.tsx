import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { formatGovId, govIdFormatByKey, govIdPattern, isValidGovId, maskGovId, onlyDigits, type GovIdKey } from "@/lib/govIds";
import type { AddEmployeeFormValues } from "@/lib/schemas";
import { FieldError, FieldHint, inputClass, Label } from "./fields";
import { describe } from "./fieldProps";

/**
 * A government number field: formats as you type (00-0000000-0), and once filled and
 * valid shows only the last 4 digits, because these numbers are sensitive personal data.
 */
export function GovIdInput({ name }: { name: GovIdKey }) {
  const { control } = useFormContext<AddEmployeeFormValues>();
  const [focused, setFocused] = useState(false);
  const format = govIdFormatByKey[name];
  const id = `emp-${name}`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const masked = !focused && field.value && isValidGovId(name, field.value) && onlyDigits(field.value).length > 4;
        return (
          <div>
            <Label htmlFor={id}>
              {format.label}
            </Label>
            <input
              id={id}
              name={field.name}
              ref={field.ref}
              inputMode="numeric"
              autoComplete="off"
              className={`${inputClass} font-num tracking-wide`}
              placeholder={govIdPattern(name)}
              value={masked ? maskGovId(field.value) : field.value}
              onFocus={() => setFocused(true)}
              onChange={(e) => field.onChange(formatGovId(name, e.target.value))}
              onBlur={() => {
                setFocused(false);
                field.onBlur();
              }}
              {...describe(id, fieldState.error?.message, !fieldState.error)}
            />
            <FieldError id={`${id}-error`} message={fieldState.error?.message} />
            {!fieldState.error && (
              <FieldHint id={`${id}-hint`}>
                {masked ? "Hidden for privacy · click to show" : `From the ${format.hint}`}
              </FieldHint>
            )}
          </div>
        );
      }}
    />
  );
}
