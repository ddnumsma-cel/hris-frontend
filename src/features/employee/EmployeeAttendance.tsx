import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { fileMyFix, fileMyTimeRequest, myAttendance } from "@/lib/ess/api";
import type { DayRow } from "@/lib/timekeeping/api";
import { addDays } from "@/lib/timekeeping/compute";
import { isoToday } from "@/lib/leave/api";
import { inputClass } from "../admin/corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../admin/corehr/ui";
import { SimpleTable, Tabs, type Col } from "../admin/timekeeping/common";
import { clock, dayStatus, duration, hhmm, lunchText, shortDate } from "../admin/timekeeping/format";

const KEY = ["ess", "attendance"] as const;

type Ask = { kind: "overtime" | "undertime"; day: DayRow } | { kind: "fix"; day?: DayRow; punch: "in" | "out" };

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
  const today = isoToday();
  const max = ask.kind === "overtime" ? ask.day.extraMinutes : ask.kind === "undertime" ? ask.day.undertimeMinutes : 0;
  const [minutes, setMinutes] = useState(max);
  const [date, setDate] = useState(ask.day?.date ?? today);
  const [punch, setPunch] = useState<"in" | "out">(ask.kind === "fix" ? ask.punch : "in");
  const defaultTime = ask.kind === "fix" && ask.day?.shift ? (punch === "in" ? ask.day.shift.start : ask.day.shift.end) : "";
  const [time, setTime] = useState(defaultTime);
  const [nextDay, setNextDay] = useState(false);
  const [reason, setReason] = useState("");
  const send = useMutation({
    mutationFn: (): Promise<unknown> =>
      ask.kind === "fix"
        ? fileMyFix({ workDate: date, kind: punch, time, nextDay, reason })
        : fileMyTimeRequest({ date: ask.day.date, type: ask.kind, minutes, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ess"] });
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      toast.show("Sent to HR. You'll see the answer under My requests.");
      onClose();
    },
  });
  const title = ask.kind === "overtime" ? "Request overtime" : ask.kind === "undertime" ? "Explain leaving early" : "Fix a missed time-in or time-out";

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
        {ask.kind !== "fix" && (
          <>
            <p className="text-sm text-ink-2">
              {shortDate(ask.day.date)}: {ask.kind === "overtime" ? `you worked ${duration(max)} past your shift.` : `you left ${duration(max)} before your shift ended.`}{" "}
              {ask.kind === "overtime" ? "It's paid as overtime once HR approves it." : "Approval excuses it; the time is still unpaid."}
            </p>
            {ask.kind === "overtime" && (
              <Field id="a-min" label="Minutes to claim" hint={`Up to ${max} minutes.`}>
                <input id="a-min" type="number" min={1} max={max} className={inputClass} value={minutes} onChange={(e) => setMinutes(e.target.valueAsNumber)} />
              </Field>
            )}
          </>
        )}
        {ask.kind === "fix" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field id="a-date" label="Work day">
                <input id="a-date" type="date" className={inputClass} max={today} min={addDays(today, -30)} value={date} disabled={!!ask.day} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field id="a-kind" label="What's missing">
                <select id="a-kind" className={inputClass} value={punch} onChange={(e) => setPunch(e.target.value as "in" | "out")}>
                  <option value="in">Time-in</option>
                  <option value="out">Time-out</option>
                </select>
              </Field>
              <Field id="a-time" label="Actual time">
                <input id="a-time" type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
              {punch === "out" && (
                <label className="mt-6 flex items-center gap-2 text-sm text-ink-2">
                  <input type="checkbox" checked={nextDay} onChange={(e) => setNextDay(e.target.checked)} /> After midnight
                </label>
              )}
            </div>
          </>
        )}
        <Field id="a-why" label="Reason" required>
          <input id="a-why" className={inputClass} value={reason} placeholder={ask.kind === "fix" ? "e.g. Forgot to tap out" : ask.kind === "overtime" ? "e.g. Client deadline" : "e.g. Doctor's appointment"} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <ErrorNote error={send.error} />
      </div>
    </Dialog>
  );
}

export function EmployeeAttendance() {
  const data = useQuery({ queryKey: KEY, queryFn: myAttendance, staleTime: 0 });
  const [tab, setTab] = useState<"logs" | "requests">("logs");
  const [ask, setAsk] = useState<Ask | null>(null);

  if (data.isError) return <LoadError onRetry={() => data.refetch()} />;

  const days = data.data?.days ?? [];
  const requests = data.data?.requests ?? [];
  const fixes = data.data?.fixes ?? [];
  const filed = (date: string, type: string) => requests.some((r) => r.date === date && r.type === type && r.status !== "declined");
  const fixFiled = (date: string, kind: string) => fixes.some((r) => r.workDate === date && r.kind === kind && r.status !== "declined");
  const worked = days.filter((d) => d.timeIn);
  const late = days.filter((d) => d.lateMinutes > 0);
  const otHours = Math.round((days.reduce((n, d) => n + d.approvedOvertimeMinutes, 0) / 60) * 10) / 10;

  const rows: RequestRow[] = [
    ...requests.map((r) => ({ id: r.id, date: r.date, what: r.type === "overtime" ? "Overtime" : "Leaving early", detail: duration(r.minutes), reason: r.reason, status: r.status, note: r.note, filedAt: r.filedAt })),
    ...fixes.map((r) => ({ id: r.id, date: r.workDate, what: r.kind === "in" ? "Missed time-in" : "Missed time-out", detail: `${hhmm(r.time)}${r.nextDay ? " (next day)" : ""}`, reason: r.reason, status: r.status, note: r.note, filedAt: r.filedAt })),
  ].sort((a, b) => b.filedAt.localeCompare(a.filedAt));
  const waiting = rows.filter((r) => r.status === "pending").length;

  const action = (d: DayRow) => {
    if (d.issues.some((i) => i.kind === "missing-out") && !fixFiled(d.date, "out")) return <Button size="sm" variant="ghost" onClick={() => setAsk({ kind: "fix", day: d, punch: "out" })}>Fix time-out</Button>;
    if (d.status === "absent" && !fixFiled(d.date, "in")) return <Button size="sm" variant="ghost" onClick={() => setAsk({ kind: "fix", day: d, punch: "in" })}>I was at work</Button>;
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
        subtitle="Your time-ins and time-outs from the last 2 weeks. If something's wrong or you worked late, send a request to HR."
        actions={<Button onClick={() => setAsk({ kind: "fix", punch: "in" })}>Fix a missed time-in/out</Button>}
      />
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
    </>
  );
}
