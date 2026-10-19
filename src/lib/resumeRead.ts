// Reads an applicant's resume on their own device (nothing is uploaded) and pulls out what the
// application form asks for. PDFs are read with PDF.js; photos, and PDFs that are only scans, go
// through Tesseract OCR. Everything found is a suggestion the applicant checks.

import type { ApplicantProfession } from "./types";
import { formatPhMobile, isValidPhMobile } from "./govIds";

export interface ResumeFields {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  profession?: ApplicantProfession;
  prcLicenseNumber?: string;
  yearsExperience?: number;
  /** Place names to match against the PSGC lists. */
  text: string;
}

export type ReadProgress = { stage: string; progress?: number };

const MAX_PAGES = 3;

async function pdfText(file: File, onProgress?: (p: ReadProgress) => void): Promise<{ text: string; pdf: import("pdfjs-dist").PDFDocumentProxy }> {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines: string[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGES); n++) {
    onProgress?.({ stage: `Reading page ${n}` });
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      } else if (item.str && !item.str.endsWith(" ")) line += " ";
    }
    if (line.trim()) lines.push(line);
  }
  return { text: lines.join("\n"), pdf };
}

async function ocr(images: (HTMLCanvasElement | File)[], onProgress?: (p: ReadProgress) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  let page = 0;
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") onProgress?.({ stage: images.length > 1 ? `Reading page ${page}` : "Reading text", progress: m.progress });
    },
  });
  try {
    const out: string[] = [];
    for (const img of images) {
      page++;
      const { data } = await worker.recognize(img);
      out.push(data.text);
    }
    return out.join("\n");
  } finally {
    await worker.terminate();
  }
}

/** The resume's text, by whichever route works for the file. */
export async function readResumeText(file: File, onProgress?: (p: ReadProgress) => void): Promise<string> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) {
    onProgress?.({ stage: "Reading text" });
    return ocr([file], onProgress);
  }
  const { text, pdf } = await pdfText(file, onProgress);
  if (text.replace(/\s/g, "").length >= 60) return text;
  // A scanned PDF has no text layer: draw its pages and read them like photos.
  const canvases: HTMLCanvasElement[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGES); n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;
    canvases.push(canvas);
  }
  return ocr(canvases, onProgress);
}

// ---- Parsing ----

const NOT_A_NAME = /resume|curriculum|vitae|\bcv\b|objective|profile|summary|address|contact|email|mobile|phone|career|experience|education|skills/i;
const PARTICLES = new Set(["de", "dela", "del", "delos", "de la", "de los", "san", "sta", "sta.", "sto", "sto.", "van", "von", "da", "dos", "las"]);
const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])([a-zñ])/g, (_, sep: string, c: string) => sep + c.toUpperCase());

/** The applicant's name: one of the first lines, 2–5 capitalised words, no digits or labels. */
export function parseName(text: string): { firstName: string; lastName: string } | undefined {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10);
  for (const raw of lines) {
    const line = raw.replace(/^name\s*[:-]\s*/i, "").replace(/,?\s*(cpa|mba|bsa)$/i, "");
    if (/[\d@|/\\]/.test(line) || NOT_A_NAME.test(line)) continue;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 5) continue;
    if (!words.every((w) => /^[A-ZÑ][A-Za-zÑñ.'-]*$/.test(w) || PARTICLES.has(w.toLowerCase()))) continue;
    // Drop a suffix and a middle initial ("P."); keep particles with the last name ("Dela Cruz").
    const parts = words.filter((w) => !SUFFIX.test(w) && !/^[A-Z]\.$/.test(w)).map((w) => (w === w.toUpperCase() && w.length > 2 ? titleCase(w) : w));
    if (parts.length < 2) continue;
    let split = parts.length - 1;
    while (split > 1 && PARTICLES.has(parts[split - 1].toLowerCase())) split--;
    return { firstName: parts.slice(0, split).join(" "), lastName: parts.slice(split).join(" ") };
  }
  return undefined;
}

function parseProfession(text: string): ApplicantProfession | undefined {
  if (/certified\s+public\s+accountant|\bC\.?P\.?A\.?\b(?!\s*(board|review|exam|reviewee))/i.test(text)) return "CPA";
  const accountancy = /bachelor\s+of\s+science\s+in\s+accountancy|\bBS\s*(in\s*)?Accountancy\b|\bBSA\b|\bBS\s*Accounting\b/i;
  if (accountancy.test(text)) {
    const studying = /(undergraduate|currently\s+(enrolled|studying)|expected\s+(graduation|to\s+graduate)|\b(3rd|4th|third|fourth)\s+year\b|present\)?\s*$)/im;
    return studying.test(text) ? "Accounting student / undergrad" : "BS Accountancy graduate";
  }
  return undefined;
}

