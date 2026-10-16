import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { PlusIcon } from "@/components/icons";
import { myAttendance } from "@/lib/ess/api";
import type { TimeRequest } from "@/lib/timekeeping/types";
import { useCreateParam } from "@/lib/useCreateParam";
import { LoadError, Pill } from "../admin/corehr/ui";
import { SimpleTable, type Col } from "../admin/timekeeping/common";
import { requestSpan, shortDate } from "../admin/timekeeping/format";
import { TimeRequestDialog, fileableDays, type Ask } from "./TimeRequestDialog";

const STATUS = { pending: { tone: "warn", label: "Waiting for your approver" }, approved: { tone: "good", label: "Approved" }, declined: { tone: "crit", label: "Declined" } } as const;

/**
 * Requests › Overtime / Undertime: the employee's own requests of one kind, and the form to file
 * one. They go straight to the approver; HR only sees them once approved.
 */
export function EmployeeTimeRequests({ kind }: { kind: Ask["kind"] }) {
  const data = useQuery({ queryKey: ["ess", "attendance"], queryFn: () => myAttendance(), staleTime: 0 });
  const [ask, setAsk] = useState<Ask | null>(null);
  useCreateParam(kind, () => setAsk({ kind }));
  if (data.isError) return <LoadError onRetry={() => data.refetch()} />;

  const all = data.data?.requests ?? [];
  const rows = all.filter((r) => r.type === kind);
  const filed = (date: string, type: string) => all.some((r) => r.date === date && r.type === type && r.status !== "declined");
  const label = kind === "overtime" ? "Overtime" : "Undertime";

  const cols: Col<TimeRequest>[] = [
    { header: "Day", cell: (r) => <span className="font-medium">{shortDate(r.date)}</span> },
    { header: kind === "overtime" ? "Overtime" : "Left early by", cell: (r) => requestSpan(r) },
    { header: "Reason", cell: (r) => <span className="inline-block max-w-72 truncate align-bottom text-ink-2" title={r.reason}>{r.reason}</span> },
    { header: "Filed", cell: (r) => <span className="text-ink-2">{shortDate(r.filedAt.slice(0, 10))}</span> },
    {
      header: "Status",
      cell: (r) => (
        <span className="flex items-center gap-2" title={r.note}>
          <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
          {r.note && <span className="max-w-48 truncate text-xs text-ink-3">{r.note}</span>}
        </span>
      ),
    },
  ];

  return (
    <>
      <ContentHead
        title={label}
        actions={
          <Button icon={<PlusIcon className="h-3.75 w-3.75" />} onClick={() => setAsk({ kind })}>
            Request {kind}
          </Button>
        }
      />
      <SimpleTable rows={rows} rowKey={(r) => r.id} cols={cols} loading={data.isLoading} empty={`You haven't requested ${kind} yet.`} />
      {ask && <TimeRequestDialog ask={ask} choices={fileableDays(ask.kind, data.data?.days ?? [], filed)} onClose={() => setAsk(null)} />}
    </>
  );
}
