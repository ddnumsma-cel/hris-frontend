import type {
  ComplianceItem,
  CpdStatus,
  PayrollRunStep,
  PersonnelDocument,
  ProfessionalLicense,
  TrainingRecord,
} from "./types";

const monthIndex: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/** Parses "Sept 30" or "Oct 15, 2026" style labels used throughout the mock data. */
export function parseFlexibleDate(label: string, fallbackYear = new Date().getFullYear()): Date | null {
  const withYear = label.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  const noYear = label.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  const match = withYear ?? noYear;
  if (!match) return null;

  const idx = monthIndex[match[1].toLowerCase()] ?? monthIndex[match[1].toLowerCase().slice(0, 3)];
  if (idx === undefined) return null;

  const day = Number(match[2]);
  const year = withYear ? Number(withYear[3]) : fallbackYear;
  return new Date(year, idx, day);
}

function daysUntil(date: Date, now = new Date()): number {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((date.getTime() - startOfToday.getTime()) / 86_400_000);
}

/** Parses the plain "YYYY-MM-DD" dates used by personnel records, as a local
 * date rather than UTC (avoids the off-by-one-day pitfall of `new Date(iso)`). */
export function parseIsoDate(iso: string): Date | null {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Age in whole years as of `now`. */
export function getAge(birthDateIso: string, now = new Date()): number | null {
  const birth = parseIsoDate(birthDateIso);
  if (!birth) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

/** PH optional-retirement age under RA 7641 — a starting point for
 * age-based workforce-planning rules, not a hard cutoff. */
export const OPTIONAL_RETIREMENT_AGE = 60;

/** Live status for any expiry date on a personnel document (government ID,
 * professional license) — same due-soon/overdue computation as compliance
 * filings, so nobody has to remember to flag an expiring ID by hand. */
export function getDocumentExpiryStatus(
  expiryIso: string,
  now = new Date(),
): { status: "OK" | "Due soon" | "Overdue"; note: string } {
  const expiry = parseIsoDate(expiryIso);
  if (!expiry) return { status: "OK", note: expiryIso };

  const diff = daysUntil(expiry, now);
  if (diff < 0) return { status: "Overdue", note: `Expired ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} ago` };
  if (diff <= DUE_SOON_WINDOW_DAYS) return { status: "Due soon", note: diff === 0 ? "Expires today" : `Expires in ${diff} days` };
  return { status: "OK", note: `Expires ${expiryIso}` };
}

/** Every expiring/expired field (government ID, professional license) on one
 * employee's personnel documents — used to drive attention-panel items. */
export function getExpiringPersonnelFields(doc: PersonnelDocument, now = new Date()) {
  const fields: { label: string; status: "Due soon" | "Overdue"; note: string }[] = [];
  if (doc.idExpiry) {
    const r = getDocumentExpiryStatus(doc.idExpiry, now);
    if (r.status !== "OK") fields.push({ label: `${doc.idType ?? "Government ID"}`, status: r.status, note: r.note });
  }
  if (doc.licenseExpiry) {
    const r = getDocumentExpiryStatus(doc.licenseExpiry, now);
    if (r.status !== "OK") fields.push({ label: "Professional license (on file)", status: r.status, note: r.note });
  }
  return fields;
}

const DUE_SOON_WINDOW_DAYS = 7;

/**
 * Compliance items are only ever manually moved to "Filed" by HR — whether
 * something is merely "Due soon" vs. actually "Overdue" (and the day count in
 * the note) is computed live from the due date instead of being a fact
 * someone has to remember to update.
 */
export function getEffectiveCompliance(item: ComplianceItem, now = new Date()): { status: ComplianceItem["status"]; note?: string } {
  if (item.status === "Filed") return { status: "Filed" };

  const due = parseFlexibleDate(item.due, now.getFullYear());
  if (!due) return { status: item.status, note: item.note };

  const diff = daysUntil(due, now);
  if (diff < 0) {
    return { status: "Overdue", note: `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} overdue` };
  }
  if (diff <= DUE_SOON_WINDOW_DAYS) {
    return { status: "Due soon", note: diff === 0 ? "Due today" : `Due in ${diff} day${diff === 1 ? "" : "s"}` };
  }
  return { status: "Due soon", note: `Due in ${diff} days` };
}

/**
 * PRC-style CPD (Continuing Professional Development) compliance for a CPA
 * license: units already met beats the deadline regardless of date; short of
 * that, urgency is computed live from the cycle end date the same way
 * compliance filings are, instead of relying on someone to flip a status.
 */
export function getCpdStatus(
  license: ProfessionalLicense,
  now = new Date(),
): { status: CpdStatus; note: string } {
  const { cpdUnitsEarned, cpdUnitsRequired } = license;
  const unitsLabel = `${cpdUnitsEarned}/${cpdUnitsRequired} units`;

  if (cpdUnitsEarned >= cpdUnitsRequired) {
    return { status: "Compliant", note: unitsLabel };
  }

  const due = parseFlexibleDate(license.cycleEndDate, now.getFullYear());
  if (!due) return { status: "In progress", note: unitsLabel };

  const diff = daysUntil(due, now);
  if (diff < 0) {
    return { status: "Overdue", note: `${unitsLabel} · ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} past deadline` };
  }
  if (diff <= DUE_SOON_WINDOW_DAYS) {
    return { status: "Due soon", note: `${unitsLabel} · due in ${diff} day${diff === 1 ? "" : "s"}` };
  }
  return { status: "In progress", note: `${unitsLabel} · due ${license.cycleEndDate}` };
}

/** True when a training's due date has passed and it still isn't completed. */
export function isTrainingOverdue(record: TrainingRecord, now = new Date()): boolean {
  if (record.status === "Completed") return false;
  const due = parseFlexibleDate(record.dueDate, now.getFullYear());
  if (!due) return false;
  return daysUntil(due, now) < 0;
}

// Each payroll run step is tied to a milestone date embedded in (or implied
// right after) its label — matched here so the step tracker advances on its
// own as real time passes instead of sitting on whatever status was seeded.
const PAYROLL_MILESTONES: { match: RegExp; date: (year: number) => Date }[] = [
  { match: /timekeeping locked/i, date: (y) => new Date(y, 8, 25) }, // Sept 25
  { match: /payroll computation/i, date: (y) => new Date(y, 8, 26) }, // day after timekeeping locks
  { match: /statutory remittances/i, date: (y) => new Date(y, 9, 25) }, // Oct 25
  { match: /payslips released/i, date: (y) => new Date(y, 9, 30) }, // Oct 30
];

/**
 * Recomputes each payroll step's status from real milestone dates: anything
 * whose date has passed is "done", the first one still ahead becomes
 * "current", and the rest stay "pending" — a stand-in for what a real
 * payroll cron job would flip automatically.
 */
export function getEffectivePayrollSteps(steps: PayrollRunStep[], now = new Date()): PayrollRunStep[] {
  const year = now.getFullYear();
  const withDates = steps.map((step) => {
    const milestone = PAYROLL_MILESTONES.find((m) => m.match.test(step.label));
    return { step, due: milestone ? milestone.date(year) : null };
  });

  let currentAssigned = false;
  return withDates.map(({ step, due }) => {
    if (!due) return step;
    if (now.getTime() >= due.getTime()) return { ...step, status: "done" as const };
    if (!currentAssigned) {
      currentAssigned = true;
      return { ...step, status: "current" as const };
    }
    return { ...step, status: "pending" as const };
  });
}
