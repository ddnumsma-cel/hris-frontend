// Pure (DOM-free) helpers behind the ID scanner in idScan.ts: image
// binarization for OCR, and turning OCR words into form fields with a
// confidence for each. Kept separate so they can be exercised outside the
// browser.
//
// How a card is read:
//   1. OCR words (with their boxes and Tesseract confidences) are grouped
//      into printed rows, and label phrases ("Last Name", "Date of Birth"…)
//      are found in them.
//   2. Each label's value is the text right after it on the same row, or the
//      text in the label's column on the next row. Column-awareness matters:
//      licenses print "Nationality  Sex  Date of Birth" side by side with the
//      values underneath.
//   3. Every value is checked (idValidate.ts) and scored from the confidences
//      of the words it came from. Guesses (no label, positional) are capped
//      below the "safe to prefill" line.
//   4. idScan.ts runs this over several image treatments and combines them
//      with combinePasses(): agreement raises confidence, disagreement lowers
//      it.

import {
  isLabelWord,
  validBirthDate,
  validExpiry,
  validIdNumber,
  validName,
  validSex,
  validSuffix,
} from "./idValidate";

export type IdSex = "Male" | "Female";

export interface ScannedIdFields {
  lastName?: string;
  firstName?: string;
  middleName?: string;
  suffix?: string;
  birthDate?: string; // yyyy-mm-dd
  sex?: IdSex;
  idType?: string;
  idNumber?: string;
  idExpiry?: string; // yyyy-mm-dd
}

export type ScannedField = keyof ScannedIdFields;

export const idTypeOptions = [
  "PhilSys National ID",
  "UMID",
  "Driver's License",
  "Passport",
  "PRC ID",
  "SSS ID",
  "TIN ID",
  "Postal ID",
  "Other",
] as const;

/** Fields a scan should find; missing ones make the scanner try another image treatment. */
export const CORE_FIELDS: ScannedField[] = ["lastName", "firstName", "birthDate", "idNumber"];

/** One OCR'd word, shaped like Tesseract.js's `Word`. `confidence` is 0–100. */
export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface Candidate {
  value: string;
  /** 0–1. */
  conf: number;
  /** Most this value may ever score, even when every pass agrees (guesses stay below "confident"). */
  cap: number;
}

export type Candidates = Partial<Record<ScannedField, Candidate>>;

// ---------------------------------------------------------------------------
// Image binarization
//
// ID cards print dark text over busy pastel guilloche patterns and
// watermarks. Tesseract reads that background as stray characters ("Ll i",
// "%", "Zz") glued onto real values, so each OCR pass sees a black-and-white
// version of the card instead of the raw photo.
// ---------------------------------------------------------------------------

/** Global threshold picked by Otsu's method — best on evenly lit scans. */
export function binarizeOtsu(gray: Uint8ClampedArray): Uint8ClampedArray {
  const hist = new Array<number>(256).fill(0);
  for (const v of gray) hist[v]!++;
  const total = gray.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t]!;

  let sumBg = 0;
  let weightBg = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    weightBg += hist[t]!;
    if (weightBg === 0) continue;
    const weightFg = total - weightBg;
    if (weightFg === 0) break;
    sumBg += t * hist[t]!;
    const meanBg = sumBg / weightBg;
    const meanFg = (sumAll - sumBg) / weightFg;
    const between = weightBg * weightFg * (meanBg - meanFg) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }

  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) out[i] = gray[i]! < threshold ? 0 : 255;
  return out;
}

/** Local-mean threshold — survives shadows and uneven phone-camera lighting. */
export function binarizeAdaptive(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const radius = Math.max(8, Math.round(width / 50));
  const offset = 25;
  // Integral image for O(1) window sums.
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += gray[y * width + x]!;
      integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)]! + row;
    }
  }
  const out = new Uint8ClampedArray(gray.length);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const sum =
        integral[y1 * (width + 1) + x1]! -
        integral[y0 * (width + 1) + x1]! -
        integral[y1 * (width + 1) + x0]! +
        integral[y0 * (width + 1) + x0]!;
      const mean = sum / ((x1 - x0) * (y1 - y0));
      out[y * width + x] = gray[y * width + x]! < mean - offset ? 0 : 255;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Words → rows → labelled segments
// ---------------------------------------------------------------------------

const NAME_PARTICLES = new Set(["DE", "DEL", "DELA", "DELOS", "LA", "LAS", "LOS", "SAN", "STA", "STO", "Y"]);

const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

type LabelField =
  | "lastName"
  | "firstName"
  | "middleName"
  | "combinedName"
  | "birthDate"
  | "expiry"
  | "sex"
  | "idNumber"
  | "other";

// Label vocabulary, matched fuzzily (OCR turns "Name" into "Mame", "Nome"…).
// At each position the first matching phrase wins, so more specific phrases
// come first.
const LABELS: { field: LabelField; phrases: string[] }[] = [
  { field: "combinedName", phrases: ["last name first name middle name", "last name first name", "surname first name"] },
  { field: "middleName", phrases: ["panggitnang apelyido", "gitnang apelyido", "middle name"] },
  { field: "lastName", phrases: ["apelyido", "last name", "surname", "family name"] },
  { field: "firstName", phrases: ["mga pangalan", "pangalan", "given names", "given name", "first name"] },
  { field: "birthDate", phrases: ["petsa ng kapanganakan", "date of birth", "birth date", "birthdate"] },
  {
    field: "expiry",
    phrases: ["expiration date", "expiry date", "date of expiry", "valid until", "expiration", "expires"],
  },
  { field: "sex", phrases: ["kasarian", "sex"] },
  {
    field: "idNumber",
    phrases: [
      "license no",
      "license number",
      "passport no",
      "pasaporte blg",
      "registration no",
      "registration number",
      "reg no",
      "id no",
      "id number",
      "crn",
      "prn",
      "pcn",
      "tin",
      "ss no",
      "sss no",
      "ss number",
    ],
  },
  {
    field: "other",
    phrases: [
      "date of issue",
      "petsa ng pagkakaloob",
      "issuing authority",
      "registration date",
      "place of birth",
      "tirahan",
      "address",
      "nationality",
      "nasyonalidad",
      "blood type",
      "civil status",
      "marital status",
      "weight",
      "height",
      "eyes color",
      "agency code",
      "restrictions",
      "conditions",
      "dl codes",
      "signature",
      "lagda",
      "profession",
      "uri",
      "type",
      "kodigo",
      "code",
    ],
  },
];

