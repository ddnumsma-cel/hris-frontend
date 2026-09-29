import { Dialog } from "@/components/ui/Dialog";
import { formatPHP } from "@/lib/format";
import type { Payslip } from "@/lib/types";

export function PayslipBreakdownDialog({ payslip, onClose }: { payslip: Payslip | null; onClose: () => void }) {
  const earnings = payslip?.breakdown.filter((b) => b.kind === "earning") ?? [];
  const deductions = payslip?.breakdown.filter((b) => b.kind === "deduction") ?? [];

  return (
    <Dialog open={payslip !== null} onClose={onClose} title={`Payslip breakdown — ${payslip?.cutoffLabel ?? ""}`}>
      {payslip && (
        <div className="flex flex-col gap-4 text-sm">
          <div>
            <div className="mb-1.5 text-xs font-medium tracking-[0.01em] text-ink-3">Earnings</div>
            {earnings.map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1">
                <span className="text-ink-2">{item.label}</span>
                <span className="font-num">{formatPHP(item.amount)}</span>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 font-semibold">
              <span>Gross pay</span>
              <span className="font-num">{formatPHP(payslip.gross)}</span>
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium tracking-[0.01em] text-ink-3">Deductions</div>
            {deductions.map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1">
                <span className="text-ink-2">{item.label}</span>
                <span className="font-num text-critical">-{formatPHP(item.amount)}</span>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 font-semibold">
              <span>Total deductions</span>
              <span className="font-num">{formatPHP(payslip.deductions)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-brand-tint px-3 py-2.5 font-semibold text-brand-ink">
            <span>Net pay</span>
            <span className="font-num">{formatPHP(payslip.net)}</span>
          </div>
        </div>
      )}
    </Dialog>
  );
}
