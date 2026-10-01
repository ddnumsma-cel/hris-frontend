import { useQuery } from "@tanstack/react-query";
import { useFormContext, useWatch, type FieldPath } from "react-hook-form";
import { fetchCities, fetchProvinces } from "@/lib/psgc";
import type { AddEmployeeFormValues } from "@/lib/schemas";
import { describe, errorAt } from "./fieldProps";
import { FieldError, inputClass, Label } from "./fields";

type Name = FieldPath<AddEmployeeFormValues>;

export interface AddressNames {
  street: Name;
  barangay: Name;
  city: Name;
  province: Name;
}

/**
 * Street as free text, then Province → City/municipality → Barangay as dropdowns, each filtered by
 * the one before (PSA PSGC list). A value typed before the dropdowns existed stays selectable.
 */
export function AddressFields({ names, idPrefix, required }: { names: AddressNames; idPrefix: string; required: boolean }) {
  const {
    register,
    setValue,
    control,
    formState: { errors },
  } = useFormContext<AddEmployeeFormValues>();
  const [province, city, barangay] = useWatch({ control, name: [names.province, names.city, names.barangay] }) as string[];

  const provincesQuery = useQuery({ queryKey: ["psgc", "provinces"], queryFn: fetchProvinces, staleTime: Infinity });
  const provinceCode = provincesQuery.data?.find((p) => p.name === province)?.code;
  const citiesQuery = useQuery({
    queryKey: ["psgc", "cities", provinceCode],
    queryFn: () => fetchCities(provinceCode!),
    enabled: Boolean(provinceCode),
    staleTime: Infinity,
  });
  const cities = citiesQuery.data ?? [];
  const barangays = cities.find((c) => c.name === city)?.barangays ?? [];

  const id = (part: string) => `${idPrefix}-${part}`;
  const err = (name: Name) => errorAt(errors, name);
  // A value that isn't in the list (an older draft) is kept as an option rather than silently lost.
  const keep = (value: string | undefined, list: string[]) => (value && !list.includes(value) ? [value, ...list] : list);
  const loadFailed = provincesQuery.isError || citiesQuery.isError;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor={id("street")} required={required}>
          House no., street, subdivision
        </Label>
        <input id={id("street")} className={inputClass} placeholder="123 Mango Ave., Villa Aurora" autoComplete="address-line1" {...describe(id("street"), err(names.street))} {...register(names.street)} />
        <FieldError id={`${id("street")}-error`} message={err(names.street)} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label htmlFor={id("province")} required={required}>
            Province
          </Label>
          <select
            id={id("province")}
            className={inputClass}
            disabled={provincesQuery.isLoading}
            {...describe(id("province"), err(names.province))}
            {...register(names.province, {
              // A new province means a new city and barangay.
              onChange: () => {
                setValue(names.city, "");
                setValue(names.barangay, "");
              },
            })}
          >
            <option value="">{provincesQuery.isLoading ? "Loading…" : "Select province…"}</option>
            {keep(province, (provincesQuery.data ?? []).map((p) => p.name)).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <FieldError id={`${id("province")}-error`} message={err(names.province)} />
        </div>
        <div>
          <Label htmlFor={id("city")} required={required}>
            City / municipality
          </Label>
          <select
            id={id("city")}
            className={inputClass}
            disabled={!province || citiesQuery.isLoading}
            {...describe(id("city"), err(names.city))}
            {...register(names.city, { onChange: () => setValue(names.barangay, "") })}
          >
            <option value="">{!province ? "Choose a province first" : citiesQuery.isLoading ? "Loading…" : "Select city / municipality…"}</option>
            {keep(city, cities.map((c) => c.name)).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <FieldError id={`${id("city")}-error`} message={err(names.city)} />
        </div>
        <div>
          <Label htmlFor={id("barangay")}>Barangay</Label>
          <select id={id("barangay")} className={inputClass} disabled={!city} {...register(names.barangay)}>
            <option value="">{city ? "Select barangay…" : "Choose a city first"}</option>
            {keep(barangay, barangays).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>
      {loadFailed && <p className="text-xs font-medium text-critical">Couldn't load the list of places. Check your connection and reopen this step.</p>}
    </div>
  );
}
