// Reimbursements mock API. Each call stands in for an HTTP request.

import { newId } from "../corehr/store";
import { people, type LeavePerson } from "../leave/api";
import { CLAIM_WINDOW_DAYS, claims, MAX_AMOUNT, saveClaims, type Category, type Claim } from "./store";

const DELAY = 250;
const respond = <T,>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(structuredClone(v)), DELAY));
const fail = (m: string): Promise<never> => new Promise((_, rej) => setTimeout(() => rej(new Error(m)), DELAY));

const FULL_STORAGE = "Couldn't save the receipt photo: this browser's storage is full. Try a smaller or cropped photo.";

function localIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface ClaimInput {
  employeeId: string;
  category: Category | "";
  otherType?: string;
  merchant: string;
  purchaseDate: string;
  amount: number;
  description: string;
  receipt: string;
}

/** Problems that stop a claim from being filed, keyed by field. */
export function checkClaim(input: ClaimInput): Partial<Record<keyof ClaimInput, string>> {
  const errors: Partial<Record<keyof ClaimInput, string>> = {};
  const today = localIso(new Date());
  const oldest = new Date();
  oldest.setDate(oldest.getDate() - CLAIM_WINDOW_DAYS);
  if (!input.receipt) errors.receipt = "Add a photo of the receipt";
  if (!input.category) errors.category = "Choose what the expense was for";
  else if (input.category === "Other" && !input.otherType?.trim()) errors.otherType = "Type what kind of expense it is";
  else if ((input.otherType?.trim().length ?? 0) > 60) errors.otherType = "Keep it under 60 characters";
  if (!input.merchant.trim()) errors.merchant = "Enter the store or merchant on the receipt";
  if (!input.purchaseDate) errors.purchaseDate = "Enter the date on the receipt";
  else if (input.purchaseDate > today) errors.purchaseDate = "The receipt date can't be in the future";
  else if (input.purchaseDate < localIso(oldest)) errors.purchaseDate = `Receipts older than ${CLAIM_WINDOW_DAYS} days can't be claimed`;
  if (!Number.isFinite(input.amount) || input.amount <= 0) errors.amount = "Enter the total on the receipt";
  else if (input.amount > MAX_AMOUNT) errors.amount = `Claims over ₱${MAX_AMOUNT.toLocaleString("en-PH")} go through Finance, not here`;
  if (!input.description.trim()) errors.description = "Say what it was for";
  if (!errors.amount && !errors.purchaseDate) {
    const dup = claims.find(
      (c) => c.employeeId === input.employeeId && (c.status === "pending" || c.status === "approved") && c.purchaseDate === input.purchaseDate && c.amount === Math.round(input.amount * 100) / 100 && c.merchant.trim().toLowerCase() === input.merchant.trim().toLowerCase(),
    );
    if (dup) errors.receipt = "You've already claimed this receipt";
  }
  return errors;
}

export async function fileClaim(input: ClaimInput): Promise<Claim> {
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
  return respond(claim);
}

export function listMyClaims(employeeId: string): Promise<Claim[]> {
  return respond(claims.filter((c) => c.employeeId === employeeId).sort((a, b) => b.filedAt.localeCompare(a.filedAt)));
}

// ---- HR ----

export interface ClaimRow extends Claim {
  person: LeavePerson;
}

export function listClaims(): Promise<ClaimRow[]> {
  const ps = people();
  return respond(
    claims
      .flatMap((c) => {
        const person = ps.find((p) => p.id === c.employeeId);
        return person ? [{ ...c, person }] : [];
      })
      .sort((a, b) => b.filedAt.localeCompare(a.filedAt)),
  );
}

export async function decideClaim(id: string, approve: boolean, note: string, actor: string): Promise<Claim> {
  const c = claims.find((x) => x.id === id);
  if (!c) return fail("That claim no longer exists");
  if (c.status !== "pending") return fail("This claim was already decided");
  if (!approve && !note.trim()) return fail("Say why, so the employee knows");
  const next: Claim = { ...c, status: approve ? "approved" : "rejected", decidedBy: actor, decidedAt: new Date().toISOString(), note: note.trim() || undefined };
  if (!saveClaims(claims.map((x) => (x.id === id ? next : x)))) return fail(FULL_STORAGE);
  return respond(next);
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
