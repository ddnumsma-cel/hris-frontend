import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { PlusIcon, XIcon } from "@/components/icons";
import { AGENCIES, RATE_FIELDS, deleteVersion, listVersions, saveVersion, type RateField } from "@/lib/contributions";
import { pagibig, philhealth, sss, withholding, type Agency, type BirRates, type RateVersion, type TaxBracket } from "@/lib/reports/statutory";
import { useCan } from "@/lib/useCan";
import { inputClass, useActor } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { SimpleTable, Tabs } from "../timekeeping/common";
import { useCreateParam } from "@/lib/useCreateParam";
import { fmtDay } from "@/lib/preferences";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const longDate = (iso: string) => fmtDay(iso);
const show = (f: RateField, v: number) => (f.kind === "pct" ? `${+(v * 100).toFixed(4)}%` : peso(v));
const fieldsOf = (a: Agency) => RATE_FIELDS[a] as RateField[];
const rateOf = (v: RateVersion, key: string) => (v.rates as unknown as Record<string, number>)[key] ?? 0;

type Status = "in force" | "upcoming" | "past";
function statusOf(versions: RateVersion[], v: RateVersion): Status {
  if (v.effectiveFrom > today()) return "upcoming";
  const current = versions.find((x) => x.effectiveFrom <= today());
  return current?.id === v.id ? "in force" : "past";
}

/** What one salary costs under the rates in force on a date, as labelled rows. */
function preview(agency: Agency, salary: number, on: string): { rows: { label: string; amount: number }[]; note: string } {
  if (agency === "bir") {
    const cutoff = withholding(salary / 2, "semi-monthly", on);
    return {
      rows: [
        { label: "Tax, paid monthly", amount: withholding(salary, "monthly", on) },
        { label: "Tax per cutoff, paid twice a month", amount: cutoff },
        { label: "Per month, paid twice a month", amount: cutoff * 2 },
      ],
      note: "Taxable pay is after SSS, PhilHealth and Pag-IBIG; allowances count as non-taxable.",
    };
  }
  const rows = (ee: number, er: number) => [
    { label: "Employee pays", amount: ee },
    { label: "Employer pays", amount: er },
    { label: "Total", amount: ee + er },
  ];
  if (agency === "sss") {
    const s = sss(salary, on);
    return { rows: rows(s.ee, s.er + s.ec), note: s.msc ? `Salary credit ${peso(s.msc)}. Employer share includes ${peso(s.ec)} EC. Each cutoff deducts half the employee share.` : "" };
  }
  const s = agency === "philhealth" ? philhealth(salary, on) : pagibig(salary, on);
  return { rows: rows(s.ee, s.er), note: "Each payroll cutoff deducts half of the employee share." };
}

type BracketDraft = { over: string; base: string; rate: string };
const toDraft = (rows: TaxBracket[]): BracketDraft[] => rows.map((r) => ({ over: String(r.over), base: String(r.base), rate: String(+(r.rate * 100).toFixed(4)) }));
const fromDraft = (rows: BracketDraft[]): TaxBracket[] => rows.map((r) => ({ over: Number(r.over), base: Number(r.base), rate: Number(r.rate) / 100 }));

/** A BIR table, read-only. */
function BracketTable({ title, rows }: { title: string; rows: TaxBracket[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-ink-2">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-2">
            <th scope="col" className="pb-1.5 font-semibold">Pay over</th>
            <th scope="col" className="pb-1.5 text-right font-semibold">Tax</th>
            <th scope="col" className="pb-1.5 text-right font-semibold">+ of excess</th>
          </tr>
        </thead>
        <tbody className="font-num">
          {[...rows].sort((a, b) => a.over - b.over).map((r) => (
            <tr key={r.over} className="border-t border-surface-2">
              <td className="py-1.5">{peso(r.over)}</td>
              <td className="py-1.5 text-right">{peso(r.base)}</td>
              <td className="py-1.5 text-right">{+(r.rate * 100).toFixed(4)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[0.7rem] text-ink-3">Pay up to {peso(Math.min(...rows.map((r) => r.over)))} is tax-free.</p>
    </div>
  );
}

/** Edits a BIR table row by row. */
function BracketEditor({ id, title, rows, onChange }: { id: string; title: string; rows: BracketDraft[]; onChange: (rows: BracketDraft[]) => void }) {
  const set = (i: number, key: keyof BracketDraft, value: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">{title}</legend>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_2rem] gap-2 text-xs font-semibold text-ink-2">
        <span>Pay over (₱)</span>
        <span>Tax (₱)</span>
        <span>+ % of excess</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_2rem] items-center gap-2">
          <input aria-label={`${title} bracket ${i + 1}: pay over`} id={i === 0 ? id : undefined} type="number" min={0} step="any" className={inputClass} value={r.over} onChange={(e) => set(i, "over", e.target.value)} />
          <input aria-label={`${title} bracket ${i + 1}: tax`} type="number" min={0} step="any" className={inputClass} value={r.base} onChange={(e) => set(i, "base", e.target.value)} />
          <input aria-label={`${title} bracket ${i + 1}: percent of excess`} type="number" min={0} step="any" className={inputClass} value={r.rate} onChange={(e) => set(i, "rate", e.target.value)} />
          <button type="button" aria-label={`Remove ${title} bracket ${i + 1}`} disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, j) => j !== i))} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-40">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { over: "", base: "", rate: "" }])} className="self-start text-xs font-semibold text-brand-ink hover:underline">
        + Add bracket
      </button>
    </fieldset>
  );
}

