// Final pay cases, stored on their own so Core HR can open one when HR records a separation
// without loading payroll (see finalpay.ts for the computation). With the API server they're kept
// in the database: the server opens and drops cases with the separation (see refreshCases).

import { remoteApi, remoteOn } from "../remote";

export interface FinalPayItem {
  label: string;
  detail: string;
  amount: number;
}

export interface FinalPayCase {
  id: string;
  employeeId: string;
  lastDay: string;
  reason: string;
  openedBy: string;
  openedAt: string;
  /** Set when released: the figures are frozen as they were then. */
  released?: { at: string; by: string; reference: string; items: FinalPayItem[]; total: number };
}

const KEY = "heyhr-final-pay-v1";

/** With the API server or the backend: the cases as last loaded (refreshCases). */
let serverCases: FinalPayCase[] = [];

/** With the API server or the backend: the cases this account may see. */
export async function refreshCases() {
  if (remoteOn()) serverCases = await remoteApi<FinalPayCase[]>("GET", "/payroll/final-pay");
}

export function loadCases(): FinalPayCase[] {
  if (remoteOn()) return serverCases;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as FinalPayCase[];
  } catch {
    // Blocked or corrupt storage: start empty.
  }
  return [];
}

export function saveCases(next: FinalPayCase[]) {
  if (remoteOn()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not kept after a reload.
  }
}

/** Opens (or updates the last day of) someone's unreleased case. */
export function ensureCase(employeeId: string, lastDay: string, reason: string, actor: string) {
  const cases = loadCases();
  const open = cases.find((c) => c.employeeId === employeeId);
  if (open?.released) return;
  if (open) saveCases(cases.map((c) => (c.id === open.id ? { ...c, lastDay, reason } : c)));
  else saveCases([{ id: `fp-${Date.now().toString(36)}`, employeeId, lastDay, reason, openedBy: actor, openedAt: new Date().toISOString() }, ...cases]);
}

/** Drops an unreleased case, when HR cancels a separation. */
export function dropCase(employeeId: string) {
  saveCases(loadCases().filter((c) => c.employeeId !== employeeId || c.released));
}
