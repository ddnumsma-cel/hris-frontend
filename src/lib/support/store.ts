// Support tickets: a client's people (Super Admin, HR, Accounting, and employees for problems on
// their own side) report a problem or ask for help, and our System Admins answer, set priority and
// close them. An employee's ticket goes straight to us: only they and System Admins see it. Kept in this
// browser like the other mock stores; with the API server (remoteOn()) they're in the database
// (server/src/support.ts), where the client's people see only the tickets they filed.

import { admin, roleOf } from "../admin/store";
import { remoteApi, remoteOn } from "../remote";
import { deny } from "../session";
import { sessionWho } from "../session";
import { LIMITS, scopeFor } from "../permissions";
import { tellEmployees, tellRoles } from "../requestNotices";

export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketCategory = "Bug or error" | "How do I…" | "Account or sign-in" | "Payroll" | "Data fix" | "Billing" | "Feature request";

export const CATEGORIES: TicketCategory[] = ["Bug or error", "How do I…", "Account or sign-in", "Payroll", "Data fix", "Billing", "Feature request"];
export const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];
export const STATUSES: TicketStatus[] = ["open", "in_progress", "waiting", "resolved", "closed"];
export const STATUS_LABEL: Record<TicketStatus, string> = { open: "Open", in_progress: "In progress", waiting: "Waiting for you", resolved: "Resolved", closed: "Closed" };

export interface TicketMessage {
  id: string;
  by: string;
  /** "support" = our System Admins; "client" = the person who filed it or their colleagues. */
  side: "client" | "support";
  text: string;
  at: string;
}

export interface Ticket {
  id: string;
  number: number;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  filedBy: string;
  filedById: string;
  /** The filer's employee record, so replies reach them. */
  filedByEmployeeId?: string;
  /** The workspace it was filed from; tickets from the HR workspace are shared there, others are private. Missing = "admin". */
  workspace?: "admin" | "manager" | "employee";
  /** The page they were on, to help reproduce it. */
  page?: string;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

const KEY = "support-tickets";
const ACCOUNT_KEY = "msma-hris-account";
const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

function seed(): Ticket[] {
  return [
    {
      id: "tk-1",
      number: 1001,
      subject: "Payslip PDF cuts off the last line when printed",
      category: "Bug or error",
      priority: "normal",
      status: "in_progress",
      filedBy: "Accounting",
      filedById: "",
      page: "/admin/payroll/runs",
      assignee: "Support team",
      createdAt: day(3),
      updatedAt: day(2),
      messages: [
        { id: "m1", by: "Accounting", side: "client", text: "When we print payslips on A4, the net pay line goes to a second page.", at: day(3) },
        { id: "m2", by: "Support team", side: "support", text: "Thanks, we can see it. A fix is going out with the next update.", at: day(2) },
      ],
    },
    {
      id: "tk-2",
      number: 1002,
      subject: "How do we add a new office location?",
      category: "How do I…",
      priority: "low",
      status: "resolved",
      filedBy: "HR",
      filedById: "",
      createdAt: day(9),
      updatedAt: day(8),
      messages: [
        { id: "m1", by: "HR", side: "client", text: "We're opening a branch in Mandaue. Where do we add it?", at: day(9) },
        { id: "m2", by: "Support team", side: "support", text: "Maintenance → Locations → Add office. Departments can then be placed under it.", at: day(8) },
      ],
    },
  ];
}

function load(): Ticket[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Ticket[];
  } catch {
    // Start fresh.
  }
  return seed();
}

let tickets = load();
const save = (next: Ticket[]) => {
  tickets = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Kept for this visit only.
  }
};

const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), 150));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), 150));

/** The signed-in account: id, name, and whether they're on our support team. */
function me() {
  let id = "";
  try {
    id = localStorage.getItem(ACCOUNT_KEY) ?? "";
  } catch {
    // No session.
  }
  const a = admin.accounts.find((x) => x.id === id);
  const { role, employeeId } = sessionWho();
  return { id, employeeId, name: a?.name ?? "Someone", support: scopeFor(sessionWho(), "view", "support") === "all", workspace: role ? LIMITS.workspace[role] : ("employee" as const), roleName: roleOf(a)?.name ?? "" };
}

/** Support sees every ticket; the HR workspace shares the tickets filed there; anyone else sees only their own. */
function mayOpen(t: Ticket, who: ReturnType<typeof me>) {
  return who.support || t.filedById === who.id || (who.workspace === "admin" && (t.workspace ?? "admin") === "admin");
}

