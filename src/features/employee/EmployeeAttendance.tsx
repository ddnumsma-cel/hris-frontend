import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { acknowledgeMyNotice, fileMyFix, fileMyTimeRequest, myAttendance, myNotices } from "@/lib/ess/api";
import type { DayRow } from "@/lib/timekeeping/api";
import { addDays } from "@/lib/timekeeping/compute";
import type { FixCause } from "@/lib/timekeeping/types";
import { isoToday } from "@/lib/leave/api";
import { inputClass } from "../admin/corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../admin/corehr/ui";
import { SimpleTable, Tabs, type Col } from "../admin/timekeeping/common";
import { FIX_CAUSES, clock, dayStatus, duration, hhmm, lunchText, shortDate } from "../admin/timekeeping/format";

const KEY = ["ess", "attendance"] as const;

type Ask = { kind: "overtime" | "undertime"; day: DayRow };
type Adjust = { date?: string; punch: "in" | "out" };

interface RequestRow {
  id: string;
  date: string;
  what: string;
  detail: string;
  reason: string;
  status: "pending" | "approved" | "declined";
  note?: string;
  filedAt: string;
}

const STATUS = { pending: { tone: "warn", label: "Waiting for HR" }, approved: { tone: "good", label: "Approved" }, declined: { tone: "crit", label: "Declined" } } as const;

