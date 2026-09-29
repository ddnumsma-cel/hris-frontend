// Pure (DOM-free) helpers behind the ID scanner in idScan.ts: image
// binarization for OCR, and turning OCR text into form fields. Kept separate
// so they can be exercised outside the browser.

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

/** Fields a scan must find before we stop trying other image treatments. */
export const CORE_FIELDS: (keyof ScannedIdFields)[] = ["lastName", "firstName", "birthDate", "idNumber"];

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
// Text → fields
// ---------------------------------------------------------------------------

const SUFFIXES = ["JR", "SR", "II", "III", "IV", "V"];

// Lowercase surname particles that are legitimately short ("DE LA CRUZ").
const NAME_PARTICLES = new Set(["DE", "DEL", "DELA", "DELOS", "DE LOS", "LA", "LAS", "LOS", "SAN", "STA", "STO", "Y"]);

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

type LabelField = "lastName" | "firstName" | "middleName" | "combinedName" | "birthDate" | "expiry" | "other";

// Label vocabulary, matched fuzzily (OCR turns "Name" into "Mame", "Nome"…).
// Order matters: more specific phrases first.
const LABELS: { field: LabelField; phrases: string[] }[] = [
  { field: "combinedName", phrases: ["last name first name middle name", "last name first name"] },
  { field: "middleName", phrases: ["gitnang apelyido", "middle name"] },
  { field: "lastName", phrases: ["apelyido", "last name", "surname", "family name"] },
  { field: "firstName", phrases: ["mga pangalan", "given names", "given name", "first name"] },
  { field: "birthDate", phrases: ["petsa ng kapanganakan", "date of birth", "birth date", "birthdate"] },
  { field: "expiry", phrases: ["expiration date", "expiry date", "valid until", "date of expiry"] },
  {
    field: "other",
    phrases: ["tirahan", "address", "nationality", "sex", "kasarian", "blood type", "place of birth", "signature"],
  },
];

// Header text on the cards — never a person's name.
const HEADER_WORDS =
  /REPUBLI|PILIPINAS|PHILIPPINE|PAMBANSANG|PAGKAKAKILANLAN|IDENTIFICATION|CARD|DEPARTMENT|OFFICE|UNIFIED|MULTI|PURPOSE|LICENSE|DRIVER|PASSPORT|SOCIAL|SECURITY|SYSTEM|AUTHORITY|TRANSPORTATION|BUREAU|REVENUE|CITY|METRO|BRGY|BARANGAY|PROVINCE|SPECIMEN|\bPHL\b/;

interface Line {
  raw: string;
  label?: LabelField;
  /** Text on the line after its label, if any. */
  afterLabel?: string;
}

/**
 * @param positional allow the label-less PhilSys fallback (names by their
 *   printed order). It's a guess, so the scanner only enables it after every
 *   OCR pass failed to find the labels.
 */
