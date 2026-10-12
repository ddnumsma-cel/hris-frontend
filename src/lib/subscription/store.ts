// Subscription data: plans, the clients on them, and a log of seat alerts, blocked adds and
// upgrade requests. Saved to localStorage like the other stores.
//
// Seat counts are never stored: they're worked out from the records every time (usageOf), so they
// can't drift. One seat = one employee record that isn't Separated (On leave and Suspended still
// count). Admin accounts = active logins holding the HR, Approver or Accounting role.

import { admin } from "../admin/store";
import { state as core } from "../corehr/store";
import type { RoleKey } from "../permissions";

export interface Plan {
  id: string;
  name: string;
  employeeSeatLimit: number;
  adminAccountLimit: number;
  /** Overage allowed past the limit before new adds are refused, in percent (rounded down to whole seats). */
  gracePercent: number;
}

export interface Client {
  id: string;
  name: string;
  planId: string;
  /** yyyy-mm-dd */
  renewalDate: string;
  /** Replaces the plan's employee seat limit when set. */
  seatLimitOverride?: number;
  /** Temporary extra seats, until (and including) a date. */
  extension?: { seats: number; until: string };
  /** The highest seat threshold already announced (0 / 80 / 90 / 100), so each crossing is told once. */
  lastSeatLevel: SeatLevel;
  /** The highest seat threshold Super Admins and HR were notified about (missing = none yet). */
  lastSeatAlert?: SeatLevel;
}

export type SeatLevel = 0 | 80 | 90 | 100;

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
const VERSION = 1;

/** The roles that take an admin account. */
export const ADMIN_ROLES: RoleKey[] = ["hr", "approver", "accounting"];

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
    clients: [{ id: DEMO_CLIENT_ID, name: admin.settings.companyName || "MSMA Group", planId: "plan-starter", renewalDate: "2027-01-31", lastSeatLevel: 0 }],
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

export type SeatStatus = "ok" | "near" | "at" | "grace" | "over";

export interface Usage {
  clientId: string;
  clientName: string;
  planId: string;
  planName: string;
  renewalDate: string;
  seatsUsed: number;
  /** The limit in force: override or plan, plus any running extension. */
  seatLimit: number;
  /** Highest count new adds may reach (limit + grace). */
  seatCap: number;
  adminsUsed: number;
  adminLimit: number;
  adminCap: number;
  gracePercent: number;
  seatLimitOverride?: number;
  extension?: { seats: number; until: string };
  status: SeatStatus;
  adminStatus: SeatStatus;
}

const today = () => new Date().toISOString().slice(0, 10);
const capOf = (limit: number, grace: number) => limit + Math.floor((limit * grace) / 100);

export function statusOf(used: number, limit: number, cap: number): SeatStatus {
  if (used > cap) return "over";
  if (used > limit) return "grace";
  if (used >= limit) return "at";
  if (used >= limit * 0.8) return "near";
  return "ok";
}

export const seatsUsed = () => core.employees.filter((e) => e.job.status !== "Separated").length;

export function adminsUsed() {
  return admin.accounts.filter((a) => a.status === "active" && ADMIN_ROLES.includes(admin.roles.find((r) => r.id === a.roleId)?.key as RoleKey)).length;
}

export function usageOf(client: Client): Usage {
  const plan = sub.plans.find((p) => p.id === client.planId) ?? sub.plans[0]!;
  const extension = client.extension && client.extension.until >= today() ? client.extension : undefined;
  const seatLimit = (client.seatLimitOverride ?? plan.employeeSeatLimit) + (extension?.seats ?? 0);
  const seatCap = capOf(seatLimit, plan.gracePercent);
  const adminCap = capOf(plan.adminAccountLimit, plan.gracePercent);
  const seats = seatsUsed();
  const admins = adminsUsed();
  return {
    clientId: client.id,
    clientName: client.name,
    planId: plan.id,
    planName: plan.name,
    renewalDate: client.renewalDate,
    seatsUsed: seats,
    seatLimit,
    seatCap,
    adminsUsed: admins,
    adminLimit: plan.adminAccountLimit,
    adminCap,
    gracePercent: plan.gracePercent,
    seatLimitOverride: client.seatLimitOverride,
    extension: client.extension,
    status: statusOf(seats, seatLimit, seatCap),
    adminStatus: statusOf(admins, plan.adminAccountLimit, adminCap),
  };
}

/** The signed-in company's client record. */
export const currentClient = () => sub.clients.find((c) => c.id === DEMO_CLIENT_ID) ?? sub.clients[0]!;

export const seatLevelOf = (u: Usage): SeatLevel => (u.seatsUsed >= u.seatLimit ? 100 : u.seatsUsed >= u.seatLimit * 0.9 ? 90 : u.seatsUsed >= u.seatLimit * 0.8 ? 80 : 0);

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
