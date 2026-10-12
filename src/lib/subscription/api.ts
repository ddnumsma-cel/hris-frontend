// Subscription mock API: seat checks used by the employee and account create calls, the
// threshold alerts, the Subscription card (Super Admin, HR) and Clients & Subscriptions (System
// Admin). Every endpoint asks deny() first, so Approver, Accounting and Employee get a 403.
//
// TODO(backend): run assertSeatsAvailable and the insert in one transaction that locks the
// client row (SELECT … FOR UPDATE), so two adds at once can't both take the last seat. Here the
// check and the save run in one synchronous step, which gives the same guarantee in one browser.

import { notifyRoles } from "../notifications";
import { deny } from "../session";
import { tellRoles } from "../requestNotices";
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

export const isSeatLimitError = (e: unknown): e is SeatLimitError => e instanceof Error && (e as SeatLimitError).code === "SEAT_LIMIT_REACHED";

const SYSADMIN_LINK = { system_admin: "/admin/administration/subscription" };
const COMPANY_LINK = { super_admin: "/admin/settings/subscription", hr: "/admin/settings/subscription" };
const seatsText = (u: Usage) => `${u.seatsUsed} of ${u.seatLimit} employee seats`;

// ---- Checks used inside other endpoints (synchronous, so check + save can't interleave) ----

/**
 * Throws SeatLimitError when adding this many employees would pass the limit plus grace. A
 * refused add is logged and System Admins are told. `count` > 1 is a bulk import.
 */
export function assertSeatsAvailable(count = 1) {
  const client = currentClient();
  const u = usageOf(client);
  if (u.seatsUsed + count <= u.seatCap) return;
  const free = Math.max(0, u.seatCap - u.seatsUsed);
  const message =
    count > 1
      ? `This import has ${count} employees but only ${free} ${free === 1 ? "seat is" : "seats are"} available.`
      : `Seat limit reached. ${client.name} is using ${seatsText(u)}${u.seatCap > u.seatLimit ? `, and the ${u.gracePercent}% grace is used up` : ""}.`;
  logEvent(client, "blocked", count > 1 ? `Import of ${count} employees refused (${free} seats free)` : "Add employee refused: no seats left");
  notifyRoles(
    ["system_admin"],
    `${client.name}: add employee blocked`,
    `${client.name} (${u.planName}) tried to add ${count === 1 ? "an employee" : `${count} employees`} at ${seatsText(u)} (${u.seatCap} with grace).`,
    SYSADMIN_LINK,
  );
  throw new SeatLimitError(message, u);
}

/** Throws AdminLimitError when one more HR / Approver / Accounting login would pass the plan's limit plus grace. */
export function assertAdminAccountAvailable() {
  const client = currentClient();
  const u = usageOf(client);
  if (u.adminsUsed + 1 <= u.adminCap) return;
  logEvent(client, "blocked", "Admin account refused: plan's admin accounts are used up");
  throw new AdminLimitError(`Admin account limit reached. ${client.name} is using ${u.adminsUsed} of ${u.adminLimit} admin accounts (HR, Approver and Accounting logins). Ask your System Admin to upgrade the plan.`, u);
}

/**
 * Sends the seat alerts once per crossing: 80% only shows the banner (and is logged); 90% tells
 * Super Admins and HR, and System Admins; 100% tells System Admins with the client, plan and
 * usage. Falling back under a threshold re-arms it. Call after anything that changes the count.
 */
export function checkSeatThresholds() {
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
  if (level === 100) {
    notifyRoles(["system_admin"], `${updated.name} is at its seat limit`, `${updated.name} (${u.planName}) is using ${seatsText(u)} and ${u.adminsUsed} of ${u.adminLimit} admin accounts.`, SYSADMIN_LINK);
  } else if (level >= 90 && last < 90) {
    notifyRoles(["system_admin"], `${updated.name} is at 90% of its seats`, `${updated.name} (${u.planName}) is using ${seatsText(u)} and ${u.adminsUsed} of ${u.adminLimit} admin accounts.`, SYSADMIN_LINK);
  }
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
  const planLeft = Math.max(0, u.seatLimit - u.seatsUsed);
  const left = Math.max(0, u.seatCap - u.seatsUsed);
  const seats = (n: number) => `${n} ${n === 1 ? "seat" : "seats"}`;
  const after = "Payroll, attendance and leave keep working. A Super Admin can request more seats from the seat counter at the top of the page.";
  if (level === 100) {
    const now = left ? `You can add ${left === 1 ? "1 more employee" : `${left} more employees`} for now, then adding stops.` : "New employees can't be added until the plan is upgraded.";
    notifyRoles(["super_admin", "hr"], "All employee seats are used", `You've used all ${u.seatLimit} seats on your ${u.planName} plan. ${now} ${after}`, COMPANY_LINK);
    return;
  }
  notifyRoles(
    ["super_admin", "hr"],
    level === 90 ? `Only ${seats(planLeft)} left` : "Employee seats are almost full",
    `You've used ${u.seatsUsed} of your ${u.seatLimit} seats, so ${seats(planLeft)} ${planLeft === 1 ? "is" : "are"} left. When they run out, you can't add new employees. ${after}`,
    COMPANY_LINK,
  );
}