export function parseIdText(
  raw: string,
  { positional = false, idType: expectedType }: { positional?: boolean; idType?: string } = {},
): ScannedIdFields {
  const lines: Line[] = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /[A-Za-z0-9]/.test(l))
    .map(classifyLine);
  const text = lines.map((l) => l.raw).join("\n");
  const upper = text.toUpperCase();

  const mrz = parsePassportMrz(lines.map((l) => l.raw));
  if (mrz) return mrz;

  // HR says which ID this is, so read it with that card's number format
  // instead of guessing the type from the printed text.
  const idType = expectedType && expectedType !== "Other" ? expectedType : detectIdType(upper);
  const fields: ScannedIdFields = { idType };

  const combinedIdx = lines.findIndex((l) => l.label === "combinedName");
  if (combinedIdx >= 0) {
    // Driver's license: "DELA CRUZ, JUAN PEREZ" under one combined label.
    const value = findValue(lines, combinedIdx, (l) => (l.includes(",") ? l : undefined));
    if (value) {
      const [last, rest = ""] = value.split(",", 2);
      const given = cleanName(rest)?.split(" ") ?? [];
      fields.lastName = cleanName(last);
      if (given.length > 1) fields.middleName = given.pop();
      fields.firstName = given.join(" ") || undefined;
    }
  }

  for (const field of ["lastName", "firstName", "middleName"] as const) {
    if (fields[field]) continue;
    const idx = lines.findIndex((l) => l.label === field);
    if (idx >= 0) fields[field] = findValue(lines, idx, cleanName);
  }

  // Suffix printed with the given name ("JUAN JR.").
  if (fields.firstName) {
    const words = fields.firstName.split(" ");
    const suffix = normalizeSuffix(words[words.length - 1]);
    if (suffix && words.length > 1) {
      fields.suffix = suffix;
      fields.firstName = words.slice(0, -1).join(" ");
    }
  }

  const birthIdx = lines.findIndex((l) => l.label === "birthDate");
  if (birthIdx >= 0) fields.birthDate = findValue(lines, birthIdx, normalizeDate);
  const expiryIdx = lines.findIndex((l) => l.label === "expiry");
  if (expiryIdx >= 0) fields.idExpiry = findValue(lines, expiryIdx, normalizeDate);

  // PhilSys prints the values in a fixed order. When the (small, italic)
  // labels didn't survive OCR, fall back to that order.
  if (positional && idType === "PhilSys National ID" && (!fields.lastName || !fields.firstName)) {
    // Names sit between the card number and the birth date.
    const start = lines.findIndex((l) => findGrouped(l.raw.toUpperCase(), [4, 4, 4, 4]));
    const dateAt = lines.findIndex((l, i) => i > start && normalizeDate(l.raw));
    const end = dateAt >= 0 ? dateAt : lines.length;
    const names = lines
      .slice(start + 1, end)
      .map((l) => (l.label || HEADER_WORDS.test(l.raw.toUpperCase()) ? undefined : strictNameLine(l.raw)))
      .filter((n): n is string => !!n);
    fields.lastName ??= names[0];
    fields.firstName ??= names[1];
    fields.middleName ??= names[2];
  }
  // No labelled date found: take the first full date on the card.
  fields.birthDate ??= lines.map((l) => normalizeDate(l.raw)).find(Boolean);

  fields.sex = findSex(upper);

  fields.idNumber = findIdNumber(upper, idType);
  return clean(fields);
}

/**
 * The value after or under a "SEX" label. Cards often print another label
 * beside it ("SEX   DATE OF BIRTH" / "F   1995/03/15"), and sparse OCR puts
 * each of those on its own line, so check the rest of the label's line, then
 * the next few lines for one that starts with a sex value.
 */
