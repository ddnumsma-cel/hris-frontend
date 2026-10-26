import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { cutoffOf, cutoffsInMonth, payRules, savePayProfile, savePayRules, type PayProfile } from "@/lib/pay/settings";
import { todayIso } from "@/lib/timekeeping/store";
import { inputClass, useActor } from "../corehr/format";
import { ErrorNote, Field } from "../corehr/ui";

function Footer({ onClose, onSave, pending }: { onClose: () => void; onSave: () => void; pending: boolean }) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button disabled={pending} onClick={onSave}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

/** Paydays: the two days of the month each cut-off closes. */
export function PaydaysDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(payRules().cutoffDays.map(String) as [string, string]);
  const save = useMutation({
    mutationFn: () => savePayRules({ cutoffDays: [Number(days[0]), Number(days[1])] }, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.show("Paydays saved. New payroll runs use the new cut-offs.");
      onClose();
    },
  });
  // A live preview: this month's two cut-offs with these paydays.
  const [a, b] = days.map(Number) as [number, number];
  const valid = a >= 1 && b >= 1 && a <= 31 && b <= 31 && a !== b;
  const today = todayIso();
  const preview = valid ? cutoffsInMonth(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, [Math.min(a, b), Math.max(a, b)]).map((c) => c.label).join(" and ") : "";
  return (
    <Dialog open onClose={onClose} title="Paydays" footer={<Footer onClose={onClose} onSave={() => save.mutate()} pending={save.isPending} />}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">Each cut-off closes on a payday. Today is in the {cutoffOf(todayIso()).label} cut-off.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field id="pd-1" label="First payday">
            <input id="pd-1" type="number" min={1} max={31} inputMode="numeric" className={inputClass} value={days[0]} onChange={(e) => setDays([e.target.value, days[1]])} />
          </Field>
          <Field id="pd-2" label="Second payday" hint="31 means the last day of the month.">
            <input id="pd-2" type="number" min={1} max={31} inputMode="numeric" className={inputClass} value={days[1]} onChange={(e) => setDays([days[0], e.target.value])} />
          </Field>
        </div>
        {preview && <p className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-sm text-ink-2">This month: {preview}.</p>}
        <p className="text-xs text-ink-3">Payroll runs already made keep their dates.</p>
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}

/** One employee's pay settings: work week, allowances and tax-free pay. */
export function PayProfileDialog({ employee, onClose }: { employee: { id: string; name: string; profile: PayProfile }; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const [v, setV] = useState({ ...employee.profile });
  const money = (key: "transportAllowance" | "otMealRate" | "deMinimis" | "otherNonTaxable" | "clientShare") => ({
    value: String(v[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [key]: e.target.value === "" ? 0 : e.target.valueAsNumber }),
  });
  const save = useMutation({
    mutationFn: () => savePayProfile(employee.id, v, actor, employee.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.show(`Pay settings saved for ${employee.name}. Draft payroll runs pick them up when refreshed.`);
      onClose();
    },
  });
  return (
    <Dialog open onClose={onClose} title={`Pay settings · ${employee.name}`} footer={<Footer onClose={onClose} onSave={() => save.mutate()} pending={save.isPending} />}>
      <div className="flex flex-col gap-3">
        <Field id="pp-week" label="Work week" hint="Both are 40 hours a week. An absence costs that day's hours.">
          <select id="pp-week" className={inputClass} value={v.workWeek} onChange={(e) => setV({ ...v, workWeek: e.target.value as PayProfile["workWeek"] })}>
            <option value="5-day">5-day: Monday to Friday, 8 hours</option>
            <option value="6-day">6-day: Monday to Friday 7 hours, Saturday 5</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="pp-ta" label="Transport allowance" hint="Per cut-off, prorated by days attended. Not taxed.">
            <input id="pp-ta" type="number" min={0} step="0.01" className={inputClass} {...money("transportAllowance")} />
          </Field>
          <Field id="pp-meal" label="OT meal rate" hint="Per day with approved overtime.">
            <input id="pp-meal" type="number" min={0} step="0.01" className={inputClass} {...money("otMealRate")} />
          </Field>
          <Field id="pp-dm" label="De minimis" hint="Part of the basic pay each cut-off that isn't taxed.">
            <input id="pp-dm" type="number" min={0} step="0.01" className={inputClass} {...money("deMinimis")} />
          </Field>
          <Field id="pp-nt" label="Other non-taxable" hint="Other tax-free part of the basic pay each cut-off.">
            <input id="pp-nt" type="number" min={0} step="0.01" className={inputClass} {...money("otherNonTaxable")} />
          </Field>
          <Field id="pp-share" label="Charged to a client (%)" hint="Share of the salary booked to 14002 Advances - Sphinx.">
            <input id="pp-share" type="number" min={0} max={100} step="0.01" className={inputClass} {...money("clientShare")} />
          </Field>
          <Field id="pp-client" label="Client" hint="Who the share is charged to, e.g. Sphinx.">
            <input id="pp-client" className={inputClass} value={v.client} disabled={!v.clientShare} onChange={(e) => setV({ ...v, client: e.target.value })} />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-xs font-medium text-ink">Leave out of their deductions</legend>
          {([["skipSss", "SSS"], ["skipPhilhealth", "PhilHealth"], ["skipPagibig", "Pag-IBIG"]] as const).map(([key, name]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.checked })} /> {name}
            </label>
          ))}
        </fieldset>
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}
