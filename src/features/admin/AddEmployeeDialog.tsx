import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import clsx from "clsx";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IdCardIcon, LoaderIcon, UploadIcon, XIcon } from "@/components/icons";
import { createEmployee } from "@/lib/api";
import { assignNewHire } from "@/lib/coreHr";
import { idTypeOptions, scanIdImage, type ScannedIdFields, type ScanProgress } from "@/lib/idScan";
import {
  addEmployeeSchema,
  clusterDescriptions,
  clusterOptions,
  departmentsByCluster,
  fromAssignment,
  officeOptions,
  sexOptions,
  toAssignment,
  type AddEmployeeFormValues,
} from "@/lib/schemas";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-2";
const errorClass = "mt-1 text-xs font-medium text-critical";

const suffixOptions = ["Jr.", "Sr.", "II", "III", "IV", "V"];

const emptyValues: AddEmployeeFormValues = {
  lastName: "",
  firstName: "",
  middleName: "",
  suffix: "",
  birthDate: "",
  sex: "",
  email: "",
  phone: "",
  position: "",
  assignment: "",
  office: "Cebu HQ",
  idType: "",
  idNumber: "",
  idExpiry: "",
};

type ScannableField = keyof ScannedIdFields & keyof AddEmployeeFormValues;

type ScanState =
  | { status: "idle" }
  | { status: "scanning"; progress: ScanProgress }
  | { status: "done"; filled: ScannableField[]; idType?: string }
  | { status: "error"; message: string };

