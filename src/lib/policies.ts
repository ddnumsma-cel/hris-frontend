// Company rules and policies (Maintenance → Rules): HR publishes them, employees
// read and acknowledge them. Changing a published policy makes a new version that
// everyone acknowledges again. Saved to localStorage; uploaded files go to fileStore.

import { fullName, state as core } from "./corehr/store";
import { getFile } from "./fileStore";
import { notifyEmployee } from "./outbox";

export const POLICY_CATEGORIES = ["Employee handbook", "Code of conduct", "Attendance & time", "Leave", "Pay & benefits", "Data privacy", "Health & safety", "Other"] as const;
export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];

export interface Policy {
  id: string;
  title: string;
  category: PolicyCategory;
  /** Starts at 1; goes up each time a published policy's content changes. */
  version: number;
  effectiveDate: string;
  summary: string;
  body: string;
  /** An attached document (fileStore key), e.g. the signed PDF. */
  fileId?: string;
  fileName?: string;
  requireAck: boolean;
  status: "draft" | "published" | "archived";
  updatedBy: string;
  updatedAt: string;
}

export interface Acknowledgement {
  policyId: string;
  version: number;
  employeeId: string;
  at: string;
}

interface Saved {
  policies: Policy[];
  acks: Acknowledgement[];
}

const KEY = "heyhr-policies-v1";
const DELAY = 200;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Saved>;
      return { policies: s.policies ?? [], acks: s.acks ?? [] };
    }
  } catch {
    // Blocked or corrupt storage: start empty.
  }
  return { policies: [], acks: [] };
}
let saved = load();
function persist(next: Saved) {
  saved = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not kept after a reload; fine in the prototype.
  }
}

const current = () => core.employees.filter((e) => e.job.status !== "Separated");
const acked = (p: Policy, employeeId: string) => saved.acks.find((a) => a.policyId === p.id && a.version === p.version && a.employeeId === employeeId);

// ---- HR ----

export interface PolicyRow extends Policy {
  acknowledged: number;
  total: number;
}

export function listPolicies(): Promise<PolicyRow[]> {
  const people = current();
  return respond(
    [...saved.policies]
      .sort((a, b) => (a.status === "archived" ? 1 : 0) - (b.status === "archived" ? 1 : 0) || a.title.localeCompare(b.title))
      .map((p) => ({ ...p, acknowledged: people.filter((e) => acked(p, e.id)).length, total: people.length })),
  );
}

export type PolicyInput = Pick<Policy, "title" | "category" | "effectiveDate" | "summary" | "body" | "fileId" | "fileName" | "requireAck"> & { id?: string };

export async function savePolicy(input: PolicyInput, actor: string): Promise<Policy> {
  const title = input.title.trim();
  if (!title) return fail("Give the policy a title");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) return fail("Choose the date it takes effect");
  if (!input.body.trim() && !input.fileId) return fail("Write the policy or attach the document");
  if (saved.policies.some((p) => p.id !== input.id && p.title.toLowerCase() === title.toLowerCase() && p.status !== "archived")) return fail("There's already a policy with that title");
  const old = saved.policies.find((p) => p.id === input.id);
  const contentChanged = !!old && (old.body !== input.body.trim() || old.fileId !== input.fileId || old.title !== title);
  const now = new Date().toISOString();
  const next: Policy = {
    id: old?.id ?? `pol-${Date.now().toString(36)}`,
    title,
    category: input.category,
    version: old ? (old.status === "published" && contentChanged ? old.version + 1 : old.version) : 1,
    effectiveDate: input.effectiveDate,
    summary: input.summary.trim(),
    body: input.body.trim(),
    fileId: input.fileId,
    fileName: input.fileName,
    requireAck: input.requireAck,
    status: old?.status ?? "draft",
    updatedBy: actor,
    updatedAt: now,
  };
  persist({ ...saved, policies: old ? saved.policies.map((p) => (p.id === next.id ? next : p)) : [...saved.policies, next] });
  return respond(next);
}

export async function setPolicyStatus(id: string, status: Policy["status"], actor: string): Promise<void> {
  const p = saved.policies.find((x) => x.id === id);
  if (!p) return fail("That policy no longer exists");
  persist({ ...saved, policies: saved.policies.map((x) => (x.id === id ? { ...x, status, updatedBy: actor, updatedAt: new Date().toISOString() } : x)) });
  if (status === "published" && p.status !== "published") for (const e of current()) notifyEmployee(e.id, "policy", `New company policy: ${p.title}`, `${p.title} is published${p.requireAck ? " and needs your confirmation that you've read it" : ""}. Read it on heyhr under Company policies.`);
  return respond(undefined);
}

export async function deletePolicy(id: string): Promise<void> {
  const p = saved.policies.find((x) => x.id === id);
  if (!p) return fail("That policy no longer exists");
  if (p.status !== "draft") return fail("Published policies stay on record. Archive it instead.");
  persist({ ...saved, policies: saved.policies.filter((x) => x.id !== id) });
  return respond(undefined);
}

/** Who has and hasn't acknowledged the current version. */
export function acknowledgementsFor(id: string) {
  const p = saved.policies.find((x) => x.id === id);
  if (!p) return respond({ done: [] as { name: string; at: string }[], waiting: [] as string[] });
  const people = current().map((e) => ({ e, a: acked(p, e.id) }));
  return respond({
    done: people.filter((x) => x.a).map((x) => ({ name: fullName(x.e.personal), at: x.a!.at })).sort((a, b) => a.name.localeCompare(b.name)),
    waiting: people.filter((x) => !x.a).map((x) => fullName(x.e.personal)).sort(),
  });
}

/** Opens an attached policy document in a new tab. */
export async function openPolicyFile(fileId: string) {
  const f = await getFile(fileId);
  if (f) window.open(URL.createObjectURL(f.blob), "_blank", "noopener");
}

// ---- Employees ----

export interface MyPolicy extends Policy {
  acknowledgedAt?: string;
}

/** Published policies for one employee, unacknowledged first. */
export function policiesFor(employeeId: string): Promise<MyPolicy[]> {
  return respond(
    saved.policies
      .filter((p) => p.status === "published")
      .map((p) => ({ ...p, acknowledgedAt: acked(p, employeeId)?.at }))
      .sort((a, b) => Number(!!a.acknowledgedAt) - Number(!!b.acknowledgedAt) || a.title.localeCompare(b.title)),
  );
}

export async function acknowledgePolicy(id: string, employeeId: string): Promise<void> {
  const p = saved.policies.find((x) => x.id === id && x.status === "published");
  if (!p) return fail("That policy is no longer published");
  if (acked(p, employeeId)) return respond(undefined);
  persist({ ...saved, acks: [...saved.acks, { policyId: p.id, version: p.version, employeeId, at: new Date().toISOString() }] });
  return respond(undefined);
}