function AskDialog({ ask, onClose }: { ask: Ask; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const max = ask.kind === "overtime" ? ask.day.extraMinutes : ask.day.undertimeMinutes;
  const [minutes, setMinutes] = useState(max);
  const [reason, setReason] = useState("");
  const send = useMutation({
    mutationFn: () => fileMyTimeRequest({ date: ask.day.date, type: ask.kind, minutes, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ess"] });
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      toast.show("Sent to HR. You'll see the answer under My requests.");
      onClose();
    },
  });
  const title = ask.kind === "overtime" ? "Request overtime" : "Explain leaving early";

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={send.isPending} onClick={() => send.mutate()}>
            Send to HR
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">
          {shortDate(ask.day.date)}: {ask.kind === "overtime" ? `you worked ${duration(max)} past your shift.` : `you left ${duration(max)} before your shift ended.`}{" "}
          {ask.kind === "overtime" ? "It's paid as overtime once HR approves it." : "Approval excuses it; the time is still unpaid."}
        </p>
        {ask.kind === "overtime" && (
          <Field id="a-min" label="Minutes to claim" hint={`Up to ${max} minutes.`}>
            <input id="a-min" type="number" min={1} max={max} className={inputClass} value={minutes} onChange={(e) => setMinutes(e.target.valueAsNumber)} />
          </Field>
        )}
        <Field id="a-why" label="Reason" required>
          <input id="a-why" className={inputClass} value={reason} placeholder={ask.kind === "overtime" ? "e.g. Client deadline" : "e.g. Doctor's appointment"} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <ErrorNote error={send.error} />
      </div>
    </Dialog>
  );
}

/** Asking HR to correct a time-in or time-out the biometrics or the system got wrong. */
function AdjustDialog({ adjust, days, onClose }: { adjust: Adjust; days: DayRow[]; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const today = isoToday();
  const recordFor = (date: string, punch: "in" | "out") => {
    const day = days.find((d) => d.date === date);
    return { day, onRecord: punch === "in" ? day?.timeIn : day?.timeOut };
  };
  // A recorded punch suggests the device got the time wrong; none, that it missed the scan.
  const defaults = (date: string, punch: "in" | "out") => {
    const { day, onRecord } = recordFor(date, punch);
    return { cause: (onRecord ? "wrong-time" : "not-recorded") as FixCause, time: day?.shift ? (punch === "in" ? day.shift.start : day.shift.end) : "" };
  };
  const [date, setDate] = useState(adjust.date ?? today);
  const [punch, setPunch] = useState(adjust.punch);
  const [cause, setCause] = useState(() => defaults(date, punch).cause);
  const [time, setTime] = useState(() => defaults(date, punch).time);
  const [nextDay, setNextDay] = useState(false);
  const { onRecord } = recordFor(date, punch);
  const pick = (d: string, p: "in" | "out") => {
    const next = defaults(d, p);
    setDate(d);
    setPunch(p);
    setCause(next.cause);
    setTime(next.time);
    if (p === "in") setNextDay(false);
  };
  const [reason, setReason] = useState("");
  const send = useMutation({
    mutationFn: () => fileMyFix({ workDate: date, kind: punch, time, nextDay, cause, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ess"] });
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      toast.show("Sent to HR. You'll see the answer under My requests.");
      onClose();
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Request a time adjustment"
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={send.isPending} onClick={() => send.mutate()}>
            Send to HR
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">If the biometrics missed your scan, recorded the wrong time, or the system had a bug, tell HR the correct time. It changes your record only once HR or Admin approves it.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field id="adj-date" label="Work day">
            <input id="adj-date" type="date" className={inputClass} max={today} min={addDays(today, -30)} value={date} onChange={(e) => pick(e.target.value, punch)} />
          </Field>
          <Field id="adj-punch" label="Which one">
            <select id="adj-punch" className={inputClass} value={punch} onChange={(e) => pick(date, e.target.value as "in" | "out")}>
              <option value="in">Time-in</option>
              <option value="out">Time-out</option>
            </select>
          </Field>
        </div>
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">
          On record: <span className="font-medium text-ink">{onRecord ? clock(onRecord.at) : `no time-${punch}`}</span>
        </p>
        <Field id="adj-cause" label="What happened">
          <select id="adj-cause" className={inputClass} value={cause} onChange={(e) => setCause(e.target.value as FixCause)}>
            {(Object.keys(FIX_CAUSES) as FixCause[]).map((c) => (
              <option key={c} value={c}>
                {FIX_CAUSES[c]}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="adj-time" label="Correct time">
            <input id="adj-time" type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          {punch === "out" && (
            <label className="mt-6 flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" checked={nextDay} onChange={(e) => setNextDay(e.target.checked)} /> After midnight
            </label>
          )}
        </div>
        <Field id="adj-why" label="Details" required>
          <input id="adj-why" className={inputClass} value={reason} placeholder="e.g. Scanner didn't read my finger, so I signed the logbook" onChange={(e) => setReason(e.target.value)} />
        </Field>
        <ErrorNote error={send.error} />
      </div>
    </Dialog>
  );
}

/** Memos from HR about lateness or AWOL, until the employee confirms they read them. */
function Notices() {
  const queryClient = useQueryClient();
  const notices = useQuery({ queryKey: ["ess", "notices"], queryFn: myNotices, staleTime: 0 });
  const ack = useMutation({
    mutationFn: acknowledgeMyNotice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ess", "notices"] });
      queryClient.invalidateQueries({ queryKey: ["timekeeping", "notices"] });
    },
  });
  const unread = (notices.data ?? []).filter((n) => !n.acknowledgedAt);
  if (!unread.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {unread.map((n) => (
        <section key={n.id} aria-label="Notice from HR" className="flex flex-col gap-2 rounded-2xl border border-warning/40 bg-warning-tint px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-semibold">{n.subject}</h2>
            <span className="text-xs text-ink-2">
              From {n.sentBy} · {shortDate(n.sentAt)}
            </span>
          </div>
          <p className="text-sm whitespace-pre-line text-ink">{n.message}</p>
          <Button size="sm" className="self-start" disabled={ack.isPending} onClick={() => ack.mutate(n.id)}>
            I&#39;ve read this
          </Button>
        </section>
      ))}
    </div>
  );
}

export function EmployeeAttendance() {
  const data = useQuery({ queryKey: KEY, queryFn: myAttendance, staleTime: 0 });
  const [tab, setTab] = useState<"logs" | "requests">("logs");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [adjust, setAdjust] = useState<Adjust | null>(null);

  if (data.isError) return <LoadError onRetry={() => data.refetch()} />;

  const days = data.data?.days ?? [];
  const requests = data.data?.requests ?? [];
  const fixes = data.data?.fixes ?? [];
  const filed = (date: string, type: string) => requests.some((r) => r.date === date && r.type === type && r.status !== "declined");
  const fixFiled = (date: string, kind: string) => fixes.some((r) => r.workDate === date && r.kind === kind && r.status === "pending");
  const worked = days.filter((d) => d.timeIn);
  const late = days.filter((d) => d.lateMinutes > 0);
  const otHours = Math.round((days.reduce((n, d) => n + d.approvedOvertimeMinutes, 0) / 60) * 10) / 10;

  const rows: RequestRow[] = [
    ...requests.map((r) => ({ id: r.id, date: r.date, what: r.type === "overtime" ? "Overtime" : "Leaving early", detail: duration(r.minutes), reason: r.reason, status: r.status, note: r.note, filedAt: r.filedAt })),
    ...fixes.map((r) => ({
      id: r.id,
      date: r.workDate,
      what: `Time-${r.kind} adjustment`,
      detail: `${r.recorded ? `${hhmm(r.recorded)} → ` : ""}${hhmm(r.time)}${r.nextDay ? " (next day)" : ""}`,
      reason: `${FIX_CAUSES[r.cause ?? "not-recorded"]}: ${r.reason}`,
      status: r.status,
      note: r.note,
      filedAt: r.filedAt,
    })),
  ].sort((a, b) => b.filedAt.localeCompare(a.filedAt));
  const waiting = rows.filter((r) => r.status === "pending").length;

  const action = (d: DayRow) => {
    if (d.issues.some((i) => i.kind === "missing-out") && !fixFiled(d.date, "out")) return <Button size="sm" variant="ghost" onClick={() => setAdjust({ date: d.date, punch: "out" })}>Adjust time-out</Button>;
    if (d.status === "absent" && !fixFiled(d.date, "in")) return <Button size="sm" variant="ghost" onClick={() => setAdjust({ date: d.date, punch: "in" })}>Adjust time-in</Button>;
    if (d.extraMinutes >= 30 && !filed(d.date, "overtime")) return <Button size="sm" variant="ghost" onClick={() => setAsk({ kind: "overtime", day: d })}>Request overtime</Button>;
    if (d.undertimeMinutes > 0 && !d.undertimeExcused && !filed(d.date, "undertime")) return <Button size="sm" variant="ghost" onClick={() => setAsk({ kind: "undertime", day: d })}>Explain</Button>;
    if (filed(d.date, "overtime") || filed(d.date, "undertime") || fixFiled(d.date, "in") || fixFiled(d.date, "out")) return <span className="text-xs text-ink-3">Request sent</span>;
    return null;
  };

  const dayCols: Col<DayRow>[] = [
    { header: "Date", cell: (d) => <span className="font-medium">{shortDate(d.date)}</span> },
    { header: "Shift", cell: (d) => <span className="text-ink-2">{d.shift && d.kind === "work" ? `${hhmm(d.shift.start)} – ${hhmm(d.shift.end)}` : d.kind === "leave" ? "On leave" : d.holiday ? d.holiday.name : "Day off"}</span> },
    { header: "Time in", cell: (d) => (d.timeIn ? clock(d.timeIn.at) : "—") },
    {
      header: "Lunch break",
      cell: (d) =>
        d.lunchOut !== undefined ? (
          <span className="inline-flex items-center gap-1.5">
            {lunchText(d)}
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.65rem] font-semibold text-ink-3">Auto</span>
          </span>
        ) : (
          "—"
        ),
    },
    { header: "Time out", cell: (d) => (d.timeOut ? clock(d.timeOut.at) : "—") },
    { header: "Worked", cell: (d) => (d.workedMinutes ? duration(d.workedMinutes) : "—") },
    {
      header: "Status",
      cell: (d) => {
        const s = dayStatus(d);
        return <Pill tone={s.tone}>{s.label}</Pill>;
      },
    },
    { header: "", align: "right", cell: action },
  ];
  const reqCols: Col<RequestRow>[] = [
    { header: "Request", cell: (r) => <span className="font-medium">{r.what}</span> },
    { header: "Day", cell: (r) => shortDate(r.date) },
    { header: "Details", cell: (r) => r.detail },
    { header: "Reason", cell: (r) => <span className="inline-block max-w-56 truncate align-bottom text-ink-2" title={r.reason}>{r.reason}</span> },
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

  const stats = [
    { label: "Days worked", value: String(worked.length), sub: "Last 2 weeks" },
    { label: "Late arrivals", value: String(late.length), sub: late.length ? `${duration(late.reduce((n, d) => n + d.lateMinutes, 0))} in total` : "Nice, all on time" },
    { label: "Approved overtime", value: `${otHours} hrs`, sub: "Paid in your next payslip" },
    { label: "Waiting for HR", value: String(waiting), sub: waiting === 1 ? "request" : "requests" },
  ];

  return (
    <>
      <ContentHead
        title="My attendance"
        subtitle="Your time-ins and time-outs from the last 2 weeks. If the biometrics or system got a time wrong, or you worked late, send a request to HR."
        actions={<Button onClick={() => setAdjust({ punch: "in" })}>Request time adjustment</Button>}
      />
      <Notices />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.isLoading
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)
          : stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
                <div className="text-xs font-semibold text-ink-2">{s.label}</div>
                <div className="mt-1 font-display text-2xl font-semibold">{s.value}</div>
                <div className="mt-0.5 truncate text-xs text-ink-3">{s.sub}</div>
              </div>
            ))}
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "logs", label: "Time logs", count: days.length },
          { value: "requests", label: "My requests", count: rows.length },
        ]}
      />
      {tab === "logs" ? (
        <SimpleTable rows={days} rowKey={(d) => d.date} cols={dayCols} loading={data.isLoading} empty="No time logs yet." />
      ) : (
        <SimpleTable rows={rows} rowKey={(r) => r.id} cols={reqCols} loading={data.isLoading} empty="You haven't sent any requests." />
      )}
      {ask && <AskDialog ask={ask} onClose={() => setAsk(null)} />}
      {adjust && <AdjustDialog adjust={adjust} days={days} onClose={() => setAdjust(null)} />}
    </>
  );
}
