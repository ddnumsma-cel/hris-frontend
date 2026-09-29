// Client-side ID reading for the Add Employee form. There is no backend, so
// everything happens in the browser. HR first says which ID they're
// uploading; then, for each photo:
//   1. The photo is checked for size, sharpness, lighting and glare — not to
//      turn it away, but to explain what went wrong if the name can't be read.
//      A photo is only sent back for a retake when the name is unreadable;
//      anything else it can't read clearly is simply left for HR to type.
//   2. PhilSys National IDs carry a QR code with the holder's details as
//      JSON — decoded with jsQR, this is exact.
//   3. Otherwise the card is upscaled, turned black-and-white (see
//      idParse.ts for why) and read with Tesseract OCR, using the chosen
//      ID's layout and number format. Only values read with high confidence
//      are returned; the rest come back as "unsure" and stay blank.
// Both libraries are imported lazily so they only load when someone uploads.

import {
  binarizeAdaptive,
  binarizeOtsu,
  clean,
  detectIdType,
  bestOfPasses,
  hasCoreFields,
  isPlausibleBirthDate,
  normalizeDate,
  normalizeSuffix,
  parseIdText,
  titleCase,
  type CheckedField,
  type IdSex,
  type OcrLines,
  type ScannedIdFields,
} from "./idParse";

export { idTypeOptions, type CheckedField, type ScannedIdFields } from "./idParse";

export interface ScanProgress {
  stage: "Checking photo quality" | "Checking for QR code" | "Loading reader" | "Reading text";
  progress: number; // 0–1
  pass?: number;
  passes?: number;
}

export type IdScanOutcome =
  /** Read: `fields` are confident values; `unsure` were seen but not clear enough to fill. */
  | { kind: "read"; fields: ScannedIdFields; unsure: CheckedField[]; source: "qr" | "ocr"; expiredOn?: string }
  /** The name couldn't be read — ask for a new photo. */
  | { kind: "retake"; title: string; reason: string }
  /** The card doesn't look like the ID type HR picked. */
  | { kind: "wrongType"; detected: string };

// Tesseract reads best when capital letters are ~30–40px tall, so card photos
// are upscaled first. Any single scale can drop a letter on some cards (a
// "JUAN" read as "JUA" with 90% confidence), so every photo is read at two
// scales and the readings are cross-checked.
const OCR_WIDTHS = [1600, 2400] as const;

/**
 * @param expectedType the ID type, if known; otherwise it's detected from the card
 * @param side "front" must show the holder's name; the back may not.
 */
export async function scanIdImage(
  file: File,
  expectedType: string | undefined,
  side: "front" | "back",
  onProgress?: (p: ScanProgress) => void,
): Promise<IdScanOutcome> {
  const image = await loadImage(file);

  onProgress?.({ stage: "Checking photo quality", progress: 0 });
  // Kept to explain a failed read; it never blocks reading on its own.
  const problem = checkPhotoQuality(image);

  // Any card might be a PhilSys ID, and its QR code is exact — always try it.
  if (!expectedType || expectedType === "PhilSys National ID") {
    onProgress?.({ stage: "Checking for QR code", progress: 0 });
    const fromQr = await readPhilSysQr(image);
    if (fromQr) return finish(fromQr, [], "qr");
  }

  onProgress?.({ stage: "Loading reader", progress: 0 });
  const scaled = OCR_WIDTHS.map((w) => toGrayscale(image, w));
  const [small, large] = scaled as [(typeof scaled)[number], (typeof scaled)[number]];
  // Otsu (clean scans) at both scales first so there are two readings to
  // compare; then adaptive for shadows/uneven lighting, and plain grayscale.
  const treatments = [
    { img: small, treat: () => binarizeOtsu(small.gray) },
    { img: large, treat: () => binarizeOtsu(large.gray) },
    { img: small, treat: () => binarizeAdaptive(small.gray, small.width, small.height) },
    { img: large, treat: () => large.gray },
  ];

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
    const passes: { text: string; fields: ScannedIdFields; lines: OcrLines }[] = [];
    for (const { img, treat } of treatments) {
      pass++;
      const { data } = await worker.recognize(toCanvas(treat(), img.width, img.height), {}, { text: true, blocks: true });
      const lines: OcrLines = [];
      for (const block of data.blocks ?? [])
        for (const paragraph of block.paragraphs)
          for (const line of paragraph.lines)
            lines.push(line.words.map((w) => ({ text: w.text, confidence: w.confidence })));

      // Wrong card: the printed text clearly names a different ID.
      if (pass === 1 && expectedType && expectedType !== "Other") {
        const detected = detectIdType(data.text.toUpperCase());
        if (detected !== "Other" && detected !== expectedType) return { kind: "wrongType", detected };
      }
      const parsed = parseIdText(data.text, { idType: expectedType });
      passes.push({ text: data.text, fields: parsed, lines });
      // Stop once this pass alone read every core field confidently.
      // Stop once two passes agree on every core field, read confidently.
      if (passes.length >= 2 && hasCoreFields(bestOfPasses(passes).agreed)) break;
    }
    let { fields, unsure } = bestOfPasses(passes);
    if (!fields.lastName && !fields.firstName) {
      // Labels never came through clearly: fall back to guessing names by
      // their printed order, from the cleanest (first) pass.
      const first = passes[0]!;
      ({ fields, unsure } = bestOfPasses([
        ...passes,
        { ...first, fields: parseIdText(first.text, { positional: true, idType: expectedType }) },
      ]));
    }

    if (side === "front" && !fields.lastName && !fields.firstName) {
      return {
        kind: "retake",
        title: problem ? `We couldn't read the name — ${problem.title.charAt(0).toLowerCase()}${problem.title.slice(1)}` : "We couldn't read the name on this ID",
        reason:
          problem?.reason ??
          "Retake the photo with the card flat on a table, all four corners in the frame, and the text in sharp focus.",
      };
    }
    // The card's type: as given, or what the printed text points to.
    const idType = expectedType ?? passes.map((p) => p.fields.idType).find((t) => t && t !== "Other") ?? "Other";
    return finish({ ...fields, idType }, unsure, "ocr");
  } finally {
    await worker.terminate();
  }
}