export function listTickets(): Promise<Ticket[]> {
  const denied = deny("support", "view");
  if (denied) return denied;
  if (remoteOn()) return remoteApi<Ticket[]>("GET", "/support/tickets");
  const who = me();
  return respond(tickets.filter((t) => mayOpen(t, who)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}

export function fileTicket(input: { subject: string; category: TicketCategory; priority: TicketPriority; text: string; page?: string }): Promise<Ticket> {
  const denied = deny("support", "create");
  if (denied) return denied;
  if (remoteOn()) return remoteApi<Ticket>("POST", "/support/tickets", input);
  const subject = input.subject.trim();
  const text = input.text.trim();
  if (!subject) return fail("Give the problem a short title.");
  if (!text) return fail("Describe what happened.");
  const who = me();
  const now = new Date().toISOString();
  const t: Ticket = {
    id: `tk-${Date.now().toString(36)}`,
    number: Math.max(1000, ...tickets.map((x) => x.number)) + 1,
    subject,
    category: input.category,
    priority: input.priority,
    status: "open",
    filedBy: who.name,
    filedById: who.id,
    filedByEmployeeId: who.employeeId,
    workspace: who.workspace,
    page: input.page,
    createdAt: now,
    updatedAt: now,
    messages: [{ id: "m1", by: who.name, side: who.support ? "support" : "client", text, at: now }],
  };
  save([t, ...tickets]);
  tellRoles(["system_admin"], "support", "request", `New support ticket #${t.number}: ${t.subject}`, `${who.name} · ${t.category} · ${t.priority} priority.`);
  return respond(t);
}

export function replyTicket(id: string, text: string): Promise<Ticket> {
  const denied = deny("support", "create");
  if (denied) return denied;
  if (remoteOn()) return remoteApi<Ticket>("POST", `/support/tickets/${encodeURIComponent(id)}/messages`, { text });
  const who = me();
  const t = tickets.find((x) => x.id === id && mayOpen(x, who));
  if (!t) return fail("That ticket is gone.");
  if (!text.trim()) return fail("Write a reply first.");
  const now = new Date().toISOString();
  // A client's reply reopens a ticket waiting on them or marked resolved; support's reply waits on the client.
  const status: TicketStatus = who.support ? (t.status === "open" ? "in_progress" : t.status) : t.status === "waiting" || t.status === "resolved" ? "open" : t.status;
  const next = { ...t, status, updatedAt: now, messages: [...t.messages, { id: `m${t.messages.length + 1}`, by: who.support ? "Support team" : who.name, side: who.support ? ("support" as const) : ("client" as const), text: text.trim(), at: now }] };
  save(tickets.map((x) => (x.id === id ? next : x)));
  if (who.support) tellEmployees([t.filedByEmployeeId], "support", "update", `Support replied to ticket #${t.number}`, text.trim().slice(0, 140));
  else tellRoles(["system_admin"], "support", "update", `${who.name} replied on ticket #${t.number}`, text.trim().slice(0, 140));
  return respond(next);
}

/** Support only: status, priority and who's on it. */
export function updateTicket(id: string, patch: Partial<Pick<Ticket, "status" | "priority" | "assignee">>): Promise<Ticket> {
  const denied = deny("support", "edit");
  if (denied) return denied;
  if (remoteOn()) return remoteApi<Ticket>("PATCH", `/support/tickets/${encodeURIComponent(id)}`, patch);
  const t = tickets.find((x) => x.id === id);
  if (!t) return fail("That ticket is gone.");
  const next = { ...t, ...patch, updatedAt: new Date().toISOString() };
  save(tickets.map((x) => (x.id === id ? next : x)));
  if (patch.status && patch.status !== t.status) tellEmployees([t.filedByEmployeeId], "support", "update", `Ticket #${t.number} is now ${STATUS_LABEL[patch.status]}`, t.subject);
  return respond(next);
}

/** Clients may close their own ticket once it's sorted. */
export function closeTicket(id: string): Promise<Ticket> {
  const denied = deny("support", "create");
  if (denied) return denied;
  if (remoteOn()) return remoteApi<Ticket>("POST", `/support/tickets/${encodeURIComponent(id)}/close`);
  const t = tickets.find((x) => x.id === id && mayOpen(x, me()));
  if (!t) return fail("That ticket is gone.");
  const next = { ...t, status: "closed" as const, updatedAt: new Date().toISOString() };
  save(tickets.map((x) => (x.id === id ? next : x)));
  return respond(next);
}
