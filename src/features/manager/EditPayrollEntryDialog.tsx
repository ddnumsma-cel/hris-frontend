import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { updatePayrollEntry, type PayrollRegisterRow } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { computePayroll } from "@/lib/payroll";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function EditPayrollForm({ row, onClose, onSaved }: { row: PayrollRegisterRow; onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [monthlyBasic, setMonthlyBasic] = useState(String(row.entry.monthlyBasic));
  const [allowance, setAllowance] = useState(String(row.entry.allowance));
  const [overtimeHours, setOvertimeHours] = useState(String(row.entry.overtimeHours));
  const [otherDeductions, setOtherDeductions] = useState(String(row.entry.otherDeductions));

  const input = {
    monthlyBasic: toNumber(monthlyBasic),
    allowance: toNumber(allowance),
    overtimeHours: toNumber(overtimeHours),
    otherDeductions: toNumber(otherDeductions),
  };
  const preview = computePayroll(input);

  const mutation = useMutation({
    mutationFn: () => updatePayrollEntry(row.employee.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager", "payroll-register"] });
      onClose();
      onSaved();
    },
  });

  const lines: { label: string; amount: number; kind: "earning" | "deduction" }[] = [
    { label: "Basic pay (½ month)", amount: preview.basicPay, kind: "earning" },
    { label: `Overtime (${input.overtimeHours} hrs × 125%)`, amount: preview.overtimePay, kind: "earning" },
    { label: "Allowances", amount: preview.allowance, kind: "earning" },
    { label: "SSS", amount: preview.sss, kind: "deduction" },
    { label: "PhilHealth", amount: preview.philHealth, kind: "deduction" },
    { label: "Pag-IBIG", amount: preview.pagIbig, kind: "deduction" },
    { label: "Withholding tax", amount: preview.withholdingTax, kind: "deduction" },
    { label: "Loans & other deductions", amount: preview.otherDeductions, kind: "deduction" },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="flex flex-col gap-3.5"
    >
      <div className="text-sm">
        <div className="font-bold">{row.employee.name}</div>
        <div className="text-xs text-ink-2">
          {row.employee.position} · {row.employee.id}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pay-basic" className={labelClass}>
            Monthly basic salary
          </label>
          <input id="pay-basic" type="number" min={0} step="0.01" required value={monthlyBasic} onChange={(e) => setMonthlyBasic(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="pay-allowance" className={labelClass}>
            Allowances (this cutoff)
          </label>
          <input id="pay-allowance" type="number" min={0} step="0.01" value={allowance} onChange={(e) => setAllowance(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="pay-ot" className={labelClass}>
            Approved overtime (hrs)
          </label>
          <input id="pay-ot" type="number" min={0} step="0.5" value={overtimeHours} onChange={(e) => setOvertimeHours(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="pay-other" className={labelClass}>
            Loans & other deductions
          </label>
          <input id="pay-other" type="number" min={0} step="0.01" value={otherDeductions} onChange={(e) => setOtherDeductions(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-2 p-3 text-[0.8rem]">
        {lines.map((l) => (
          <div key={l.label} className="flex justify-between py-0.5">
            <span className="text-ink-2">{l.label}</span>
            <span className={`font-num ${l.kind === "deduction" ? "text-critical" : ""}`}>
              {l.kind === "deduction" ? "−" : ""}
              {formatPHP(l.amount)}
            </span>
          </div>
        ))}
        <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 font-bold">
          <span>Net pay</span>
          <span className="font-num">{formatPHP(preview.net)}</span>
        </div>
      </div>

      {row.entry.status === "Approved" && (
        <p className="text-xs text-warning">Saving changes moves this entry back to Draft for re-approval.</p>
      )}
      {mutation.isError && <p className="text-xs text-critical">{(mutation.error as Error).message}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save pay"}
        </Button>
      </div>
    </form>
  );
}

export function EditPayrollEntryDialog({
  row,
  onClose,
  onSaved,
}: {
  row: PayrollRegisterRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={row !== null} onClose={onClose} title="Edit pay for this cutoff">
      {row && <EditPayrollForm key={row.employee.id} row={row} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}