// Header text on the cards — never a person's name.
const HEADER_WORDS =
  /REPUBLI|PILIPINAS|PHILIPPINE|PAMBANSANG|PAGKAKAKILANLAN|IDENTIFICATION|CARD|DEPARTMENT|OFFICE|UNIFIED|MULTI|PURPOSE|LICENSE|DRIVER|PASSPORT|SOCIAL|SECURITY|SYSTEM|AUTHORITY|TRANSPORTATION|BUREAU|REVENUE|CITY|METRO|BRGY|BARANGAY|PROVINCE|SPECIMEN|\bPHL\b/;

interface Tok {
  text: string;
  up: string;
  /** Lowercase letters only, for label matching. */
  norm: string;
  conf: number; // 0–1
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  label?: LabelField;
  used?: boolean;
}

interface Segment {
  label?: LabelField;
  labelToks: Tok[];
  valueToks: Tok[];
}

interface Row {
  toks: Tok[];
  segs: Segment[];
  y0: number;
  y1: number;
  h: number;
  text: string;
}

const height = (t: Tok) => t.y1 - t.y0;
const centerX = (t: Tok) => (t.x0 + t.x1) / 2;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};

/** Splits "Apelyido/Last" and "Sex:F" and "CRN-0111…" into separate tokens (boxes divided by character share). */
function toTokens(words: OcrWord[]): Tok[] {
  const out: Tok[] = [];
  for (const w of words) {
    const text = w.text.trim().replace(/[«‹]/g, "<");
    if (!/[A-Za-z0-9<Ññ]/.test(text)) continue;
    const cuts = [0];
    for (let i = 1; i < text.length - 1; i++) {
      const [a, c, b] = [text[i - 1]!, text[i]!, text[i + 1]!];
      if (c === ":" || (c === "/" && /[A-Za-z]/.test(a) && /[A-Za-z]/.test(b))) cuts.push(i, i + 1);
      else if (c === "-" && /^[A-Za-z]{2,}$/.test(text.slice(0, i)) && /\d/.test(b)) cuts.push(i, i + 1);
    }
    cuts.push(text.length);
    const width = w.bbox.x1 - w.bbox.x0;
    for (let k = 0; k < cuts.length; k += 2) {
      const [s, e] = [cuts[k]!, cuts[k + 1]!];
      const piece = text.slice(s, e);
      if (!/[A-Za-z0-9<Ññ]/.test(piece)) continue;
      out.push({
        text: piece,
        up: piece.toUpperCase(),
        norm: piece.toLowerCase().replace(/[^a-zñ]/g, ""),
        conf: Math.max(0, Math.min(1, w.confidence / 100)),
        x0: w.bbox.x0 + (width * s) / text.length,
        x1: w.bbox.x0 + (width * e) / text.length,
        y0: w.bbox.y0,
        y1: w.bbox.y1,
      });
    }
  }
  // Very tall "words" are photo edges and seals, not text.
  const h = median(out.map(height));
  return out.filter((t) => height(t) <= h * 3.5);
}

/** Groups tokens into printed rows (left-to-right chaining tolerates slight skew). */
function groupRows(toks: Tok[]): Row[] {
  const groups: Tok[][] = [];
  for (const t of [...toks].sort((a, b) => a.x0 - b.x0)) {
    let best: Tok[] | undefined;
    let bestScore = 0.4;
    for (const g of groups) {
      const last = g[g.length - 1]!;
      if (t.x0 < last.x1 - 0.3 * Math.min(height(t), height(last))) continue; // stacked, not side by side
      const overlap = Math.min(t.y1, last.y1) - Math.max(t.y0, last.y0);
      // Relative to the taller box: a small label's box often clips the top of
      // the big value under it, and must not pull that value into its row.
      const score = overlap / Math.max(height(t), height(last));
      if (score > bestScore) {
        bestScore = score;
        best = g;
      }
    }
    if (best) best.push(t);
    else groups.push([t]);
  }
  return groups
    .map((g) => {
      const row: Row = {
        toks: g,
        segs: [],
        y0: median(g.map((t) => t.y0)),
        y1: median(g.map((t) => t.y1)),
        h: median(g.map(height)),
        text: g.map((t) => t.text).join(" "),
      };
      row.segs = segment(row);
      return row;
    })
    .sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
}

/** Cuts a row into label segments: [label words][value words until the next label]. */
function segment(row: Row): Segment[] {
  const segs: Segment[] = [];
  const toks = row.toks;
  let i = 0;
  while (i < toks.length) {
    const match = matchLabelAt(toks, i);
    if (match?.field === "lastName") {
      // "Last Name, F?st Name, Madde Name": a garbled combined label still
      // ends in more "Name"s right after.
      for (let k = match.end; k < Math.min(toks.length, match.end + 4); k++) {
        if (toks[k]!.x0 - toks[k - 1]!.x1 > 1.5 * height(toks[k]!) || /\d/.test(toks[k]!.text)) break;
        if (similar(toks[k]!.norm, "name")) {
          match.field = "combinedName";
          match.end = k + 1;
        }
      }
    }
    if (match) {
      const prev = segs[segs.length - 1];
      const labelToks = toks.slice(i, match.end);
      // "Apelyido/Last Name": two phrases, one label.
      if (prev && prev.label === match.field && prev.valueToks.length === 0) prev.labelToks.push(...labelToks);
      else segs.push({ label: match.field, labelToks, valueToks: [] });
      for (const t of labelToks) t.label = match.field;
      i = match.end;
    } else {
      const prev = segs[segs.length - 1];
      if (prev) prev.valueToks.push(toks[i]!);
      else segs.push({ labelToks: [], valueToks: [toks[i]!] });
      i++;
    }
  }
  return segs;
}

