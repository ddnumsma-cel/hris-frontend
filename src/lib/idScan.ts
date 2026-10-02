// Client-side ID reading for the Add Employee form. There is no backend, so
// everything happens in the browser:
//   1. PhilSys National IDs carry a QR code with the holder's details as
//      JSON — decoded with jsQR, this is exact (confidence 1).
//   2. Otherwise the card is upscaled, turned black-and-white (see
//      idParse.ts for why) and read with Tesseract OCR — at least twice, with
//      different image treatments. Each value is scored from the OCR
//      confidence of the words it came from, raised when passes agree and
//      lowered when they don't, and dropped outright if it fails validation
//      (idValidate.ts). A third pass runs only when the first two disagree or
//      missed a core field.
// Both libraries are imported lazily so they only load when someone uploads.

import {
  binarizeAdaptive,
  binarizeOtsu,
  clean,
  combinePasses,
  CORE_FIELDS,
  normalizeDate,
  parseOcrWords,
  passesDisagree,
  titleCase,
  type Candidates,
  type IdSex,
  type OcrWord,
  type ScannedField,
  type ScannedIdFields,
} from "./idParse";
import { validBirthDate, validName, validSuffix } from "./idValidate";
import type { Page } from "tesseract.js";

export { idTypeOptions, type ScannedField, type ScannedIdFields } from "./idParse";

export interface ScanProgress {
  stage: "Checking for QR code" | "Loading reader" | "Reading text";
  progress: number; // 0–1
  pass?: number;
  passes?: number;
}

export interface IdScanResult {
  /** Only values that passed validation. */
  fields: ScannedIdFields;
  /** 0–1 per present field. QR-decoded = 1. */
  confidence: Partial<Record<ScannedField, number>>;
  source: "qr" | "ocr";
}

/** At/above: safe to prefill. Below: show the value as "please check". */
export const CONFIDENT = 0.8;

// Tesseract reads best when capital letters are ~30–40px tall; card photos
// are usually far smaller, so upscale to this width first.
const OCR_WIDTH = 2000;

// Everything that legitimately appears on a PH ID. Keeps background texture
// from coming back as "%", "»", "©"… ("<" is the passport MRZ filler.)
const CHAR_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÑñ0123456789 -,./':<";

/** Reads an ID, returning only the values confident enough to prefill. */
export async function scanIdImage(file: File, onProgress?: (p: ScanProgress) => void): Promise<ScannedIdFields> {
  const { fields, confidence } = await scanIdImageDetailed(file, onProgress);
  return clean(
    Object.fromEntries(
      Object.entries(fields).filter(([k]) => (confidence[k as ScannedField] ?? 0) >= CONFIDENT),
    ) as ScannedIdFields,
  );
}

/** Reads an ID, returning every validated value with its confidence (0–1). */
export async function scanIdImageDetailed(
  file: File,
  onProgress?: (p: ScanProgress) => void,
): Promise<IdScanResult> {
  const image = await loadImage(file);

  onProgress?.({ stage: "Checking for QR code", progress: 0 });
  const fromQr = await readPhilSysQr(image);
  if (fromQr) {
    const confidence = Object.fromEntries(Object.keys(fromQr).map((k) => [k, 1]));
    return { fields: fromQr, confidence, source: "qr" };
  }

  onProgress?.({ stage: "Loading reader", progress: 0 });
  const { gray, width, height } = toGrayscale(image, OCR_WIDTH);
  // Otsu for clean scans, adaptive for shadows/uneven lighting, plain
  // grayscale as the tie-breaker.
  const treatments = [() => binarizeOtsu(gray), () => binarizeAdaptive(gray, width, height), () => gray];

  const { createWorker, PSM } = await import("tesseract.js");
  let pass = 0;
  let planned = 2;
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        onProgress?.({ stage: "Reading text", progress: m.progress, pass, passes: planned });
      }
    },
  });
  try {
    // Sparse-text mode: ID cards are scattered fields, not paragraphs.
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      tessedit_char_whitelist: CHAR_WHITELIST,
    });
    const passes: Candidates[] = [];
    for (const treat of treatments) {
      pass++;
      const { data } = await worker.recognize(toCanvas(treat(), width, height), { rotateAuto: true }, { blocks: true });
      passes.push(parseOcrWords(wordsOf(data)));
      if (passes.length < 2) continue;
      const missingCore = CORE_FIELDS.some((f) => passes.every((p) => !p[f]));
      if (!passesDisagree(passes) && !missingCore) break;
      planned = 3;
    }
    const { fields, confidence } = combinePasses(passes);
    return { fields, confidence, source: "ocr" };
  } finally {
    await worker.terminate();
  }
}

function wordsOf(page: Page): OcrWord[] {
  const words: OcrWord[] = [];
  for (const block of page.blocks ?? [])
    for (const para of block.paragraphs)
      for (const line of para.lines)
        for (const w of line.words) words.push({ text: w.text, confidence: w.confidence, bbox: w.bbox });
  return words;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file couldn't be opened as an image."));
    };
    img.src = url;
  });
}

function toGrayscale(image: HTMLImageElement, targetWidth: number) {
  const scale = targetWidth / image.naturalWidth;
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
  }
  return { gray, width, height };
}

function toCanvas(gray: Uint8ClampedArray, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(width, height);
  for (let i = 0; i < gray.length; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = gray[i]!;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

async function readPhilSysQr(image: HTMLImageElement): Promise<ScannedIdFields | null> {
  const { default: jsQR } = await import("jsqr");
  // Phone photos are large; scale down so decoding stays fast.
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(data, width, height);
  if (!code) return null;
  return parsePhilSysQr(code.data);
}

/** PhilSys QR payload: {"subject": {"lName","fName","mName","Suffix","sex","DOB","PCN"}, ...} */
export function parsePhilSysQr(payload: string): ScannedIdFields | null {
  try {
    const json = JSON.parse(payload) as { subject?: Record<string, string> };
    const s = json.subject;
    if (!s || (!s.lName && !s.fName)) return null;
    const sex = s.sex?.trim().toUpperCase();
    const pcn = s.PCN?.replace(/\D/g, "");
    // The QR is exact, but still refuse anything that isn't a real value.
    return clean({
      lastName: validName(titleCase(s.lName), { allowLabelWords: true }),
      firstName: validName(titleCase(s.fName), { allowLabelWords: true }),
      middleName: validName(titleCase(s.mName), { allowLabelWords: true }),
      suffix: validSuffix(s.Suffix),
      birthDate: validBirthDate(normalizeDate(s.DOB)),
      sex: (sex?.startsWith("M") ? "Male" : sex?.startsWith("F") ? "Female" : undefined) as IdSex | undefined,
      idType: "PhilSys National ID",
      idNumber: pcn?.length === 16 ? pcn.replace(/(\d{4})(?=\d)/g, "$1-") : undefined,
    });
  } catch {
    return null;
  }
}
