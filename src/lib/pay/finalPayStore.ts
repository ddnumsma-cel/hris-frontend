// Final pay cases, stored on their own so Core HR can open one when HR records a separation
// without loading payroll (see finalpay.ts for the computation).

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

export function loadCases(): FinalPayCase[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as FinalPayCase[];
  } catch {
    // Blocked or corrupt storage: start empty.
  }
  return [];
}

export function saveCases(next: FinalPayCase[]) {
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
