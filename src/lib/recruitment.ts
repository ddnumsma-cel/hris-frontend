// Accountant-first ordering for applicants. The firm mostly hires accountants, so HR reviews CPAs
// first, then accountancy graduates, then everyone else; newest first within each group.

import type { Applicant, ApplicantProfession, JobRequisition } from "./types";

export const PROFESSIONS: { value: ApplicantProfession; label: string }[] = [
  { value: "CPA", label: "Certified Public Accountant (CPA)" },
  { value: "BS Accountancy graduate", label: "BS Accountancy graduate" },
  { value: "Accounting student / undergrad", label: "Accounting student or undergraduate" },
  { value: "Other", label: "Other field" },
];

const rank: Record<ApplicantProfession, number> = {
  CPA: 3,
  "BS Accountancy graduate": 2,
  "Accounting student / undergrad": 1,
  Other: 0,
};

/** CPAs and accountancy graduates count as accountants (they get the badge and pass the filter). */
export const isAccountant = (a: Pick<Applicant, "profession">) => (a.profession ? rank[a.profession] >= 2 : false);

/** Accountants first (CPA, then graduate), then accounting students, then others; newest first in each. */
export function byAccountantPriority(a: Applicant, b: Applicant) {
  const r = (b.profession ? rank[b.profession] : 0) - (a.profession ? rank[a.profession] : 0);
  return r || (b.appliedAt ?? "").localeCompare(a.appliedAt ?? "");
}

const ACCOUNTING_DEPARTMENTS = ["Audit & Assurance", "Tax Advisory", "Bookkeeping", "Accounting"];

/** Roles accountants do; the public form lists these first. */
export const isAccountingRole = (r: Pick<JobRequisition, "department">) => ACCOUNTING_DEPARTMENTS.includes(r.department);

/** The public link for one role, or for every open role. */
export function applyLink(requisitionId?: string) {
  const base = typeof window === "undefined" ? "" : window.location.origin;
  return `${base}/apply${requisitionId ? `/${requisitionId}` : ""}`;
}
