import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastContext";
import { adjustBalance, fmtDays, listAdjustments, listBalances, listTypes, type BalanceRow } from "@/lib/leave/api";
import type { Balance, LeaveType } from "@/lib/leave/types";
import { useOfficeFilter } from "../OfficeFilterContext";
import { inputClass, useActor } from "../corehr/format";
import { Drawer, ErrorNote, Field, LoadError } from "../corehr/ui";
import { Name, SearchBox, SimpleTable, Toolbar, type Col } from "../timekeeping/common";
import { shortDate } from "../timekeeping/format";
import { FileLeaveDialog } from "./dialogs";
import { leaveKeys, num, useLeaveRefresh } from "./format";

/** The leave types shown as table columns; the rest are in the drawer. */
const COLUMNS = ["vl", "sl", "el", "bl"];

function Cell({ b }: { b?: Balance }) {
  if (!b) return <span className="text-ink-3">—</span>;
  const total = b.earned + b.carriedOver + b.adjusted;
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={b.available <= 0 ? "font-semibold text-critical" : "font-semibold"}>{num(b.available)}</span>
      <span className="text-xs text-ink-3">of {num(total)}</span>
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

function BalanceDrawer({ row, types, onClose, onFile }: { row: BalanceRow; types: LeaveType[]; onClose: () => void; onFile: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const refresh = useLeaveRefresh();
  const withBalance = types.filter((t) => t.active && t.earning.kind !== "unlimited");
  const [typeId, setTypeId] = useState(withBalance[0]?.id ?? "");
  const [form, setForm] = useState({ typeId: "vl", days: "", reason: "" });
  const adjQuery = useQuery({ queryKey: leaveKeys.adjustments(row.person.id), queryFn: () => listAdjustments(row.person.id) });
  const adjust = useMutation({
    mutationFn: () => adjustBalance({ employeeId: row.person.id, typeId: form.typeId, days: Number(form.days), reason: form.reason }, actor),
    onSuccess: () => {
      refresh();
      toast.show("Balance updated.");
      setForm((f) => ({ ...f, days: "", reason: "" }));
    },
  });
  const b = row.balances.find((x) => x.typeId === typeId);
  const type = types.find((t) => t.id === typeId);

  return (
    <Drawer
      open
      onClose={onClose}
      title={row.person.name}
      subtitle={`${row.person.departmentName} · ${row.person.branch}`}
      footer={
        <Button
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
        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {withBalance.map((t) => (
              <button key={t.id} type="button" onClick={() => setTypeId(t.id)} aria-pressed={typeId === t.id} className={typeId === t.id ? "h-7 rounded-full bg-ink px-2.5 text-xs font-medium text-surface" : "h-7 rounded-full border border-border px-2.5 text-xs font-medium text-ink-2 hover:border-ink-3"}>
                {t.code}
              </button>
            ))}
          </div>
          {b && type && (
            <div className="rounded-xl border border-border p-3">
              <div className="mb-1 text-sm font-semibold">{type.name}</div>
              {!b.eligible && <p className="mb-1 text-xs text-ink-3">{b.eligibilityNote}</p>}
              <Row label={type.earning.kind === "monthly" ? `Earned so far (of ${b.yearTotal} this year)` : "Given this year"} value={num(b.earned)} />
              {type.carryOverMax > 0 && <Row label="Carried over from last year" value={num(b.carriedOver)} />}
              <Row label="Changed by HR" value={b.adjusted > 0 ? `+${num(b.adjusted)}` : num(b.adjusted)} />
              <Row label="Used" value={`− ${num(b.used)}`} />
              <Row label="Waiting for approval" value={`− ${num(b.pending)}`} />
              <div className="mt-1 border-t border-border pt-1">
                <Row label="Available to file" value={fmtDays(b.available)} strong />
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Add or remove days</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field id="ad-type" label="Leave type">
              <select id="ad-type" className={inputClass} value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })}>
                {withBalance.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ad-days" label="Days" hint="Use a minus to remove, e.g. -1">
              <input id="ad-days" type="number" step={0.5} className={inputClass} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
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
          {(adjQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-ink-3">No changes by HR yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {(adjQuery.data ?? []).slice(0, 4).map((a) => (
                <li key={a.id} className="flex justify-between gap-3 py-1.5">
                  <span>
                    <span className="font-medium">
                      {a.days > 0 ? "+" : ""}
                      {num(a.days)} {types.find((t) => t.id === a.typeId)?.code}
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
  const balancesQuery = useQuery({ queryKey: leaveKeys.balances, queryFn: listBalances });
  const typesQuery = useQuery({ queryKey: leaveKeys.types, queryFn: listTypes });
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [filingFor, setFilingFor] = useState<string | null>(null);

  if (balancesQuery.isError || typesQuery.isError) return <LoadError onRetry={() => (balancesQuery.refetch(), typesQuery.refetch())} />;

  const types = typesQuery.data ?? [];
  const q = query.trim().toLowerCase();
  const rows = (balancesQuery.data ?? []).filter((r) => (office === "All offices" || r.person.branch === office) && (!q || r.person.name.toLowerCase().includes(q)));
  const open = rows.find((r) => r.person.id === openId) ?? (balancesQuery.data ?? []).find((r) => r.person.id === openId);
  const shown = COLUMNS.map((id) => types.find((t) => t.id === id)).filter((t): t is LeaveType => !!t?.active);

  const cols: Col<BalanceRow>[] = [
    { header: "Employee", cell: (r) => <Name name={r.person.name} sub={r.person.departmentName} /> },
    ...shown.map((t) => ({ header: t.name, cell: (r: BalanceRow) => <Cell b={r.balances.find((b) => b.typeId === t.id)} /> })),
    { header: "Used this year", cell: (r) => num(r.balances.reduce((s, b) => s + b.used, 0)) },
    { header: "Waiting", cell: (r) => num(r.balances.reduce((s, b) => s + b.pending, 0)) },
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
      <ContentHead title="Leave balances" subtitle="Days each employee can still file this year. Vacation and sick leave are earned 1.25 days a month." />
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} />
      </Toolbar>
      <SimpleTable rows={rows} rowKey={(r) => r.person.id} cols={cols} loading={balancesQuery.isLoading} empty="No employees match." />
      {open && <BalanceDrawer key={open.person.id} row={open} types={types} onClose={() => setOpenId(null)} onFile={() => setFilingFor(open.person.id)} />}
      {filingFor && <FileLeaveDialog employeeId={filingFor} onClose={() => setFilingFor(null)} />}
    </>
  );
}