function NewRatesDialog({ agency, base, onClose }: { agency: Agency; base: RateVersion; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const fields = fieldsOf(agency);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [source, setSource] = useState("");
  // Percents are typed as 5 for 5%; stored as 0.05.
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, String(f.kind === "pct" ? +(rateOf(base, f.key) * 100).toFixed(4) : rateOf(base, f.key))])));
  const birBase = agency === "bir" ? (base.rates as BirRates) : null;
  const [monthly, setMonthly] = useState<BracketDraft[]>(() => (birBase ? toDraft([...birBase.monthly].sort((a, b) => a.over - b.over)) : []));
  const [semiMonthly, setSemiMonthly] = useState<BracketDraft[]>(() => (birBase ? toDraft([...birBase.semiMonthly].sort((a, b) => a.over - b.over)) : []));
  const save = useMutation({
    mutationFn: () =>
      saveVersion(
        agency,
        {
          effectiveFrom,
          source,
          rates: (agency === "bir"
            ? { monthly: fromDraft(monthly), semiMonthly: fromDraft(semiMonthly) }
            : Object.fromEntries(fields.map((f) => [f.key, f.kind === "pct" ? Number(values[f.key]) / 100 : Number(values[f.key])]))) as never,
        },
        actor,
      ),
    onSuccess: (v) => {
      queryClient.invalidateQueries();
      toast.show(v.effectiveFrom > today() ? `Saved. The new rates apply from ${longDate(v.effectiveFrom)}.` : "Saved. Payroll now uses these rates.");
      onClose();
    },
  });
  const label = AGENCIES.find((a) => a.id === agency)!.label;
  return (
    <Dialog
      open
      onClose={onClose}
      title={`New ${label} rates`}
      size="lg"
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save rates
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-2">Start from the rates in force and change what the new circular changes. The old rates stay on record, so past payroll can still be worked out.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="nr-from" label="Takes effect on" required>
            <input id="nr-from" type="date" className={inputClass} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </Field>
          <Field id="nr-src" label="Source" required hint="Circular number or link">
            <input id="nr-src" className={inputClass} value={source} placeholder={`e.g. ${label} Circular No. 2026-001`} onChange={(e) => setSource(e.target.value)} />
          </Field>
        </div>
        {agency === "bir" ? (
          <div className="grid grid-cols-1 gap-5 border-t border-border pt-4 lg:grid-cols-2">
            <BracketEditor id="nr-monthly" title="Monthly table" rows={monthly} onChange={setMonthly} />
            <BracketEditor id="nr-semi" title="Semi-monthly table" rows={semiMonthly} onChange={setSemiMonthly} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
            {fields.map((f) => (
              <Field key={f.key} id={`nr-${f.key}`} label={`${f.label} (${f.kind === "pct" ? "%" : "₱"})`} hint={f.hint}>
                <input id={`nr-${f.key}`} type="number" min={0} step="any" className={inputClass} value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
              </Field>
            ))}
          </div>
        )}
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}

