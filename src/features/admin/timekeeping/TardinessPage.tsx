import { useMemo, useState } from "react";
import { useCan } from "@/lib/useCan";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { getTardinessRule, listAwolFlags, listDays, listNotices, listTardinessFlags, saveTardinessRule, sendNotice, type AwolFlag, type DayRow, type TardinessFlag, type TkPerson } from "@/lib/timekeeping/api";
import { addDays, toIsoDate } from "@/lib/timekeeping/compute";
import type { AttendanceNotice, TardinessRule } from "@/lib/timekeeping/types";
import { useOfficeFilter } from "../OfficeFilterContext";
import { inputClass, useActor } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { Choice, Name, SearchBox, SimpleTable, Tabs, Toolbar, type Col } from "./common";
import { PERIODS, clock, duration, hhmm, ruleText, shortDate, tkKeys } from "./format";

type Tab = "list" | "summary" | "habitual";

function RuleDialog({ rule, onClose }: { rule: TardinessRule; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [consecutive, setConsecutive] = useState(rule.consecutive);
  const [perMonth, setPerMonth] = useState(rule.perMonth);
  const save = useMutation({
    mutationFn: () => saveTardinessRule({ consecutive, perMonth }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      toast.show("Saved. Flags now follow the new rule.");
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="When to flag lateness"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">Flagged employees show up here and on the overview so HR can follow up. A flag never changes pay or marks anyone absent. Set a number to 0 to turn that check off.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field id="tr-run" label="Work days late in a row" hint="Days off, leave and holidays don't break it.">
            <input id="tr-run" type="number" min={0} max={10} className={inputClass} value={consecutive} onChange={(e) => setConsecutive(e.target.valueAsNumber)} />
          </Field>
          <Field id="tr-month" label="Times late in a month">
            <input id="tr-month" type="number" min={0} max={31} className={inputClass} value={perMonth} onChange={(e) => setPerMonth(e.target.valueAsNumber)} />
          </Field>
        </div>
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}

const range = (from: string, to: string) => (from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`);

type NoticeTarget = { kind: AttendanceNotice["kind"]; person: TkPerson; dates: string[] };

/** A memo to the employee, written for them; HR can change the wording before sending. */
function NoticeDialog({ target, onClose }: { target: NoticeTarget; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const first = target.person.name.split(" ")[0];
  const days = [...target.dates].sort().map(shortDate).join(", ");
  const [subject, setSubject] = useState(target.kind === "awol" ? "Notice on absence without leave" : "Notice on repeated tardiness");
  const [message, setMessage] = useState(
    target.kind === "awol"
      ? `Hi ${first},\n\nOur records show you were absent from work without approved leave on ${days}. Please report to HR as soon as possible to explain your absence.\n\nThank you.`
      : `Hi ${first},\n\nOur records show you were late on ${days}. Repeated tardiness affects your team and goes against company policy. Please talk to HR and make sure to report on time going forward.\n\nThank you.`,
  );
  const send = useMutation({
    mutationFn: () => sendNotice({ employeeId: target.person.id, kind: target.kind, subject, message, dates: target.dates }, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      queryClient.invalidateQueries({ queryKey: ["ess"] });
      toast.show(`Notice sent. ${first} will see it on their attendance page.`);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Send ${target.person.name} a notice`}
      size="lg"
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={send.isPending} onClick={() => send.mutate()}>
            Send notice
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-ink-2">The employee sees this on their My attendance page and confirms they read it. It doesn&#39;t change their pay.</p>
        <Field id="nt-subject" label="Subject">
          <input id="nt-subject" className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field id="nt-message" label="Message">
          <textarea id="nt-message" rows={8} className={inputClass} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <ErrorNote error={send.error} />
      </div>
    </Dialog>
  );
}

/** Late arrivals: minutes after the shift start, past the grace period. */
export function TardinessPage() {
  const { office } = useOfficeFilter();
  const canEditRule = useCan("edit", "rules");
  const canNotice = useCan("edit", "attendanceRecords");
  const today = toIsoDate(new Date());
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "habitual" ? "habitual" : "list");
  const [period, setPeriod] = useState("30");
  const [query, setQuery] = useState("");
  const [editingRule, setEditingRule] = useState(false);
  const from = addDays(today, -(Number(period) - 1));
  const daysQuery = useQuery({ queryKey: tkKeys.days(from, today), queryFn: () => listDays(from, today) });
  const flagsQuery = useQuery({ queryKey: tkKeys.tardinessFlags, queryFn: listTardinessFlags });
  const ruleQuery = useQuery({ queryKey: tkKeys.tardinessRule, queryFn: getTardinessRule });
  const awolQuery = useQuery({ queryKey: ["timekeeping", "awol-flags"], queryFn: listAwolFlags });
  const noticesQuery = useQuery({ queryKey: ["timekeeping", "notices"], queryFn: () => listNotices() });
  const [noticeFor, setNoticeFor] = useState<NoticeTarget | null>(null);
  const q = query.trim().toLowerCase();
  const days = useMemo(() => (daysQuery.data ?? []).filter((d) => (office === "All offices" || d.person.branch === office) && (!q || d.person.name.toLowerCase().includes(q))), [daysQuery.data, office, q]);
  const shown = (p: TkPerson) => (office === "All offices" || p.branch === office) && (!q || p.name.toLowerCase().includes(q));
  const flags = (flagsQuery.data ?? []).filter((f) => shown(f.person));
  const awol = (awolQuery.data ?? []).filter((f) => shown(f.person));
  /** The latest notice of a kind sent to someone. */
  const lastNotice = (id: string, kind: AttendanceNotice["kind"]) => noticesQuery.data?.find((n) => n.employeeId === id && n.kind === kind);
  const late = days.filter((d) => d.lateMinutes > 0).sort((a, b) => b.date.localeCompare(a.date) || b.lateMinutes - a.lateMinutes);
  const summary = [...new Map(late.map((d) => [d.person.id, d.person])).values()]
    .map((p) => {
      const mine = late.filter((d) => d.person.id === p.id);
      return { person: p, times: mine.length, minutes: mine.reduce((n, d) => n + d.lateMinutes, 0), last: mine[0]!.date };
    })
    .sort((a, b) => b.minutes - a.minutes);

  if (daysQuery.isError || flagsQuery.isError) return <LoadError onRetry={() => (daysQuery.refetch(), flagsQuery.refetch())} />;

  const rule = ruleQuery.data;
  const habitualCols: Col<TardinessFlag>[] = [
    { header: "Employee", cell: (f) => <Name name={f.person.name} sub={f.person.departmentName} /> },
    {
      header: "Why flagged",
      cell: (f) => (
        <span className="flex flex-wrap gap-1.5">
          {f.streaks[0] && <Pill tone="crit">{f.streaks[0].days} days in a row</Pill>}
          {f.thisMonth && <Pill tone="warn">{f.thisMonth} times this month</Pill>}
        </span>
      ),
    },
    { header: "In a row", cell: (f) => (f.streaks.length ? f.streaks.map((s) => range(s.from, s.to)).join(", ") : "—") },
    { header: "Late days (last 30 days)", cell: (f) => <span className="inline-block max-w-72 truncate align-bottom text-ink-2" title={f.lateDates.map(shortDate).join(", ")}>{f.lateDates.map(shortDate).join(", ")}</span> },
    { header: "Notice", align: "right", cell: (f) => noticeCell(f.person, "tardiness", f.streaks[0] ? lateDatesIn(f) : f.lateDates) },
  ];
  const awolCols: Col<AwolFlag>[] = [
    { header: "Employee", cell: (f) => <Name name={f.person.name} sub={f.person.departmentName} /> },
    { header: "Why flagged", cell: (f) => <Pill tone="crit">AWOL {f.dates.length} {f.dates.length === 1 ? "day" : "days"}</Pill> },
    { header: "AWOL days", cell: (f) => <span className="text-ink-2">{[...f.dates].sort().map(shortDate).join(", ")}</span> },
    { header: "Notice", align: "right", cell: (f) => noticeCell(f.person, "awol", f.dates) },
  ];

  function lateDatesIn(f: TardinessFlag) {
    const s = f.streaks[0]!;
    return f.lateDates.filter((d) => d >= s.from && d <= s.to);
  }

  function noticeCell(person: TkPerson, kind: AttendanceNotice["kind"], dates: string[]) {
    const sent = lastNotice(person.id, kind);
    return (
      <span className="flex items-center justify-end gap-2">
        {sent && (
          <span className="text-xs text-ink-2" title={sent.subject}>
            Sent {shortDate(sent.sentAt)}
            {sent.acknowledgedAt ? " · read" : ""}
          </span>
        )}
        {canNotice && (
          <Button size="sm" variant="ghost" onClick={() => setNoticeFor({ kind, person, dates })}>
            {sent ? "Send again" : "Send notice"}
          </Button>
        )}
      </span>
    );
  }

  return (
    <>
      <ContentHead
        title="Tardiness"
        subtitle={`Minutes late after each shift's grace period (8:30 AM shift, 5 min grace, in at 8:44 AM = 9 min late). ${late.length} late ${late.length === 1 ? "arrival" : "arrivals"}, ${duration(late.reduce((n, d) => n + d.lateMinutes, 0))} in total.`}
        actions={
          canEditRule && rule && (
            <Button variant="ghost" onClick={() => setEditingRule(true)}>
              Flag rule
            </Button>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "list", label: "Late arrivals", count: late.length },
          { value: "summary", label: "By employee", count: summary.length },
          { value: "habitual", label: "Flags", count: flags.length + awol.length },
        ]}
      />
      <Toolbar>
        {tab !== "habitual" && <Choice label="Period" value={period} onChange={setPeriod} options={PERIODS} />}
        <SearchBox value={query} onChange={setQuery} />
      </Toolbar>
      {tab === "habitual" ? (
        <>
          {rule && (
            <p className="text-sm text-ink-2">
              Flagged when {ruleText(rule)}. Covers the last 30 days and this month. For HR follow-up only; pay and attendance stay as recorded.
            </p>
          )}
          <SimpleTable rows={flags} rowKey={(f) => f.person.id} loading={flagsQuery.isLoading} empty={rule && ruleText(rule) === "off" ? "Flags are turned off." : "No one meets the rule right now."} cols={habitualCols} />
          <h2 className="mt-2 font-display text-base font-semibold">AWOL</h2>
          <p className="-mt-2 text-sm text-ink-2">Absent 3 or more workdays in a row without approved leave, in the last 30 days. Every absent day is deducted from pay; from the 3rd day it counts as AWOL.</p>
          <SimpleTable rows={awol} rowKey={(f) => f.person.id} loading={awolQuery.isLoading} empty="No one is AWOL in the last 30 days." cols={awolCols} />
        </>
      ) : tab === "list" ? (
        <SimpleTable<DayRow>
          rows={late}
          rowKey={(d) => `${d.person.id}|${d.date}`}
          loading={daysQuery.isLoading}
          empty="No one was late in this period."
          cols={[
            { header: "Date", cell: (d) => shortDate(d.date) },
            { header: "Employee", cell: (d) => <Name name={d.person.name} sub={d.person.departmentName} /> },
            { header: "Shift starts", cell: (d) => (d.shift ? hhmm(d.shift.start) : "—") },
            { header: "Time in", cell: (d) => (d.timeIn ? clock(d.timeIn.at) : "—") },
            { header: "Grace period", cell: (d) => (d.shift ? `${d.shift.graceMinutes} min` : "—") },
            { header: "Minutes late", align: "right", cell: (d) => <span className="font-semibold text-warning">{duration(d.lateMinutes)}</span> },
          ]}
        />
      ) : (
        <SimpleTable
          rows={summary}
          rowKey={(s) => s.person.id}
          loading={daysQuery.isLoading}
          empty="No one was late in this period."
          cols={[
            { header: "Employee", cell: (s) => <Name name={s.person.name} sub={s.person.departmentName} /> },
            { header: "Times late", cell: (s) => s.times },
            { header: "Total late", cell: (s) => <span className="font-semibold text-warning">{duration(s.minutes)}</span> },
            { header: "Most recent", cell: (s) => shortDate(s.last) },
          ]}
        />
      )}
      {editingRule && rule && <RuleDialog rule={rule} onClose={() => setEditingRule(false)} />}
      {noticeFor && <NoticeDialog target={noticeFor} onClose={() => setNoticeFor(null)} />}
    </>
  );
}
