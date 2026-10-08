import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { HomeIcon } from "@/components/icons";
import { cancelRemoteDay, declareRemoteDay, listRemoteDays, remoteAttendanceToday } from "@/lib/timekeeping/api";
import type { RemoteDay } from "@/lib/timekeeping/types";
import { todayIso } from "@/lib/timekeeping/store";
import { useCan } from "@/lib/useCan";
import { inputClass, useActor } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { Name, SimpleTable } from "./common";
import { shortDate } from "./format";
import { useCreateParam } from "@/lib/useCreateParam";

const OFFICES = ["Cebu HQ", "Manila", "Davao"];
const KEY = ["timekeeping", "remote-days"] as const;
const range = (d: RemoteDay) => (d.from === d.to ? shortDate(d.from) : `${shortDate(d.from)} – ${shortDate(d.to)}`);
const where = (d: RemoteDay) => (d.offices.length ? d.offices.join(", ") : "All offices");
const statusOf = (d: RemoteDay) => (d.to < todayIso() ? "past" : d.from > todayIso() ? "upcoming" : "today");

function DeclareDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const today = todayIso();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [offices, setOffices] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const toggle = (o: string) => setOffices((list) => (list.includes(o) ? list.filter((x) => x !== o) : [...list, o]));
  const save = useMutation({
    mutationFn: () => declareRemoteDay({ from, to, offices, reason }, actor),
    onSuccess: (d) => {
      queryClient.invalidateQueries();
      toast.show(`${range(d)} is a remote work day for ${where(d)}. Employees can clock in from home with a face scan.`);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Declare a remote work day"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={<HomeIcon className="h-3.75 w-3.75" />} disabled={save.isPending} onClick={() => save.mutate()}>
            Declare
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">For a typhoon or other emergency. On these days the office scanners aren&#39;t used: everyone covered clocks in and out from home with a face scan, and that becomes their attendance. Anyone who doesn&#39;t clock in is marked absent as usual.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field id="rd-from" label="From">
            <input id="rd-from" type="date" min={today} className={inputClass} value={from} onChange={(e) => (setFrom(e.target.value), e.target.value > to && setTo(e.target.value))} />
          </Field>
          <Field id="rd-to" label="To">
            <input id="rd-to" type="date" min={from} className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-semibold text-ink-2">Offices</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={offices.length === 0} onClick={() => setOffices([])} className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${offices.length === 0 ? "border-ink bg-ink text-surface" : "border-border bg-surface"}`}>
              All offices
            </button>
            {OFFICES.map((o) => (
              <button key={o} type="button" aria-pressed={offices.includes(o)} onClick={() => toggle(o)} className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${offices.includes(o) ? "border-ink bg-ink text-surface" : "border-border bg-surface"}`}>
                {o}
              </button>
            ))}
          </div>
        </fieldset>
        <Field id="rd-reason" label="Reason" required hint="Employees see this.">
          <input id="rd-reason" className={inputClass} value={reason} placeholder="e.g. Typhoon Kristine, Signal No. 3" onChange={(e) => setReason(e.target.value)} />
        </Field>
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}

/** HR declares work-from-home days; employees then clock in from home with a face scan. */
export function RemoteDaysPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canEdit = useCan("create", "remoteDays");
  const days = useQuery({ queryKey: KEY, queryFn: listRemoteDays, staleTime: 0 });
  const today = useQuery({ queryKey: [...KEY, "today"], queryFn: remoteAttendanceToday, staleTime: 0 });
  const [declaring, setDeclaring] = useState(false);
  useCreateParam("remote-day", () => setDeclaring(true));
  const cancel = useMutation({
    mutationFn: (d: RemoteDay) => cancelRemoteDay(d.id),
    onSuccess: () => (queryClient.invalidateQueries(), toast.show("Remote work day cancelled. The office scanners count again.")),
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't cancel.", "critical"),
  });

  if (days.isError) return <LoadError onRetry={() => days.refetch()} />;
  const covered = today.data?.covered ?? [];
  const inSet = new Set(today.data?.clockedIn ?? []);
  const notYet = covered.filter((p) => !inSet.has(p.id));

  return (
    <>
      <ContentHead
        title="Remote work days"
        subtitle="Typhoon or emergency? Declare a remote work day and everyone clocks in from home with a face scan instead of the office scanner."
        actions={
          canEdit ? (
            <Button icon={<HomeIcon className="h-3.75 w-3.75" />} onClick={() => setDeclaring(true)}>
              Declare remote work day
            </Button>
          ) : undefined
        }
      />

      {covered.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-semibold">Today, from home</h2>
            <span className="text-sm text-ink-2">
              <span className="font-semibold text-ink">{covered.length - notYet.length}</span> of {covered.length} clocked in
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${((covered.length - notYet.length) / covered.length) * 100}%` }} />
          </div>
          {notYet.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-ink-2">Not clocked in yet</span>
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {notYet.map((p) => (
                  <li key={p.id}>
                    <Name name={p.name} sub={p.departmentName} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <SimpleTable
        rows={days.data ?? []}
        rowKey={(d) => d.id}
        loading={days.isLoading}
        empty="No remote work days declared."
        cols={[
          { header: "Days", cell: (d) => <span className="font-medium">{range(d)}</span> },
          {
            header: "Status",
            cell: (d) => {
              const s = statusOf(d);
              return <Pill tone={s === "today" ? "info" : s === "upcoming" ? "warn" : "neutral"}>{s === "today" ? "In effect" : s === "upcoming" ? "Upcoming" : "Past"}</Pill>;
            },
          },
          { header: "Offices", cell: (d) => where(d) },
          { header: "Reason", cell: (d) => <span className="text-ink-2">{d.reason}</span> },
          { header: "Declared by", cell: (d) => <span className="text-ink-2">{d.declaredBy}</span> },
          {
            header: "",
            align: "right",
            cell: (d) =>
              canEdit && statusOf(d) !== "past" ? (
                <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={() => window.confirm(`Cancel the remote work day ${range(d)}?`) && cancel.mutate(d)}>
                  Cancel
                </Button>
              ) : null,
          },
        ]}
      />
      {declaring && <DeclareDialog onClose={() => setDeclaring(false)} />}
    </>
  );
}
