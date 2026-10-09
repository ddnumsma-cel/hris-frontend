import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { decideClaim, listClaims, payClaimsByTransfer, type ClaimRow } from "@/lib/reimbursements/api";
import { CATEGORIES, claimType, type ClaimStatus } from "@/lib/reimbursements/store";
import { useOfficeFilter } from "../OfficeFilterContext";
import { inputClass, useActor } from "../corehr/format";
import { Detail, ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { Choice, Name, SearchBox, SimpleTable, Tabs, Toolbar, type Col } from "../timekeeping/common";
import { shortDate } from "../timekeeping/format";
import { canFor } from "@/lib/permissions";
import { useCan, useWho } from "@/lib/useCan";
import { peso, receiptDate, STATUS, useClaimsRefresh } from "./format";
import { ReceiptThumb, ReceiptViewer } from "./receipt";

type Tab = ClaimStatus | "all" | "topay";

/** Who paid it and how, for approved claims. */
const paidText = (c: ClaimRow) => (c.paidAt ? `Paid ${shortDate(c.paidAt)} · ${c.payoutMethod === "payroll" ? `with payroll ${c.payoutRef}` : c.payoutMethod === "transfer" ? `bank transfer ${c.payoutRef}` : "in final pay"}` : "Not paid yet: goes out with the next payroll run");

function PayDialog({ picked, onClose, onDone }: { picked: ClaimRow[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const refresh = useClaimsRefresh();
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const total = picked.reduce((n, c) => n + c.amount, 0);
  const pay = useMutation({
    mutationFn: () => payClaimsByTransfer(picked.map((c) => c.id), reference, paidOn, actor),
    onSuccess: (n) => {
      refresh();
      toast.show(`${n} ${n === 1 ? "claim" : "claims"} marked paid. They won't be added to payroll.`);
      onDone();
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Pay ${picked.length} ${picked.length === 1 ? "claim" : "claims"} by bank transfer`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pay.isPending} onClick={() => pay.mutate()}>
            Mark {peso(total)} paid
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">For claims sent separately from payroll. Claims you don't mark here are added to the next payroll run automatically.</p>
        <ul className="flex flex-col gap-1 text-sm">
          {picked.map((c) => (
            <li key={c.id} className="flex justify-between gap-2">
              <span>
                {c.person.name} · {claimType(c)}
              </span>
              <span className="font-num">{peso(c.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="pay-ref" label="Transfer reference">
            <input id="pay-ref" className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <Field id="pay-date" label="Date sent">
            <input id="pay-date" type="date" className={inputClass} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </Field>
        </div>
        <ErrorNote error={pay.error} />
      </div>
    </Dialog>
  );
}

/** Receipt on the left, claim details and the decision on the right. */
/** May the signed-in person take this claim's next step? Approvers act on waiting claims, Accounting on endorsed ones. */
function useCanDecide() {
  const who = useWho();
  return (c: ClaimRow) => (c.status === "pending" ? canFor(who, "approve", "claims", c.employeeId) : c.status === "endorsed" ? canFor(who, "final", "claims", c.employeeId) : false);
}

function ReviewDialog({ c, canApprove, startWith, onClose }: { c: ClaimRow; canApprove: boolean; startWith?: "reject"; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const refresh = useClaimsRefresh();
  const [rejecting, setRejecting] = useState(startWith === "reject");
  const [note, setNote] = useState("");
  const decide = useMutation({
    mutationFn: (approve: boolean) => decideClaim(c.id, approve, note, actor),
    onSuccess: (_, approve) => {
      refresh();
      toast.show(approve ? (c.status === "pending" ? `Approved ${c.person.name}'s claim. It goes to Accounting for final approval.` : `Approved ${c.person.name}'s claim. It goes out with the next payroll.`) : `Rejected ${c.person.name}'s claim.`);
      onClose();
    },
  });
  const pending = canApprove;

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={`${c.person.name} · ${peso(c.amount)}`}
      footer={
        pending ? (
          <div className="flex justify-end gap-2">
            {rejecting ? (
              <>
                <Button variant="ghost" onClick={() => setRejecting(false)}>
                  Back
                </Button>
                <Button variant="danger" disabled={decide.isPending} onClick={() => decide.mutate(false)}>
                  Reject claim
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setRejecting(true)}>
                  Reject
                </Button>
                <Button disabled={decide.isPending} onClick={() => decide.mutate(true)}>
                  Approve {peso(c.amount)}
                </Button>
              </>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <div className="self-start overflow-hidden rounded-xl border border-border bg-surface-2">
          <img src={c.receipt} alt={`Receipt from ${c.merchant}`} className="max-h-[26rem] w-full object-contain" />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill>
            <span className="text-xs text-ink-3">Filed {shortDate(c.filedAt)}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6">
            <Detail label="Employee">{c.person.name}</Detail>
            <Detail label="Department">{c.person.departmentName || "—"}</Detail>
            <Detail label="Expense type">{c.category === "Other" && c.otherType ? `Other: ${c.otherType}` : c.category}</Detail>
            <Detail label="Amount">{peso(c.amount)}</Detail>
            <Detail label="Store or merchant">{c.merchant}</Detail>
            <Detail label="Date on receipt">{receiptDate(c.purchaseDate)}</Detail>
            <Detail label="What it was for" wide>
              {c.description}
            </Detail>
            {c.approverDecidedBy && (
              <Detail label={c.status === "rejected" && c.decidedAt === c.approverDecidedAt ? "Rejected by approver" : "Approved by approver"} wide>
                {c.approverDecidedBy}
                {c.approverDecidedAt && `, ${shortDate(c.approverDecidedAt)}`}
                {c.approverNote && <span className="block text-ink-2">“{c.approverNote}”</span>}
              </Detail>
            )}
            {c.status === "approved" && (
              <Detail label="Payout" wide>
                {paidText(c)}
              </Detail>
            )}
            {c.decidedBy && c.decidedAt !== c.approverDecidedAt && (
              <Detail label={c.status === "approved" ? "Final approval by" : "Rejected by"} wide>
                {c.decidedBy}
                {c.decidedAt && `, ${shortDate(c.decidedAt)}`}
                {c.note && <span className="block text-ink-2">“{c.note}”</span>}
              </Detail>
            )}
          </div>
          {pending && (
            <div className="rounded-lg bg-surface-2 p-3 text-xs text-ink-2">
              Check that the receipt total, date and store match what's entered, and that it's a work expense. {c.status === "pending" ? "After you approve, Accounting gives the final approval." : "Your approval is final: it goes out with the next payroll."}
            </div>
          )}
          {pending && rejecting && (
            <Field id="rb-note" label="Why is it rejected?" required hint="The employee sees this.">
              <textarea id="rb-note" rows={3} autoFocus className={clsx(inputClass, "resize-none")} placeholder="e.g. The receipt is blurry, please file again with a clearer photo" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          )}
          <ErrorNote error={decide.error} />
        </div>
      </div>
    </Dialog>
  );
}

export function ReimbursementsPage() {
  const toast = useToast();
  const actor = useActor();
  const refresh = useClaimsRefresh();
  const { office } = useOfficeFilter();
  const who = useWho();
  const canDecide = useCanDecide();
  const query = useQuery({ queryKey: ["reimbursements", "claims"], queryFn: listClaims });
  // Accounting starts on the claims waiting for their final approval.
  const [tab, setTab] = useState<Tab>(() => (who.role === "accounting" ? "endorsed" : "pending"));
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState<{ c: ClaimRow; reject?: boolean } | null>(null);
  const [viewing, setViewing] = useState<ClaimRow | null>(null);
  // Accounting pays approved claims: picked ones by bank transfer, the rest with payroll.
  const canPay = useCan("final", "claims");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);
  const toggle = (id: string) => setPicked((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const approve = useMutation({
    mutationFn: (c: ClaimRow) => decideClaim(c.id, true, "", actor),
    onSuccess: (_, c) => {
      refresh();
      toast.show(`Approved ${c.person.name}'s claim of ${peso(c.amount)}.`);
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't approve."),
  });

  if (query.isError) return <LoadError onRetry={() => query.refetch()} />;

  const q = search.trim().toLowerCase();
  const matching = (query.data ?? []).filter((c) => (office === "All offices" || c.person.branch === office) && (category === "all" || c.category === category) && (!q || c.person.name.toLowerCase().includes(q) || c.merchant.toLowerCase().includes(q) || claimType(c).toLowerCase().includes(q)));
  const count = (s: ClaimStatus) => matching.filter((c) => c.status === s).length;
  const unpaid = matching.filter((c) => c.status === "approved" && !c.paidAt);
  const rows = tab === "all" ? matching : tab === "topay" ? unpaid : matching.filter((c) => c.status === tab);
  // Oldest waiting claims first, so nothing sits too long.
  if (tab === "pending" || tab === "endorsed") rows.sort((a, b) => a.filedAt.localeCompare(b.filedAt));
  const waitingTotal = matching.filter((c) => canDecide(c)).reduce((n, c) => n + c.amount, 0);

  const cols: Col<ClaimRow>[] = [
    ...(tab === "topay" && canPay ? [{ header: "", cell: (c: ClaimRow) => <input type="checkbox" aria-label={`Pay ${c.person.name}'s claim`} checked={picked.has(c.id)} onChange={() => toggle(c.id)} /> }] : []),
    { header: "Receipt", cell: (c) => <ReceiptThumb src={c.receipt} label={c.merchant} onOpen={() => setViewing(c)} /> },
    { header: "Employee", cell: (c) => <Name name={c.person.name} sub={c.person.departmentName} /> },
    { header: "Expense", cell: (c) => <Name name={claimType(c)} sub={c.merchant} /> },
    { header: "Date on receipt", cell: (c) => <span className="text-ink-2">{receiptDate(c.purchaseDate)}</span> },
    { header: "Amount", cell: (c) => <span className="font-num font-semibold">{peso(c.amount)}</span> },
    { header: "Filed", cell: (c) => <span className="text-ink-2">{shortDate(c.filedAt)}</span> },
    {
      header: "Status",
      align: "right",
      cell: (c) =>
        canDecide(c) ? (
          <span className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setOpen({ c })}>
              Review
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen({ c, reject: true })}>
              Reject
            </Button>
            <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(c)}>
              Approve
            </Button>
          </span>
        ) : (
          <span className="flex items-center justify-end gap-2">
            {c.status === "approved" ? <Pill tone={c.paidAt ? "good" : "info"}>{c.paidAt ? "Paid" : "To pay out"}</Pill> : <Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill>}
            <Button size="sm" variant="ghost" onClick={() => setOpen({ c })}>
              View
            </Button>
          </span>
        ),
    },
  ];

  return (
    <>
      <ContentHead
        title="Reimbursements"
        subtitle={`Employees' expense claims with their POS receipts. Their approver approves first, then Accounting gives the final approval; approved claims go out with the next payroll.${waitingTotal ? ` ${peso(waitingTotal)} waiting for you.` : ""}`}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "pending", label: "Waiting for approver", count: count("pending") },
          { value: "endorsed", label: "Waiting for Accounting", count: count("endorsed") },
          ...(canPay ? [{ value: "topay" as const, label: "To pay out", count: unpaid.length }] : []),
          { value: "approved", label: "Approved", count: count("approved") },
          { value: "rejected", label: "Rejected", count: count("rejected") },
          { value: "all", label: "All", count: matching.length },
        ]}
      />
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search employee or store" />
        <Choice label="Expense type" value={category} onChange={setCategory} options={[{ value: "all", label: "All expense types" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
        {tab === "topay" && canPay && (
          <span className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" disabled={!rows.length} onClick={() => setPicked(picked.size === rows.length ? new Set() : new Set(rows.map((c) => c.id)))}>
              {picked.size === rows.length && rows.length ? "Clear" : "Select all"}
            </Button>
            <Button size="sm" disabled={!picked.size} onClick={() => setPaying(true)}>
              Pay by transfer{picked.size ? ` (${picked.size})` : ""}
            </Button>
          </span>
        )}
      </Toolbar>
      {tab === "topay" && <p className="text-xs text-ink-2">Approved claims not paid yet. They're added to the next payroll run automatically; mark the ones you send by bank transfer instead.</p>}
      <SimpleTable rows={rows} rowKey={(c) => c.id} cols={cols} loading={query.isLoading} empty={tab === "pending" ? "Nothing waiting. You're all caught up." : "Nothing here yet."} />
      {open && <ReviewDialog key={open.c.id} c={open.c} canApprove={canDecide(open.c)} startWith={open.reject ? "reject" : undefined} onClose={() => setOpen(null)} />}
      {paying && <PayDialog picked={rows.filter((c) => picked.has(c.id))} onClose={() => setPaying(false)} onDone={() => setPicked(new Set())} />}
      {viewing && <ReceiptViewer src={viewing.receipt} title={`${viewing.person.name} · ${viewing.merchant}`} onClose={() => setViewing(null)} />}
    </>
  );
}
