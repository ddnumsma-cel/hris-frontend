// Strict checks applied to every value the ID reader produces. A value that
// fails is dropped: a blank field costs HR one lookup, a plausible-looking
// wrong one costs them a bad record. Pure (DOM-free).

import type { IdSex } from "./idParse";

// Words printed as labels or headers on PH IDs. If one of these ends up in a
// name field, the reader grabbed the label instead of the value.
const LABEL_WORDS = new Set([
  "LAST", "FIRST", "MIDDLE", "NAME", "NAMES", "GIVEN", "SURNAME", "FAMILY", "SUFFIX",
  "APELYIDO", "PANGALAN", "GITNANG", "PANGGITNANG", "MGA",
  "NATIONALITY", "NASYONALIDAD", "FILIPINO", "PHL",
  "REPUBLIC", "REPUBLIKA", "PHILIPPINES", "PHILIPPINE", "PILIPINAS",
  "SEX", "KASARIAN", "MALE", "FEMALE", "LALAKI", "BABAE",
  "DATE", "BIRTH", "PETSA", "KAPANGANAKAN", "PLACE", "ISSUE", "ISSUED",
  "ADDRESS", "TIRAHAN",
  "LICENSE", "LICENCE", "DRIVER", "DRIVERS", "NONPROFESSIONAL", "PROFESSIONAL", "STUDENT", "PERMIT",
  "EXPIRATION", "EXPIRY", "VALID", "UNTIL",
  "SIGNATURE", "LAGDA", "CARD", "IDENTIFICATION", "PAGKAKAKILANLAN", "PAMBANSANG", "NUMBER",
  "CRN", "TIN", "SSS", "PRN", "PCN", "PSN",
  "TYPE", "URI", "CODE", "KODIGO", "BLOOD", "HEIGHT", "WEIGHT", "EYES", "COLOR", "AGENCY", "RESTRICTIONS", "CONDITIONS",
  "PASSPORT", "PASAPORTE", "AUTHORITY",
  "OFFICE", "LAND", "TRANSPORTATION", "UNIFIED", "MULTI", "MULTIPURPOSE", "PURPOSE",
  "SOCIAL", "SECURITY", "SYSTEM", "REGISTRATION", "REGULATION", "COMMISSION",
  "BUREAU", "INTERNAL", "REVENUE", "POSTAL", "PHLPOST", "CORPORATION", "DEPARTMENT",
  "CIVIL", "STATUS", "SINGLE", "MARRIED", "SPECIMEN",
]);

const NAME_PARTICLES = new Set(["DE", "DEL", "DELA", "DELOS", "LA", "LAS", "LOS", "SAN", "STA", "STO", "MA", "Y", "VDA"]);
const VOWELS = /[AEIOUY]/;

/** A name as printed on the card, already title-cased. Returns it, or undefined if it isn't believable. */
export function validName(value: string | undefined, { allowLabelWords = false } = {}): string | undefined {
  const v = value?.replace(/\s+/g, " ").trim();
  if (!v || v.length < 2 || v.length > 40) return undefined;
  // Letters, Ñ, space, hyphen, apostrophe; a period only after the
  // abbreviations PH names really use ("Ma.", "Sto.", "Sta.").
  if (!/^[A-Za-zÑñ]+(?:\.?[ '-][A-Za-zÑñ]+)*\.?$/.test(v)) return undefined;
  const words = v
    .toUpperCase()
    .split(/[ -]/)
    .map((w) => w.replace(/'/g, "")); // "O'BRIEN" is one word
  for (const raw of words) {
    const word = raw.replace(/\.$/, "");
    if (raw.endsWith(".") && !["MA", "STA", "STO", "JR", "SR"].includes(word)) return undefined;
    if (!allowLabelWords && isLabelWord(word)) return undefined;
    if (word.length === 1 && !NAME_PARTICLES.has(word)) return undefined;
    if (word.length >= 3 && !VOWELS.test(word) && !NAME_PARTICLES.has(word)) return undefined;
    if (/(.)\1\1/.test(word)) return undefined; // "LLLL" — MRZ filler or background
    if (/[^AEIOUY]{5,}/.test(word)) return undefined;
  }
  return v;
}

export function isLabelWord(word: string): boolean {
  const w = word.toUpperCase().replace(/[^A-ZÑ]/g, "");
  if (LABEL_WORDS.has(w)) return true;
  // Long label words survive one OCR slip ("SURNAMF"); short ones must be
  // exact or real names would collide ("NAMES" vs "JAMES").
  if (w.length < 7) return false;
  for (const label of LABEL_WORDS) {
    if (label.length >= 7 && Math.abs(label.length - w.length) <= 1 && editDistance(w, label) <= 1) return true;
  }
  return false;
}

const SUFFIXES = ["JR", "SR", "II", "III", "IV", "V"];

export function validSuffix(value: string | undefined): string | undefined {
  const v = value?.replace(/\./g, "").trim().toUpperCase();
  if (!v || !SUFFIXES.includes(v)) return undefined;
  return v === "JR" || v === "SR" ? `${v[0]}${v[1]!.toLowerCase()}.` : v;
}

/** yyyy-mm-dd that exists on the calendar (no Feb 30). */
export function realDate(value: string | undefined): Date | undefined {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const [y, mo, d] = [+m[1]!, +m[2]!, +m[3]!];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return undefined;
  return date;
}

function yearsBefore(today: Date, years: number) {
  return new Date(Date.UTC(today.getFullYear() - years, today.getMonth(), today.getDate()));
}

/** Birth date of someone between 15 and 100 years old today. */
export function validBirthDate(value: string | undefined, today = new Date()): string | undefined {
  const date = realDate(value);
  if (!date) return undefined;
  if (date > yearsBefore(today, 15) || date < yearsBefore(today, 100)) return undefined;
  return value;
}

/** Expiry within today−10y … today+15y, and never before the birth date. */
export function validExpiry(value: string | undefined, birthDate?: string, today = new Date()): string | undefined {
  const date = realDate(value);
  if (!date) return undefined;
  if (date < yearsBefore(today, 10) || date > yearsBefore(today, -15)) return undefined;
  const birth = realDate(birthDate);
  if (birth && date <= birth) return undefined;
  return value;
}

export function validSex(value: string | undefined): IdSex | undefined {
  return value === "Male" || value === "Female" ? value : undefined;
}

// ID number formats, in their canonical printed form.
export const ID_NUMBER_FORMATS: Record<string, RegExp> = {
  "PhilSys National ID": /^\d{4}-\d{4}-\d{4}-\d{4}$/,
  UMID: /^\d{4}-\d{7}-\d$/,
  "Driver's License": /^[A-Z]\d{2}-\d{2}-\d{6}$/,
  Passport: /^[A-Z]{1,2}\d{6,7}[A-Z]?$/,
  "PRC ID": /^\d{7}$/,
  "SSS ID": /^\d{2}-\d{7}-\d$/,
  "TIN ID": /^\d{3}-\d{3}-\d{3}(?:-\d{3,5})?$/,
  "Postal ID": /^(?=(?:[A-Z]*\d){8})[A-Z0-9]{10,14}$/,
};

/** The ID number if it matches its type's format (or, for an unknown type, any known format). */
export function validIdNumber(value: string | undefined, idType: string | undefined): string | undefined {
  if (!value) return undefined;
  const format = idType ? ID_NUMBER_FORMATS[idType] : undefined;
  if (format) return format.test(value) ? value : undefined;
  return Object.values(ID_NUMBER_FORMATS).some((re) => re.test(value)) ? value : undefined;
}

function editDistance(a: string, b: string) {
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
