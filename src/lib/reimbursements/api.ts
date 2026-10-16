// Reimbursements mock API. Each call stands in for an HTTP request.

import { newId } from "../corehr/store";
import { people, type LeavePerson } from "../leave/api";
import { claimProblems, type ClaimInput } from "./rules";
import { api, serverMode } from "../http";
import { claims, refreshClaims, saveClaims, type Category, type Claim, type PayoutMethod } from "./store";
import { can, visible } from "../permissions";
import { deny, forbidden, sessionWho } from "../session";
import { tellApprover, tellAssigned, tellEmployees, who as nameFor } from "../requestNotices";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const what = (c: Claim) => (c.category === "Other" ? (c.otherType ?? "Other") : c.category);

export type { ClaimInput };

const DELAY = 250;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));

const FULL_STORAGE = "Couldn't save the receipt photo: this browser's storage is full. Try a smaller or cropped photo.";

/** Problems that stop a claim from being filed, keyed by field. */
export function checkClaim(input: ClaimInput): Partial<Record<keyof ClaimInput, string>> {
  return claimProblems(input, claims);
}

export async function fileClaim(input: ClaimInput): Promise<Claim> {
  const denied = deny("claims", "create", input.employeeId);
  if (denied) return denied;
  if (serverMode) {
    const claim = await api<Claim>("POST", "/reimbursements/claims", input);
    await refreshClaims();
    return claim;
  }
  const errors = Object.values(checkClaim(input));
  if (errors.length) return fail(errors[0]!);
  const claim: Claim = {
    id: newId("rb"),
    employeeId: input.employeeId,
    category: input.category as Category,
    ...(input.category === "Other" ? { otherType: input.otherType!.trim() } : {}),
    merchant: input.merchant.trim(),
    purchaseDate: input.purchaseDate,
    amount: Math.round(input.amount * 100) / 100,
    description: input.description.trim(),
    receipt: input.receipt,
    status: "pending",
    filedAt: new Date().toISOString(),
  };
  if (!saveClaims([claim, ...claims])) return fail(FULL_STORAGE);
  tellApprover(claim.employeeId, "claim", "request", `${nameFor(claim.employeeId)} filed a ${what(claim)} claim`, `${peso(claim.amount)} at ${claim.merchant}. Review it under Approvals.`);
  return respond(claim);
}

export async function listMyClaims(employeeId: string): Promise<Claim[]> {
  const denied = deny("claims", "view", employeeId);
  if (denied) return denied;
  if (serverMode) await refreshClaims();
  return respond(claims.filter((c) => c.employeeId === employeeId).sort((a, b) => b.filedAt.localeCompare(a.filedAt)));
}

// ---- HR ----

export interface ClaimRow extends Claim {
  person: LeavePerson;
}

export async function listClaims(): Promise<ClaimRow[]> {
  // Approvers see their team's claims, Accounting and Super Admins everyone's; HR none.
  const who = sessionWho();
  if (!can(who, "view", "claims")) return forbidden();
  if (serverMode) await refreshClaims();
  const ps = people();
  return respond(
    visible(who, "claims", claims, (c) => c.employeeId)
      .flatMap((c) => {
        const person = ps.find((p) => p.id === c.employeeId);
        return person ? [{ ...c, person }] : [];
      })
      .sort((a, b) => b.filedAt.localeCompare(a.filedAt)),
  );
}

/**
 * One approval step. A waiting claim goes to the employee's approver (Approve, team): yes moves it
 * on to Accounting, no rejects it. An endorsed claim gets Accounting's final decision (Final Approve).
 * Each step records who, when and the reason.
 */
