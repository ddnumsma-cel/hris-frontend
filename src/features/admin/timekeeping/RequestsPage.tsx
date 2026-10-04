import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { decideRequest, earliestDate, fileRequest, listDays, listRequests, type DayRow } from "@/lib/timekeeping/api";
import { addDays, toIsoDate } from "@/lib/timekeeping/compute";
import type { TimeRequest } from "@/lib/timekeeping/types";
import { useOfficeFilter } from "../OfficeFilterContext";
import { inputClass, useActor } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { Name, SearchBox, SimpleTable, Tabs, Toolbar, type Col } from "./common";
import { clock, duration, hhmm, shortDate, tkKeys } from "./format";

type Kind = TimeRequest["type"];
type Tab = "pending" | "approved" | "declined" | "unfiled";

const COPY = {
  overtime: {
    title: "Overtime",
    subtitle: "Time worked past the end of the shift. It's only paid as overtime once approved here.",
    measure: "Worked past shift",
    unfiled: "Worked late, no request",
  },
  undertime: {
    title: "Undertime",
    subtitle: "Leaving before the shift ends. Approving excuses it; the time is still unpaid.",
    measure: "Left early by",
    unfiled: "Left early, no request",
  },
} as const;

function DeclineDialog({ r, name, onClose }: { r: TimeRequest; name: string; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const decline = useMutation({
    mutationFn: () => decideRequest(r.id, false, note, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
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
          <Button variant="danger" onClick={() => decline.mutate()} disabled={decline.isPending}>
            Decline
          </Button>
        </div>
      }
    >
      <Field id="d-note" label="Reason" required hint="The employee will see this.">
        <textarea id="d-note" autoFocus rows={3} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <ErrorNote error={decline.error} />
    </Dialog>
  );
}

function FileDialog({ day, kind, onClose }: { day: DayRow; kind: Kind; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const max = kind === "overtime" ? day.extraMinutes : day.undertimeMinutes;
  const [minutes, setMinutes] = useState(max);
  const [reason, setReason] = useState("");
  const file = useMutation({
    mutationFn: () => fileRequest({ employeeId: day.person.id, date: day.date, type: kind, minutes, reason }, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      toast.show("Request filed. It's now waiting for approval.");
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`File ${kind} for ${day.person.name}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => file.mutate()} disabled={file.isPending}>
            File request
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-2">
          {shortDate(day.date)}: {kind === "overtime" ? `worked ${duration(max)} past the shift.` : `left ${duration(max)} before the shift ended.`}
        </p>
        <Field id="f-min" label="Minutes" hint={`Up to ${max} minutes.`}>
          <input id="f-min" type="number" min={1} max={max} className={inputClass} value={minutes} onChange={(e) => setMinutes(e.target.valueAsNumber)} />
        </Field>
        <Field id="f-why" label="Reason" required>
          <input id="f-why" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <ErrorNote error={file.error} />
      </div>
    </Dialog>
  );
}

export function RequestsPage({ kind }: { kind: Kind }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const { office } = useOfficeFilter();
  const today = toIsoDate(new Date());
  const from = earliestDate();
  const copy = COPY[kind];
  const requestsQuery = useQuery({ queryKey: tkKeys.requests, queryFn: listRequests });
  const daysQuery = useQuery({ queryKey: tkKeys.days(from, today), queryFn: () => listDays(from, today) });
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [declining, setDeclining] = useState<{ r: TimeRequest; name: string } | null>(null);
  const [filing, setFiling] = useState<DayRow | null>(null);
  const approve = useMutation({
    mutationFn: (r: TimeRequest) => decideRequest(r.id, true, "", actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      toast.show("Approved.");
    },
  });

  const dayMap = useMemo(() => new Map((daysQuery.data ?? []).map((d) => [`${d.person.id}|${d.date}`, d])), [daysQuery.data]);
  const q = query.trim().toLowerCase();
  const keep = (d?: DayRow) => !!d && (office === "All offices" || d.person.branch === office) && (!q || d.person.name.toLowerCase().includes(q));
  const requests = (requestsQuery.data ?? []).filter((r) => r.type === kind && keep(dayMap.get(`${r.employeeId}|${r.date}`)));
  const filed = new Set((requestsQuery.data ?? []).filter((r) => r.type === kind && r.status !== "declined").map((r) => `${r.employeeId}|${r.date}`));
  const unfiled = (daysQuery.data ?? []).filter((d) => d.date >= addDays(today, -13) && keep(d) && !filed.has(`${d.person.id}|${d.date}`) && (kind === "overtime" ? d.extraMinutes >= 30 : d.undertimeMinutes > 0));
  const loading = requestsQuery.isLoading || daysQuery.isLoading;
  const count = (s: TimeRequest["status"]) => requests.filter((r) => r.status === s).length;

  if (requestsQuery.isError || daysQuery.isError) return <LoadError onRetry={() => (requestsQuery.refetch(), daysQuery.refetch())} />;

  const measure = (d: DayRow) => duration(kind === "overtime" ? d.extraMinutes : d.undertimeMinutes);
  const shiftCell = (d: DayRow) => (d.shift && d.kind === "work" ? `${hhmm(d.shift.start)} – ${hhmm(d.shift.end)}` : "Day off");

  const requestCols: Col<TimeRequest>[] = [
    { header: "Employee", cell: (r) => <Name name={dayMap.get(`${r.employeeId}|${r.date}`)!.person.name} sub={dayMap.get(`${r.employeeId}|${r.date}`)!.person.departmentName} /> },
    { header: "Date", cell: (r) => shortDate(r.date) },
    { header: "Shift", cell: (r) => shiftCell(dayMap.get(`${r.employeeId}|${r.date}`)!) },
    { header: kind === "overtime" ? "Time out" : "Left at", cell: (r) => { const d = dayMap.get(`${r.employeeId}|${r.date}`)!; return d.timeOut ? clock(d.timeOut.at) : "—"; } },
    { header: copy.measure, cell: (r) => measure(dayMap.get(`${r.employeeId}|${r.date}`)!) },
    { header: "Requested", cell: (r) => <span className="font-medium">{duration(r.minutes)}</span> },
    { header: "Reason", cell: (r) => <span className="inline-block max-w-44 truncate align-bottom text-ink-2" title={r.reason}>{r.reason}</span> },
    {
      header: tab === "pending" ? "" : "Decision",
      align: "right",
      cell: (r) =>
        r.status === "pending" ? (
          <span className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setDeclining({ r, name: dayMap.get(`${r.employeeId}|${r.date}`)!.person.name })}>
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
  const unfiledCols: Col<DayRow>[] = [
    { header: "Employee", cell: (d) => <Name name={d.person.name} sub={d.person.departmentName} /> },
    { header: "Date", cell: (d) => shortDate(d.date) },
    { header: "Shift", cell: shiftCell },
    { header: kind === "overtime" ? "Time out" : "Left at", cell: (d) => (d.timeOut ? clock(d.timeOut.at) : "—") },
    { header: copy.measure, cell: (d) => <span className="font-medium">{measure(d)}</span> },
    {
      header: "",
      align: "right",
      cell: (d) => (
        <Button size="sm" variant="ghost" onClick={() => setFiling(d)}>
          File {kind}
        </Button>
      ),
    },
  ];

  return (
    <>
      <ContentHead title={copy.title} subtitle={copy.subtitle} />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "pending", label: "Waiting for approval", count: count("pending") },
          { value: "approved", label: "Approved", count: count("approved") },
          { value: "declined", label: "Declined", count: count("declined") },
          { value: "unfiled", label: copy.unfiled, count: unfiled.length },
        ]}
      />
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} />
      </Toolbar>
      {tab === "unfiled" ? (
        <SimpleTable rows={unfiled} rowKey={(d) => `${d.person.id}|${d.date}`} cols={unfiledCols} loading={loading} empty="Nothing here. Everyone has a request on file." />
      ) : (
        <SimpleTable rows={requests.filter((r) => r.status === tab)} rowKey={(r) => r.id} cols={requestCols} loading={loading} empty={tab === "pending" ? "No requests waiting." : "Nothing here yet."} />
      )}
      {tab === "unfiled" && <p className="text-xs text-ink-3">{kind === "overtime" ? "Days in the last 2 weeks where someone stayed 30 minutes or more past their shift." : "Days in the last 2 weeks where someone left before their shift ended."}</p>}
      {declining && <DeclineDialog r={declining.r} name={declining.name} onClose={() => setDeclining(null)} />}
      {filing && <FileDialog day={filing} kind={kind} onClose={() => setFiling(null)} />}
    </>
  );
}

export function OvertimePage() {
  return <RequestsPage kind="overtime" />;
}

export function UndertimePage() {
  return <RequestsPage kind="undertime" />;
}
