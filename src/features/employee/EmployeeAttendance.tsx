import { useState } from "react";
import { ApproverNote } from "./ApproverNote";
import { TimeRequestDialog, type Ask } from "./TimeRequestDialog";
import { useCreateParam } from "@/lib/useCreateParam";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { acknowledgeMyNotice, fileMyFix, myAttendance, myNotices } from "@/lib/ess/api";
import { myWfhDays } from "@/lib/ess/more";
import { fmtTime } from "@/lib/preferences";
import type { DayRow } from "@/lib/timekeeping/api";
import { addDays } from "@/lib/timekeeping/compute";
import type { FixCause } from "@/lib/timekeeping/types";
import { isoToday } from "@/lib/leave/api";
import { inputClass } from "../admin/corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../admin/corehr/ui";
import { Choice, SimpleTable, Tabs, Toolbar, type Col } from "../admin/timekeeping/common";
import { filterSelectClass } from "../admin/corehr/format";
import { FIX_CAUSES, clock, dayStatus, duration, hhmm, lunchText, requestSpan, shortDate } from "../admin/timekeeping/format";

const KEY = ["ess", "attendance"] as const;

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

const STATUS = { pending: { tone: "warn", label: "Waiting for your approver" }, approved: { tone: "good", label: "Approved" }, declined: { tone: "crit", label: "Declined" } } as const;


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
      toast.show("Sent for approval. You'll be notified when it's decided.");
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
            Send to your manager
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <ApproverNote kind="correction" />
        <p className="text-sm text-ink-2">If the biometrics missed your scan, recorded the wrong time, or the system had a bug, give the correct time. It changes your record only once your manager approves it.</p>
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
  // Which days to show: this month by default, last month, everything, or picked dates.
  const today = isoToday();
  const [period, setPeriod] = useState("month");
  const [custom, setCustom] = useState({ from: addDays(today, -13), to: today });
  const month = (back: number) => {
    const d = new Date(`${today.slice(0, 7)}-01T12:00:00`);
    d.setMonth(d.getMonth() - back);
    const from = d.toISOString().slice(0, 10);
    d.setMonth(d.getMonth() + 1, 0);
    return { from, to: d.toISOString().slice(0, 10) };
  };
  const periods: Record<string, { label: string; from: string; to: string }> = {
    all: { label: "All time", from: "all", to: today },
    lastMonth: { label: "Last month", ...month(1) },
    month: { label: "This month", ...month(0) },
    custom: { label: "Custom dates…", ...custom },
  };
  const range = periods[period] ?? periods.month!;
  const data = useQuery({ queryKey: [...KEY, range.from, range.to], queryFn: () => myAttendance(range.from, range.to), staleTime: 0 });
  const [tab, setTab] = useState<"logs" | "requests" | "wfh">("logs");
  const wfh = useQuery({ queryKey: ["ess", "wfh-days"], queryFn: myWfhDays, staleTime: 0 });
  const [ask, setAsk] = useState<Ask | null>(null);
  const [adjust, setAdjust] = useState<Adjust | null>(null);
  useCreateParam("adjustment", () => setAdjust({ punch: "in" }));

  if (data.isError) return <LoadError error={data.error} onRetry={() => data.refetch()} />;

  const days = data.data?.days ?? [];
  const requests = data.data?.requests ?? [];
  const fixes = data.data?.fixes ?? [];
  const filed = (date: string, type: string) => requests.some((r) => r.date === date && r.type === type && r.status !== "declined");
  const fixFiled = (date: string, kind: string) => fixes.some((r) => r.workDate === date && r.kind === kind && r.status === "pending");
  const worked = days.filter((d) => d.timeIn);
  const late = days.filter((d) => d.lateMinutes > 0);
  const otHours = Math.round((days.reduce((n, d) => n + d.approvedOvertimeMinutes, 0) / 60) * 10) / 10;

  const rows: RequestRow[] = [
    ...requests.map((r) => ({ id: r.id, date: r.date, what: r.type === "overtime" ? "Overtime" : "Leaving early", detail: requestSpan(r), reason: r.reason, status: r.status, note: r.note, filedAt: r.filedAt })),
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
    { label: "Days worked", value: String(worked.length), sub: period === "custom" ? `${shortDate(custom.from)} – ${shortDate(custom.to)}` : range.label },
    { label: "Late arrivals", value: String(late.length), sub: late.length ? `${duration(late.reduce((n, d) => n + d.lateMinutes, 0))} in total` : "Nice, all on time" },
    { label: "Approved overtime", value: `${otHours} hrs`, sub: "Paid in your next payslip" },
    { label: "Waiting for approval", value: String(waiting), sub: waiting === 1 ? "request" : "requests" },
  ];

  return (
    <>
      <ContentHead
        title="Attendance"
        actions={
          <>
            <Button onClick={() => setAdjust({ punch: "in" })}>Request time adjustment</Button>
          </>
        }
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
          { value: "requests", label: "Requests", count: rows.length },
          { value: "wfh", label: "Work from home", count: wfh.data?.length ?? 0 },
        ]}
      />
      {tab === "logs" && (
        <Toolbar>
          <Choice label="Period" value={period} onChange={setPeriod} options={Object.entries(periods).map(([value, p]) => ({ value, label: p.label }))} />
          {period === "custom" && (
            <>
              <input type="date" aria-label="From" className={`${filterSelectClass} pr-3`} max={custom.to} value={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} />
              <span className="text-xs text-ink-3">to</span>
              <input type="date" aria-label="To" className={`${filterSelectClass} pr-3`} min={custom.from} max={today} value={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} />
            </>
          )}
        </Toolbar>
      )}
      {tab === "logs" ? (
        <SimpleTable pageSize={10} rows={days} rowKey={(d) => d.date} cols={dayCols} loading={data.isLoading} empty="No time logs yet." />
      ) : tab === "wfh" ? (
        <SimpleTable
          pageSize={10}
          rows={wfh.data ?? []}
          rowKey={(d) => d.date}
          loading={wfh.isLoading}
          empty="You haven't worked from home yet."
          cols={[
            { header: "Day", cell: (d) => <span className="font-medium">{shortDate(d.date)}</span> },
            { header: "Why", cell: (d) => <span className="text-ink-2">{d.reason}</span> },
            { header: "Clock in", cell: (d) => (d.inAt ? fmtTime(d.inAt) : <span className="text-ink-3">—</span>) },
            { header: "Clock out", cell: (d) => (d.outAt ? fmtTime(d.outAt) : <span className="text-ink-3">—</span>) },
            { header: "Check", cell: (d) => (d.inAt ? <Pill tone="good">{d.located ? "Face scan + location" : "Face scan"}</Pill> : <Pill tone="warn">No clock-in</Pill>) },
          ]}
        />
      ) : (
        <SimpleTable pageSize={10} rows={rows} rowKey={(r) => r.id} cols={reqCols} loading={data.isLoading} empty="You haven't sent any requests." />
      )}
      {ask && <TimeRequestDialog ask={ask} onClose={() => setAsk(null)} />}
      {adjust && <AdjustDialog adjust={adjust} days={days} onClose={() => setAdjust(null)} />}
    </>
  );
}
