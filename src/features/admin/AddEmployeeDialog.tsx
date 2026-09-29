import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import clsx from "clsx";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AlertTriangleIcon, CameraIcon, CheckCircleIcon, IdCardIcon, LoaderIcon, PlusIcon, UploadIcon, XIcon } from "@/components/icons";
import { createEmployee, previewEmployeeId } from "@/lib/api";
import { getAge } from "@/lib/automation";
import { scanIdImage, type CheckedField, type ScannedIdFields, type ScanProgress } from "@/lib/idScan";
import {
  addEmployeeFormSchema,
  bloodTypeOptions,
  emergencyRelationshipOptions,
  hireClusterOptions,
  hireDepartmentOptions,
  officeOptions,
  sexOptions,
  type AddEmployeeFormValues,
} from "@/lib/schemas";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-2";
const errorClass = "mt-1 text-xs font-medium text-critical";

const suffixOptions = ["Jr.", "Sr.", "II", "III", "IV", "V"];

// The ID photo plus up to three more — the back of the card, or another ID.
const MAX_ID_IMAGES = 4;
const imageLabels = ["ID 1", "ID 2", "ID 3", "ID 4"];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const emptyValues = (): AddEmployeeFormValues => ({
  lastName: "",
  firstName: "",
  middleName: "",
  suffix: "",
  birthDate: "",
  sex: "",
  bloodType: "",
  email: "",
  phone: "",
  address: "",
  emergencyName: "",
  emergencyRelationship: "",
  emergencyPhone: "",
  position: "",
  dateHired: todayIso(),
  department: "",
  cluster: "",
  office: "Cebu HQ",
  idType: "",
  idNumber: "",
  idExpiry: "",
});

// Step 1 collects who the person is; step 2 their employment details.
// Next only moves on once these step 1 fields pass validation.
const stepOneFields = [
  "lastName",
  "firstName",
  "middleName",
  "suffix",
  "birthDate",
  "sex",
  "bloodType",
  "phone",
  "email",
  "address",
  "emergencyName",
  "emergencyRelationship",
  "emergencyPhone",
] as const;
const steps = ["Personal details", "Employment details"] as const;

interface IdImage {
  file: File;
  url: string;
}

type ScannableField = keyof ScannedIdFields & keyof AddEmployeeFormValues;

type ScanState =
  | { status: "idle" }
  | { status: "scanning"; progress: ScanProgress; side?: string }
  | {
      status: "done";
      filled: ScannableField[];
      unsure: CheckedField[];
      source: "qr" | "ocr";
      /** ID types recognised across the uploaded images. */
      idTypes: string[];
      /** Images skipped because they show someone else's surname. */
      mismatched: { lastName: string }[];
    }
  /** The photo was rejected (blurry, dark, glare, too small, unreadable) — not kept. */
  | { status: "retake"; title: string; reason: string; side?: string }
  | { status: "error"; message: string };

// What an uploaded ID may fill. It's for auto-fill only — it isn't saved to
// the 201 File, so the card's own number and expiry aren't used.
const autoFillFields = new Set<string>(["lastName", "firstName", "middleName", "suffix", "birthDate", "sex"]);

const fieldLabels: Record<CheckedField, string> = {
  lastName: "last name",
  firstName: "first name",
  middleName: "middle name",
  birthDate: "birth date",
  sex: "sex",
  idNumber: "ID number",
  idExpiry: "expiry date",
};