function matchLabelAt(toks: Tok[], i: number): { field: LabelField; end: number } | undefined {
  for (const { field, phrases } of LABELS) {
    for (const phrase of phrases) {
      const words = phrase.split(" ");
      if (i + words.length > toks.length) continue;
      let ok = true;
      for (let k = 0; k < words.length && ok; k++) {
        const t = toks[i + k]!;
        ok = similar(t.norm, words[k]!) && /^[^0-9]*$/.test(t.text.replace(/[.,]/g, ""));
        // Label words sit next to each other; a wide gap means separate columns.
        if (ok && k > 0) ok = t.x0 - toks[i + k - 1]!.x1 < 1.5 * Math.max(height(t), 1);
      }
      if (ok) return { field, end: i + words.length };
    }
  }
  return undefined;
}

function similar(word: string, target: string) {
  if (word === target) return true;
  const allowed = target.length <= 3 ? 0 : target.length <= 6 ? 1 : 2;
  return allowed > 0 && Math.abs(word.length - target.length) <= allowed && levenshtein(word, target) <= allowed;
}

/** Leading tokens up to the first wide gap (a different column). */
function firstCluster(toks: Tok[]): Tok[] {
  const sorted = [...toks].sort((a, b) => a.x0 - b.x0);
  const out: Tok[] = [];
  for (const t of sorted) {
    const last = out[out.length - 1];
    if (last && t.x0 - last.x1 > 2.5 * Math.max(height(t), height(last))) break;
    out.push(t);
  }
  return out;
}

/**
 * A value printed wider than its label's column ("MARIA LUISA" under a short
 * label) spills out of the band: pull in words that continue it without a gap.
 */
function widen(rowToks: Tok[], cluster: Tok[]): Tok[] {
  if (!cluster.length) return cluster;
  const out = [...cluster];
  const near = (a: Tok, b: Tok) =>
    Math.abs(a.x0 > b.x0 ? a.x0 - b.x1 : b.x0 - a.x1) < 1.2 * Math.max(height(a), height(b));
  let i = rowToks.indexOf(out[0]!);
  while (i > 0 && !rowToks[i - 1]!.label && near(rowToks[i - 1]!, out[0]!)) out.unshift(rowToks[--i]!);
  let j = rowToks.indexOf(out[out.length - 1]!);
  while (j >= 0 && j < rowToks.length - 1 && !rowToks[j + 1]!.label && near(rowToks[j + 1]!, out[out.length - 1]!))
    out.push(rowToks[++j]!);
  return out;
}

interface Found {
  value: string;
  used: Tok[];
  /** Extra multiplier (e.g. OCR digit fixes). */
  factor?: number;
}
type Accept = (toks: Tok[]) => Found | undefined;

/**
 * The value belonging to a label: text after it on the same row, else the
 * text in the label's column on the following row(s).
 */
