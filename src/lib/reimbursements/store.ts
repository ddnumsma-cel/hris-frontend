// Reimbursements: expense claims employees file with a photo of the POS receipt. Two approvals:
// the employee's approver (supervisor) first, then Accounting's final approval. HR isn't involved. Saved to localStorage, receipts as compressed JPEG data URLs.

import { state as core } from "../corehr/store";

export const CATEGORIES = ["Transportation", "Meals & client meetings", "Office supplies", "Communication", "Training & seminars", "Medical", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

/** pending: waiting for the approver · endorsed: approver said yes, waiting for Accounting · approved: final. */
export type ClaimStatus = "pending" | "endorsed" | "approved" | "rejected";

export interface Claim {
  id: string;
  employeeId: string;
  category: Category;
  /** What the employee typed when the category is "Other". */
  otherType?: string;
  merchant: string;
  /** yyyy-mm-dd on the receipt. */
  purchaseDate: string;
  amount: number;
  description: string;
  /** The receipt photo, as a data URL. */
  receipt: string;
  status: ClaimStatus;
  filedAt: string;
  /** Step 1: the approver (supervisor). */
  approverDecidedBy?: string;
  approverDecidedAt?: string;
  approverNote?: string;
  /** The final decision (Accounting), or the approver's when they declined. */
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
  /** Paid out: with a payroll run (added to take-home pay), by bank transfer, or in final pay. */
  paidAt?: string;
  paidBy?: string;
  payoutMethod?: "payroll" | "transfer" | "final pay";
  /** The run label, the transfer reference, or "Final pay". */
  payoutRef?: string;
}

/** The expense name to show: what they typed for "Other", else the category. */
export const claimType = (c: Pick<Claim, "category" | "otherType">) => (c.category === "Other" && c.otherType ? c.otherType : c.category);

/** Receipts older than this can't be claimed. */
export const CLAIM_WINDOW_DAYS = 60;
export const MAX_AMOUNT = 50_000;

const KEY = "heyhr-reimbursements-v1";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** A drawn POS slip for the sample claims (real claims carry the employee's photo). */
function sampleReceipt(merchant: string, date: string, lines: [string, number][]) {
  const total = lines.reduce((n, [, v]) => n + v, 0);
  const money = (n: number) => n.toLocaleString("en-PH", { minimumFractionDigits: 2 });
  const rows = lines.map(([label, v], i) => `<text x="24" y="${190 + i * 26}">${esc(label)}</text><text x="296" y="${190 + i * 26}" text-anchor="end">${money(v)}</text>`).join("");
  const y = 190 + lines.length * 26;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="${y + 150}" font-family="Courier New, monospace" font-size="15" fill="#222"><rect width="100%" height="100%" fill="#fbfaf6"/><text x="160" y="48" text-anchor="middle" font-size="19" font-weight="bold">${esc(merchant.toUpperCase())}</text><text x="160" y="74" text-anchor="middle" font-size="13">Cebu City · VAT REG TIN 000-123-456</text><text x="160" y="104" text-anchor="middle" font-size="13">OFFICIAL RECEIPT</text><text x="24" y="140" font-size="13">Date: ${date}</text><text x="296" y="140" text-anchor="end" font-size="13">OR# ${Math.abs(merchant.length * 7919) % 90000 + 10000}</text><line x1="24" y1="160" x2="296" y2="160" stroke="#999" stroke-dasharray="4 4"/>${rows}<line x1="24" y1="${y - 6}" x2="296" y2="${y - 6}" stroke="#999" stroke-dasharray="4 4"/><text x="24" y="${y + 22}" font-weight="bold">TOTAL</text><text x="296" y="${y + 22}" text-anchor="end" font-weight="bold">PHP ${money(total)}</text><text x="160" y="${y + 80}" text-anchor="middle" font-size="13">THANK YOU!</text></svg>`;
  return { amount: total, receipt: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
}

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function seed(): Claim[] {
  const others = core.employees.filter((e) => e.id !== "MSMA-00482" && e.job.status !== "Separated").slice(0, 3).map((e) => e.id);
  const mk = (id: string, employeeId: string | undefined, category: Category, merchant: string, ago: number, lines: [string, number][], description: string, status: ClaimStatus, extra: Partial<Claim> = {}): Claim[] =>
    employeeId ? [{ id, employeeId, category, merchant, purchaseDate: daysAgo(ago), description, status, filedAt: `${daysAgo(Math.max(0, ago - 1))}T09:30:00`, ...sampleReceipt(merchant, daysAgo(ago), lines), ...extra }] : [];
  return [
    ...mk("rb-1", "MSMA-00482", "Office supplies", "National Book Store", 3, [["Bond paper A4 x2", 590], ["Ballpen black x12", 216], ["Folder long x20", 340]], "Supplies for the Q4 tax filing binders", "pending"),
    ...mk("rb-2", "MSMA-00482", "Transportation", "Grab Philippines", 18, [["GrabCar BIR RDO 81", 285], ["Booking fee", 25]], "Ride to BIR Cebu to file a client's 1702-Q", "approved", { decidedBy: "Dinah Marquez", decidedAt: `${daysAgo(16)}T14:10:00`, note: "Included in the next payroll." }),
    ...mk("rb-3", others[0], "Meals & client meetings", "Casa Verde Lahug", 2, [["Brian's Ribs", 595], ["Pasta Pomodoro", 385], ["Iced tea x3", 285]], "Lunch meeting with a new audit client", "pending"),
    ...mk("rb-4", others[1], "Communication", "Smart Communications", 5, [["Prepaid load (client calls)", 500]], "Load for client follow-ups while on field work", "pending"),
    ...mk("rb-5", others[2], "Training & seminars", "PICPA Cebu Chapter", 25, [["CPD seminar: TRAIN law update", 2500]], "CPD units for license renewal", "approved", { decidedBy: "Dinah Marquez", decidedAt: `${daysAgo(22)}T10:00:00` }),
  ];
}

function load(): Claim[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Claim[];
  } catch {
    // Storage blocked or corrupt: start from the samples.
  }
  return seed();
}

export let claims: Claim[] = load();

/** Saves the claims; false when storage is full (receipt photos are the heavy part). */
export function saveClaims(next: Claim[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    claims = next;
    return true;
  } catch {
    return false;
  }
}