export function ContributionsPage() {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const canEdit = useCan("edit", "contributions");
  const [agency, setAgency] = useState<Agency>("sss");
  const [salary, setSalary] = useState(30000);
  const [adding, setAdding] = useState(false);
  useCreateParam("contribution-rates", () => setAdding(true));
  const versions = useQuery({ queryKey: ["payroll", "contributions", agency], queryFn: () => listVersions(agency) });
  const remove = useMutation({
    mutationFn: (v: RateVersion) => deleteVersion(agency, v.id, actor),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.show("Upcoming rates removed.");
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't remove.", "critical"),
  });

  if (versions.isError) return <LoadError onRetry={() => versions.refetch()} />;

  const all = versions.data ?? [];
  const current = all.find((v) => v.effectiveFrom <= today()) ?? all[all.length - 1];
  const upcoming = all.filter((v) => v.effectiveFrom > today()).at(-1);
  const fields = fieldsOf(agency);
  const label = AGENCIES.find((a) => a.id === agency)!.label;
  const now = preview(agency, salary || 0, today());
  const next = upcoming ? preview(agency, salary || 0, upcoming.effectiveFrom) : null;

  return (
    <>
      <ContentHead
        title="Government contributions"
        subtitle="SSS, PhilHealth, Pag-IBIG and BIR rates that payroll deducts. Saved rates apply right away, or on the date they take effect."
        actions={
          canEdit && current ? (
            <Button icon={<PlusIcon className="h-3.75 w-3.75" />} onClick={() => setAdding(true)}>
              New {label} rates
            </Button>
          ) : undefined
        }
      />
      <Tabs value={agency} onChange={setAgency} options={AGENCIES.map((a) => ({ value: a.id, label: a.label }))} />
      {!canEdit && <p className="text-xs text-ink-2">View only. Accounting maintains these rates.</p>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold">In force today</h2>
              {current && (
                <p className="text-xs text-ink-2">
                  Since {longDate(current.effectiveFrom)} · {current.source}
                </p>
              )}
            </div>
            {upcoming && <Pill tone="info">New rates from {longDate(upcoming.effectiveFrom)}</Pill>}
          </div>
          {current && agency === "bir" && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <BracketTable title="Monthly payroll" rows={(current.rates as BirRates).monthly} />
              <BracketTable title="Semi-monthly payroll (per cutoff)" rows={(current.rates as BirRates).semiMonthly} />
            </div>
          )}
          {current && agency !== "bir" && (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className="flex flex-col border-b border-surface-2 pb-2.5">
                  <dt className="text-xs text-ink-2">{f.label}</dt>
                  <dd className="font-num text-[0.95rem] font-semibold">
                    {show(f, rateOf(current, f.key))}
                    {upcoming && rateOf(upcoming, f.key) !== rateOf(current, f.key) && <span className="ml-2 text-xs font-medium text-brand-ink">→ {show(f, rateOf(upcoming, f.key))}</span>}
                  </dd>
                  {f.hint && <span className="text-[0.7rem] text-ink-3">{f.hint}</span>}
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
          <div>
            <h2 className="font-display text-base font-semibold">Try a salary</h2>
            <p className="text-xs text-ink-2">{agency === "bir" ? "Withholding tax for one employee." : `Monthly ${label} for one employee.`}</p>
          </div>
          <Field id="try-salary" label={agency === "bir" ? "Monthly taxable pay (₱)" : "Monthly basic pay (₱)"}>
            <input id="try-salary" type="number" min={0} step={500} className={inputClass} value={salary} onChange={(e) => setSalary(e.target.valueAsNumber)} />
          </Field>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-2">
                <th scope="col" className="pb-2 font-semibold" />
                <th scope="col" className="pb-2 text-right font-semibold">Today</th>
                {next && <th scope="col" className="pb-2 text-right font-semibold">From {longDate(upcoming!.effectiveFrom)}</th>}
              </tr>
            </thead>
            <tbody className="font-num">
              {now.rows.map((r, i) => (
                <tr key={r.label} className="border-t border-surface-2 last:font-semibold">
                  <td className="py-2 font-sans text-ink-2">{r.label}</td>
                  <td className="py-2 text-right">{peso(r.amount)}</td>
                  {next && <td className="py-2 text-right">{peso(next.rows[i]?.amount ?? 0)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-ink-2">{now.note}</p>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-semibold">History</h2>
        <SimpleTable
          rows={all}
          rowKey={(v) => v.id}
          loading={versions.isLoading}
          empty="No rates saved."
          cols={[
            { header: "Takes effect", cell: (v) => <span className="font-medium">{longDate(v.effectiveFrom)}</span> },
            {
              header: "Status",
              cell: (v) => {
                const s = statusOf(all, v);
                return <Pill tone={s === "in force" ? "good" : s === "upcoming" ? "info" : "neutral"}>{s === "in force" ? "In force" : s === "upcoming" ? "Upcoming" : "Past"}</Pill>;
              },
            },
            {
              header: "Rates",
              cell: (v) => {
                if (agency === "bir") {
                  const m = (v.rates as BirRates).monthly;
                  return <span className="text-ink-2">{`${m.length} brackets · ${+(Math.min(...m.map((r) => r.rate)) * 100).toFixed(2)}% to ${+(Math.max(...m.map((r) => r.rate)) * 100).toFixed(2)}%`}</span>;
                }
                return <span className="text-ink-2">{fields.filter((f) => f.kind === "pct").map((f) => `${f.label} ${show(f, rateOf(v, f.key))}`).join(" · ")}</span>;
              },
            },
            { header: "Source", cell: (v) => <span className="inline-block max-w-64 truncate align-bottom text-ink-2" title={v.source}>{v.source}</span> },
            { header: "Saved by", cell: (v) => <span className="text-ink-2">{v.savedBy}</span> },
            {
              header: "",
              align: "right",
              cell: (v) =>
                canEdit && statusOf(all, v) === "upcoming" ? (
                  <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(v)}>
                    Remove
                  </Button>
                ) : null,
            },
          ]}
        />
      </section>

      {adding && current && <NewRatesDialog agency={agency} base={upcoming ?? current} onClose={() => setAdding(false)} />}
    </>
  );
}