/** Years worked: "5 years of experience", else the date ranges under the work-experience heading. */
function parseYears(text: string): number | undefined {
  const stated = text.match(/(\d{1,2})\+?\s*years?\s+(of\s+)?(work\s+|professional\s+|relevant\s+)?experience/i);
  if (stated) return Number(stated[1]);
  const start = text.search(/(work|professional|employment)\s+(experience|history)|^\s*experience\s*$/im);
  if (start === -1) return undefined;
  const rest = text.slice(start + 10);
  const end = rest.search(/^\s*(education|educational|skills|references|certifications?|trainings?|seminars?|affiliations?|awards?)\b/im);
  const section = end === -1 ? rest : rest.slice(0, end);
  const now = new Date().getFullYear();
  const spans: [number, number][] = [];
  for (const m of section.matchAll(/\b((?:19|20)\d{2})\s*(?:-|–|—|to)\s*((?:19|20)\d{2}|present|current|to\s+date|now)\b/gi)) {
    const a = Number(m[1]);
    const b = /\d/.test(m[2]) ? Number(m[2]) : now;
    if (b >= a && b <= now) spans.push([a, b]);
  }
  if (spans.length === 0) return undefined;
  // Overlapping jobs count once.
  const years = new Set<number>();
  for (const [a, b] of spans) for (let y = a; y < b; y++) years.add(y);
  return Math.min(50, Math.max(years.size, 0));
}

export function parseResume(text: string): ResumeFields {
  // OCR sometimes splits an email after a dot ("juan. delacruz@gmail.com"); join it back first.
  const joined = text.replace(/(\w)\.\s+(?=[\w.+-]+@)/g, "$1.");
  const match = joined.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/);
  let email = match?.[0];
  // It can also drop the dot ("juan delacruz@…"): if the word just before is part of their name, it belongs.
  const name = parseName(text);
  if (match && name) {
    const before = joined.slice(0, match.index).match(/(?:^|\s)([a-z]+)\s$/)?.[1];
    const nameWords = `${name.firstName} ${name.lastName}`.toLowerCase().split(/\s+/);
    if (before && nameWords.includes(before)) email = `${before}.${email}`;
  }
  const phoneRaw = text.match(/(\+?63|0)[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{4}/)?.[0];
  const phone = phoneRaw && isValidPhMobile(phoneRaw) ? formatPhMobile(phoneRaw) : undefined;
  const profession = parseProfession(text);
  const prc = text.match(/\b(?:PRC|license|licence)\b[^\d\n]{0,25}(\d{7})\b/i)?.[1];
  return {
    ...parseName(text),
    email: email?.toLowerCase(),
    phone,
    profession,
    prcLicenseNumber: profession === "CPA" ? prc : undefined,
    yearsExperience: parseYears(text),
    text,
  };
}

// ---- Place ----

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();

/** Ways a city is written: "City of Cebu" is also "Cebu City". */
export function cityAliases(name: string): string[] {
  const n = norm(name);
  const m = n.match(/^city of (.+)$/);
  return m ? [n, `${m[1]} city`] : [n];
}

const has = (hay: string, needle: string) => new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(hay);

/** Lines that look like an address get searched first, so "Rizal" in a school name loses to the real address. */
export function addressFirst(text: string): string[] {
  const lines = text.split(/\n/).map(norm).filter(Boolean);
  const address = lines.filter((l) => /\b(address|brgy|barangay|street|st|ave|avenue|purok|sitio|subd|village|city|province)\b/.test(l));
  return [...address, ...lines.filter((l) => !address.includes(l))];
}

export function findCity(lines: string[], cities: { name: string }[]): string | undefined {
  for (const line of lines) for (const c of cities) if (cityAliases(c.name).some((a) => has(line, a))) return c.name;
  return undefined;
}

export function findProvince(lines: string[], provinces: { name: string }[]): string | undefined {
  // Longer names first, so "Davao del Sur" wins over "Davao".
  const sorted = [...provinces].sort((a, b) => b.name.length - a.name.length);
  for (const line of lines) for (const p of sorted) if (has(line, norm(p.name))) return p.name;
  return undefined;
}