export async function decideClaim(id: string, approve: boolean, note: string, actor: string): Promise<Claim> {
  if (serverMode) {
    const claim = await api<Claim>("POST", `/reimbursements/claims/${encodeURIComponent(id)}/decision`, { approve, note });
    await refreshClaims();
    return claim;
  }
  const c = claims.find((x) => x.id === id);
  if (!c) return fail("That claim no longer exists");
  if (c.status !== "pending" && c.status !== "endorsed") return fail("This claim was already decided");
  const step = c.status === "pending" ? "approve" : "final";
  const denied = deny("claims", step, c.employeeId);
  if (denied) return denied;
  if (!approve && !note.trim()) return fail("Say why, so the employee knows");
  const at = new Date().toISOString();
  const why = note.trim() || undefined;
  const next: Claim =
    step === "approve"
      ? { ...c, status: approve ? "endorsed" : "rejected", approverDecidedBy: actor, approverDecidedAt: at, approverNote: why, ...(approve ? {} : { decidedBy: actor, decidedAt: at, note: why }) }
      : { ...c, status: approve ? "approved" : "rejected", decidedBy: actor, decidedAt: at, note: why };
  if (!saveClaims(claims.map((x) => (x.id === id ? next : x)))) return fail(FULL_STORAGE);
  const label = `${what(next)} claim (${peso(next.amount)})`;
  if (next.status === "endorsed") {
    tellEmployees(next.employeeId, "claim", "update", `Your ${label} was endorsed`, `${actor} endorsed it. Accounting gives the final approval next.`);
    tellAssigned("final", "claims", "claim", "request", `${nameFor(next.employeeId)}'s ${label} is ready for final approval`, `Endorsed by ${actor}. ${next.merchant}.`);
  } else if (next.status === "approved") {
    tellEmployees(next.employeeId, "claim", "approved", `Your ${label} was approved`, `${actor} approved it. Accounting will release the money to you (cash, bank transfer, e-wallet or check) and you'll be told when it's sent.`);
  } else {
    tellEmployees(next.employeeId, "claim", "rejected", `Your ${label} was rejected`, `Rejected by ${actor}.${why ? ` “${why}”` : ""}`);
  }
  return respond(next);
}

/**
 * Accounting releases approved claims straight to the employee (cash, bank transfer, e-wallet or
 * check) as soon as the money is available. Reimbursements are not added to payroll.
 */
export async function releaseClaims(ids: string[], method: PayoutMethod, reference: string, paidOn: string, actor: string): Promise<number> {
  const picked = claims.filter((c) => ids.includes(c.id));
  for (const c of picked) {
    const denied = deny("claims", "final", c.employeeId);
    if (denied) return denied;
  }
  if (!picked.length) return fail("Choose the claims to pay");
  if (picked.some((c) => c.status !== "approved" || c.paidAt)) return fail("Only approved claims that aren't paid yet can be paid out");
  if (method !== "cash" && !reference.trim()) return fail(method === "check" ? "Enter the check number" : "Enter the transfer reference");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return fail("Enter the date it was released");
  if (serverMode) {
    // The server stores the method, reference, date and who released it.
    const { paid } = await api<{ paid: number }>("POST", "/reimbursements/claims/pay", { ids, method, reference: reference.trim() || (method === "cash" ? "Cash" : ""), paidOn });
    await refreshClaims();
    return paid;
  }
  const at = `${paidOn}T12:00:00`;
  const set = new Set(ids);
  if (!saveClaims(claims.map((c) => (set.has(c.id) ? { ...c, paidAt: at, paidBy: actor, payoutMethod: method, payoutRef: reference.trim() || (method === "cash" ? "Cash" : "") } : c)))) return fail(FULL_STORAGE);
  const how = method === "cash" ? "in cash" : method === "check" ? `by check (no. ${reference.trim()})` : `by ${method === "transfer" ? "bank transfer" : method} (ref. ${reference.trim()})`;
  for (const c of picked) tellEmployees(c.employeeId, "claim", "approved", `Your ${what(c)} reimbursement was released`, `${peso(c.amount)} released to you ${how}.`);
  return respond(picked.length);
}

/** Shrinks a phone photo to a JPEG that fits in storage (longest side 1400px). */
export async function compressReceipt(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo (JPG or PNG)");
  if (file.size > 15 * 1024 * 1024) throw new Error("That photo is over 15 MB. Try a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't read that photo. Try a JPG or PNG."));
      el.src = url;
    });
    const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't read that photo.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}
