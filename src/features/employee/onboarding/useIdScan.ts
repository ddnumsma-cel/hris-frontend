import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { scanIdImage, type CheckedField, type ScannedIdFields, type ScanProgress } from "@/lib/idScan";
import type { AddEmployeeFormValues } from "@/lib/schemas";

// The ID photo plus up to three more — the back of the card, or another ID.
export const MAX_ID_IMAGES = 4;
export const imageLabels = ["ID 1", "ID 2", "ID 3", "ID 4"];

// An uploaded ID only fills in who the person is.
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

export function listFields(fields: CheckedField[]) {
  const names = fields.map((f) => fieldLabels[f]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
}

type ScannableField = keyof ScannedIdFields & keyof AddEmployeeFormValues;

type ScanState =
  | { status: "idle" }
  | { status: "scanning"; progress: ScanProgress; side?: string }
  | { status: "done"; filled: ScannableField[]; unsure: CheckedField[]; source: "qr" | "ocr"; idTypes: string[]; mismatched: { lastName: string }[] }
  | { status: "retake"; title: string; reason: string; side?: string }
  | { status: "error"; message: string };

interface IdImage {
  file: File;
  url: string;
}

/**
 * ID upload + auto-fill state, kept on the page (not the step) so moving between
 * steps doesn't lose the photos. `autoFilled` marks fields read from the ID until edited.
 */
export function useIdScan(form: UseFormReturn<AddEmployeeFormValues>) {
  const [images, setImages] = useState<IdImage[]>([]);
  const [scan, setScan] = useState<ScanState>({ status: "idle" });
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());

  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => () => imagesRef.current.forEach((img) => URL.revokeObjectURL(img.url)), []);

  function clearMark(name: string) {
    setAutoFilled((prev) => {
      if (!prev.has(name)) return prev;
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  }

  async function addFiles(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    if (files.some((f) => !f.type.startsWith("image/"))) {
      setScan({ status: "error", message: "Upload a photo or scan of the ID (JPG, PNG or WebP)." });
      return;
    }
    const { getValues, setValue } = form;
    const accepted = files.slice(0, MAX_ID_IMAGES - images.length);
    const previous = scan.status === "done" ? scan : undefined;
    const filled = new Set<ScannableField>(previous?.filled ?? []);
    let unsure = new Set<CheckedField>(previous?.unsure ?? []);
    let source: "qr" | "ocr" = previous?.source ?? "ocr";
    const idTypes = new Set<string>(previous?.idTypes ?? []);
    const mismatched = [...(previous?.mismatched ?? [])];
    let kept = images.length;
    const sameName = (a: string, b: string) =>
      a.toLowerCase().replace(/[^a-zñ]/g, "") === b.toLowerCase().replace(/[^a-zñ]/g, "");

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

      // Another person's ID: don't mix their details in.
      const current = getValues("lastName");
      if (outcome.fields.lastName && current && !sameName(outcome.fields.lastName, current)) {
        mismatched.push({ lastName: outcome.fields.lastName });
        continue;
      }

      setImages((prev) => [...prev, { file, url: URL.createObjectURL(file) }]);
      kept++;
      if (outcome.fields.idType && outcome.fields.idType !== "Other") idTypes.add(outcome.fields.idType);
      for (const [key, value] of Object.entries(outcome.fields) as [ScannableField, string][]) {
        if (!value || !autoFillFields.has(key) || getValues(key)) continue;
        setValue(key, value as never, { shouldDirty: true, shouldValidate: true });
        filled.add(key);
      }
      for (const f of outcome.unsure) if (autoFillFields.has(f)) unsure.add(f);
      if (outcome.source === "qr") source = "qr";
    }
    unsure = new Set([...unsure].filter((f) => !getValues(f as ScannableField)));
    setAutoFilled(new Set(filled));
    setScan({ status: "done", filled: [...filled], unsure: [...unsure], source, idTypes: [...idTypes], mismatched });
  }

  function removeImage(index: number) {
    const img = images[index];
    if (img) URL.revokeObjectURL(img.url);
    const next = images.filter((_, i) => i !== index);
    setImages(next);
    if (next.length === 0) {
      setScan({ status: "idle" });
      setAutoFilled(new Set());
    }
  }

  function reset() {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    setScan({ status: "idle" });
    setAutoFilled(new Set());
  }

  /** What becomes the "Valid Government ID" entry in the 201 checklist. */
  const governmentId =
    images.length > 0
      ? {
          idType: scan.status === "done" && scan.idTypes.length > 0 ? scan.idTypes.join(" / ") : "Government ID",
          fileName: images[0].file.name,
          extraFileNames: images.slice(1).map((i) => i.file.name),
        }
      : undefined;

  return { images, scan, autoFilled, clearMark, addFiles, removeImage, reset, governmentId, scanning: scan.status === "scanning" };
}

export type IdScan = ReturnType<typeof useIdScan>;