function findSex(upper: string): IdSex | undefined {
  const rows = upper.split("\n").map((r) => r.trim()).filter(Boolean);
  const token = /^[^A-Z]*(MALE|FEMALE|LALAKI|BABAE|M|F)(?![A-Z])/;
  for (let i = 0; i < rows.length; i++) {
    const label = rows[i]!.match(/\b(?:SEX|KASARIAN)\b/);
    if (!label) continue;
    const sameLine = rows[i]!.slice(label.index! + label[0].length).match(token);
    if (sameLine) return normalizeSex(sameLine[1]);
    for (const row of rows.slice(i + 1, i + 4)) {
      const below = row.match(token);
      if (below) return normalizeSex(below[1]);
    }
  }
  return undefined;
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

function classifyLine(raw: string): Line {
  // "Apelyido/Last Name" → ["Apelyido", "Last", "Name"]; matched lowercased.
  const tokens = raw.split(/[\s/]+/).filter(Boolean);
  const words = tokens.map((t) => t.toLowerCase().replace(/[^a-z]/g, ""));
  for (const { field, phrases } of LABELS) {
    for (const phrase of phrases) {
      const end = matchPhrase(words, phrase.split(" "));
      if (end >= 0) {
        // Keep whatever follows the label on the same line — some IDs print
        // the value inline ("SURNAME DELA CRUZ").
        return { raw, label: field, afterLabel: tokens.slice(end).join(" ") };
      }
    }
  }
  return { raw };
}

/** Index just past a fuzzy phrase match in `words`, or -1. */
function matchPhrase(words: string[], phrase: string[]): number {
  for (let start = 0; start + phrase.length <= words.length; start++) {
    const ok = phrase.every((p, k) => similar(words[start + k]!, p));
    if (ok) return start + phrase.length;
  }
  return -1;
}

function similar(word: string, target: string) {
  if (word === target) return true;
  const allowed = target.length <= 3 ? 0 : target.length <= 6 ? 1 : 2;
  return allowed > 0 && levenshtein(word, target) <= allowed;
}

/**
 * The value belonging to the label at `idx`: text after the label on the same
 * line, else the next lines — skipping OCR junk — until another label starts.
 */
function findValue(lines: Line[], idx: number, accept: (line: string) => string | undefined): string | undefined {
  const inline = lines[idx]!.afterLabel;
  if (inline && !classifyLine(inline).label) {
    const v = accept(inline);
    if (v) return v;
  }
  for (let i = idx + 1; i < Math.min(lines.length, idx + 5); i++) {
    if (lines[i]!.label) return undefined;
    const v = accept(lines[i]!.raw);
    if (v) return v;
  }
  return undefined;
}

/**
 * Keeps the uppercase name words on a line and drops the rest ("Ll i DELA
 * CRUZ" → "Dela Cruz", "\ JUAN %" → "Juan"). IDs print names in capitals, so
 * mixed-case fragments are background noise or label text.
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
    if (bare !== bare.toUpperCase()) return false; // mixed/lower case → noise
    return bare.length >= 2 || NAME_PARTICLES.has(bare);
  });
  if (kept.length === 0) return undefined;
  const joined = kept.join(" ");
  if (joined.replace(/[^A-ZÑ]/g, "").length < 2) return undefined;
  return titleCase(joined);
}

/** Stricter than cleanName, for label-less fallback: the whole line must be a name. */
function strictNameLine(line: string): string | undefined {
  const trimmed = line.replace(/^[^A-ZÑ]+|[^A-ZÑ.]+$/g, "");
  if (!/^[A-ZÑ][A-ZÑ .'-]+$/.test(trimmed)) return undefined;
  if (/\d/.test(line) || trimmed.replace(/[^A-ZÑ]/g, "").length < 3) return undefined;
  return titleCase(trimmed);
}

/** The ID type the printed text points to, or "Other" when it's unclear. */
export function detectIdType(upper: string): string {
  if (/PHILSYS|PAMBANSANG|PAGKAKAKILANLAN|PHILIPPINE\s*IDENTIFICATION/.test(upper)) return "PhilSys National ID";
  if (/UNIFIED\s*MULTI|UMID|\bCRN\b/.test(upper)) return "UMID";
  if (/DRIVER|LAND\s*TRANSPORTATION|\bLTO\b/.test(upper)) return "Driver's License";
  if (/PASSPORT|PASAPORTE/.test(upper)) return "Passport";
  if (/PROFESSIONAL\s*REGULATION|\bPRC\b/.test(upper)) return "PRC ID";
  if (/SOCIAL\s*SECURITY|\bSSS\b/.test(upper)) return "SSS ID";
  if (/INTERNAL\s*REVENUE|\bTIN\b/.test(upper)) return "TIN ID";
  if (/POSTAL|PHLPOST/.test(upper)) return "Postal ID";
  return "Other";
}

// Characters OCR commonly confuses with digits inside ID numbers.
const DIGIT_FIXES: Record<string, string> = {
  O: "0",
  Q: "0",
  D: "0",
  I: "1",
  L: "1",
  "|": "1",
  Z: "2",
  S: "5",
  G: "6",
  B: "8",
  T: "7",
};

function toDigits(chunk: string) {
  return chunk
    .toUpperCase()
    .split("")
    .map((c) => DIGIT_FIXES[c] ?? c)
    .join("");
}

/**
 * Finds groups of digits separated by "-", space, ":" or "." whose sizes match
 * the ID's format, tolerating letters OCR mistook for digits as long as each
 * group is mostly real digits.
 */
function findGrouped(upper: string, groups: number[]): string | undefined {
  const sep = "[\\s\\-:.]{1,3}";
  const chunk = (n: number) => `([0-9A-Z|]{${n}})`;
  const re = new RegExp(`(?<![0-9A-Z])${groups.map(chunk).join(sep)}(?![0-9A-Z])`, "g");
  for (const m of upper.matchAll(re)) {
    const parts = m.slice(1, groups.length + 1);
    const mostlyDigits = parts.every((p) => p.replace(/\D/g, "").length >= Math.ceil(p.length * 0.6));
    const fixed = parts.map(toDigits);
    if (mostlyDigits && fixed.every((p) => /^\d+$/.test(p))) return fixed.join("-");
  }
  return undefined;
}

function findIdNumber(upper: string, idType: string): string | undefined {
  switch (idType) {
    case "PhilSys National ID":
      return findGrouped(upper, [4, 4, 4, 4]);
    case "UMID":
      return findGrouped(upper, [4, 7, 1]);
    case "SSS ID":
      return findGrouped(upper, [2, 7, 1]);
    case "TIN ID":
      return findGrouped(upper, [3, 3, 3, 3]) ?? findGrouped(upper, [3, 3, 3]);
    case "Driver's License":
      return upper
        .match(/\b([A-Z]\d{2})[-\s]?(\d{2})[-\s]?(\d{6})\b/)
        ?.slice(1, 4)
        .join("-");
    case "PRC ID":
      return upper.match(/REGISTRATION\s*(?:NO\.?|NUMBER)?\s*[:.]?\s*(\d{6,8})/)?.[1];
    default:
      return upper.match(/\b(?:ID\s*NO\.?|NO\.)\s*[:.]?\s*([A-Z0-9-]{6,})/)?.[1];
  }
}

/** Passport machine-readable zone: P<PHLDELA<CRUZ<<JUAN<PEREZ<<<… / P1234567<8PHL9001015M3001017<<<… */
function parsePassportMrz(lines: string[]): ScannedIdFields | null {
  const mrzLines = lines.map((l) => l.replace(/\s+/g, "").toUpperCase()).filter((l) => /^[A-Z0-9<]{30,}$/.test(l));
  const nameLine = mrzLines.find((l) => /^P[<O0]/.test(l));
  if (!nameLine) return null;
  const dataLine = mrzLines[mrzLines.indexOf(nameLine) + 1];

  const [surname = "", given = ""] = nameLine.slice(5).split("<<");
  const fields: ScannedIdFields = {
    idType: "Passport",
    lastName: titleCase(surname.replace(/</g, " ")),
    firstName: titleCase(given.split("<").filter(Boolean).join(" ")),
  };
  if (dataLine && dataLine.length >= 28) {
    fields.idNumber = dataLine.slice(0, 9).replace(/</g, "");
    fields.birthDate = mrzDate(dataLine.slice(13, 19), "past");
    fields.sex = normalizeSex(dataLine[20]);
    fields.idExpiry = mrzDate(dataLine.slice(21, 27), "future");
  }
  return clean(fields);
}

function mrzDate(yymmdd: string, when: "past" | "future"): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const yy = Number(yymmdd.slice(0, 2));
  const currentYY = new Date().getFullYear() % 100;
  const century = when === "past" ? (yy > currentYY ? 1900 : 2000) : 2000;
  return `${century + yy}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
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
  return best >= 0.6 ? month : undefined;
}

export function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.toUpperCase().replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (y: number, m: number | undefined, d: number) =>
    m !== undefined && y > 1900 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31
      ? `${y}-${pad(m)}-${pad(d)}`
      : undefined;

  let m = v.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/); // 1990/01/31
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!);
  m = v.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/); // 01/31/1990 (PH: month first)
  if (m) return iso(+m[3]!, +m[1]!, +m[2]!);
  m = v.match(/([A-Z]{3,9}) (\d{1,2}) (\d{4})/); // JANUARY 31 1990
  if (m) return iso(+m[3]!, fuzzyMonth(m[1]!), +m[2]!);
  m = v.match(/(\d{1,2}) ([A-Z]{3,9}) (\d{4})/); // 31 JAN 1990
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
  const v = value?.replace(/\./g, "").trim().toUpperCase();
  if (!v || !SUFFIXES.includes(v)) return undefined;
  return v === "JR" || v === "SR" ? `${v[0]}${v[1]!.toLowerCase()}.` : v;
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

// ---------------------------------------------------------------------------
// Confidence
//
// A field is only auto-filled when every word it came from was read with high
// confidence. Anything less is left blank for HR to type, instead of filling
// in a plausible-looking but wrong value.

/** Minimum Tesseract word confidence (0–100) for a value to be auto-filled. */
export const MIN_WORD_CONFIDENCE = 85;
/** Names are printed large and bold, so they're accepted at a lower bar. */
export const MIN_NAME_CONFIDENCE = 70;

export interface OcrWord {
  text: string;
  confidence: number;
}

/** OCR words grouped by printed line, as Tesseract returns them. */
export type OcrLines = OcrWord[][];

export type CheckedField = "lastName" | "firstName" | "middleName" | "birthDate" | "sex" | "idNumber" | "idExpiry";

const lettersOnly = (s: string) => s.toUpperCase().replace(/[^A-ZÑ]/g, "");

/**
 * Best confidence of an OCR word that reads exactly as `token`, or 0 if none
 * does. Exact only: a clipped read ("JUA") must not borrow the confidence of
 * a full one ("JUAN").
 */
function bestMatch(words: OcrWord[], token: string, normalize: (s: string) => string) {
  let best = 0;
  for (const w of words) if (normalize(w.text) === token) best = Math.max(best, w.confidence);
  return best;
}

function valueConfidence(field: CheckedField, value: string, lines: OcrLines): number {
  const words = lines.flat();
  switch (field) {
    case "lastName":
    case "firstName":
    case "middleName": {
      const tokens = value.split(/\s+/).map(lettersOnly).filter(Boolean);
      return tokens.length ? Math.min(...tokens.map((t) => bestMatch(words, t, lettersOnly))) : 0;
    }
    case "idNumber": {
      // The number may be one OCR word ("1234-5678-…") or one per group.
      const whole = value.replace(/[^0-9A-Z]/gi, "").toUpperCase();
      const digitsOf = (s: string) => toDigits(s).replace(/[^0-9A-Z]/g, "");
      const asOne = bestMatch(words, whole, digitsOf);
      if (asOne) return asOne;
      const tokens = value.split(/[^0-9A-Z]+/i).filter(Boolean);
      return tokens.length ? Math.min(...tokens.map((t) => bestMatch(words, t.toUpperCase(), digitsOf))) : 0;
    }
    case "birthDate":
    case "idExpiry": {
      // Dates are printed in many formats; judge by the line holding the year.
      const year = value.slice(0, 4);
      const line = lines.find((l) => l.some((w) => w.text.includes(year)));
      const parts = line?.filter((w) => /\d/.test(w.text) || lettersOnly(w.text).length >= 3) ?? [];
      return parts.length ? Math.min(...parts.map((w) => w.confidence)) : 0;
    }
    case "sex":
      return Math.max(0, ...words.filter((w) => /^(M|F|MALE|FEMALE|LALAKI|BABAE)$/.test(lettersOnly(w.text))).map((w) => w.confidence));
  }
}

const checkedFields = ["lastName", "firstName", "middleName", "birthDate", "sex", "idNumber", "idExpiry"] as const;

function minConfidence(field: CheckedField) {
  return field === "lastName" || field === "firstName" || field === "middleName" ? MIN_NAME_CONFIDENCE : MIN_WORD_CONFIDENCE;
}

/**
 * Combines several OCR passes field by field. Each field takes the value the
 * most passes read (confidence breaks ties), so one pass dropping a letter is
 * outvoted. `agreed` holds the fields that at least two passes read the same.
 */
export function bestOfPasses(passes: { fields: ScannedIdFields; lines: OcrLines }[]) {
  const fields: ScannedIdFields = {};
  const agreed: ScannedIdFields = {};
  const unsure = new Set<CheckedField>();
  for (const field of checkedFields) {
    const votes = new Map<string, { count: number; confidence: number }>();
    for (const pass of passes) {
      const value = pass.fields[field];
      if (!value) continue;
      const confidence = valueConfidence(field, value, pass.lines);
      const v = votes.get(value) ?? { count: 0, confidence: 0 };
      votes.set(value, { count: v.count + 1, confidence: Math.max(v.confidence, confidence) });
    }
    const best = [...votes.entries()].sort((a, b) => b[1].count - a[1].count || b[1].confidence - a[1].confidence)[0];
    if (!best) continue;
    const [value, { count, confidence }] = best;
    if (confidence >= minConfidence(field)) {
      (fields as Record<string, string>)[field] = value;
      if (count >= 2) (agreed as Record<string, string>)[field] = value;
    } else unsure.add(field);
  }
  // A suffix is split off the first name, so it stands or falls with it.
  const withSuffix = passes.find((p) => p.fields.firstName === fields.firstName && p.fields.suffix);
  if (fields.firstName && withSuffix) fields.suffix = withSuffix.fields.suffix;
  return { fields, agreed, unsure: [...unsure] };
}

/**
 * Splits OCR results into fields confident enough to fill and fields that
 * were found but not read clearly (returned as `unsure`, left blank).
 */
export function keepConfidentFields(fields: ScannedIdFields, lines: OcrLines) {
  const kept: ScannedIdFields = { ...fields };
  const unsure: CheckedField[] = [];
  for (const field of checkedFields) {
    const value = fields[field];
    if (!value) continue;
    if (valueConfidence(field, value, lines) < minConfidence(field)) {
      delete kept[field];
      unsure.push(field);
    }
  }
  // A suffix is split off the first name, so it stands or falls with it.
  if (!kept.firstName) delete kept.suffix;
  return { fields: kept, unsure };
}

/** A birth date that fits someone of working age (15–100) today. */
export function isPlausibleBirthDate(iso: string, today = new Date()) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return false;
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age >= 15 && age <= 100;
}
