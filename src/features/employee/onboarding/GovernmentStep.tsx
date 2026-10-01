import { useRef } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { CheckCircleIcon, FileIcon, UploadIcon } from "@/components/icons";
import type { AddEmployeeFormValues } from "@/lib/schemas";
import type { PersonnelDocumentType, UploadedDocument } from "@/lib/types";
import { FieldGroup } from "./fields";
import { GovIdInput } from "./GovIdInput";
import type { IdScan } from "./useIdScan";
import { coreDocuments, situationalFor } from "./model";

const docNotes: Partial<Record<PersonnelDocumentType, string>> = {
  "Application Form / Resume": "Your latest resume, PDF or photo",
  "Birth Certificate (PSA)": "PSA-issued copy",
  "Valid Government ID": "UMID, passport, driver's license… or scan it on the Identity step",
  "Diploma / Transcript of Records": "Highest level completed",
  "NBI Clearance": "Issued within the last 6 months",
  "Police/Barangay Clearance": "From your city or barangay",
  "Pre-Employment Medical Result": "From the clinic HR sent you to",
  "Marriage Certificate (PSA)": "Because you're married",
  "Child's Birth Certificate": "One for each child you listed",
  "Professional License": "Your PRC ID or certificate",
  "Certificate of Employment (Previous)": "From your last employer, with your BIR Form 2316",
};

function UploadRow({
  type,
  upload,
  fromIdScan,
  onPick,
  onRemove,
}: {
  type: PersonnelDocumentType;
  upload?: UploadedDocument;
  fromIdScan: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const done = Boolean(upload) || fromIdScan;
  const inputId = `upload-${type.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3">
      <span className={done ? "text-good" : "text-ink-3"}>{done ? <CheckCircleIcon className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{type}</p>
        <p className="truncate text-xs text-ink-2">
          {upload ? upload.fileName : fromIdScan ? "From the ID you uploaded" : docNotes[type]}
        </p>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      <div className="flex flex-none items-center gap-1">
        {upload && (
          <button type="button" onClick={onRemove} className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
            Remove
          </button>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={`${done ? "Replace" : "Upload"} ${type}`}
          className={
            done
              ? "rounded-full px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-surface-2"
              : "flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand"
          }
        >
          {!done && <UploadIcon className="h-3.5 w-3.5" />}
          {done ? "Replace" : "Upload"}
        </button>
      </div>
    </li>
  );
}

export function GovernmentStep({ idScan }: { idScan: IdScan }) {
  const { control } = useFormContext<AddEmployeeFormValues>();
  const values = useWatch({ control }) as AddEmployeeFormValues;
  const idOnFile = Boolean(idScan.governmentId);
  const situational = situationalFor(values);

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

        <FieldGroup
          title="Your 201 files"
          description="Upload a clear photo or PDF of each. Skip any you don't have yet and upload them later from your 201 file."
        >
          <Controller
            control={control}
            name="uploadedDocuments"
            render={({ field }) => {
              const uploads = field.value as UploadedDocument[];
              const set = (type: PersonnelDocumentType, file: File | null) =>
                field.onChange([...uploads.filter((u) => u.type !== type), ...(file ? [{ type, fileName: file.name }] : [])]);
              const all = [...coreDocuments, ...situational];
              const done = all.filter((t) => uploads.some((u) => u.type === t) || (t === "Valid Government ID" && idOnFile)).length;
              const row = (type: PersonnelDocumentType) => (
                <UploadRow
                  key={type}
                  type={type}
                  upload={uploads.find((u) => u.type === type)}
                  fromIdScan={type === "Valid Government ID" && idOnFile}
                  onPick={(file) => set(type, file)}
                  onRemove={() => set(type, null)}
                />
              );
              return (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full origin-left rounded-full bg-good transition-transform duration-300 motion-reduce:transition-none"
                        style={{ transform: `scaleX(${done / all.length})` }}
                      />
                    </div>
                    <p className="font-num flex-none text-xs font-semibold text-ink-2" aria-live="polite">
                      {done} of {all.length} uploaded
                    </p>
                  </div>
                  <ul className="divide-y divide-border rounded-xl border border-border px-4">{coreDocuments.map(row)}</ul>
                  {situational.length > 0 && (
                    <>
                      <p className="mt-2 text-xs font-semibold text-ink-2">Because of what you entered</p>
                      <ul className="divide-y divide-border rounded-xl border border-border px-4">{situational.map(row)}</ul>
                    </>
                  )}
                </>
              );
            }}
          />
        </FieldGroup>
      </div>
    </>
  );
}
