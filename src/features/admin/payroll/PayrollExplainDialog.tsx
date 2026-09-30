import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import type { PayrollRegisterRow } from "@/lib/api";
import { formatPHP } from "@/lib/format";
import { computePayroll } from "@/lib/payroll";

// Mirrors the constants in lib/payroll.ts so each line shows the rule it applied.
const SSS_MSC_MIN = 5_000;
const SSS_MSC_MAX = 35_000;

function deduction(n: number) {
  return `(${formatPHP(n).replace("₱", "")})`;
}

function Line({ label, rule, amount, strong }: { label: string; rule?: string; amount: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <div>
        <div className={strong ? "text-[0.9rem] font-semibold" : "text-[0.85rem]"}>{label}</div>
        {rule && <div className="text-xs text-ink-3">{rule}</div>}
      </div>
      <div className={`font-num whitespace-nowrap text-right ${strong ? "text-[0.9rem] font-semibold" : "text-[0.85rem]"}`}>
        {amount}
      </div>
    </div>
  );
}

/** Walks through one employee's pay for the cutoff, line by line (BRD PAY-001). */
export function PayrollExplainDialog({
  row,
  onClose,
  onEdit,
}: {
  row: PayrollRegisterRow | null;
  onClose: () => void;
  onEdit: (row: PayrollRegisterRow) => void;
}) {
  const pay = row ? computePayroll(row.entry) : null;
  const monthly = row?.entry.monthlyBasic ?? 0;
  const msc = Math.min(Math.max(monthly, SSS_MSC_MIN), SSS_MSC_MAX);
  const firstName = row?.employee.name.split(" ")[0] ?? "";

  return (
    <Dialog open={row !== null} onClose={onClose} title={row ? `How ${firstName}'s pay was computed` : ""}>
      {row && pay && (
        <>
          <div className="mb-3">
            <div className="text-[0.9rem] font-semibold">{row.employee.name}</div>
            <div className="text-xs text-ink-3">
              {row.employee.id} · {row.employee.position}
            </div>
          </div>

          <div className="rounded-lg bg-surface-2 px-3.5">
            <Line label="Monthly basic" amount={formatPHP(monthly)} />
            <Line label="Basic pay (this cutoff)" rule="Monthly ÷ 2" amount={formatPHP(pay.basicPay)} />
            <Line
              label={`Overtime · ${row.entry.overtimeHours.toFixed(1)} hrs`}
              rule="Monthly ÷ 176 hrs × 125% × hours"
              amount={formatPHP(pay.overtimePay)}
            />
            <Line label="Allowance (non-taxable)" rule="De minimis" amount={formatPHP(pay.allowance)} />
            <Line label="Gross pay" amount={formatPHP(pay.gross)} strong />
            <Line
              label="SSS · employee 5%"
              rule={`MSC ${formatPHP(msc)}${monthly > SSS_MSC_MAX ? " cap" : ""} × 5% ÷ 2`}
              amount={deduction(pay.sss)}
            />
            <Line label="PhilHealth · 2.5%" rule="Basic × 2.5% ÷ 2" amount={deduction(pay.philHealth)} />
            <Line label="Pag-IBIG" rule="2%, capped ₱200/month ÷ 2" amount={deduction(pay.pagIbig)} />
            <Line label="Withholding tax" rule="TRAIN semi-monthly bracket" amount={deduction(pay.withholdingTax)} />
            <Line label="Other deductions" rule="Loan / adjustment" amount={deduction(pay.otherDeductions)} />
            <Line label="Net pay" amount={formatPHP(pay.net)} strong />
          </div>

          <p className="mt-3 text-xs text-ink-3">
            These are the standard statutory rules. Final premium rates (BRD §5.2), contribution schedule (§5.9) and pay
            elements (§5.8) still need the Payroll Processor's confirmation.
          </p>

          <div className="-mx-4.5 mt-4 flex justify-end gap-2 border-t border-border px-4.5 pt-3.5">
            <Button
              type="button"
              variant="ghost"
              disabled={row.entry.status === "Released"}
              title={row.entry.status === "Released" ? "Released pay needs a correction run" : undefined}
              onClick={() => onEdit(row)}
            >
              Edit entry
            </Button>
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
