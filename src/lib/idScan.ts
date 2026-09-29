// Client-side ID reading for the Add Employee form. There is no backend, so
// everything happens in the browser:
//   1. PhilSys National IDs carry a QR code with the holder's details as
//      JSON — decoded with jsQR, this is exact.
//   2. Otherwise the card is upscaled, turned black-and-white (see
//      idParse.ts for why) and read with Tesseract OCR. If key fields are
//      still missing, it retries with a different image treatment and fills
//      only the gaps.
// Both libraries are imported lazily so they only load when someone uploads.

import {
  binarizeAdaptive,
  binarizeOtsu,
  clean,
  hasCoreFields,
  mergeScans,
  normalizeDate,
  normalizeSuffix,
  parseIdText,
  titleCase,
  type IdSex,
  type ScannedIdFields,
} from "./idParse";

export { idTypeOptions, type ScannedIdFields } from "./idParse";

export interface ScanProgress {
  stage: "Checking for QR code" | "Loading reader" | "Reading text";
  progress: number; // 0–1
  pass?: number;
  passes?: number;
}

// Tesseract reads best when capital letters are ~30–40px tall; card photos
// are usually far smaller, so upscale to this width first.
const OCR_WIDTH = 2000;

export async function scanIdImage(file: File, onProgress?: (p: ScanProgress) => void): Promise<ScannedIdFields> {
  const image = await loadImage(file);

  onProgress?.({ stage: "Checking for QR code", progress: 0 });
  const fromQr = await readPhilSysQr(image);
  if (fromQr) return fromQr;

  onProgress?.({ stage: "Loading reader", progress: 0 });
  const { gray, width, height } = toGrayscale(image, OCR_WIDTH);
  // Ordered by how often each one wins: Otsu for clean scans, adaptive for
  // shadows/uneven lighting, plain grayscale as a last resort.
  const treatments = [() => binarizeOtsu(gray), () => binarizeAdaptive(gray, width, height), () => gray];

  const { createWorker, PSM } = await import("tesseract.js");
  let pass = 0;
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        onProgress?.({ stage: "Reading text", progress: m.progress, pass, passes: treatments.length });
      }
    },
  });
  try {
    // Sparse-text mode: ID cards are scattered fields, not paragraphs.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    let result: ScannedIdFields = {};
    const texts: string[] = [];
    for (const treat of treatments) {
      pass++;
      const { data } = await worker.recognize(toCanvas(treat(), width, height));
      texts.push(data.text);
      result = mergeScans(result, parseIdText(data.text));
      if (hasCoreFields(result)) return result;
    }
    // Labels never came through clearly: fall back to guessing names by
    // their printed order, from the cleanest (first) pass.
    return mergeScans(result, parseIdText(texts[0]!, { positional: true }));
  } finally {
    await worker.terminate();
  }
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
    return clean({
      lastName: titleCase(s.lName),
      firstName: titleCase(s.fName),
      middleName: titleCase(s.mName),
      suffix: normalizeSuffix(s.Suffix),
      birthDate: normalizeDate(s.DOB),
      sex: (sex?.startsWith("M") ? "Male" : sex?.startsWith("F") ? "Female" : undefined) as IdSex | undefined,
      idType: "PhilSys National ID",
      idNumber: s.PCN?.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1-"),
    });
  } catch {
    return null;
  }
}