function listFields(fields: CheckedField[]) {
  const names = fields.map((f) => fieldLabels[f]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
}

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
  const [idImages, setIdImages] = useState<IdImage[]>([]);
  const [scan, setScan] = useState<ScanState>({ status: "idle" });
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    trigger,
    control,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<AddEmployeeFormValues>({
    resolver: zodResolver(addEmployeeFormSchema),
    defaultValues: emptyValues(),
  });

  // Free the preview images when the dialog closes or unmounts.
  const imagesRef = useRef(idImages);
  useEffect(() => {
    imagesRef.current = idImages;
  }, [idImages]);
  useEffect(() => () => imagesRef.current.forEach((img) => URL.revokeObjectURL(img.url)), []);

  const [lastName, firstName, dateHired, department, birthDate] = useWatch({
    control,
    name: ["lastName", "firstName", "dateHired", "department", "birthDate"],
  });
  const age = birthDate ? getAge(birthDate) : null;
  const idPreview =
    dateHired && lastName.trim() && firstName.trim() ? previewEmployeeId({ dateHired, lastName, firstName }) : null;

  const mutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "employee-directory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview-stats"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      close();
      onSubmitted();
    },
  });

  const hasInput = isDirty || idImages.length > 0;

  function close() {
    reset(emptyValues());
    idImages.forEach((img) => URL.revokeObjectURL(img.url));
    setIdImages([]);
    setScan({ status: "idle" });
    setAutoFilled(new Set());
    setConfirmDiscard(false);
    setStep(1);
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

  /**
   * Reads one or more ID photos — the back of a card, or other IDs. The ID
   * type is recognised from each photo. Every image fills only what's still
   * blank, and one showing a different surname is skipped rather than mixing
   * two people's details. A photo whose name can't be read gets a specific
   * reason to retake it.
   */
  async function handleIdFiles(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (files.length === 0) return;
    if (files.some((f) => !f.type.startsWith("image/"))) {
      setScan({ status: "error", message: "Upload a photo or scan of the ID (JPG, PNG or WebP)." });
      return;
    }
    const accepted = files.slice(0, MAX_ID_IMAGES - idImages.length);

    const previous = scan.status === "done" ? scan : undefined;
    const filled = new Set<ScannableField>(previous?.filled ?? []);
    let unsure = new Set<CheckedField>(previous?.unsure ?? []);
    let source: "qr" | "ocr" = previous?.source ?? "ocr";
    const idTypes = new Set<string>(previous?.idTypes ?? []);
    const mismatched = [...(previous?.mismatched ?? [])];
    let kept = idImages.length;
    const sameName = (a: string, b: string) => a.toLowerCase().replace(/[^a-zñ]/g, "") === b.toLowerCase().replace(/[^a-zñ]/g, "");

    for (const file of accepted) {
      const side = kept > 0 ? imageLabels[kept] : undefined;
      setScan({ status: "scanning", side, progress: { stage: "Checking photo quality", progress: 0 } });
      let outcome;
      try {
        outcome = await scanIdImage(file, undefined, kept === 0 ? "front" : "back", (progress) =>
          setScan({ status: "scanning", side, progress }),
        );
      } catch (e) {
        setScan({ status: "error", message: e instanceof Error ? e.message : "We couldn't open that photo." });
        return;
      }
      if (outcome.kind === "retake") {
        setScan({ status: "retake", title: outcome.title, reason: outcome.reason, side });
        return;
      }
      if (outcome.kind !== "read") continue;

      // Another ID for a different person: don't mix their details in.
      const current = getValues("lastName");
      if (outcome.fields.lastName && current && !sameName(outcome.fields.lastName, current)) {
        mismatched.push({ lastName: outcome.fields.lastName });
        continue;
      }

      setIdImages((prev) => [...prev, { file, url: URL.createObjectURL(file) }]);
      kept++;
      if (outcome.fields.idType && outcome.fields.idType !== "Other") idTypes.add(outcome.fields.idType);
      for (const [key, value] of Object.entries(outcome.fields) as [ScannableField, string][]) {
        // The ID is only used to fill in who the person is; its own number
        // and expiry belong to the 201 requirements, collected later.
        if (!value || !autoFillFields.has(key) || getValues(key)) continue;
        setValue(key, value as never, { shouldDirty: true, shouldValidate: true });
        filled.add(key);
      }
      for (const f of outcome.unsure) if (autoFillFields.has(f)) unsure.add(f);
      if (outcome.source === "qr") source = "qr";
    }
    // A later image may have read what an earlier one couldn't.
    unsure = new Set([...unsure].filter((f) => !getValues(f as ScannableField)));
    setAutoFilled(new Set(filled));
    setScan({ status: "done", filled: [...filled], unsure: [...unsure], source, idTypes: [...idTypes], mismatched });
  }

  function removeIdImage(index: number) {
    const img = idImages[index];
    if (img) URL.revokeObjectURL(img.url);
    const next = idImages.filter((_, i) => i !== index);
    setIdImages(next);
    if (next.length === 0) {
      setScan({ status: "idle" });
      setAutoFilled(new Set());
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (scan.status !== "scanning") handleIdFiles(e.dataTransfer.files);
  }

  function goToStep(next: 1 | 2) {
    setStep(next);
    // Start the new step at its top rather than wherever the last one was scrolled.
    formRef.current?.scrollIntoView({ block: "start" });
  }

  async function goNext() {
    if (await trigger([...stepOneFields], { shouldFocus: true })) goToStep(2);
  }

  function onSubmit(values: AddEmployeeFormValues) {
    mutation.mutate({
      lastName: values.lastName,
      firstName: values.firstName,
      middleName: values.middleName,
      suffix: values.suffix,
      birthDate: values.birthDate,
      email: values.email,
      phone: values.phone,
      position: values.position,
      department: values.department,
      cluster: values.cluster as (typeof hireClusterOptions)[number],
      office: values.office,
      dateHired: values.dateHired,
      bloodType: values.bloodType,
      address: values.address,
      emergencyContact: values.emergencyName
        ? {
            name: values.emergencyName,
            relationship: values.emergencyRelationship || undefined,
            phone: values.emergencyPhone,
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
        header={<StepIndicator step={step} />}
        footer={
          step === 1 ? (
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={requestClose}>
                Cancel
              </Button>
              <Button type="submit" form="add-employee-form" disabled={scan.status === "scanning"}>
                Next
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => goToStep(1)} disabled={mutation.isPending}>
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={requestClose}>
                  Cancel
                </Button>
                <Button type="submit" form="add-employee-form" disabled={isSubmitting || mutation.isPending}>
                  {mutation.isPending ? "Saving…" : "Save employee"}
                </Button>
              </div>
            </div>
          )
        }
      >
        <form
          ref={formRef}
          id="add-employee-form"
          // Enter on step 1 means Next, not save.
          onSubmit={
            step === 1
              ? (e) => {
                  e.preventDefault();
                  goNext();
                }
              : handleSubmit(onSubmit)
          }
          className="flex flex-col gap-4 scroll-mt-4"
          noValidate
        >
          {step === 1 && (
            <>
              {/* ID upload / auto-fill — one compact row so step 1 fits without scrolling. */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={clsx(
                  "rounded-lg border border-dashed p-3 transition-colors",
                  dragging ? "border-brand bg-brand-tint" : "border-border bg-surface-2/40",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleIdFiles(e.target.files)}
                />

                <div className="flex flex-wrap items-center gap-2.5">
                  {idImages.length === 0 && (
                    <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink-2">
                      <IdCardIcon className="h-4.5 w-4.5 flex-none text-ink-3" />
                      Upload a valid ID to auto-fill the form.
                    </p>
                  )}

                  {idImages.length > 0 && (
                    <ul className="flex items-center gap-2" aria-label="Uploaded ID images">
                      {idImages.map((img, i) => (
                        <li key={img.url} className="relative">
                          <img
                            src={img.url}
                            alt={`Uploaded ${imageLabels[i]}`}
                            title={imageLabels[i]}
                            className="h-9 w-14 rounded-md border border-border object-cover"
                          />
                          {scan.status !== "scanning" && (
                            <button
                              type="button"
                              onClick={() => removeIdImage(i)}
                              aria-label={`Remove ${imageLabels[i]}`}
                              title="Remove"
                              className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-border bg-surface text-ink-2 shadow-sm hover:text-critical"
                            >
                              <XIcon className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {idImages.length < MAX_ID_IMAGES && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={
                        idImages.length === 0 ? <UploadIcon className="h-3.5 w-3.5" /> : <PlusIcon className="h-3.5 w-3.5" />
                      }
                      onClick={() => fileInputRef.current?.click()}
                      disabled={scan.status === "scanning"}
                    >
                      {idImages.length === 0 ? "Upload ID photo" : "Upload another ID"}
                    </Button>
                  )}
                </div>

                {/* One status line, only when there's something to say. */}
                <div aria-live="polite">
                  {scan.status === "scanning" && (
                    <div className="mt-2.5 flex items-center gap-2 text-xs font-semibold">
                      <LoaderIcon className="h-3.5 w-3.5 flex-none animate-spin" />
                      <span className="flex-none">
                        {scan.side && `${scan.side}: `}
                        {scan.progress.stage}…
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-brand transition-[width]"
                          style={{ width: `${Math.max(8, Math.round(scan.progress.progress * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {scan.status === "done" && (
                    <p className="mt-2.5 flex items-start gap-1.5 text-xs text-ink-2">
                      <CheckCircleIcon className="mt-px h-3.5 w-3.5 flex-none text-good" />
                      <span>
                        <span className="font-semibold text-ink">
                          {scan.filled.length > 0
                            ? `Filled ${scan.filled.length} field${scan.filled.length === 1 ? "" : "s"}`
                            : "Nothing new to fill"}
                          {scan.source === "qr"
                            ? " from the QR code"
                            : scan.idTypes.length > 0 && ` from the ${scan.idTypes.join(" and ")}`}
                          .
                        </span>
                        {scan.unsure.length > 0 && ` Couldn't make out the ${listFields(scan.unsure)} — type ${scan.unsure.length === 1 ? "it" : "them"} in.`}
                      </span>
                    </p>
                  )}
                  {scan.status === "done" && scan.mismatched.length > 0 && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-warning">
                      <AlertTriangleIcon className="mt-px h-3.5 w-3.5 flex-none" />
                      <span>
                        Skipped an ID for {scan.mismatched.map((m) => `"${m.lastName}"`).join(", ")} — the surname
                        doesn't match this employee.
                      </span>
                    </p>
                  )}
                  {scan.status === "retake" && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md bg-critical-tint px-2.5 py-2 text-xs">
                      <CameraIcon className="h-3.5 w-3.5 flex-none text-critical" />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold text-critical">{scan.title}.</span>{" "}
                        <span className="text-ink">{scan.reason}</span>
                      </span>
                      <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()}>
                        Retake photo
                      </Button>
                    </div>
                  )}
                  {scan.status === "error" && <p className="mt-2.5 text-xs font-semibold text-critical">{scan.message}</p>}
                </div>
              </div>

              <FormSection title="Personal information">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_7rem]">
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
                      Middle name
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
                      Suffix
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
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[1.6fr_6rem_1fr_1fr]">
                  <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="emp-birth" fromId={autoFilled.has("birthDate")}>
                      Birth date
                    </Label>
                    <input id="emp-birth" type="date" className={inputFor("birthDate")} {...field("birthDate")} />
                  </div>
                  <div>
                    <span className={labelClass}>Age</span>
                    {/* Worked out from the birth date. */}
                    <div
                      aria-live="polite"
                      className="font-num flex min-h-[2.4rem] items-center rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm"
                    >
                      {age !== null && age >= 0 ? age : <span className="text-ink-3">—</span>}
                    </div>
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
                  <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="emp-blood" fromId={false}>
                      Blood type
                    </Label>
                    <select id="emp-blood" className={inputClass} {...field("bloodType")}>
                      <option value="">Select…</option>
                      {bloodTypeOptions.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </FormSection>

              <FormSection title="Contact">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div>
                    <Label htmlFor="emp-phone" fromId={autoFilled.has("phone")}>
                      Mobile number
                    </Label>
                    <input
                      id="emp-phone"
                      type="tel"
                      className={inputClass}
                      placeholder="+63 9XX XXX XXXX"
                      autoComplete="tel"
                      {...field("phone")}
                    />
                    {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="emp-email" fromId={autoFilled.has("email")}>
                      Email address
                    </Label>
                    <input
                      id="emp-email"
                      type="email"
                      className={inputClass}
                      placeholder="juan@email.com"
                      autoComplete="email"
                      {...field("email")}
                    />
                    {errors.email && <p className={errorClass}>{errors.email.message}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="emp-address" fromId={false}>
                      Address
                    </Label>
                    <input
                      id="emp-address"
                      className={inputClass}
                      placeholder="House no., street, barangay, city"
                      autoComplete="street-address"
                      {...field("address")}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="emp-emergency-name" fromId={false}>
                      Emergency contact
                    </Label>
                    <input
                      id="emp-emergency-name"
                      className={inputClass}
                      placeholder="Full name"
                      {...field("emergencyName")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="emp-emergency-rel" fromId={false}>
                      Relationship
                    </Label>
                    <select id="emp-emergency-rel" className={inputClass} {...field("emergencyRelationship")}>
                      <option value="">Select…</option>
                      {emergencyRelationshipOptions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="emp-emergency-phone" fromId={false}>
                      Contact no.
                    </Label>
                    <input
                      id="emp-emergency-phone"
                      type="tel"
                      className={inputClass}
                      placeholder="+63 9XX XXX XXXX"
                      {...field("emergencyPhone")}
                    />
                  </div>
                </div>
              </FormSection>
            </>
          )}

          {step === 2 && (
            <>
              <FormSection title="Employment">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="emp-department" fromId={false}>
                      Department
                    </Label>
                    <select
                      id="emp-department"
                      className={inputClass}
                      {...register("department", {
                        // A different department starts the cluster choice over.
                        onChange: () => setValue("cluster", ""),
                      })}
                    >
                      <option value="">Select department…</option>
                      {hireDepartmentOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {errors.department && <p className={errorClass}>{errors.department.message}</p>}
                  </div>
                  {/* Stays empty until a department is chosen. */}
                  <div>
                    {department && (
                      <>
                        <Label htmlFor="emp-cluster" fromId={false}>
                          Cluster
                        </Label>
                        <select id="emp-cluster" className={inputClass} {...field("cluster")}>
                          <option value="">Select cluster…</option>
                          {hireClusterOptions.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        {errors.cluster && <p className={errorClass}>{errors.cluster.message}</p>}
                      </>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="emp-hired" fromId={false}>
                      Date hired
                    </Label>
                    <input id="emp-hired" type="date" className={inputClass} {...field("dateHired")} />
                    {errors.dateHired && <p className={errorClass}>{errors.dateHired.message}</p>}
                  </div>
                  <div>
                    <span className={labelClass}>
                      Employee ID <span className="font-normal text-ink-3">(auto)</span>
                    </span>
                    <div
                      aria-live="polite"
                      className="font-num flex min-h-[2.4rem] items-center rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm"
                    >
                      {idPreview ? idPreview.id : <span className="text-ink-3">Enter name and date hired</span>}
                    </div>
                    <p className="mt-1 text-[0.7rem] text-ink-3">
                      {idPreview && idPreview.renumbers > 0
                        ? `${idPreview.renumbers} later hire${idPreview.renumbers === 1 ? "" : "s"} this month will move down one number.`
                        : "From the hire date · same-day hires go alphabetically"}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="emp-position" fromId={autoFilled.has("position")}>
                      Position
                    </Label>
                    <input id="emp-position" className={inputClass} placeholder="Staff Accountant" {...field("position")} />
                    {errors.position && <p className={errorClass}>{errors.position.message}</p>}
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

            </>
          )}
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

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <ol className="flex items-center gap-2 pb-3.5 text-xs font-semibold" aria-label="Add employee steps">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2;
        const state = n === step ? "current" : n < step ? "done" : "upcoming";
        return (
          <li key={label} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
            {i > 0 && <span className="h-px w-6 bg-border" aria-hidden="true" />}
            <span
              className={clsx(
                "flex h-5.5 w-5.5 items-center justify-center rounded-full text-[0.7rem]",
                state === "upcoming" ? "bg-surface-2 text-ink-3" : "bg-brand text-white",
              )}
            >
              {n}
            </span>
            <span className={state === "upcoming" ? "text-ink-3" : "text-ink"}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
