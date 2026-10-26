// Subscription mock API: seat checks used by the employee and account create calls, the
// threshold alerts, the Subscription card (Super Admin, HR) and Clients & Subscriptions (System
// Admin). Every endpoint asks deny() first, so Approver, Accounting and Employee get a 403.
//
// With the API server (serverMode) the plan, the counts, the checks and the event log live on the
// server (server/src/subscription.ts): it checks seats inside the add's own transaction, under a
// lock, so two adds can't both take the last seat, and it remembers which seat alerts were sent.
// Without it, the check and the save run in one synchronous step, which gives the same guarantee
// in one browser.

import { api, serverMode } from "../http";
import { notifyRoles } from "../notifications";
import { deny } from "../session";
import { tellRoles } from "../requestNotices";
import { adminLimitMessage, blockedAlert, blockedEventText, companySeatAlert, extensionNotice, overrideNotice, planNotice, platformSeatAlert, seatLimitMessage, seatsText, upgradeAlert } from "./rules";
import { currentClient, logEvent, saveSub, seatLevelOf, sub, usageOf, type Client, type Plan, type SeatLevel, type SubscriptionEvent, type Usage } from "./store";

const DELAY = 250;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));

export type { Plan, SubscriptionEvent, Usage } from "./store";

/** Adding employees would go past the seat limit plus grace. Like an HTTP 409 with a code. */
export class SeatLimitError extends Error {
  readonly status = 409;
  readonly code = "SEAT_LIMIT_REACHED";
  readonly usage: Usage;
  constructor(message: string, usage: Usage) {
    super(message);
    this.usage = usage;
    this.name = "SeatLimitError";
  }
}

/** Giving another HR / Approver / Accounting login would go past the plan's admin accounts. */
export class AdminLimitError extends Error {
  readonly status = 409;
  readonly code = "ADMIN_LIMIT_REACHED";
  readonly usage: Usage;
  constructor(message: string, usage: Usage) {
    super(message);
    this.usage = usage;
    this.name = "AdminLimitError";
  }
}

/** Also true for the server's 409 (an ApiError carrying the same code). */
export const isSeatLimitError = (e: unknown): e is SeatLimitError => e instanceof Error && (e as SeatLimitError).code === "SEAT_LIMIT_REACHED";

const SYSADMIN_LINK = { system_admin: "/admin/administration/subscription" };
const COMPANY_LINK = { super_admin: "/admin/settings/subscription", hr: "/admin/settings/subscription" };

/** The server's usage plus the seat alerts it just recorded (each crossing comes back once). */
type ServerUsage = Usage & { alerts?: { company?: SeatLevel; platform?: SeatLevel } };

/** The plain usage; the server already sent its seat alerts to the bell. */
function alertsFrom({ alerts: _alerts, ...u }: ServerUsage): Usage {
  return u;
}

// ---- Checks used inside other endpoints (synchronous, so check + save can't interleave) ----

/**
 * Throws SeatLimitError when adding this many employees would pass the limit plus grace. A
 * refused add is logged and System Admins are told. `count` > 1 is a bulk import.
 */
export function assertSeatsAvailable(count = 1) {
  // With the API server, the server checks inside the add itself (409 SEAT_LIMIT_REACHED).
  if (serverMode) return;
  const client = currentClient();
  const u = usageOf(client);
  if (u.seatsUsed + count <= u.seatCap) return;
  const message = seatLimitMessage(u, count);
  logEvent(client, "blocked", blockedEventText(u, count));
  const n = blockedAlert(u, count);
  notifyRoles(["system_admin"], n.title, n.body, SYSADMIN_LINK);
  throw new SeatLimitError(message, u);
}

/** Throws AdminLimitError when one more HR / Approver / Accounting login would pass the plan's limit plus grace. */
export function assertAdminAccountAvailable() {
  // With the API server, the server checks inside the account change (409 ADMIN_LIMIT_REACHED).
  if (serverMode) return;
  const client = currentClient();
  const u = usageOf(client);
  if (u.adminsUsed + 1 <= u.adminCap) return;
  logEvent(client, "blocked", "Admin account refused: plan's admin accounts are used up");
  throw new AdminLimitError(adminLimitMessage(u), u);
}

