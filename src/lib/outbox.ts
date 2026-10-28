// Email and text messages the system sends. A browser can't send them itself, so until the server
// is connected they wait here, in the order they'd go out; the Super Admin sees them on
// Administration › Outbox. Each person's Settings › Notifications choices are respected.
// With the API server the messages are queued on the database instead: the server looks up each
// person's address and notification settings itself, and nothing sends them yet.

import { admin } from "./admin/store";
import { fullName, state as core } from "./corehr/store";
import { remoteApi, remoteOn } from "./remote";
import { can } from "./permissions";
import { sessionWho } from "./session";
import { settingsFor, type NotificationEvent } from "./settings/store";

export type MessageEvent = NotificationEvent | "wfh" | "payslip" | "policy" | "separation" | "documents";

export interface OutboxMessage {
  id: string;
  channel: "email" | "sms";
  /** Name, plus the address or number it goes to. */
  to: string;
  address: string;
  subject: string;
  body: string;
  event: MessageEvent;
  at: string;
  status: "waiting";
}

const KEY = "heyhr-outbox-v1";
const KEEP = 300;

// With a server, messages (and the addresses in them) are never kept in this browser: drop any left from before.
if (remoteOn()) {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Blocked storage: nothing to drop.
  }
}

function load(): OutboxMessage[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as OutboxMessage[];
  } catch {
    // Blocked or corrupt storage: start empty.
  }
  return [];
}

/** Does this employee want email for this event? People without a login, or events Settings doesn't list, get it. */
function wantsEmail(employeeId: string, event: MessageEvent) {
  const account = admin.accounts.find((a) => a.employeeId === employeeId);
  if (!account) return true;
  const prefs = settingsFor(account.id).notifications;
  const row = (prefs.matrix as Record<string, { email: boolean } | undefined>)[event];
  return row ? row.email : true;
}

/** Queue an email (and optionally a text) to an employee. Missing addresses are skipped. */
export function notifyEmployee(employeeId: string | undefined, event: MessageEvent, subject: string, body: string, sms?: string) {
  // With the API server or the backend: queued there, which looks up the address (none kept in this browser).
  if (remoteOn()) {
    if (employeeId) queueRemote({ employeeId, event, subject, body, ...(sms ? { sms } : {}) });
    return;
  }
  const e = core.employees.find((x) => x.id === employeeId);
  if (!e) return;
  const name = fullName(e.personal);
  const at = new Date().toISOString();
  const out: OutboxMessage[] = [];
  const id = () => `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  if (e.contact.workEmail && wantsEmail(e.id, event)) out.push({ id: id(), channel: "email", to: name, address: e.contact.workEmail, subject, body, event, at, status: "waiting" });
  if (sms && e.contact.mobile) out.push({ id: id(), channel: "sms", to: name, address: e.contact.mobile, subject: "Text message", body: sms, event, at, status: "waiting" });
  if (!out.length) return;
  try {
    localStorage.setItem(KEY, JSON.stringify([...out, ...load()].slice(0, KEEP)));
  } catch {
    // Storage full: the message is lost, as it would be if the mail server were down.
  }
}

// With the API server, messages queued in one go (e.g. every payslip in a run) go up in one request.
// Like a mail server that's down, a failure only loses the message; it never stops what queued it.
let pending: { employeeId: string; event: MessageEvent; subject: string; body: string; sms?: string }[] = [];
let sending: Promise<void> = Promise.resolve();
function queueRemote(m: (typeof pending)[number]) {
  pending.push(m);
  if (pending.length > 1) return;
  sending = Promise.resolve().then(async () => {
    const messages = pending;
    pending = [];
    for (let i = 0; i < messages.length; i += 1000) await remoteApi("POST", "/outbox", { messages: messages.slice(i, i + 1000) }).catch((e) => console.warn(e));
  });
}
let clearing: Promise<unknown> = Promise.resolve();

/** The employee's manager (who they report to), for request alerts. */
export const managerOf = (employeeId: string) => core.employees.find((e) => e.id === employeeId)?.job.supervisorId;

export const nameOf = (employeeId: string) => {
  const e = core.employees.find((x) => x.id === employeeId);
  return e ? fullName(e.personal) : employeeId;
};

export function listOutbox(): Promise<OutboxMessage[]> {
  if (!can(sessionWho(), "view", "systemSettings")) return Promise.reject(Object.assign(new Error("You don't have access to this."), { status: 403 }));
  if (remoteOn()) return Promise.all([sending, clearing]).then(() => remoteApi<OutboxMessage[]>("GET", "/outbox"));
  return new Promise((r) => setTimeout(() => r(load()), 150));
}

export function clearOutbox() {
  // The list waits for this before it reloads.
  if (remoteOn()) return void (clearing = remoteApi("DELETE", "/outbox").catch((e) => console.warn(e)));
  localStorage.removeItem(KEY);
}
