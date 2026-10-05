import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastContext";
import { adjustCredits, fmtCredits, listAdjustments, listCredits, type CreditRow } from "@/lib/leave/api";
import { CREDITS_ADJUSTMENT, LEAVE_CREDITS_PER_YEAR } from "@/lib/leave/store";
import { useOfficeFilter } from "../OfficeFilterContext";
import { inputClass, useActor } from "../corehr/format";
import { Drawer, ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { Choice, Name, SearchBox, SimpleTable, Toolbar, type Col } from "../timekeeping/common";
import { shortDate } from "../timekeeping/format";
import { FileLeaveDialog } from "./dialogs";
import { dateRange, leaveKeys, num, useLeaveRefresh } from "./format";

/** One dot per leave: filled = used, half-tone = waiting, outline = still free. */
function Dots({ c }: { c: CreditRow["credits"] }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {Array.from({ length: c.total }, (_, i) => (
        <span key={i} className={clsx("h-2.5 w-2.5 rounded-full", i < c.used ? "bg-brand" : i < c.used + c.pending ? "bg-brand/35" : "border border-ink-3/60")} />
      ))}
    </span>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-ink-2">{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

function CreditsDrawer({ row, onClose, onFile }: { row: CreditRow; onClose: () => void; onFile: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const refresh = useLeaveRefresh();
  const [form, setForm] = useState({ leaves: "", reason: "" });
  const adjQuery = useQuery({ queryKey: leaveKeys.adjustments(row.person.id), queryFn: () => listAdjustments(row.person.id) });
  const adjust = useMutation({
    mutationFn: () => adjustCredits({ employeeId: row.person.id, leaves: Number(form.leaves), reason: form.reason }, actor),
    onSuccess: () => {
      refresh();
      toast.show("Leave credits updated.");
      setForm({ leaves: "", reason: "" });
    },
  });
  const c = row.credits;
  const changes = (adjQuery.data ?? []).filter((a) => a.typeId === CREDITS_ADJUSTMENT);

  return (
    <Drawer
      open
      onClose={onClose}
      title={row.person.name}
      subtitle={`${row.person.departmentName} · ${row.person.branch}`}
      footer={
        <Button
          disabled={c.available < 1}
          onClick={() => {
            onClose();
            onFile();
          }}
        >
          File leave for {row.person.name.split(" ")[0]}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-sm font-semibold">Leave credits · {new Date().getFullYear()}</div>
            <Dots c={c} />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-semibold">{num(c.available)}</span>
            <span className="text-sm text-ink-2">of {num(c.total)} left</span>
          </div>
          <div className="mt-3 border-t border-border pt-2">
            <Row label="Given this year" value={String(LEAVE_CREDITS_PER_YEAR)} />
            <Row label="Changed by HR" value={c.adjusted > 0 ? `+${c.adjusted}` : String(c.adjusted)} />
            <Row label="Used" value={`− ${c.used}`} />
            <Row label="Waiting for approval" value={`− ${c.pending}`} />
            <div className="mt-1 border-t border-border pt-1">
              <Row label="Left to file" value={fmtCredits(c.available)} strong />
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-3">Every paid leave uses 1, however many days it covers. Leave without pay doesn't count.</p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Leaves this year</h3>
          {row.leaves.length === 0 ? (
            <p className="text-sm text-ink-3">No leave filed yet this year.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {row.leaves.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block font-medium">{r.type.name}</span>
                    <span className="block text-xs text-ink-3">
                      {dateRange(r.start, r.end)} · {num(r.days)} {r.days === 1 ? "day" : "days"}
                    </span>
                  </span>
                  <Pill tone={r.status === "approved" ? "good" : "warn"}>{r.status === "approved" ? "Used" : "Waiting"}</Pill>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Add or remove leaves</h3>
          <div className="grid grid-cols-3 gap-3">
            <Field id="ad-leaves" label="Leaves" hint="e.g. 1 or -1">
              <input id="ad-leaves" type="number" step={1} className={inputClass} value={form.leaves} onChange={(e) => setForm({ ...form, leaves: e.target.value })} />
            </Field>
            <Field id="ad-why" label="Reason" required className="col-span-2">
              <input id="ad-why" className={inputClass} placeholder="e.g. Worked during the company outing" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </Field>
          </div>
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="ghost" disabled={adjust.isPending} onClick={() => adjust.mutate()}>
              Save change
            </Button>
          </div>
          <ErrorNote error={adjust.error} />
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold">Past changes</h3>
          {changes.length === 0 ? (
            <p className="text-sm text-ink-3">No changes by HR yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {changes.slice(0, 4).map((a) => (
                <li key={a.id} className="flex justify-between gap-3 py-1.5">
                  <span>
                    <span className="font-medium">
                      {a.days > 0 ? "+" : ""}
                      {fmtCredits(a.days)}
                    </span>{" "}
                    <span className="text-ink-2">{a.reason}</span>
                  </span>
                  <span className="text-xs whitespace-nowrap text-ink-3">
                    {shortDate(a.at)} · {a.by}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  );
}

export function BalancesPage() {
  const { office } = useOfficeFilter();
  const creditsQuery = useQuery({ queryKey: leaveKeys.balances, queryFn: listCredits });
  const [query, setQuery] = useState("");
  const [show, setShow] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [filingFor, setFilingFor] = useState<string | null>(null);

  if (creditsQuery.isError) return <LoadError onRetry={() => creditsQuery.refetch()} />;

  const q = query.trim().toLowerCase();
  const all = creditsQuery.data ?? [];
  const rows = all
    .filter((r) => (office === "All offices" || r.person.branch === office) && (!q || r.person.name.toLowerCase().includes(q)))
    .filter((r) => show === "all" || (show === "none" ? r.credits.available === 0 : r.credits.available > 0 && r.credits.available <= 2));
  const open = all.find((r) => r.person.id === openId);

  const cols: Col<CreditRow>[] = [
    { header: "Employee", cell: (r) => <Name name={r.person.name} sub={r.person.departmentName} /> },
    {
      header: "Leaves left",
      cell: (r) => (
        <span className="flex items-center gap-3">
          <span className="inline-flex w-14 items-baseline gap-1">
            <span className={r.credits.available === 0 ? "font-semibold text-critical" : "font-semibold"}>{r.credits.available}</span>
            <span className="text-xs text-ink-3">of {r.credits.total}</span>
          </span>
          <Dots c={r.credits} />
        </span>
      ),
    },
    { header: "Used", cell: (r) => r.credits.used },
    { header: "Waiting", cell: (r) => r.credits.pending },
    { header: "Last leave", cell: (r) => (r.leaves[0] ? <Name name={r.leaves[0].type.name} sub={dateRange(r.leaves[0].start, r.leaves[0].end)} /> : <span className="text-ink-3">None yet</span>) },
    {
      header: "",
      align: "right",
      cell: (r) => (
        <Button size="sm" variant="ghost" onClick={() => setOpenId(r.person.id)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <ContentHead title="Leave balances" subtitle={`Everyone gets ${LEAVE_CREDITS_PER_YEAR} leaves a year, all given on January 1. Any paid leave uses 1, however many days it covers.`} />
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} />
        <Choice
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            { value: "all", label: "Everyone" },
            { value: "low", label: "1–2 leaves left" },
            { value: "none", label: "No leaves left" },
          ]}
        />
      </Toolbar>
      <SimpleTable rows={rows} rowKey={(r) => r.person.id} cols={cols} loading={creditsQuery.isLoading} empty="No employees match." />
      {open && <CreditsDrawer key={open.person.id} row={open} onClose={() => setOpenId(null)} onFile={() => setFilingFor(open.person.id)} />}
      {filingFor && <FileLeaveDialog employeeId={filingFor} onClose={() => setFilingFor(null)} />}
    </>
  );
}
