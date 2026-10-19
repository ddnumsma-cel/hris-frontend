// In-app notifications kept for a role (everyone holding it sees them) and/or particular people
// (by employee record), shown in the bell, with who has read them. Unlike announcements and team notices, these are stored, so an alert
// is sent once and stays until read. Saved to localStorage.
// With the API server (serverMode) the server stores them (one row per person told, created with the
// action that caused it, server/src/notify.ts) and the bell reads and marks them read there.

import { api, serverMode } from "./http";
import type { NotificationKind } from "./noticeLinks";
import type { RoleKey } from "./permissions";
import { sessionAccountId, sessionWho } from "./session";

export type { NotificationKind } from "./noticeLinks";

export interface AppNotification {
  id: string;
  kind?: NotificationKind;
  toRoles: RoleKey[];
  /** Also (or only) these people, by employee record. */
  toEmployees?: string[];
  title: string;
  body: string;
  /** Where clicking it goes, per role (each role's page lives at its own address). */
  links?: Partial<Record<RoleKey, string>>;
  at: string;
  readBy: string[];
  /** The account that caused it (never told about its own action). */
  by?: string;
}

/** What the bell gets: one notification for the signed-in person. */
export interface MyNotification {
  id: string;
  kind?: NotificationKind;
  title: string;
  body: string;
  link?: string;
  at: string;
  unread: boolean;
}

const KEY = "heyhr-notifications-v1";
const KEEP = 300;

// Certificate requests sent before Requests › Certificates existed pointed at 201 documents.
const CERTIFICATE_LINKS = { super_admin: "/admin/requests/certificates", hr: "/admin/requests/certificates", accounting: "/admin/requests/certificates", system_admin: "/admin/requests/certificates", employee: "/employee/certificates" };
const upgrade = (n: AppNotification): AppNotification =>
  / requested an? .*(Certificate|Letter)/.test(n.title) && n.links?.hr !== CERTIFICATE_LINKS.hr ? { ...n, kind: n.kind ?? "request", links: CERTIFICATE_LINKS } : n;

function load(): AppNotification[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return (JSON.parse(raw) as AppNotification[]).map(upgrade);
  } catch {
    // Blocked or corrupt storage: start empty.
  }
  return [];
}

let all: AppNotification[] = load();

function save(next: AppNotification[]) {
  all = next.slice(0, KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full or blocked: still shown this session.
  }
}

const newId = () => `nt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Sends one notification to everyone holding `roles` and/or the people in `employees` (by employee
 * record). `links` gives each role its own page. The signed-in account that caused it is never
 * told about its own action. Called by the mock API only.
 */
export function notify(o: {
  kind: NotificationKind;
  title: string;
  body: string;
  roles?: RoleKey[];
  employees?: (string | undefined)[];
  links?: AppNotification["links"];
}) {
  if (serverMode) return; // the server sends them (server/src/notify.ts)
  const employees = [...new Set(o.employees?.filter((e): e is string => !!e))];
  if (!o.roles?.length && !employees.length) return;
  const n: AppNotification = { id: newId(), kind: o.kind, toRoles: o.roles ?? [], toEmployees: employees.length ? employees : undefined, title: o.title, body: o.body, links: o.links, at: new Date().toISOString(), readBy: [], by: sessionAccountId() };
  save([n, ...all]);
}

/** Sends a notification to everyone holding these roles. Called by the mock API only. */
export function notifyRoles(toRoles: RoleKey[], title: string, body: string, links?: AppNotification["links"]) {
  if (serverMode) return; // the server sends them (server/src/notify.ts)
  const n: AppNotification = { id: newId(), kind: "alert", toRoles, title, body, links, at: new Date().toISOString(), readBy: [] };
  save([n, ...all]);
}

/** Sends a notification to particular employees (whoever signs in with their record). `link` is an Employee-workspace page, so only employee accounts get it. Called by the mock API only. */
export function notifyEmployees(employeeIds: string[], title: string, body: string, link?: string) {
  if (serverMode) return; // the server sends them (server/src/notify.ts)
  if (!employeeIds.length) return;
  const n: AppNotification = { id: newId(), kind: "update", toRoles: [], toEmployees: employeeIds, title, body, links: link ? { employee: link } : undefined, at: new Date().toISOString(), readBy: [] };
  save([n, ...all]);
}

const isFor = (n: AppNotification, role: RoleKey, employeeId?: string, me?: string) =>
  !(me && n.by === me) && (n.toRoles.includes(role) || (!!employeeId && !!n.toEmployees?.includes(employeeId)));

/** The signed-in person's notifications, newest first. */
export function listMyNotifications(): Promise<MyNotification[]> {
  if (serverMode) return api<MyNotification[]>("GET", "/notifications");
  const { role, employeeId } = sessionWho();
  const me = sessionAccountId() ?? "";
  if (!role) return Promise.resolve([]);
  const mine = all
    .filter((n) => isFor(n, role, employeeId, me))
    .map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.links?.[role], at: n.at, unread: !n.readBy.includes(me) }));
  return Promise.resolve(mine);
}

/** Marks all of the signed-in person's notifications as read. */
export async function markMyNotificationsRead(): Promise<void> {
  if (serverMode) return void (await api("POST", "/notifications/read"));
  const { role, employeeId } = sessionWho();
  const me = sessionAccountId();
  if (role && me) save(all.map((n) => (isFor(n, role, employeeId, me) && !n.readBy.includes(me) ? { ...n, readBy: [...n.readBy, me] } : n)));
}
