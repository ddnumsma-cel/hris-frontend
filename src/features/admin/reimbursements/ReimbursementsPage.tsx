import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { decideClaim, listClaims, type ClaimRow } from "@/lib/reimbursements/api";
import { CATEGORIES, claimType, type ClaimStatus } from "@/lib/reimbursements/store";
import { useOfficeFilter } from "../OfficeFilterContext";
import { inputClass, useActor } from "../corehr/format";
import { Detail, ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { Choice, Name, SearchBox, SimpleTable, Tabs, Toolbar, type Col } from "../timekeeping/common";
import { shortDate } from "../timekeeping/format";
import { useAccess } from "../administration/access";
import { peso, receiptDate, STATUS, useClaimsRefresh } from "./format";
import { ReceiptThumb, ReceiptViewer } from "./receipt";

type Tab = ClaimStatus | "all";

/** Receipt on the left, claim details and the decision on the right. */
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
      toast.show(approve ? `Approved ${c.person.name}'s claim. It goes out with the next payroll.` : `Rejected ${c.person.name}'s claim.`);
      onClose();
    },
  });
  const pending = c.status === "pending" && canApprove;

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
            {c.decidedBy && (
              <Detail label={c.status === "approved" ? "Approved by" : "Rejected by"} wide>
                {c.decidedBy}
                {c.decidedAt && `, ${shortDate(c.decidedAt)}`}
                {c.note && <span className="block text-ink-2">“{c.note}”</span>}
              </Detail>
            )}
          </div>
          {pending && (
            <div className="rounded-lg bg-surface-2 p-3 text-xs text-ink-2">
              Check that the receipt total, date and store match what's entered, and that it's a work expense. You're approving on behalf of the employee's supervisor.
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
  const canApprove = useAccess().reimbursements === "approve";
  const query = useQuery({ queryKey: ["reimbursements", "claims"], queryFn: listClaims });
  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState<{ c: ClaimRow; reject?: boolean } | null>(null);
  const [viewing, setViewing] = useState<ClaimRow | null>(null);
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
  const rows = tab === "all" ? matching : matching.filter((c) => c.status === tab);
  // Oldest waiting claims first, so nothing sits too long.
  if (tab === "pending") rows.sort((a, b) => a.filedAt.localeCompare(b.filedAt));
  const waitingTotal = matching.filter((c) => c.status === "pending").reduce((n, c) => n + c.amount, 0);

  const cols: Col<ClaimRow>[] = [
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
        c.status === "pending" && canApprove ? (
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
            <Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill>
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
        subtitle={`Employees' expense claims with their POS receipts. Approve on the supervisor's behalf; approved claims go out with the next payroll.${count("pending") ? ` ${peso(waitingTotal)} waiting.` : ""}`}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "pending", label: "Waiting for approval", count: count("pending") },
          { value: "approved", label: "Approved", count: count("approved") },
          { value: "rejected", label: "Rejected", count: count("rejected") },
          { value: "all", label: "All", count: matching.length },
        ]}
      />
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search employee or store" />
        <Choice label="Expense type" value={category} onChange={setCategory} options={[{ value: "all", label: "All expense types" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
      </Toolbar>
      <SimpleTable rows={rows} rowKey={(c) => c.id} cols={cols} loading={query.isLoading} empty={tab === "pending" ? "Nothing waiting. You're all caught up." : "Nothing here yet."} />
      {open && <ReviewDialog key={open.c.id} c={open.c} canApprove={canApprove} startWith={open.reject ? "reject" : undefined} onClose={() => setOpen(null)} />}
      {viewing && <ReceiptViewer src={viewing.receipt} title={`${viewing.person.name} · ${viewing.merchant}`} onClose={() => setViewing(null)} />}
    </>
  );
}
