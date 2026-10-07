import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { decideFix, listFixes, listPeople } from "@/lib/timekeeping/api";
import type { FixRequest } from "@/lib/timekeeping/types";
import { useOfficeFilter } from "../OfficeFilterContext";
import { inputClass, useActor } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { Name, SearchBox, SimpleTable, Tabs, Toolbar, type Col } from "./common";
import { FIX_CAUSES, hhmm, shortDate } from "./format";

type Tab = FixRequest["status"];

function DeclineDialog({ r, name, onClose }: { r: FixRequest; name: string; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const decline = useMutation({
    mutationFn: () => decideFix(r.id, false, note, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      queryClient.invalidateQueries({ queryKey: ["ess"] });
      toast.show(`Declined for ${name}.`);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Decline ${name}'s request?`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={decline.isPending} onClick={() => decline.mutate()}>
            Decline
          </Button>
        </div>
      }
    >
      <Field id="fx-note" label="Reason" required hint="The employee will see this.">
        <textarea id="fx-note" autoFocus rows={3} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <ErrorNote error={decline.error} />
    </Dialog>
  );
}

export function CorrectionsPage() {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const { office } = useOfficeFilter();
  const fixes = useQuery({ queryKey: ["timekeeping", "fixes"], queryFn: listFixes, staleTime: 0 });
  const people = useQuery({ queryKey: ["timekeeping", "people"], queryFn: listPeople });
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [declining, setDeclining] = useState<{ r: FixRequest; name: string } | null>(null);
  const approve = useMutation({
    mutationFn: (r: FixRequest) => decideFix(r.id, true, "", actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      queryClient.invalidateQueries({ queryKey: ["ess"] });
      toast.show("Approved. The time is now on their record.");
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't approve.", "critical"),
  });

  if (fixes.isError || people.isError) return <LoadError onRetry={() => (fixes.refetch(), people.refetch())} />;

  const person = (id: string) => people.data?.find((p) => p.id === id);
  const q = query.trim().toLowerCase();
  const matching = (fixes.data ?? []).filter((r) => {
    const p = person(r.employeeId);
    return !!p && (office === "All offices" || p.branch === office) && (!q || p.name.toLowerCase().includes(q));
  });
  const count = (s: Tab) => matching.filter((r) => r.status === s).length;

  const cols: Col<FixRequest>[] = [
    { header: "Employee", cell: (r) => <Name name={person(r.employeeId)!.name} sub={person(r.employeeId)!.departmentName} /> },
    { header: "Work day", cell: (r) => shortDate(r.workDate) },
    { header: "Adjust", cell: (r) => (r.kind === "in" ? "Time-in" : "Time-out") },
    { header: "What happened", cell: (r) => <span className="text-ink-2">{FIX_CAUSES[r.cause ?? "not-recorded"]}</span> },
    { header: "On record", cell: (r) => <span className="text-ink-2">{r.recorded ? hhmm(r.recorded) : "None"}</span> },
    { header: "Correct time", cell: (r) => <span className="font-medium">{hhmm(r.time)}{r.nextDay ? " (next day)" : ""}</span> },
    { header: "Reason", cell: (r) => <span className="inline-block max-w-56 truncate align-bottom text-ink-2" title={r.reason}>{r.reason}</span> },
    { header: "Sent", cell: (r) => <span className="text-ink-2">{shortDate(r.filedAt)}</span> },
    {
      header: tab === "pending" ? "" : "Decision",
      align: "right",
      cell: (r) =>
        r.status === "pending" ? (
          <span className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setDeclining({ r, name: person(r.employeeId)!.name })}>
              Decline
            </Button>
            <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(r)}>
              Approve
            </Button>
          </span>
        ) : (
          <span title={r.note}>
            <Pill tone={r.status === "approved" ? "good" : "crit"}>{r.status === "approved" ? "Approved" : "Declined"}</Pill>
            <span className="ml-2 text-xs text-ink-3">by {r.decidedBy}</span>
          </span>
        ),
    },
  ];

  return (
    <>
      <ContentHead title="Time adjustments" subtitle="Employees asking to correct a time-in or time-out the biometrics or system got wrong. Approving puts the correct time on their record; a wrong recorded time is set aside." />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "pending", label: "Waiting for approval", count: count("pending") },
          { value: "approved", label: "Approved", count: count("approved") },
          { value: "declined", label: "Declined", count: count("declined") },
        ]}
      />
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} />
      </Toolbar>
      <SimpleTable rows={matching.filter((r) => r.status === tab)} rowKey={(r) => r.id} cols={cols} loading={fixes.isLoading || people.isLoading} empty={tab === "pending" ? "Nothing waiting. You're all caught up." : "Nothing here yet."} />
      {declining && <DeclineDialog r={declining.r} name={declining.name} onClose={() => setDeclining(null)} />}
    </>
  );
}
