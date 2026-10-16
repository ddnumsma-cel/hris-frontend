/**
 * Philippine government numbers HR records for a new hire: how each one is
 * written, how long it is, and how it's shown once saved (last 4 digits only).
 */

export type GovIdKey = "tin" | "sss" | "philHealth" | "pagIbig";

export interface GovIdFormat {
  key: GovIdKey;
  label: string;
  /** Where the employee finds it, shown under the field. */
  hint: string;
  /** Digit groups, e.g. [2, 7, 1] → 00-0000000-0. */
  groups: number[];
  /** Accepted lengths in digits (TIN may leave off the 3-digit branch code). */
  lengths: number[];
}

export const govIdFormats: GovIdFormat[] = [
  { key: "tin", label: "TIN", hint: "BIR Form 1902 or 2316", groups: [3, 3, 3, 3], lengths: [9, 12] },
  { key: "sss", label: "SSS number", hint: "SSS E-1 form or UMID card", groups: [2, 7, 1], lengths: [10] },
  { key: "philHealth", label: "PhilHealth number", hint: "PhilHealth ID or MDR", groups: [2, 9, 1], lengths: [12] },
  { key: "pagIbig", label: "Pag-IBIG MID", hint: "Pag-IBIG MID card or Virtual Pag-IBIG", groups: [4, 4, 4], lengths: [12] },
];

export const govIdFormatByKey = Object.fromEntries(govIdFormats.map((f) => [f.key, f])) as Record<GovIdKey, GovIdFormat>;

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

/** "34112233445" → "34-1122334-5" (extra digits are dropped as you type). */
export function formatGovId(key: GovIdKey, value: string) {
  const { groups, lengths } = govIdFormatByKey[key];
  const digits = onlyDigits(value).slice(0, Math.max(...lengths));
  const parts: string[] = [];
  let i = 0;
  for (const size of groups) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + size));
    i += size;
  }
  return parts.join("-");
}

/** The pattern to show in placeholders and error messages, e.g. "00-0000000-0". */
export function govIdPattern(key: GovIdKey) {
  return govIdFormatByKey[key].groups.map((n) => "0".repeat(n)).join("-");
}

export function isValidGovId(key: GovIdKey, value: string) {
  const length = onlyDigits(value).length;
  return length === 0 || govIdFormatByKey[key].lengths.includes(length);
}

/** "34-1122334-5" → "••-•••3345"-style: only the last 4 digits stay readable. */
export function maskGovId(value: string) {
  const digits = onlyDigits(value);
  if (digits.length <= 4) return value;
  let seen = 0;
  const keepFrom = digits.length - 4;
  return value.replace(/\d/g, (d) => (seen++ < keepFrom ? "•" : d));
}

// ---- Mobile numbers ----

/** Accepts 09XX XXX XXXX, +63 9XX XXX XXXX or 639XXXXXXXXX. */
export function isValidPhMobile(value: string) {
  const digits = onlyDigits(value);
  return /^(0|63)?9\d{9}$/.test(digits);
}

/** Any accepted mobile format → "+63 917 552 0184". */
export function formatPhMobile(value: string) {
  const digits = onlyDigits(value);
  const local = digits.replace(/^(63|0)(?=9\d{9}$)/, "");
  if (!/^9\d{9}$/.test(local)) return value.trim();
  return `+63 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
