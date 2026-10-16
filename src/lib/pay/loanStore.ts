// Loans and other recurring deductions: stored here, deducted by payroll runs (runs.ts) and
// managed on Payroll → Loans & deductions (loans.ts). No imports from runs, so both can use it.
// With the API server they're kept in the database (see refreshLoans).

import { api, serverMode } from "../http";

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

// v2: the loans and cash advances in MSMA's payroll register.
const KEY = "heyhr-loans-v2";

function seed(): Loan[] {
  const at = "2026-07-01T09:00:00";
  return [
    { id: "ln-ca-santos", employeeId: "MSMA-00317", kind: "Cash advance", reference: "Cash advance, salary deduction for 2 years (balance per CA sheet)", principal: 92968.75, installment: 3718.75, startDate: "2026-01-10", status: "active", createdBy: "Accounting (demo)", createdAt: at },
    { id: "ln-ca-estrada", employeeId: "MSMA-00812", kind: "Cash advance", reference: "Cash advance – medical (balance per CA sheet)", principal: 45220, installment: 1190, startDate: "2026-01-10", status: "active", createdBy: "Accounting (demo)", createdAt: at },
    { id: "ln-sss-hernandez", employeeId: "MSMA-01002", kind: "SSS salary loan", reference: "Per payroll register; balance to confirm", principal: 21420, installment: 892.5, startDate: "2026-01-10", status: "active", createdBy: "Accounting (demo)", createdAt: at },
    { id: "ln-sss-lopez", employeeId: "MSMA-00098", kind: "SSS salary loan", reference: "Per payroll register; balance to confirm", principal: 15708, installment: 654.5, startDate: "2026-01-10", status: "active", createdBy: "Accounting (demo)", createdAt: at },
    { id: "ln-sss-estrada", employeeId: "MSMA-00812", kind: "SSS salary loan", reference: "Two SSS loans per payroll register; balance to confirm", principal: 20411.28, installment: 850.47, startDate: "2026-01-10", status: "active", createdBy: "Accounting (demo)", createdAt: at },
    { id: "ln-sss-gatchalian", employeeId: "MSMA-00845", kind: "SSS salary loan", reference: "Two SSS loans per payroll register; balance to confirm", principal: 16379.28, installment: 682.47, startDate: "2026-01-10", status: "active", createdBy: "Accounting (demo)", createdAt: at },
    { id: "ln-hdmf-estrada", employeeId: "MSMA-00812", kind: "Pag-IBIG multi-purpose loan", reference: "Per payroll register; balance to confirm", principal: 4146, installment: 172.75, startDate: "2026-01-10", status: "active", createdBy: "Accounting (demo)", createdAt: at },
    { id: "ln-hdmf-gatchalian", employeeId: "MSMA-00845", kind: "Pag-IBIG multi-purpose loan", reference: "Per payroll register; balance to confirm", principal: 12435.36, installment: 518.14, startDate: "2026-01-10", status: "active", createdBy: "Accounting (demo)", createdAt: at },
  ];
}

function load(): Loan[] {
  // With the API server, loans come from the database (see refreshLoans).
  if (serverMode) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Loan[];
  } catch {
    // Blocked or corrupt storage: start from the sample loans.
  }
  return seed();
}

let loans: Loan[] = load();

/** With the API server: what approved payroll runs have taken for each loan so far. */
const paidOnServer = new Map<string, number>();

/** With the API server: the loans this account may see, and what's been paid on each. */
export async function refreshLoans() {
  if (!serverMode) return;
  const rows = await api<(Loan & { paid: number })[]>("GET", "/payroll/loans");
  paidOnServer.clear();
  loans = rows.map(({ paid, ...l }) => {
    paidOnServer.set(l.id, paid);
    return l;
  });
}

/** With the API server: what approved runs have taken for a loan (as of the last refreshLoans). */
export const serverLoanPaid = (loanId: string) => paidOnServer.get(loanId) ?? 0;

/** Re-read what's saved, so another tab's change is seen. */
export function allLoans(): Loan[] {
  if (!serverMode) loans = load();
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
