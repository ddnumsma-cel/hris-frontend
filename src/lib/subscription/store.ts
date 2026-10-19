// Subscription data: plans, the clients on them, and a log of seat alerts, blocked adds and
// upgrade requests. Saved to localStorage like the other stores.
//
// Seat counts are never stored: they're worked out from the records every time (usageOf), so they
// can't drift. One seat = one employee record that isn't Separated (On leave and Suspended still
// count). Admin accounts = active logins holding the HR, Approver or Accounting role.

import { admin } from "../admin/store";
import { state as core } from "../corehr/store";
import type { RoleKey } from "../permissions";
import { ADMIN_ROLES, usageFrom, type ClientTerms, type Plan, type SeatLevel, type Usage } from "./rules";

// The limits and statuses live in rules.ts, shared with the API server.
export { ADMIN_ROLES, capOf, seatLevelOf, statusOf } from "./rules";
export type { Plan, SeatLevel, SeatStatus, Usage } from "./rules";

export interface Client extends ClientTerms {
  planId: string;
  /** The highest seat threshold already announced (0 / 80 / 90 / 100), so each crossing is told once. */
  lastSeatLevel: SeatLevel;
  /** The highest seat threshold Super Admins and HR were notified about (missing = none yet). */
  lastSeatAlert?: SeatLevel;
}

export type SubscriptionEventKind = "threshold" | "blocked" | "upgrade-request" | "plan-changed" | "seat-override" | "extension";

export interface SubscriptionEvent {
  id: string;
  clientId: string;
  kind: SubscriptionEventKind;
  message: string;
  /** Who did it (blank for automatic alerts). */
  by?: string;
  at: string;
  /** Seats and admin accounts at that moment. */
  seats: string;
  admins: string;
}

export interface SubscriptionState {
  version: number;
  plans: Plan[];
  clients: Client[];
  events: SubscriptionEvent[];
}

const KEY = "heyhr-subscription-v1";
// v2: on the Growth plan (50 seats) for MSMA's 45 full-time employees.
const VERSION = 2;

/** The demo client is the one company this prototype holds (Core HR's top unit). */
export const DEMO_CLIENT_ID = "org-msma";

function seed(): SubscriptionState {
  return {
    version: VERSION,
    plans: [
      { id: "plan-starter", name: "Starter", employeeSeatLimit: 20, adminAccountLimit: 8, gracePercent: 5 },
      { id: "plan-growth", name: "Growth", employeeSeatLimit: 50, adminAccountLimit: 15, gracePercent: 5 },
      { id: "plan-business", name: "Business", employeeSeatLimit: 150, adminAccountLimit: 30, gracePercent: 5 },
    ],
    clients: [{ id: DEMO_CLIENT_ID, name: admin.settings.companyName || "MSMA Group", planId: "plan-growth", renewalDate: "2027-01-31", lastSeatLevel: 0 }],
    events: [],
  };
}

function load(): SubscriptionState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as SubscriptionState;
      if (saved.version === VERSION) return saved;
    }
  } catch {
    // Blocked or corrupt storage: start from the seed.
  }
  return seed();
}

export let sub: SubscriptionState = load();

export function saveSub(next: SubscriptionState) {
  sub = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the change still applies for this session.
  }
}

// ---- Usage, always computed ----

const today = () => new Date().toISOString().slice(0, 10);

export const seatsUsed = () => core.employees.filter((e) => e.job.status !== "Separated").length;

export function adminsUsed() {
  return admin.accounts.filter((a) => a.status === "active" && ADMIN_ROLES.includes(admin.roles.find((r) => r.id === a.roleId)?.key as RoleKey)).length;
}

export function usageOf(client: Client): Usage {
  const plan = sub.plans.find((p) => p.id === client.planId) ?? sub.plans[0]!;
  return usageFrom(plan, client, seatsUsed(), adminsUsed(), today());
}

/** The signed-in company's client record. */
export const currentClient = () => sub.clients.find((c) => c.id === DEMO_CLIENT_ID) ?? sub.clients[0]!;

export function logEvent(client: Client, kind: SubscriptionEventKind, message: string, by?: string) {
  const u = usageOf(client);
  const event: SubscriptionEvent = {
    id: `se-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    clientId: client.id,
    kind,
    message,
    by,
    at: new Date().toISOString(),
    seats: `${u.seatsUsed} / ${u.seatLimit}`,
    admins: `${u.adminsUsed} / ${u.adminLimit}`,
  };
  saveSub({ ...sub, events: [event, ...sub.events].slice(0, 500) });
}