export function AddEmployeeDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreviewUrl, setIdPreviewUrl] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanState>({ status: "idle" });
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<AddEmployeeFormValues>({
    resolver: zodResolver(addEmployeeSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    return () => {
      if (idPreviewUrl) URL.revokeObjectURL(idPreviewUrl);
    };
  }, [idPreviewUrl]);

  const mutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: (employee) => {
      // Give the new hire a Core HR assignment and a "Hired" entry in their history.
      assignNewHire(employee);
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "employee-directory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview-stats"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      close();
      onSubmitted();
    },
  });

  const hasInput = isDirty || idFile !== null;

  function close() {
    reset(emptyValues);
    setIdFile(null);
    setIdPreviewUrl(null);
    setScan({ status: "idle" });
    setAutoFilled(new Set());
    setConfirmDiscard(false);
    onClose();
  }

  // Cancel, the X button and Escape all come through here; once anything has
  // been entered, ask before throwing it away.
  function requestClose() {
    if (confirmDiscard) return;
    if (hasInput && !mutation.isPending) setConfirmDiscard(true);
    else close();
  }

  // Register a field so a manual edit clears its "From ID" marker.
  function field(name: keyof AddEmployeeFormValues) {
    return register(name, {
      onChange: () =>
        setAutoFilled((prev) => {
          if (!prev.has(name)) return prev;
          const next = new Set(prev);
          next.delete(name);
          return next;
        }),
    });
  }

  async function handleIdFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setScan({ status: "error", message: "Upload a photo or scan of the ID (JPG, PNG or WebP)." });
      return;
    }
    setIdFile(file);
    setIdPreviewUrl(URL.createObjectURL(file));
    setScan({ status: "scanning", progress: { stage: "Checking for QR code", progress: 0 } });

    try {
      const result = await scanIdImage(file, (progress) => setScan({ status: "scanning", progress }));
      const filled: ScannableField[] = [];
      for (const [key, value] of Object.entries(result) as [ScannableField, string][]) {
        if (!value) continue;
        setValue(key, value as never, { shouldDirty: true, shouldValidate: true });
        filled.push(key);
      }
      setAutoFilled(new Set(filled));
      setScan({ status: "done", filled, idType: result.idType });
    } catch (e) {
      setScan({
        status: "error",
        message: e instanceof Error ? e.message : "We couldn't read that ID. Fill in the details manually.",
      });
    }
  }

  function removeIdFile() {
    setIdFile(null);
    setIdPreviewUrl(null);
    setScan({ status: "idle" });
    setAutoFilled(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (scan.status !== "scanning") handleIdFile(e.dataTransfer.files[0]);
  }

  function onSubmit(values: AddEmployeeFormValues) {
    const { cluster, department } = fromAssignment(values.assignment);
    mutation.mutate({
      lastName: values.lastName,
      firstName: values.firstName,
      middleName: values.middleName,
      suffix: values.suffix,
      birthDate: values.birthDate,
      email: values.email,
      phone: values.phone,
      position: values.position,
      department,
      cluster,
      office: values.office,
      governmentId: values.idType
        ? {
            idType: values.idType,
            idNumber: values.idNumber || undefined,
            idExpiry: values.idExpiry || undefined,
            fileName: idFile?.name,
          }
        : undefined,
    });
  }

  const inputFor = (name: string) => clsx(inputClass, autoFilled.has(name) && "border-brand/60");

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        title="Add employee"
        size="lg"
        dismissOnBackdrop={false}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-employee-form"
              disabled={isSubmitting || mutation.isPending || scan.status === "scanning"}
            >
              {mutation.isPending ? "Saving…" : "Save employee"}
            </Button>
          </div>
        }
      >
        <form id="add-employee-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          {/* ID upload / auto-fill */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={clsx(
              "rounded-lg border border-dashed p-3.5 transition-colors",
              dragging ? "border-brand bg-brand-tint" : "border-border bg-surface-2/40",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleIdFile(e.target.files?.[0])}
            />
            <div className="flex items-center gap-3.5">
              {idPreviewUrl ? (
                <img
                  src={idPreviewUrl}
                  alt="Uploaded ID"
                  className="h-14 w-22 flex-none rounded-md border border-border object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 flex-none items-center justify-center rounded-lg bg-surface text-ink-3">
                  <IdCardIcon className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                {scan.status === "idle" && (
                  <>
                    <div className="text-sm font-semibold">Upload an ID to auto-fill</div>
                    <div className="text-xs text-ink-2">
                      PhilSys, UMID, driver's license, passport, PRC and more. Drop a photo here or browse.
                    </div>
                  </>
                )}
                {scan.status === "scanning" && (
                  <>
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                      {scan.progress.stage}
                      {scan.progress.pass && scan.progress.pass > 1
                        ? ` — trying a clearer version (${scan.progress.pass} of ${scan.progress.passes})`
                        : ""}
                      …
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-brand transition-[width]"
                        style={{ width: `${Math.max(8, Math.round(scan.progress.progress * 100))}%` }}
                      />
                    </div>
                  </>
                )}
                {scan.status === "done" && (
                  <>
                    <div className="text-sm font-semibold">
                      {scan.filled.length > 0
                        ? `Filled ${scan.filled.length} field${scan.filled.length === 1 ? "" : "s"} from ${
                            scan.idType && scan.idType !== "Other" ? scan.idType : "the ID"
                          }`
                        : "Couldn't find any details on this ID"}
                    </div>
                    <div className="text-xs text-ink-2">
                      {scan.filled.length > 0
                        ? "Check the highlighted fields before saving. OCR can misread characters."
                        : "Try a sharper, well-lit photo with the whole card in frame, or fill in the form manually."}
                    </div>
                  </>
                )}
                {scan.status === "error" && (
                  <>
                    <div className="text-sm font-semibold text-critical">Couldn't read the ID</div>
                    <div className="text-xs text-ink-2">{scan.message}</div>
                  </>
                )}
              </div>
              <div className="flex flex-none items-center gap-1">
                {scan.status !== "scanning" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<UploadIcon className="h-3.5 w-3.5" />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {idFile ? "Replace" : "Upload an ID"}
                  </Button>
                )}
                {idFile && scan.status !== "scanning" && (
                  <button
                    type="button"
                    onClick={removeIdFile}
                    aria-label="Remove uploaded ID"
                    title="Remove"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <FormSection title="Personal information">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <Label htmlFor="emp-last" fromId={autoFilled.has("lastName")}>
                  Last name
                </Label>
                <input
                  id="emp-last"
                  className={inputFor("lastName")}
                  placeholder="Dela Cruz"
                  autoComplete="family-name"
                  {...field("lastName")}
                />
                {errors.lastName && <p className={errorClass}>{errors.lastName.message}</p>}
              </div>
              <div>
                <Label htmlFor="emp-first" fromId={autoFilled.has("firstName")}>
                  First name
                </Label>
                <input
                  id="emp-first"
                  className={inputFor("firstName")}
                  placeholder="Juan"
                  autoComplete="given-name"
                  {...field("firstName")}
                />
                {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
              </div>
              <div>
                <Label htmlFor="emp-middle" fromId={autoFilled.has("middleName")}>
                  Middle name <span className="font-normal text-ink-3">(optional)</span>
                </Label>
                <input
                  id="emp-middle"
                  className={inputFor("middleName")}
                  placeholder="Perez"
                  autoComplete="additional-name"
                  {...field("middleName")}
                />
              </div>
              <div>
                <Label htmlFor="emp-suffix" fromId={autoFilled.has("suffix")}>
                  Suffix <span className="font-normal text-ink-3">(optional)</span>
                </Label>
                <select id="emp-suffix" className={inputFor("suffix")} {...field("suffix")}>
                  <option value="">None</option>
                  {suffixOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="emp-birth" fromId={autoFilled.has("birthDate")}>
                  Birth date
                </Label>
                <input id="emp-birth" type="date" className={inputFor("birthDate")} {...field("birthDate")} />
              </div>
              <div>
                <Label htmlFor="emp-sex" fromId={autoFilled.has("sex")}>
                  Sex
                </Label>
                <select id="emp-sex" className={inputFor("sex")} {...field("sex")}>
                  <option value="">Select…</option>
                  {sexOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </FormSection>

          <FormSection title="Contact">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <Label htmlFor="emp-email" fromId={autoFilled.has("email")}>
                  Work email <span className="font-normal text-ink-3">(optional)</span>
                </Label>
                <input
                  id="emp-email"
                  type="email"
                  className={inputClass}
                  placeholder="juan.delacruz@msma.ph"
                  {...field("email")}
                />
                {errors.email && <p className={errorClass}>{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="emp-phone" fromId={autoFilled.has("phone")}>
                  Mobile number <span className="font-normal text-ink-3">(optional)</span>
                </Label>
                <input
                  id="emp-phone"
                  type="tel"
                  className={inputClass}
                  placeholder="+63 9XX XXX XXXX"
                  {...field("phone")}
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Employment">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="emp-position" fromId={autoFilled.has("position")}>
                  Position
                </Label>
                <input id="emp-position" className={inputClass} placeholder="Audit Associate" {...field("position")} />
                {errors.position && <p className={errorClass}>{errors.position.message}</p>}
              </div>
              <div>
                <Label htmlFor="emp-assignment" fromId={autoFilled.has("assignment")}>
                  Department · Cluster
                </Label>
                <select id="emp-assignment" className={inputClass} {...field("assignment")}>
                  <option value="">Select department…</option>
                  {clusterOptions.map((cluster) => (
                    <optgroup key={cluster} label={`${cluster} — ${clusterDescriptions[cluster]}`}>
                      {departmentsByCluster[cluster].map((department) => (
                        <option key={department} value={toAssignment(cluster, department)}>
                          {department} · {cluster}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {errors.assignment && <p className={errorClass}>{errors.assignment.message}</p>}
              </div>
              <div>
                <Label htmlFor="emp-office" fromId={autoFilled.has("office")}>
                  Office
                </Label>
                <select id="emp-office" className={inputClass} {...field("office")}>
                  {officeOptions.map((office) => (
                    <option key={office} value={office}>
                      {office}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </FormSection>

          <FormSection title="Government ID" meta="Saved to the employee's 201 File">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div>
                <Label htmlFor="emp-idtype" fromId={autoFilled.has("idType")}>
                  ID type
                </Label>
                <select id="emp-idtype" className={inputFor("idType")} {...field("idType")}>
                  <option value="">None yet</option>
                  {idTypeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="emp-idnumber" fromId={autoFilled.has("idNumber")}>
                  ID number
                </Label>
                <input id="emp-idnumber" className={clsx(inputFor("idNumber"), "font-num")} {...field("idNumber")} />
              </div>
              <div>
                <Label htmlFor="emp-idexpiry" fromId={autoFilled.has("idExpiry")}>
                  Expiry date
                </Label>
                <input id="emp-idexpiry" type="date" className={inputFor("idExpiry")} {...field("idExpiry")} />
              </div>
            </div>
          </FormSection>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard new employee?"
        message="You've started filling in this form. If you close it now, everything you've entered will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={close}
        onClose={() => setConfirmDiscard(false)}
      />
    </>
  );
}

function Label({ htmlFor, fromId, children }: { htmlFor: string; fromId: boolean; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={labelClass}>
      {children}
      {fromId && (
        <span className="rounded-full bg-brand-tint px-1.5 py-px text-[0.62rem] font-semibold text-brand-ink">From ID</span>
      )}
    </label>
  );
}

function FormSection({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-2 border-b border-border pb-1.5">
        <h3 className="text-xs font-medium tracking-[0.01em] text-ink-3">{title}</h3>
        {meta && <span className="text-[0.7rem] text-ink-3">{meta}</span>}
      </div>
      {children}
    </section>
  );
}