/**
 * Asked when someone starts adding an employee (Add employee button, the form opening): resolves
 * when a seat is free, otherwise rejects with SeatLimitError, which is logged and tells System
 * Admins like a refused save. The create call still checks again.
 */
export async function checkSeatAvailable(): Promise<void> {
  const denied = deny("people", "create");
  if (denied) return denied;
  try {
    assertSeatsAvailable(1);
  } catch (err) {
    return Promise.reject(err);
  }
  return respond(undefined);
}

// ---- The company's own subscription (Super Admin, HR) ----

export function getSubscription(): Promise<Usage> {
  const denied = deny("subscription", "view");
  if (denied) return denied;
  checkSeatThresholds();
  return respond(usageOf(currentClient()));
}

export async function requestUpgrade(note: string, actor: string): Promise<void> {
  const denied = deny("subscriptionUpgrade", "create");
  if (denied) return denied;
  const client = currentClient();
  const u = usageOf(client);
  const text = note.trim();
  logEvent(client, "upgrade-request", `Upgrade requested${text ? `: "${text}"` : ""}`, actor);
  notifyRoles(
    ["system_admin"],
    `${client.name} requested an upgrade`,
    `${actor} asked to upgrade from ${u.planName}. Using ${seatsText(u)} and ${u.adminsUsed} of ${u.adminLimit} admin accounts.${text ? ` Note: ${text}` : ""}`,
    SYSADMIN_LINK,
  );
  return respond(undefined);
}

// ---- Clients & Subscriptions (System Admin) ----

export function listClients(): Promise<Usage[]> {
  const denied = deny("clients", "view");
  if (denied) return denied;
  checkSeatThresholds();
  return respond(sub.clients.map(usageOf));
}

export function listPlans(): Promise<Plan[]> {
  const denied = deny("clients", "view");
  if (denied) return denied;
  return respond(sub.plans);
}

export function listSubscriptionEvents(): Promise<(SubscriptionEvent & { clientName: string })[]> {
  const denied = deny("clients", "view");
  if (denied) return denied;
  return respond(sub.events.map((e) => ({ ...e, clientName: sub.clients.find((c) => c.id === e.clientId)?.name ?? e.clientId })));
}

function updateClient(id: string, change: (c: Client) => Client) {
  saveSub({ ...sub, clients: sub.clients.map((c) => (c.id === id ? change(c) : c)) });
  return sub.clients.find((c) => c.id === id)!;
}

export async function changePlan(clientId: string, planId: string, actor: string): Promise<void> {
  const denied = deny("clients", "edit");
  if (denied) return denied;
  const client = sub.clients.find((c) => c.id === clientId);
  const plan = sub.plans.find((p) => p.id === planId);
  if (!client) return fail("That client no longer exists");
  if (!plan) return fail("Choose a plan");
  const from = sub.plans.find((p) => p.id === client.planId)?.name ?? "No plan";
  const updated = updateClient(clientId, (c) => ({ ...c, planId }));
  logEvent(updated, "plan-changed", `Plan changed: ${from} → ${plan.name}`, actor);
  tellRoles(["super_admin", "hr"], "subscription", "approved", `Your plan is now ${plan.name}`, `Changed from ${from}: ${plan.employeeSeatLimit} employee seats and ${plan.adminAccountLimit} admin accounts.`);
  checkSeatThresholds();
  return respond(undefined);
}

export async function setSeatOverride(clientId: string, seats: number | null, actor: string): Promise<void> {
  const denied = deny("clients", "edit");
  if (denied) return denied;
  if (!sub.clients.some((c) => c.id === clientId)) return fail("That client no longer exists");
  if (seats !== null && (!Number.isInteger(seats) || seats < 1 || seats > 100000)) return fail("Enter a whole number of seats, 1 or more");
  const updated = updateClient(clientId, (c) => ({ ...c, seatLimitOverride: seats ?? undefined }));
  tellRoles(["super_admin", "hr"], "subscription", "update", seats === null ? "Your seat limit is back to the plan's" : `Your seat limit is now ${seats}`, "Set by our team. See Settings › Subscription.");
  logEvent(updated, "seat-override", seats === null ? "Seat limit override removed (plan limit applies)" : `Seat limit overridden to ${seats}`, actor);
  checkSeatThresholds();
  return respond(undefined);
}

export async function grantExtension(clientId: string, input: { seats: number; until: string } | null, actor: string): Promise<void> {
  const denied = deny("clients", "edit");
  if (denied) return denied;
  if (!sub.clients.some((c) => c.id === clientId)) return fail("That client no longer exists");
  if (input) {
    if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 10000) return fail("Enter how many extra seats, 1 or more");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.until)) return fail("Choose when the extension ends");
    if (input.until < new Date().toISOString().slice(0, 10)) return fail("The end date can't be in the past");
  }
  const updated = updateClient(clientId, (c) => ({ ...c, extension: input ?? undefined }));
  tellRoles(["super_admin", "hr"], "subscription", input ? "approved" : "update", input ? `${input.seats} extra seats until ${input.until}` : "Your extra seats ended", input ? "A temporary extension from our team while your upgrade is arranged." : "The temporary extension is over; your plan's limit applies.");
  logEvent(updated, "extension", input ? `Temporary extension: +${input.seats} seats until ${input.until}` : "Temporary extension ended", actor);
  checkSeatThresholds();
  return respond(undefined);
}