/**
 * Sends the seat alerts once per crossing: 80% only shows the banner (and is logged); 90% tells
 * Super Admins and HR, and System Admins; 100% tells System Admins with the client, plan and
 * usage. Falling back under a threshold re-arms it. Call after anything that changes the count.
 */
export function checkSeatThresholds() {
  // With the API server, the server keeps the levels and reports new crossings with the usage.
  if (serverMode) return;
  const client = currentClient();
  const u = usageOf(client);
  const level = seatLevelOf(u);
  alertCompany(client.id, u, level);
  const last = client.lastSeatLevel;
  if (level === last) return;
  saveSub({ ...sub, clients: sub.clients.map((c) => (c.id === client.id ? { ...c, lastSeatLevel: level } : c)) });
  if (level < last) return;
  const updated = currentClient();
  logEvent(updated, "threshold", `Reached ${level}% of employee seats (${seatsText(u)})`);
  if (level === 100) tellPlatform(u, 100);
  else if (level >= 90 && last < 90) tellPlatform(u, 90);
}

/** Tells System Admins that a client reached 90% or 100% of its seats. */
function tellPlatform(u: Usage, level: SeatLevel) {
  const n = platformSeatAlert(u, level);
  notifyRoles(["system_admin"], n.title, n.body, SYSADMIN_LINK);
}

/**
 * Tells Super Admins and HR, in their bell, that seats are almost full (80%, then 90%) and when
 * they're all used. Once per level; dropping back below a level lets it be told again.
 */
function alertCompany(clientId: string, u: Usage, level: SeatLevel) {
  const alerted = sub.clients.find((c) => c.id === clientId)?.lastSeatAlert ?? 0;
  if (level === alerted) return;
  saveSub({ ...sub, clients: sub.clients.map((c) => (c.id === clientId ? { ...c, lastSeatAlert: level } : c)) });
  if (level < alerted || level === 0) return;
  tellCompany(u, level);
}

/** The Super Admin and HR bell message for reaching 80%, 90% or 100% of the seats. */
function tellCompany(u: Usage, level: SeatLevel) {
  const n = companySeatAlert(u, level);
  notifyRoles(["super_admin", "hr"], n.title, n.body, COMPANY_LINK);
}

/**
 * Asked when someone starts adding an employee (Add employee button, the form opening): resolves
 * when a seat is free, otherwise rejects with SeatLimitError, which is logged and tells System
 * Admins like a refused save. The create call still checks again.
 */
export async function checkSeatAvailable(): Promise<void> {
  const denied = deny("people", "create");
  if (denied) return denied;
  if (serverMode) return void (await api("POST", "/subscription/seat-check", {}));
  try {
    assertSeatsAvailable(1);
  } catch (err) {
    return Promise.reject(err);
  }
  return respond(undefined);
}

// ---- The company's own subscription (Super Admin, HR) ----

export async function getSubscription(): Promise<Usage> {
  const denied = deny("subscription", "view");
  if (denied) return denied;
  if (serverMode) return alertsFrom(await api<ServerUsage>("GET", "/subscription"));
  checkSeatThresholds();
  return respond(usageOf(currentClient()));
}

export async function requestUpgrade(note: string, actor: string): Promise<void> {
  const denied = deny("subscriptionUpgrade", "create");
  if (denied) return denied;
  const text = note.trim();
  // With the API server, the server logs it and tells System Admins.
  if (serverMode) return void (await api<Usage>("POST", "/subscription/upgrade-requests", { note: text }));
  const u = usageOf(currentClient());
  logEvent(currentClient(), "upgrade-request", `Upgrade requested${text ? `: "${text}"` : ""}`, actor);
  const n = upgradeAlert(u, actor, text);
  notifyRoles(["system_admin"], n.title, n.body, SYSADMIN_LINK);
  return respond(undefined);
}

// ---- Clients & Subscriptions (System Admin) ----

export async function listClients(): Promise<Usage[]> {
  const denied = deny("clients", "view");
  if (denied) return denied;
  if (serverMode) return (await api<ServerUsage[]>("GET", "/subscription/clients")).map(alertsFrom);
  checkSeatThresholds();
  return respond(sub.clients.map(usageOf));
}