/** Final checks shared by QR and OCR results: a realistic birth date, and expiry. */
function finish(fields: ScannedIdFields, unsure: CheckedField[], source: "qr" | "ocr"): IdScanOutcome {
  const out = { ...fields };
  const flagged = [...unsure];
  if (out.birthDate && !isPlausibleBirthDate(out.birthDate)) {
    delete out.birthDate;
    flagged.push("birthDate");
  }
  const today = new Date().toISOString().slice(0, 10);
  const expiredOn = out.idExpiry && out.idExpiry < today ? out.idExpiry : undefined;
  return { kind: "read", fields: out, unsure: flagged, source, expiredOn };
}

// ---- Photo quality ----
//
// Thresholds are deliberately forgiving so a decent phone photo is never
// turned away; they catch the photos OCR would only half-read.

const MIN_SHORT_SIDE = 360; // px — below this the small print is only a few pixels tall
const MIN_SHARPNESS = 60; // variance of the Laplacian at 1000px wide
const MIN_BRIGHTNESS = 60; // mean luminance, 0–255
const MAX_GLARE_SHARE = 0.12; // share of pixels blown out to near-white

export function checkPhotoQuality(image: HTMLImageElement): { title: string; reason: string } | null {
  const shortSide = Math.min(image.naturalWidth, image.naturalHeight);
  if (shortSide < MIN_SHORT_SIDE) {
    return {
      title: "The photo is too small to read",
      reason: `It's only ${image.naturalWidth}×${image.naturalHeight} pixels. Move closer so the ID fills the frame, or upload the original photo instead of a screenshot.`,
    };
  }

  const { gray, width, height } = toGrayscale(image, 1000);
  let sum = 0;
  let blown = 0;
  for (const v of gray) {
    sum += v;
    if (v >= 250) blown++;
  }
  if (sum / gray.length < MIN_BRIGHTNESS) {
    return {
      title: "The photo is too dark",
      reason: "Take it again somewhere well lit — near a window or under a ceiling light — so the text stands out.",
    };
  }
  if (blown / gray.length > MAX_GLARE_SHARE) {
    return {
      title: "There's glare on the ID",
      reason:
        "Part of the card is washed out by light. Tilt the card slightly or move away from the lamp or flash, then retake it.",
    };
  }
  if (laplacianVariance(gray, width, height) < MIN_SHARPNESS) {
    return {
      title: "The photo is blurry",
      reason: "Hold the phone steady, tap the ID on screen to focus, and check the text is sharp before taking the photo.",
    };
  }
  return null;
}

/** Sharpness: how strongly neighbouring pixels differ. Blur flattens edges and lowers it. */
function laplacianVariance(gray: Uint8ClampedArray, width: number, height: number) {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = 4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - width]! - gray[i + width]!;
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
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
