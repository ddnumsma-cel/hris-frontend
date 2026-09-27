import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { DownloadIcon } from "@/components/icons";
import { fetchCurrentEmployee, fetchPayslips } from "@/lib/api";
import { formatPHP, formatToday } from "@/lib/format";
import type { Payslip } from "@/lib/types";
import { PayslipBreakdownDialog } from "./PayslipBreakdownDialog";
import { printPayslip } from "./printTemplates";

export function EmployeePayslips() {
  const [selected, setSelected] = useState<Payslip | null>(null);
  const employeeQuery = useQuery({ queryKey: ["employee", "me"], queryFn: fetchCurrentEmployee });
  const payslipsQuery = useQuery({ queryKey: ["employee", "payslips"], queryFn: fetchPayslips });

  function download(p: Payslip) {
    printPayslip(employeeQuery.data, p);
  }

  return (
    <>
      <ContentHead title="Payslips" subtitle={formatToday()} />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {["Cutoff", "Gross", "Deductions", "Net pay", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-4 py-2.5 text-left text-[0.7rem] font-bold uppercase tracking-wider text-ink-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payslipsQuery.data?.map((p) => (
                <tr key={p.id}>
                  <td className="border-b border-border px-4 py-2.5">{p.cutoffLabel}</td>
                  <td className="font-num border-b border-border px-4 py-2.5">{formatPHP(p.gross)}</td>
                  <td className="font-num border-b border-border px-4 py-2.5">{formatPHP(p.deductions)}</td>
                  <td className="font-num border-b border-border px-4 py-2.5">{formatPHP(p.net)}</td>
                  <td className="border-b border-border px-4 py-2.5">
                    <Chip variant={p.status === "Paid" ? "good" : "warn"}>{p.status}</Chip>
                  </td>
                  <td className="border-b border-border px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelected(p)}
                        className="text-xs font-semibold text-brand-ink"
                      >
                        View breakdown
                      </button>
                      <button
                        type="button"
                        onClick={() => download(p)}
                        className="flex items-center gap-1 text-xs font-semibold text-brand-ink"
                      >
                        <DownloadIcon className="h-3.5 w-3.5" />
                        Print
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 pb-3.5 pt-2.5 text-xs text-ink-3">
          Deductions include SSS, PhilHealth, Pag-IBIG and withholding tax. Download BIR Form 2316 anytime from
          Certificates.
        </p>
      </Card>

      <PayslipBreakdownDialog payslip={selected} onClose={() => setSelected(null)} />
    </>
  );
}
