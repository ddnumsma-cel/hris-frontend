import type { UseFormRegisterReturn } from "react-hook-form";
import places from "@/lib/ph-places.json";
import { Field } from "./ui";

const PROVINCES = Object.keys(places) as (keyof typeof places)[];

/** Province first, then the cities and municipalities in it (PSGC list). */
export function PlaceFields({ province, city, provinceValue, cityValue, errors, inputClassName, onProvinceChange }: { province: UseFormRegisterReturn; city: UseFormRegisterReturn; provinceValue: string; cityValue: string; errors: { province?: string; city?: string }; inputClassName: string; onProvinceChange: () => void }) {
  const cities: string[] = (places as Record<string, string[]>)[provinceValue] ?? [];
  // Older records may hold a name that isn't in the list (e.g. "Cebu City"); keep it selectable.
  const keepProvince = provinceValue && !PROVINCES.includes(provinceValue as keyof typeof places);
  const keepCity = cityValue && !cities.includes(cityValue);
  return (
    <>
      <Field id="f-contact-province" label="Province" required error={errors.province}>
        <select
          id="f-contact-province"
          className={inputClassName}
          aria-invalid={errors.province ? true : undefined}
          {...province}
          onChange={(e) => {
            void province.onChange(e);
            onProvinceChange();
          }}
        >
          <option value="">Select an option</option>
          {keepProvince && <option value={provinceValue}>{provinceValue}</option>}
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>
      <Field id="f-contact-city" label="City / municipality" required error={errors.city} hint={!provinceValue ? "Choose the province first" : undefined}>
        <select id="f-contact-city" className={inputClassName} aria-invalid={errors.city ? true : undefined} disabled={!provinceValue} {...city}>
          <option value="">{provinceValue ? "Select an option" : "Select a province first"}</option>
          {keepCity && <option value={cityValue}>{cityValue}</option>}
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
