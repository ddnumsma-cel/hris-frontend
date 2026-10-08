import { useState } from "react";
import { can, canFor } from "@/lib/permissions";
import { useWho } from "@/lib/useCan";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastContext";
import { decideRequest, listRequests, listTypes, type RequestRow } from "@/lib/leave/api";
import type { RequestStatus } from "@/lib/leave/types";
import { useOfficeFilter } from "../OfficeFilterContext";
import { useActor } from "../corehr/format";
import { LoadError, Pill } from "../corehr/ui";
import { Choice, Name, SearchBox, SimpleTable, Tabs, Toolbar, type Col } from "../timekeeping/common";
import { shortDate } from "../timekeeping/format";
import { FileLeaveDialog, RequestDialog } from "./dialogs";
import { dateRange, leaveKeys, num, STATUS, useLeaveRefresh } from "./format";
import { useCreateParam } from "@/lib/useCreateParam";

type Tab = RequestStatus | "all";

export function LeaveRequestsPage() {
  const toast = useToast();
  const actor = useActor();
  const refresh = useLeaveRefresh();
  const { office } = useOfficeFilter();
  const [params] = useSearchParams();
  const requestsQuery = useQuery({ queryKey: leaveKeys.requests, queryFn: listRequests });
  const typesQuery = useQuery({ queryKey: leaveKeys.types, queryFn: listTypes });
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [typeId, setTypeId] = useState("all");
  const who = useWho();
  const canFileLeave = can(who, "create", "leave");
  const canDecide = (r: RequestRow) => canFor(who, "approve", "leave", r.employeeId);
  const [filing, setFiling] = useState(params.get("file") === "1" && canFileLeave);
  useCreateParam("leave", () => canFileLeave && setFiling(true));
  const [open, setOpen] = useState<{ r: RequestRow; reject?: boolean } | null>(null);
  const approve = useMutation({
    mutationFn: (r: RequestRow) => decideRequest(r.id, true, "", actor),
    onSuccess: (_, r) => {
      refresh();
      toast.show(`Approved ${r.person.name}'s leave.`);
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't approve."),
  });

  if (requestsQuery.isError) return <LoadError onRetry={() => requestsQuery.refetch()} />;

  const q = query.trim().toLowerCase();
  const matching = (requestsQuery.data ?? []).filter((r) => (office === "All offices" || r.person.branch === office) && (typeId === "all" || r.typeId === typeId) && (!q || r.person.name.toLowerCase().includes(q)));
  const count = (s: RequestStatus) => matching.filter((r) => r.status === s).length;
  const rows = tab === "all" ? matching : matching.filter((r) => r.status === tab);
  // Waiting requests read best soonest-first; decided ones newest-first.
  if (tab === "pending") rows.sort((a, b) => a.start.localeCompare(b.start));

  const cols: Col<RequestRow>[] = [
    { header: "Employee", cell: (r) => <Name name={r.person.name} sub={r.person.departmentName} /> },
    { header: "Leave type", cell: (r) => r.type.name },
    { header: "Dates", cell: (r) => `${dateRange(r.start, r.end)}${r.halfDay ? (r.halfDay === "am" ? " (AM)" : " (PM)") : ""}` },
    { header: "Days", cell: (r) => <span className="font-medium">{num(r.days)}</span> },
    { header: "Reason", cell: (r) => <span className="inline-block max-w-48 truncate align-bottom text-ink-2" title={r.type.confidential ? undefined : r.reason}>{r.type.confidential ? "Confidential" : r.reason}</span> },
    { header: "Filed", cell: (r) => <span className="text-ink-2">{shortDate(r.filedAt)}</span> },
    {
      header: "Status",
      align: "right",
      cell: (r) =>
        r.status === "pending" && canDecide(r) ? (
          <span className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setOpen({ r })}>
              View
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen({ r, reject: true })}>
              Reject
            </Button>
            <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(r)}>
              Approve
            </Button>
          </span>
        ) : (
          <span className="flex items-center justify-end gap-2">
            <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
            <Button size="sm" variant="ghost" onClick={() => setOpen({ r })}>
              View
            </Button>
          </span>
        ),
    },
  ];

  return (
    <>
      <ContentHead title="Leave requests" subtitle="Approve or reject leave, and file leave for an employee. Days are counted without weekends and holidays." actions={canFileLeave ? <Button onClick={() => setFiling(true)}>File leave</Button> : undefined} />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "pending", label: "Waiting for approval", count: count("pending") },
          { value: "approved", label: "Approved", count: count("approved") },
          { value: "rejected", label: "Rejected", count: count("rejected") },
          { value: "cancelled", label: "Cancelled", count: count("cancelled") },
          { value: "all", label: "All", count: matching.length },
        ]}
      />
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} />
        <Choice label="Leave type" value={typeId} onChange={setTypeId} options={[{ value: "all", label: "All leave types" }, ...(typesQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))]} />
      </Toolbar>
      <SimpleTable rows={rows} rowKey={(r) => r.id} cols={cols} loading={requestsQuery.isLoading} empty={tab === "pending" ? "Nothing waiting. You're all caught up." : "Nothing here yet."} />
      {filing && <FileLeaveDialog onClose={() => setFiling(false)} />}
      {open && <RequestDialog key={open.r.id} r={open.r} startWith={open.reject ? "reject" : undefined} onClose={() => setOpen(null)} />}
    </>
  );
}
