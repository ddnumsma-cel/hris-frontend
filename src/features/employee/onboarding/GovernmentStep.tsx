import { Controller, useFormContext, useWatch } from "react-hook-form";
import { CheckIcon } from "@/components/icons";
import type { AddEmployeeFormValues } from "@/lib/schemas";
import { FieldGroup } from "./fields";
import { GovIdInput } from "./GovIdInput";
import type { IdScan } from "./useIdScan";
import { coreDocuments, situationalDocuments } from "./model";

export function GovernmentStep({ idScan }: { idScan: IdScan }) {
  const { control } = useFormContext<AddEmployeeFormValues>();
  const civilStatus = useWatch({ control, name: "civilStatus" });
  const idOnFile = Boolean(idScan.governmentId);

  const whyNeeded: Partial<Record<string, string>> = {
    "Marriage Certificate (PSA)": civilStatus === "Married" ? "Needed — marked as married" : "If married",
    "Child's Birth Certificate": "For each child claimed as a dependent",
    "Professional License": "For CPAs, lawyers and other licensed roles",
  };

  return (
    <>
      <div className="flex flex-col gap-7">
        <FieldGroup
          title="Government numbers"
          description="Contributions and withholding tax can't be remitted without them."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <GovIdInput name="tin" />
            <GovIdInput name="sss" />
            <GovIdInput name="philHealth" />
            <GovIdInput name="pagIbig" />
          </div>
        </FieldGroup>

        <FieldGroup title="Documents you have" description="Tick what you can hand to HR. Scans can be uploaded later from your 201 file.">
          <Controller
            control={control}
            name="receivedDocuments"
            render={({ field }) => {
              const toggle = (type: string) =>
                field.onChange(field.value.includes(type) ? field.value.filter((t) => t !== type) : [...field.value, type]);
              const row = (type: string, note?: string) => {
                const fromUpload = type === "Valid Government ID" && idOnFile;
                const checked = fromUpload || field.value.includes(type);
                return (
                  <li key={type}>
                    <label className="doc-row">
                      <span className="doc-check-wrap">
                        <input type="checkbox" className="doc-check" checked={checked} disabled={fromUpload} onChange={() => toggle(type)} />
                        <CheckIcon strokeWidth={3} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-ink">{type}</span>
                        {(fromUpload || note) && <span className="block text-xs text-ink-2">{fromUpload ? "From the ID you uploaded" : note}</span>}
                      </span>
                      {checked && (
                        <span className="flex flex-none items-center gap-1 text-xs font-medium text-ink-2">
                          <CheckIcon className="h-3.5 w-3.5" />
                          Received
                        </span>
                      )}
                    </label>
                  </li>
                );
              };
              const received = coreDocuments.filter((t) => field.value.includes(t) || (t === "Valid Government ID" && idOnFile)).length;
              return (
                <>
                  <p className="text-xs font-semibold text-ink-2" aria-live="polite">
                    {received} of {coreDocuments.length} documents received
                  </p>
                  <ul className="grid gap-2 md:grid-cols-2">{coreDocuments.map((t) => row(t))}</ul>
                  <p className="mt-2 text-xs font-semibold text-ink-2">If applicable</p>
                  <ul className="grid gap-2 md:grid-cols-2">{situationalDocuments.map((t) => row(t, whyNeeded[t]))}</ul>
                </>
              );
            }}
          />
        </FieldGroup>
      </div>
    </>
  );
}
