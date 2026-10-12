// The client's subscription: plan, seats, billing and payments. Our System Admins manage it; the
// client's Super Admin can see it. Kept in this browser like the other mock stores.
// TODO(backend): billing lives with us (the vendor), not in the client's data.

import { deny } from "../session";
import { admin, roleOf } from "./store";

export type Plan = "Trial" | "Starter" | "Standard" | "Enterprise";
export type SubStatus = "Trial" | "Active" | "Past due" | "Suspended" | "Cancelled";
export type Cycle = "Monthly" | "Yearly";

export const PLANS: { plan: Plan; perSeat: number; note: string }[] = [
  { plan: "Trial", perSeat: 0, note: "30 days, everything on" },
  { plan: "Starter", perSeat: 99, note: "People, leave, attendance" },
  { plan: "Standard", perSeat: 149, note: "Plus payroll and reports" },
  { plan: "Enterprise", perSeat: 199, note: "Plus priority support" },
];
export const SUB_STATUSES: SubStatus[] = ["Trial", "Active", "Past due", "Suspended", "Cancelled"];

export interface Payment {
  id: string;
  date: string;
  amount: number;
  reference: string;
  note?: string;
}

export interface Subscription {
  client: string;
  plan: Plan;
  status: SubStatus;
  cycle: Cycle;
  /** 0 = no limit. */
  seatLimit: number;
  /** Peso per seat per month. */
  perSeat: number;
  startedOn: string;
  renewsOn: string;
  billingContact: string;
  billingEmail: string;
  notes: string;
  payments: Payment[];
}

const KEY = "subscription";

function seed(): Subscription {
  return {
    client: "Mora, Sanchez, Meñoza and Associates",
    plan: "Standard",
    status: "Active",
    cycle: "Yearly",
    seatLimit: 50,
    perSeat: 149,
    startedOn: "2026-01-15",
    renewsOn: "2027-01-15",
    billingContact: "Rheneir P. Mora",
    billingEmail: "billing@msma.ph",
    notes: "",
    payments: [{ id: "p1", date: "2026-01-15", amount: 89_400, reference: "OR-2026-0012", note: "Year 1, 50 seats" }],
  };
}

let sub: Subscription = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...seed(), ...(JSON.parse(raw) as Subscription) };
  } catch {
    // Start fresh.
  }
  return seed();
})();

const save = (next: Subscription) => {
  sub = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Kept for this visit only.
  }
};

const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), 150));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), 150));

/** Client accounts take a seat (active or turned off); our System Admin accounts don't. */
export function seatsUsed() {
  return admin.accounts.filter((a) => roleOf(a)?.key !== "system_admin").length;
}

/** Why a new client account can't be added right now, or null. */
export function seatProblem(): string | null {
  if (sub.status === "Suspended" || sub.status === "Cancelled") return `The subscription is ${sub.status.toLowerCase()}, so no accounts can be added.`;
  if (sub.seatLimit > 0 && seatsUsed() >= sub.seatLimit) return `All ${sub.seatLimit} seats are used. Ask us to add seats first.`;
  return null;
}

export function getSubscription(): Promise<Subscription & { seatsUsed: number }> {
  const denied = deny("subscription", "view");
  if (denied) return denied;
  return respond({ ...sub, seatsUsed: seatsUsed() });
}

export function updateSubscription(patch: Partial<Omit<Subscription, "payments">>): Promise<Subscription> {
  const denied = deny("subscription", "edit");
  if (denied) return denied;
  if (patch.seatLimit !== undefined && (patch.seatLimit < 0 || !Number.isInteger(patch.seatLimit))) return fail("Seats must be a whole number (0 for no limit).");
  if (patch.renewsOn !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.renewsOn)) return fail("Pick a renewal date.");
  save({ ...sub, ...patch });
  return respond(sub);
}

export function recordPayment(p: Omit<Payment, "id">): Promise<Subscription> {
  const denied = deny("subscription", "create");
  if (denied) return denied;
  if (!(p.amount > 0)) return fail("Enter the amount paid.");
  if (!p.reference.trim()) return fail("Enter the receipt or reference number.");
  save({ ...sub, payments: [{ ...p, reference: p.reference.trim(), id: `p-${Date.now().toString(36)}` }, ...sub.payments] });
  return respond(sub);
}
