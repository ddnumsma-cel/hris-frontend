import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { DownloadIcon } from "@/components/icons";
import { listAudit, type AuditRow } from "@/lib/admin/api";
import { downloadTextFile, toCsv } from "@/lib/download";
import { LoadError, Pill } from "../corehr/ui";
import { Choice, SearchBox, SimpleTable, Toolbar, type Col } from "../timekeeping/common";

const PERIODS = [
  { value: "1", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

const when = (iso: string) => new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function startOf(period: string) {
  if (period === "all") return "";
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (Number(period) - 1));
  return d.toISOString();
}

export function AuditTrailPage() {
  const audit = useQuery({ queryKey: ["admin", "audit"], queryFn: listAudit, staleTime: 0 });
  const [module, setModule] = useState("all");
  const [period, setPeriod] = useState("30");
  const [query, setQuery] = useState("");

  if (audit.isError) return <LoadError onRetry={() => audit.refetch()} />;

  const from = startOf(period);
  const q = query.trim().toLowerCase();
  const rows = (audit.data ?? []).filter((r) => (module === "all" || r.module === module) && (!from || r.at >= from) && (!q || `${r.actor} ${r.target} ${r.action} ${r.detail}`.toLowerCase().includes(q)));
  const failed = rows.filter((r) => r.action === "Failed sign-in").length;

  const cols: Col<AuditRow>[] = [
    { header: "When", cell: (r) => <span className="text-ink-2">{when(r.at)}</span> },
    { header: "Who", cell: (r) => <span className="font-medium">{r.actor || "System"}</span> },
    { header: "Area", cell: (r) => <Pill tone={r.action === "Failed sign-in" ? "crit" : r.module === "Administration" ? "info" : "neutral"}>{r.module}</Pill> },
    { header: "What", cell: (r) => r.action },
    { header: "Record", cell: (r) => r.target },
    { header: "Details", cell: (r) => <span className="inline-block max-w-80 truncate align-bottom text-ink-2" title={r.detail}>{r.detail || "—"}</span> },
  ];

  const download = () => downloadTextFile(`audit-trail-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows.map((r) => ({ When: new Date(r.at).toLocaleString("en-PH"), Who: r.actor, Area: r.module, What: r.action, Record: r.target, Details: r.detail }))), "text/csv");

  return (
    <>
      <ContentHead title="Audit trail" subtitle="Every sign-in, change and approval, with who did it and when. Entries can't be edited or deleted." />
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} placeholder="Search person or record" />
        <Choice label="Area" value={module} onChange={setModule} options={[{ value: "all", label: "All areas" }, ...["People", "Timekeeping", "Leave", "Payroll", "Administration", "Sign-in", "Settings"].map((m) => ({ value: m, label: m }))]} />
        <Choice label="Period" value={period} onChange={setPeriod} options={PERIODS} />
        {failed > 0 && <span className="text-xs font-medium text-critical">{failed} failed sign-in{failed === 1 ? "" : "s"}</span>}
        <span className="ml-auto">
          <Button size="sm" disabled={!rows.length} onClick={download}>
            <DownloadIcon className="h-3.5 w-3.5" /> Download CSV
          </Button>
        </span>
      </Toolbar>
      <SimpleTable rows={rows} rowKey={(r) => r.id} cols={cols} loading={audit.isLoading} empty="Nothing recorded for this filter." />
    </>
  );
}