function lookup(rows: Row[], ri: number, si: number, accept: Accept): Found | undefined {
  const row = rows[ri]!;
  const seg = row.segs[si]!;
  if (seg.valueToks.length) {
    const found = accept(firstCluster(seg.valueToks));
    if (found) return found;
  }
  const labelH = median(seg.labelToks.map(height));
  const prevLabel = row.segs
    .slice(0, si)
    .reverse()
    .find((s) => s.label);
  const nextLabel = row.segs.slice(si + 1).find((s) => s.label);
  const left = Math.max(seg.labelToks[0]!.x0 - 1.5 * labelH, prevLabel ? prevLabel.labelToks.at(-1)!.x1 : -Infinity);
  const right = nextLabel ? nextLabel.labelToks[0]!.x0 - 0.3 * labelH : Infinity;
  for (let k = ri + 1; k < rows.length && k <= ri + 3; k++) {
    const below = rows[k]!;
    if (below.y0 - row.y1 > 2.5 * Math.max(labelH, below.h)) break;
    const inBand = below.toks.filter((t) => centerX(t) >= left && centerX(t) < right);
    if (!inBand.length) continue;
    if (inBand.some((t) => t.label)) break; // another label in this column
    const cluster = widen(below.toks, firstCluster(inBand));
    const found = accept(cluster);
    if (found) return found;
    // Only skip past rows that look like background noise.
    const avg = cluster.reduce((s, t) => s + t.conf, 0) / cluster.length;
    if (avg >= 0.5 && cluster.map((t) => t.text).join("").replace(/[^A-Za-z0-9]/g, "").length >= 2) break;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Value acceptors
// ---------------------------------------------------------------------------

function nameWords(toks: Tok[]): Tok[] {
  const kept: Tok[] = [];
  for (const t of toks) {
    if (/\d/.test(t.text)) {
      if (kept.length) break; // names have no digits; what follows is other data
      continue;
    }
    const bare = t.text.replace(/[^A-Za-zÑñ]/g, "");
    if (!bare) continue;
    if (bare !== bare.toUpperCase()) continue; // IDs print names in capitals; mixed case is label or noise
    if (bare.length < 2 && !NAME_PARTICLES.has(bare)) continue;
    kept.push(t);
  }
  // Low-confidence fragments at the edges are usually background.
  while (kept.length && kept[0]!.conf < 0.45) kept.shift();
  while (kept.length && kept[kept.length - 1]!.conf < 0.45) kept.pop();
  return kept;
}

const acceptName: Accept = (toks) => {
  const used = nameWords(toks);
  const value = validName(titleCase(used.map((t) => t.text.replace(/[^A-Za-zÑñ'-]/g, "")).join(" ")));
  return value ? { value, used } : undefined;
};

/** "DELA CRUZ, JUAN PEREZ" (driver's license). */
function acceptCombined(toks: Tok[]): { last: Found; first?: Found; middle?: Found; guessed: boolean } | undefined {
  const words = nameWords(toks);
  const comma = words.findIndex((t) => /,/.test(t.text));
  let lastToks: Tok[];
  let givenToks: Tok[];
  let guessed = false;
  if (comma >= 0) {
    lastToks = words.slice(0, comma + 1);
    givenToks = words.slice(comma + 1);
  } else {
    // Comma lost: can't tell where a multi-word surname ends. Guess, flagged.
    if (words.length < 2) return undefined;
    guessed = true;
    lastToks = words.slice(0, 1);
    givenToks = words.slice(1);
  }
  const last = acceptName(lastToks);
  if (!last) return undefined;
  let middle: Found | undefined;
  if (givenToks.length > 1 && !validSuffix(givenToks.at(-1)!.text)) {
    middle = acceptName(givenToks.slice(-1));
    if (middle) givenToks = givenToks.slice(0, -1);
  }
  return { last, first: acceptName(givenToks), middle, guessed };
}

function joinSpans(toks: Tok[]) {
  let text = "";
  const spans: [number, number][] = [];
  for (const t of toks) {
    if (text) text += " ";
    spans.push([text.length, text.length + t.text.length]);
    text += t.text;
  }
  return { text, spans };
}

function toksIn(toks: Tok[], spans: [number, number][], start: number, end: number) {
  return toks.filter((_, i) => spans[i]![0] < end && spans[i]![1] > start);
}

/** Shortest run of tokens (from the left) that reads as a full date and passes `check`. */
function acceptDate(check: (iso: string) => string | undefined): Accept {
  return (toks) => {
    for (let i = 0; i < toks.length; i++) {
      for (let j = i; j < Math.min(toks.length, i + 4); j++) {
        const slice = toks.slice(i, j + 1);
        const iso = normalizeDate(slice.map((t) => t.text).join(" "));
        if (!iso) continue;
        if (check(iso)) return { value: iso, used: slice };
        i = j; // implausible date: keep looking after it
        break;
      }
    }
    return undefined;
  };
}

const acceptSex: Accept = (toks) => {
  const first = toks[0];
  const sex = first && normalizeSex(first.text.replace(/[^A-Za-z]/g, ""));
  return sex ? { value: sex, used: [first] } : undefined;
};

// Characters OCR confuses with digits. Applied only where a digit must be.
const DIGIT_FIXES: Record<string, string> = { O: "0", Q: "0", I: "1", L: "1", "|": "1", S: "5", B: "8" };
const FIX_PENALTY = 0.92; // per corrected character

function toDigits(chunk: string): { digits: string; fixes: number } {
  let fixes = 0;
  const digits = chunk
    .toUpperCase()
    .split("")
    .map((c) => {
      if (/\d/.test(c)) return c;
      fixes++;
      return DIGIT_FIXES[c] ?? c;
    })
    .join("");
  return { digits, fixes };
}

interface NumberMatch {
  value: string;
  start: number;
  end: number;
  fixes: number;
}

/**
 * Groups of digits separated by "-", space, ":" or "." whose sizes match the
 * format, tolerating letters OCR mistook for digits as long as each group is
 * mostly real digits.
 */
function findGrouped(text: string, groups: number[], prefixLetter = false): NumberMatch | undefined {
  const sep = "[\\s\\-:.]{1,3}";
  const chunk = (n: number) => `([0-9OQILSB|]{${n}})`;
  const head = prefixLetter ? "([A-Z])" : "";
  const body = groups.map(chunk).join(sep);
  const re = new RegExp(`(?<![0-9A-Z])${head}${prefixLetter ? `[\\s\\-]?` : ""}${body}(?![0-9A-Z])`, "g");
  for (const m of text.toUpperCase().matchAll(re)) {
    const parts = m.slice(prefixLetter ? 2 : 1, (prefixLetter ? 2 : 1) + groups.length);
    if (!parts.every((p) => p.replace(/\D/g, "").length >= Math.ceil(p.length * 0.6))) continue;
    const fixed = parts.map(toDigits);
    if (!fixed.every((p) => /^\d+$/.test(p.digits))) continue;
    const value = (prefixLetter ? m[1]! : "") + fixed.map((p) => p.digits).join("-");
    return { value, start: m.index, end: m.index + m[0].length, fixes: fixed.reduce((s, p) => s + p.fixes, 0) };
  }
  return undefined;
}

/** Driver's license: N03-12-345678 (letter + 2, 2, 6 digits). */
function findLicense(text: string): NumberMatch | undefined {
  const m = text
    .toUpperCase()
    .match(/(?<![0-9A-Z])([A-Z])([0-9OQILSB]{2})[\s-]?([0-9OQILSB]{2})[\s-]?([0-9OQILSB]{6})(?![0-9A-Z])/);
  if (!m) return undefined;
  const parts = [m[2]!, m[3]!, m[4]!];
  if (parts.join("").replace(/\D/g, "").length < 8) return undefined;
  const fixed = parts.map(toDigits);
  return {
    value: `${m[1]}${fixed[0]!.digits}-${fixed[1]!.digits}-${fixed[2]!.digits}`,
    start: m.index!,
    end: m.index! + m[0].length,
    fixes: fixed.reduce((s, p) => s + p.fixes, 0),
  };
}

function findPassportNo(text: string): NumberMatch | undefined {
  const m = text.toUpperCase().match(/(?<![0-9A-Z])([A-Z]{1,2})(\d{6,7})([A-Z]?)(?![0-9A-Z])/);
  return m ? { value: m[1]! + m[2]! + m[3]!, start: m.index!, end: m.index! + m[0].length, fixes: 0 } : undefined;
}

function findDigits(text: string, n: number): NumberMatch | undefined {
  const m = text.toUpperCase().match(new RegExp(`(?<![0-9A-Z])([0-9OQILSB]{${n}})(?![0-9A-Z])`));
  if (!m || m[1]!.replace(/\D/g, "").length < n - 1) return undefined;
  const { digits, fixes } = toDigits(m[1]!);
  return { value: digits, start: m.index!, end: m.index! + m[0].length, fixes };
}

function findPostal(text: string): NumberMatch | undefined {
  const m = text.toUpperCase().match(/(?<![0-9A-Z])([A-Z0-9]{10,14})(?![0-9A-Z])/);
  return m ? { value: m[1]!, start: m.index!, end: m.index! + m[0].length, fixes: 0 } : undefined;
}

/** Type-specific number finders. `labelled` = searched only next to an ID-number label. */
const NUMBER_FINDERS: Record<string, { find: (text: string) => NumberMatch | undefined; needsLabel: boolean }> = {
  "PhilSys National ID": { find: (t) => findGrouped(t, [4, 4, 4, 4]), needsLabel: false },
  UMID: { find: (t) => findGrouped(t, [4, 7, 1]), needsLabel: false },
  "SSS ID": { find: (t) => findGrouped(t, [2, 7, 1]), needsLabel: false },
  "TIN ID": { find: (t) => findGrouped(t, [3, 3, 3, 3]) ?? findGrouped(t, [3, 3, 3]), needsLabel: false },
  "Driver's License": { find: findLicense, needsLabel: false },
  Passport: { find: findPassportNo, needsLabel: false },
  "PRC ID": { find: (t) => findDigits(t, 7), needsLabel: true },
  "Postal ID": { find: findPostal, needsLabel: true },
};

// Formats distinctive enough to identify the card when its title wasn't read.
const INFER_ORDER = ["PhilSys National ID", "Driver's License", "UMID", "SSS ID", "TIN ID"];

function acceptNumber(idType: string): Accept {
  const finder = NUMBER_FINDERS[idType];
  return (toks) => {
    if (!finder) return undefined;
    const { text, spans } = joinSpans(toks);
    const m = finder.find(text);
    const value = m && validIdNumber(m.value, idType);
    if (!m || !value) return undefined;
    return { value, used: toksIn(toks, spans, m.start, m.end), factor: FIX_PENALTY ** m.fixes };
  };
}

// ---------------------------------------------------------------------------
// Passport machine-readable zone
// ---------------------------------------------------------------------------

function mrzCheck(field: string): string {
  const weights = [7, 3, 1];
  let total = 0;
  for (let i = 0; i < field.length; i++) {
    const c = field[i]!;
    const v = c === "<" ? 0 : /\d/.test(c) ? +c : c.charCodeAt(0) - 55;
    total += v * weights[i % 3]!;
  }
  return String(total % 10);
}

const mrzDigits = (s: string) => toDigits(s.replace(/</g, "0")).digits;

interface Mrz {
  lastName?: string;
  firstName?: string;
  number?: { value: string; checked: boolean };
  birthDate?: { value: string; checked: boolean };
  expiry?: { value: string; checked: boolean };
  sex?: IdSex;
  toks: Tok[];
}

/** P<PHLDELA<CRUZ<<JUAN<<<… / P1234567A<8PHL9001015M3001017<<<… */
function parseMrz(rows: Row[]): Mrz | null {
  const lines = rows.map((r) => ({ row: r, text: r.toks.map((t) => t.up).join("") }));
  const isMrz = (s: string) => /^[A-Z0-9<]{30,}$/.test(s) && /<{2}|<[A-Z]/.test(s);
  const nameAt = lines.findIndex((l) => isMrz(l.text) && /^P[<A-Z0O][A-Z]{3}/.test(l.text));
  if (nameAt < 0) return null;
  const mrz: Mrz = { toks: lines[nameAt]!.row.toks };

  const names = lines[nameAt]!.text.slice(5).replace(/<+$/, "");
  const [surname = "", given = ""] = names.split("<<");
  // Trailing filler often comes back as K/C/L runs; validName rejects those words.
  mrz.lastName = validName(titleCase(surname.replace(/</g, " ")));
  const givenWords = given
    .split("<")
    .filter(Boolean)
    .map((w) => titleCase(w))
    .filter((w): w is string => !!w && !!validName(w));
  mrz.firstName = givenWords.length ? validName(givenWords.join(" ")) : undefined;

  const data = lines.slice(nameAt + 1).find((l) => isMrz(l.text) || /^[A-Z0-9<]{28,}$/.test(l.text));
  if (data && data.text.length >= 28) {
    const d = data.text;
    mrz.toks = [...mrz.toks, ...data.row.toks];
    const rawNo = d.slice(0, 9);
    let numberOk = mrzCheck(rawNo) === mrzDigits(d[9]!);
    let number = rawNo.replace(/</g, "");
    if (!numberOk) {
      // PH format: letter, 7 digits, letter — retry with digit fixes in the middle.
      const fixedNo = rawNo[0]! + toDigits(rawNo.slice(1, 8)).digits + rawNo[8]!;
      if (mrzCheck(fixedNo) === mrzDigits(d[9]!)) {
        numberOk = true;
        number = fixedNo.replace(/</g, "");
      }
    }
    mrz.number = { value: number, checked: numberOk };
    const dob = mrzDigits(d.slice(13, 19));
    const birth = mrzDate(dob, "past");
    if (birth) mrz.birthDate = { value: birth, checked: mrzCheck(dob) === mrzDigits(d[19]!) };
    mrz.sex = normalizeSex(d[20]);
    const exp = mrzDigits(d.slice(21, 27));
    const expiry = mrzDate(exp, "future");
    if (expiry) mrz.expiry = { value: expiry, checked: mrzCheck(exp) === mrzDigits(d[27]!) };
  }
  return mrz;
}

function mrzDate(yymmdd: string, when: "past" | "future"): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const yy = Number(yymmdd.slice(0, 2));
  const currentYY = new Date().getFullYear() % 100;
  const century = when === "past" ? (yy > currentYY ? 1900 : 2000) : 2000;
  return `${century + yy}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}

// ---------------------------------------------------------------------------
// Card → candidates
// ---------------------------------------------------------------------------

/** Score of a value: its weakest word's OCR confidence × how it was found. */
function score(found: Found, factor: number): number {
  const wordConf = found.used.length ? Math.min(...found.used.map((t) => t.conf)) : 0;
  return Math.max(0, Math.min(1, wordConf * factor * (found.factor ?? 1)));
}

// How much each way of finding a value is trusted (multiplies word confidence),
// and the most it may ever reach (guesses stay below "confident").
const LABELLED = { factor: 1, cap: 1 };
const PATTERN = { factor: 0.97, cap: 1 }; // type-specific ID-number format, no label needed
const LOOSE = { factor: 0.8, cap: 0.75 }; // unlabelled value, or format guess on an unknown card
const GUESS = { factor: 0.6, cap: 0.6 }; // positional / comma-less name split

/** Reads one OCR pass. Every value returned has already passed validation. */
export function parseOcrWords(words: OcrWord[], { positional = true } = {}): Candidates {
  const rows = groupRows(toTokens(words));
  const upper = rows.map((r) => r.text).join("\n").toUpperCase();
  const out: Candidates = {};
  const put = (field: ScannedField, found: Found | undefined, how: { factor: number; cap: number }) => {
    if (!found || out[field]) return;
    for (const t of found.used) t.used = true;
    out[field] = { value: found.value, conf: Math.min(how.cap, score(found, how.factor)), cap: how.cap };
  };

  const mrz = parseMrz(rows);
  for (const t of mrz?.toks ?? []) t.used = true;
  const detected = detectIdType(upper) ?? (mrz ? "Passport" : undefined);
  let idType = detected;

  // Labelled values.
  rows.forEach((row, ri) => {
    row.segs.forEach((seg, si) => {
      switch (seg.label) {
        case "combinedName": {
          const r = lookupCombined(rows, ri, si);
          if (!r) break;
          const how = r.guessed ? GUESS : LABELLED;
          put("lastName", r.last, how);
          put("firstName", r.first, how);
          put("middleName", r.middle, r.guessed ? GUESS : { factor: 0.95, cap: 1 });
          break;
        }
        case "lastName":
        case "firstName":
        case "middleName": {
          let combined: ReturnType<typeof acceptCombined>;
          const found = lookup(rows, ri, si, (toks) => {
            // "REYES, CARMELA SANTOS" under a half-read label is the combined
            // license format, not a three-word surname.
            const words = nameWords(toks);
            if (words.slice(0, -1).some((t) => t.text.includes(","))) {
              combined = seg.label === "lastName" ? acceptCombined(toks) : undefined;
              return combined?.last;
            }
            return acceptName(toks);
          });
          if (combined) {
            const how = { factor: 0.9, cap: combined.guessed ? GUESS.cap : 1 };
            put("lastName", combined.last, how);
            put("firstName", combined.first, how);
            put("middleName", combined.middle, how);
          } else put(seg.label, found, LABELLED);
          break;
        }
        case "birthDate":
          put("birthDate", lookup(rows, ri, si, acceptDate((iso) => validBirthDate(iso))), LABELLED);
          break;
        case "expiry":
          put("idExpiry", lookup(rows, ri, si, acceptDate((iso) => validExpiry(iso))), LABELLED);
          break;
        case "sex":
          put("sex", lookup(rows, ri, si, acceptSex), LABELLED);
          break;
        case "idNumber":
          if (idType) put("idNumber", lookup(rows, ri, si, acceptNumber(idType)), LABELLED);
          break;
        case "other":
          // Claim the value so it can't be mistaken for an unlabelled date/number.
          for (const t of lookup(rows, ri, si, (toks) => ({ value: "", used: toks }))?.used ?? []) t.used = true;
          break;
      }
    });
  });

  // ID number by its printed format, anywhere on the card.
  if (idType && !out.idNumber && !NUMBER_FINDERS[idType]?.needsLabel) {
    for (const row of rows) {
      const found = acceptNumber(idType)(row.toks.filter((t) => !t.used || t.label === "idNumber"));
      if (found) {
        put("idNumber", found, idType === "Passport" ? LOOSE : PATTERN);
        break;
      }
    }
  }
  if (!idType) {
    // Unknown card: only a distinctive format counts, and it names the type.
    outer: for (const type of INFER_ORDER) {
      for (const row of rows) {
        const found = acceptNumber(type)(row.toks);
        if (found) {
          idType = type;
          put("idNumber", found, LOOSE);
          break outer;
        }
      }
    }
  }
  if (idType) {
    out.idType = { value: idType, conf: detected ? 0.95 : LOOSE.cap, cap: detected ? 1 : LOOSE.cap };
  }

  // Passport MRZ: check digits make it the best source for number and dates.
  if (mrz) mergeMrz(out, mrz);

  // Suffix printed with the given name ("JUAN JR.") or surname.
  for (const field of ["firstName", "lastName"] as const) {
    const c = out[field];
    if (!c || out.suffix) continue;
    const words = c.value.split(" ");
    const suffix = validSuffix(words.at(-1));
    if (suffix && words.length > 1) {
      out.suffix = { ...c, value: suffix };
      c.value = words.slice(0, -1).join(" ");
    }
  }

  // PhilSys prints the values in a fixed order. When the (small, italic)
  // labels didn't survive OCR, fall back to that order — as a guess.
  if (positional && idType === "PhilSys National ID" && (!out.lastName || !out.firstName)) {
    const start = rows.findIndex((r) => findGrouped(r.text, [4, 4, 4, 4]));
    const dateAt = rows.findIndex((r, i) => i > start && normalizeDate(r.text));
    const end = dateAt >= 0 ? dateAt : rows.length;
    const names = rows
      .slice(start + 1, end)
      .filter((r) => !r.toks.some((t) => t.label) && !HEADER_WORDS.test(r.text.toUpperCase()))
      .map((r) => acceptName(r.toks))
      .filter((f): f is Found => !!f);
    if (names.length >= 2) {
      put("lastName", names[0], GUESS);
      put("firstName", names[1], GUESS);
      put("middleName", names[2], GUESS);
    }
  }

  // No labelled birth date: if exactly one unclaimed date on the card is a
  // plausible birth date, offer it — flagged for checking.
  if (!out.birthDate) {
    const dates = new Map<string, Found>();
    for (const row of rows) {
      const toks = row.toks.filter((t) => !t.used);
      const f = acceptDate((iso) => validBirthDate(iso))(toks);
      if (f) dates.set(f.value, f);
    }
    if (dates.size === 1) put("birthDate", [...dates.values()][0], LOOSE);
  }

  // Same for an expiry: one unclaimed, still-valid future date. (Issue
  // dates are in the past, so they can't be mistaken for it.)
  if (!out.idExpiry) {
    const today = new Date().toISOString().slice(0, 10);
    const dates = new Map<string, Found>();
    for (const row of rows) {
      const toks = row.toks.filter((t) => !t.used);
      const f = acceptDate((iso) => (iso > today ? validExpiry(iso, out.birthDate?.value) : undefined))(toks);
      if (f) dates.set(f.value, f);
    }
    if (dates.size === 1) put("idExpiry", [...dates.values()][0], LOOSE);
  }

  return finalCheck(out);
}

function lookupCombined(rows: Row[], ri: number, si: number) {
  let result: ReturnType<typeof acceptCombined>;
  lookup(rows, ri, si, (toks) => {
    result = acceptCombined(toks);
    return result ? result.last : undefined;
  });
  return result;
}

function mergeMrz(out: Candidates, mrz: Mrz) {
  const conf = (checked: boolean) => (checked ? 0.97 : 0.5);
  const merge = (field: ScannedField, value: string | undefined, checked: boolean) => {
    if (!value) return;
    const viz = out[field];
    if (viz && viz.value.toUpperCase() === value.toUpperCase()) {
      // Printed page and MRZ agree.
      viz.conf = Math.min(viz.cap, Math.max(viz.conf, conf(checked)) + 0.1);
    } else if (checked) {
      out[field] = { value, conf: conf(true), cap: 1 };
    } else if (viz) {
      viz.conf *= 0.85; // they disagree and the MRZ can't settle it
    } else {
      out[field] = { value, conf: conf(false), cap: 0.6 };
    }
  };
  if (mrz.number && validIdNumber(mrz.number.value, "Passport")) merge("idNumber", mrz.number.value, mrz.number.checked);
  if (mrz.birthDate && validBirthDate(mrz.birthDate.value)) merge("birthDate", mrz.birthDate.value, mrz.birthDate.checked);
  if (mrz.expiry && validExpiry(mrz.expiry.value)) merge("idExpiry", mrz.expiry.value, mrz.expiry.checked);
  // Names and sex have no check digit: corroborate, or offer flagged.
  merge("lastName", mrz.lastName, false);
  merge("firstName", mrz.firstName, false);
  merge("sex", mrz.sex, false);
}

/** Cross-field checks and a last validation of every value. */
function finalCheck(c: Candidates): Candidates {
  const ok: Record<ScannedField, (v: string) => string | undefined> = {
    lastName: validName,
    firstName: validName,
    middleName: validName,
    suffix: validSuffix,
    birthDate: (v) => validBirthDate(v),
    sex: (v) => validSex(v),
    idType: (v) => ((idTypeOptions as readonly string[]).includes(v) ? v : undefined),
    idNumber: (v) => validIdNumber(v, c.idType?.value),
    idExpiry: (v) => validExpiry(v, c.birthDate?.value),
  };
  const out: Candidates = {};
  for (const [field, cand] of Object.entries(c) as [ScannedField, Candidate][]) {
    if (cand && ok[field](cand.value)) out[field] = cand;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Combining passes
// ---------------------------------------------------------------------------

/**
 * Combines OCR passes over differently treated images. A value read the same
 * way by several passes gains confidence; competing readings lose it in
 * proportion to how strong the competition was.
 */
export function combinePasses(passes: Candidates[]): {
  fields: ScannedIdFields;
  confidence: Partial<Record<ScannedField, number>>;
} {
  const fields: Record<string, string> = {};
  const confidence: Partial<Record<ScannedField, number>> = {};
  const keys = new Set(passes.flatMap((p) => Object.keys(p) as ScannedField[]));
  for (const key of keys) {
    const groups = new Map<string, Candidate[]>();
    for (const p of passes) {
      const c = p[key];
      if (!c) continue;
      const k = c.value.toUpperCase();
      groups.set(k, [...(groups.get(k) ?? []), c]);
    }
    const weight = (cs: Candidate[]) => cs.reduce((s, c) => s + c.conf, 0);
    const ranked = [...groups.values()].sort(
      (a, b) => weight(b) - weight(a) || Math.max(...b.map((c) => c.conf)) - Math.max(...a.map((c) => c.conf)),
    );
    const best = ranked[0]!;
    const top = best.reduce((a, c) => (c.conf > a.conf ? c : a));
    const total = ranked.reduce((s, cs) => s + weight(cs), 0);
    let conf = top.conf * (total > 0 ? weight(best) / total : 0);
    if (best.length >= 2) conf += 0.1;
    fields[key] = top.value;
    confidence[key] = round2(Math.min(top.cap, Math.max(0, conf)));
  }
  // The expiry check needs the combined birth date.
  if (fields.idExpiry && !validExpiry(fields.idExpiry, fields.birthDate)) {
    delete fields.idExpiry;
    delete confidence.idExpiry;
  }
  return { fields: fields as ScannedIdFields, confidence };
}

/** Did passes read any field differently? */
export function passesDisagree(passes: Candidates[]): boolean {
  const keys = new Set(passes.flatMap((p) => Object.keys(p) as ScannedField[]));
  for (const key of keys) {
    const values = new Set(passes.map((p) => p[key]?.value.toUpperCase()).filter(Boolean));
    if (values.size > 1) return true;
  }
  return false;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Plain-text entry point (kept for callers with OCR text but no word boxes)
// ---------------------------------------------------------------------------

/**
 * Parses plain OCR text. Without word boxes, rows are the text lines and
 * columns are approximated by character position.
 */
export function parseIdText(raw: string, { positional = false } = {}): ScannedIdFields {
  const words: OcrWord[] = [];
  raw
    .replace(/\r/g, "")
    .split("\n")
    .forEach((line, y) => {
      for (const m of line.matchAll(/\S+/g)) {
        words.push({
          text: m[0],
          confidence: 90,
          bbox: { x0: m.index * 12, x1: (m.index + m[0].length) * 12, y0: y * 30, y1: y * 30 + 20 },
        });
      }
    });
  const parsed = parseOcrWords(words, { positional });
  return clean(Object.fromEntries(Object.entries(parsed).map(([k, c]) => [k, c?.value])) as ScannedIdFields);
}

/** Merge a later OCR pass into earlier results — earlier values win. */
export function mergeScans(base: ScannedIdFields, extra: ScannedIdFields): ScannedIdFields {
  const merged: ScannedIdFields = { ...extra, ...base };
  if (base.idType === "Other" && extra.idType && extra.idType !== "Other") merged.idType = extra.idType;
  return merged;
}

export function hasCoreFields(fields: ScannedIdFields) {
  return CORE_FIELDS.every((f) => fields[f]);
}

/**
 * Keeps the uppercase name words in a string and drops the rest ("Ll i DELA
 * CRUZ" → "Dela Cruz"). IDs print names in capitals, so mixed-case fragments
 * are background noise or label text.
 */
export function cleanName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const words = value
    .replace(/[^A-Za-zÑñ.'\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[.'-]+|[.'-]+$/g, ""))
    .filter((w) => w.length > 0);
  const kept = words.filter((w) => {
    const bare = w.replace(/[.'-]/g, "");
    if (bare !== bare.toUpperCase()) return false;
    return (bare.length >= 2 || NAME_PARTICLES.has(bare)) && !isLabelWord(bare);
  });
  return validName(titleCase(kept.join(" ")));
}

function detectIdType(upper: string): string | undefined {
  if (/PHILSYS|PAMBANSANG|PAGKAKAKILANLAN|PHILIPPINE\s*IDENTIFICATION/.test(upper)) return "PhilSys National ID";
  if (/UNIFIED\s*MULTI|\bUMID\b/.test(upper)) return "UMID";
  if (/DRIVER|LAND\s*TRANSPORTATION|\bLTO\b/.test(upper)) return "Driver's License";
  if (/PASSPORT|PASAPORTE/.test(upper)) return "Passport";
  if (/PROFESSIONAL\s*REGULATION|\bPRC\b/.test(upper)) return "PRC ID";
  if (/SOCIAL\s*SECURITY|\bSSS\b/.test(upper)) return "SSS ID";
  if (/INTERNAL\s*REVENUE|\bTIN\b/.test(upper)) return "TIN ID";
  if (/POSTAL|PHLPOST/.test(upper)) return "Postal ID";
  if (/\bCRN\b/.test(upper)) return "UMID";
  return undefined;
}

/** Closest month to an OCR'd word ("JUARY" → 1), or undefined if nothing is close. */
function fuzzyMonth(word: string): number | undefined {
  const w = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (w.length < 3) return undefined;
  let best = 0;
  let month: number | undefined;
  MONTH_NAMES.forEach((name, i) => {
    // Abbreviations ("JAN", "SEPT") match on prefix; full words by similarity.
    const score = name.startsWith(w) ? 1 : lcs(w, name) / Math.max(w.length, name.length);
    if (score > best) {
      best = score;
      month = i + 1;
    }
  });
  return best >= 0.75 ? month : undefined;
}

/** Any printed date → yyyy-mm-dd (format only; see idValidate for plausibility). */
export function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.toUpperCase().replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (y: number, m: number | undefined, d: number) =>
    m !== undefined && y > 1900 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31
      ? `${y}-${pad(m)}-${pad(d)}`
      : undefined;

  let m = v.match(/(?<!\d)(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?!\d)/); // 1990/01/31
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!);
  m = v.match(/(?<!\d)(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?!\d)/); // 01/31/1990 (PH: month first)
  if (m) return iso(+m[3]!, +m[1]!, +m[2]!);
  m = v.match(/\b([A-Z]{3,9}) (\d{1,2}) (\d{4})(?!\d)/); // JANUARY 31 1990
  if (m) return iso(+m[3]!, fuzzyMonth(m[1]!), +m[2]!);
  m = v.match(/(?<!\d)(\d{1,2}) ([A-Z]{3,9}) (\d{4})(?!\d)/); // 31 JAN 1990
  if (m) return iso(+m[3]!, fuzzyMonth(m[2]!), +m[1]!);
  return undefined;
}

function normalizeSex(value: string | undefined): IdSex | undefined {
  const v = value?.trim().toUpperCase();
  if (!v) return undefined;
  if (v === "M" || v === "MALE" || v === "LALAKI") return "Male";
  if (v === "F" || v === "FEMALE" || v === "BABAE") return "Female";
  return undefined;
}

export function normalizeSuffix(value: string | undefined): string | undefined {
  return validSuffix(value);
}

export function titleCase(value: string | undefined): string | undefined {
  const v = value
    ?.replace(/[^A-Za-zÑñ .'-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!v || v.length < 2) return undefined;
  return v.toLowerCase().replace(/(^|[\s'-])([a-zñ])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function clean(fields: ScannedIdFields): ScannedIdFields {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== "")) as ScannedIdFields;
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

function lcs(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
  return dp[a.length]![b.length]!;
}