export async function listPlans(): Promise<Plan[]> {
  const denied = deny("clients", "view");
  if (denied) return denied;
  if (serverMode) return api<Plan[]>("GET", "/subscription/plans");
  return respond(sub.plans);
}

export async function listSubscriptionEvents(): Promise<(SubscriptionEvent & { clientName: string })[]> {
  const denied = deny("clients", "view");
  if (denied) return denied;
  if (serverMode) return api<(SubscriptionEvent & { clientName: string })[]>("GET", "/subscription/events");
  return respond(sub.events.map((e) => ({ ...e, clientName: sub.clients.find((c) => c.id === e.clientId)?.name ?? e.clientId })));
}

function updateClient(id: string, change: (c: Client) => Client) {
  saveSub({ ...sub, clients: sub.clients.map((c) => (c.id === id ? change(c) : c)) });
  return sub.clients.find((c) => c.id === id)!;
}

const tellNotice = (kind: "approved" | "update", n: { title: string; body: string }) => tellRoles(["super_admin", "hr"], "subscription", kind, n.title, n.body);
const tellPlan = (plan: Plan, from: string) => tellNotice("approved", planNotice(plan, from));
const tellOverride = (seats: number | null) => tellNotice("update", overrideNotice(seats));
const tellExtension = (input: { seats: number; until: string } | null) => tellNotice(input ? "approved" : "update", extensionNotice(input));

export async function changePlan(clientId: string, planId: string, actor: string): Promise<void> {
  const denied = deny("clients", "edit");
  if (denied) return denied;
  if (serverMode) {
    // The server tells Super Admins and HR, and sends any seat alerts.
    await api<{ plan: Plan; from: string; usage: ServerUsage }>("PUT", `/subscription/clients/${encodeURIComponent(clientId)}/plan`, { planId });
    return;
  }
  const client = sub.clients.find((c) => c.id === clientId);
  const plan = sub.plans.find((p) => p.id === planId);
  if (!client) return fail("That client no longer exists");
  if (!plan) return fail("Choose a plan");
  const from = sub.plans.find((p) => p.id === client.planId)?.name ?? "No plan";
  const updated = updateClient(clientId, (c) => ({ ...c, planId }));
  logEvent(updated, "plan-changed", `Plan changed: ${from} → ${plan.name}`, actor);
  tellPlan(plan, from);
  checkSeatThresholds();
  return respond(undefined);
}

export async function setSeatOverride(clientId: string, seats: number | null, actor: string): Promise<void> {
  const denied = deny("clients", "edit");
  if (denied) return denied;
  if (serverMode) {
    await api<ServerUsage>("PUT", `/subscription/clients/${encodeURIComponent(clientId)}/seat-override`, { seats });
    return;
  }
  if (!sub.clients.some((c) => c.id === clientId)) return fail("That client no longer exists");
  if (seats !== null && (!Number.isInteger(seats) || seats < 1 || seats > 100000)) return fail("Enter a whole number of seats, 1 or more");
  const updated = updateClient(clientId, (c) => ({ ...c, seatLimitOverride: seats ?? undefined }));
  tellOverride(seats);
  logEvent(updated, "seat-override", seats === null ? "Seat limit override removed (plan limit applies)" : `Seat limit overridden to ${seats}`, actor);
  checkSeatThresholds();
  return respond(undefined);
}

export async function grantExtension(clientId: string, input: { seats: number; until: string } | null, actor: string): Promise<void> {
  const denied = deny("clients", "edit");
  if (denied) return denied;
  if (serverMode) {
    await api<ServerUsage>("PUT", `/subscription/clients/${encodeURIComponent(clientId)}/extension`, { extension: input });
    return;
  }
  if (!sub.clients.some((c) => c.id === clientId)) return fail("That client no longer exists");
  if (input) {
    if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 10000) return fail("Enter how many extra seats, 1 or more");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.until)) return fail("Choose when the extension ends");
    if (input.until < new Date().toISOString().slice(0, 10)) return fail("The end date can't be in the past");
  }
  const updated = updateClient(clientId, (c) => ({ ...c, extension: input ?? undefined }));
  tellExtension(input);
  logEvent(updated, "extension", input ? `Temporary extension: +${input.seats} seats until ${input.until}` : "Temporary extension ended", actor);
  checkSeatThresholds();
  return respond(undefined);
}
