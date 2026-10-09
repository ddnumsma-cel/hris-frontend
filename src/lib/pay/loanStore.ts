// Loans and other recurring deductions: stored here, deducted by payroll runs (runs.ts) and
// managed on Payroll → Loans & deductions (loans.ts). No imports from runs, so both can use it.

export const LOAN_KINDS = ["SSS salary loan", "SSS calamity loan", "Pag-IBIG multi-purpose loan", "Pag-IBIG calamity loan", "Cash advance", "Company loan", "Other deduction"] as const;
export type LoanKind = (typeof LOAN_KINDS)[number];

export interface Loan {
  id: string;
  employeeId: string;
  kind: LoanKind;
  /** The SSS/Pag-IBIG loan number, or what an "Other deduction" is for. */
  reference: string;
  /** The total to deduct. */
  principal: number;
  /** Taken from each cutoff's pay until the balance is zero. */
  installment: number;
  /** First cutoff it's deducted from (any date inside it). */
  startDate: string;
  /** stopped: no more deductions (e.g. paid outside payroll); settled: closed in final pay. */
  status: "active" | "stopped" | "settled";
  note?: string;
  createdBy: string;
  createdAt: string;
  closedBy?: string;
  closedAt?: string;
}

const KEY = "heyhr-loans-v1";

function seed(): Loan[] {
  const at = "2026-07-01T09:00:00";
  return [
    { id: "ln-1", employeeId: "MSMA-00482", kind: "SSS salary loan", reference: "SSS-LN 0348-221", principal: 24_000, installment: 1_000, startDate: "2026-07-01", status: "active", createdBy: "Accounting (demo)", createdAt: at },
    { id: "ln-2", employeeId: "MSMA-00203", kind: "Pag-IBIG multi-purpose loan", reference: "MPL 1671-3774", principal: 30_000, installment: 1_250, startDate: "2026-08-01", status: "active", createdBy: "Accounting (demo)", createdAt: at },
    { id: "ln-3", employeeId: "MSMA-00845", kind: "Cash advance", reference: "Emergency cash advance", principal: 6_000, installment: 1_500, startDate: "2026-10-01", status: "active", createdBy: "Accounting (demo)", createdAt: at },
  ];
}

function load(): Loan[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Loan[];
  } catch {
    // Blocked or corrupt storage: start from the samples.
  }
  return seed();
}

let loans: Loan[] = load();

/** Re-read what's saved, so another tab's change is seen. */
export function allLoans(): Loan[] {
  loans = load();
  return loans;
}

export function saveLoans(next: Loan[]) {
  loans = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not kept after a reload; fine in the prototype.
  }
}

/** Adjustment IDs that payroll runs use for loan installments: "loan-<loan id>". */
export const loanAdjustmentId = (loanId: string) => `loan-${loanId}`;
export const claimAdjustmentId = (claimId: string) => `claim-${claimId}`;
