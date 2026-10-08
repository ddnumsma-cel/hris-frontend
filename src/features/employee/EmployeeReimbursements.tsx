import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { CameraIcon, LoaderIcon, PlusIcon, ReceiptIcon, UploadIcon } from "@/components/icons";
import { fileMyClaim, myClaims } from "@/lib/ess/api";
import { checkClaim, compressReceipt, type ClaimInput } from "@/lib/reimbursements/api";
import { CATEGORIES, CLAIM_WINDOW_DAYS, claimType, type Claim } from "@/lib/reimbursements/store";
import { isoToday } from "@/lib/leave/api";
import { inputClass } from "../admin/corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../admin/corehr/ui";
import { peso, receiptDate, STATUS, useClaimsRefresh } from "../admin/reimbursements/format";
import { ReceiptThumb, ReceiptViewer } from "../admin/reimbursements/receipt";
import { useCreateParam } from "@/lib/useCreateParam";

const KEY = ["ess", "claims"] as const;
type Draft = Omit<ClaimInput, "employeeId" | "amount"> & { amount: string };
const BLANK: Draft = { category: "", otherType: "", merchant: "", purchaseDate: isoToday(), amount: "", description: "", receipt: "" };

function NewClaimDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const refresh = useClaimsRefresh();
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [tried, setTried] = useState(false);
  const [reading, setReading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const input = { ...draft, amount: Number(draft.amount), employeeId: "" };
  const errors = tried ? checkClaim(input) : {};

  const submit = useMutation({
    mutationFn: () => fileMyClaim({ ...draft, amount: Number(draft.amount) }),
    onSuccess: () => {
      refresh();
      toast.show("Claim sent for approval.");
      onClose();
    },
  });

  async function pick(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setReading(true);
    try {
      set({ receipt: await compressReceipt(file) });
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "Couldn't read that photo.");
    } finally {
      setReading(false);
    }
  }

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title="New reimbursement claim"
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={submit.isPending || reading}
            onClick={() => {
              setTried(true);
              if (Object.keys(checkClaim(input)).length === 0) submit.mutate();
            }}
          >
            {submit.isPending ? "Sending…" : "Send for approval"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <div>
          <span className="mb-1 block text-xs font-semibold text-ink-2">
            Receipt photo<span className="ml-0.5 text-critical" aria-hidden="true">*</span>
          </span>
          <input ref={fileInput} type="file" accept="image/*" className="sr-only" aria-label="Receipt photo" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
          {draft.receipt ? (
            <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
              <img src={draft.receipt} alt="Your receipt" className="max-h-80 w-full object-contain" />
              <div className="flex gap-1 border-t border-border bg-surface p-1.5">
                <Button size="sm" variant="ghost" className="flex-1 justify-center" onClick={() => fileInput.current?.click()}>
                  Replace
                </Button>
                <Button size="sm" variant="ghost" className="flex-1 justify-center" onClick={() => set({ receipt: "" })}>
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void pick(e.dataTransfer.files[0]);
              }}
              className={clsx(
                "flex h-64 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 text-center transition-colors hover:border-brand hover:bg-brand-tint/50",
                errors.receipt ? "border-critical/60" : "border-border",
              )}
            >
              {reading ? (
                <LoaderIcon className="h-7 w-7 animate-spin text-ink-3" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
                  <CameraIcon className="h-6 w-6" />
                </span>
              )}
              <span>
                <span className="block text-sm font-semibold">{reading ? "Reading photo…" : "Take or upload a photo"}</span>
                <span className="mt-1 block text-xs text-ink-2">The whole POS receipt, with the total and date readable</span>
              </span>
              {!reading && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-ink">
                  <UploadIcon className="h-3.5 w-3.5" /> JPG or PNG
                </span>
              )}
            </button>
          )}
          {(photoError || errors.receipt) && <p role="alert" className="mt-1 text-xs font-medium text-critical">{photoError ?? errors.receipt}</p>}
        </div>

        <div className="grid content-start gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field id="rb-cat" label="Expense type" required className="sm:col-span-2" error={errors.category}>
            <select id="rb-cat" className={inputClass} value={draft.category} onChange={(e) => set({ category: e.target.value as Draft["category"] })}>
              <option value="">Choose one</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          {draft.category === "Other" && (
            <Field id="rb-other" label="Specify the expense" required className="sm:col-span-2" error={errors.otherType}>
              <input id="rb-other" autoFocus maxLength={60} className={inputClass} placeholder="e.g. Notarization fee, Parking, Courier" value={draft.otherType} onChange={(e) => set({ otherType: e.target.value })} />
            </Field>
          )}
          <Field id="rb-amount" label="Total amount" required error={errors.amount}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">₱</span>
              <input id="rb-amount" type="number" inputMode="decimal" min="0" step="0.01" className={clsx(inputClass, "pl-7")} placeholder="0.00" value={draft.amount} onChange={(e) => set({ amount: e.target.value })} />
            </div>
          </Field>
          <Field id="rb-date" label="Date on receipt" required error={errors.purchaseDate}>
            <input id="rb-date" type="date" className={inputClass} max={isoToday()} value={draft.purchaseDate} onChange={(e) => set({ purchaseDate: e.target.value })} />
          </Field>
          <Field id="rb-merchant" label="Store or merchant" required className="sm:col-span-2" error={errors.merchant}>
            <input id="rb-merchant" className={inputClass} placeholder="e.g. National Book Store" value={draft.merchant} onChange={(e) => set({ merchant: e.target.value })} />
          </Field>
          <Field id="rb-why" label="What was it for?" required className="sm:col-span-2" error={errors.description}>
            <textarea id="rb-why" rows={3} className={clsx(inputClass, "resize-none")} placeholder="e.g. Taxi to a client's office for the year-end audit" value={draft.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <p className="text-xs text-ink-3 sm:col-span-2">Approved claims are added to your next payroll. Receipts must be within {CLAIM_WINDOW_DAYS} days.</p>
          <div className="sm:col-span-2">
            <ErrorNote error={submit.error} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function Summary({ claims }: { claims: Claim[] }) {
  const year = isoToday().slice(0, 4);
  const sum = (xs: Claim[]) => xs.reduce((n, c) => n + c.amount, 0);
  const pending = claims.filter((c) => c.status === "pending" || c.status === "endorsed");
  const approved = claims.filter((c) => c.status === "approved" && c.purchaseDate.startsWith(year));
  const rejected = claims.filter((c) => c.status === "rejected" && c.purchaseDate.startsWith(year));
  const tiles = [
    { label: "Waiting for approval", value: peso(sum(pending)), sub: `${pending.length} ${pending.length === 1 ? "claim" : "claims"}`, dot: "bg-warning" },
    { label: `Approved in ${year}`, value: peso(sum(approved)), sub: `${approved.length} ${approved.length === 1 ? "claim" : "claims"} · paid with payroll`, dot: "bg-good" },
    { label: `Rejected in ${year}`, value: String(rejected.length), sub: rejected.length ? "See the reason on each claim" : "None so far", dot: "bg-critical" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
            <span className={clsx("h-2 w-2 rounded-full", t.dot)} />
            {t.label}
          </div>
          <div className="mt-1.5 font-display text-2xl font-semibold tracking-[-0.01em]">{t.value}</div>
          <div className="mt-0.5 text-xs text-ink-3">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

export function EmployeeReimbursements() {
  const data = useQuery({ queryKey: KEY, queryFn: myClaims, staleTime: 0 });
  const [creating, setCreating] = useState(false);
  useCreateParam("claim", () => setCreating(true));
  const [viewing, setViewing] = useState<Claim | null>(null);

  if (data.isError) return <LoadError onRetry={() => data.refetch()} />;
  const claims = data.data ?? [];

  return (
    <>
      <ContentHead
        title="Reimbursements"
        subtitle="Claim back what you spent for work. Snap the POS receipt and send it for approval."
        actions={
          <Button icon={<PlusIcon className="h-3.75 w-3.75" />} onClick={() => setCreating(true)}>
            New claim
          </Button>
        }
      />

      {data.isLoading ? <Skeleton className="h-24" /> : <Summary claims={claims} />}

      <div>
        <h2 className="mb-2 text-sm font-semibold">My claims</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {data.isLoading ? (
            <div className="p-4">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : claims.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink-3">
                <ReceiptIcon className="h-5 w-5" />
              </span>
              <div className="text-sm font-semibold">No claims yet</div>
              <p className="max-w-xs text-xs text-ink-2">Paid for something for work? Take a photo of the receipt and send it for approval.</p>
              <Button size="sm" className="mt-1" onClick={() => setCreating(true)}>
                New claim
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {claims.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-4 py-3 sm:items-center">
                  <ReceiptThumb src={c.receipt} label={c.merchant} onOpen={() => setViewing(c)} />
                  <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.1fr)] sm:items-center sm:gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{claimType(c)}</div>
                      <div className="truncate text-xs text-ink-2">
                        {c.merchant} · {c.description}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-ink-2 sm:mt-0">{receiptDate(c.purchaseDate)}</div>
                    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 sm:mt-0">
                      <Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill>
                      {(c.note ?? c.approverNote) && <span className="min-w-0 truncate text-xs text-ink-3" title={c.note ?? c.approverNote}>{c.note ?? c.approverNote}</span>}
                      {c.status === "endorsed" && c.approverDecidedBy && <span className="min-w-0 truncate text-xs text-ink-3">Approved by {c.approverDecidedBy}</span>}
                    </div>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1.5 sm:w-32 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                    <span className="font-num text-sm font-semibold">{peso(c.amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {creating && <NewClaimDialog onClose={() => setCreating(false)} />}
      {viewing && <ReceiptViewer src={viewing.receipt} title={`${viewing.merchant} · ${peso(viewing.amount)}`} onClose={() => setViewing(null)} />}
    </>
  );
}
