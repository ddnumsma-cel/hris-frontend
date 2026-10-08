import { useMemo, useState } from "react";
import { useCan } from "@/lib/useCan";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { addCorrection, confirmPunch, getDay, listDays, restorePunch, setPunchAside, type DayRow } from "@/lib/timekeeping/api";
import { FACE_MATCH_THRESHOLD, addDays, isOvernight, toIsoDate } from "@/lib/timekeeping/compute";
import type { Punch } from "@/lib/timekeeping/types";
import { useOfficeFilter } from "../OfficeFilterContext";
import { inputClass, useActor } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { Choice, Name, SearchBox, SimpleTable, Toolbar } from "./common";
import { PERIODS as PERIOD_OPTIONS, clock, dayStatus, duration, hhmm, lunchText, shortDate, tkKeys } from "./format";

const SOURCE = { biometric: "Fingerprint", face: "Face recognition", manual: "Added by HR" } as const;

interface Scan {
  punch: Punch;
  day: DayRow;
  problem?: string;
  /** Recorded automatically from the shift's lunch break, not by a device. */
  lunch?: "out" | "in";
}

/** The automatic lunch out / in rows for a day, shaped like scans so they sit in the same log. */
function lunchScans(d: DayRow): Scan[] {
  const mk = (kind: "out" | "in", ms: number): Scan => {
    const t = new Date(ms);
    const local = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}T${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    return { day: d, lunch: kind, punch: { id: `lunch-${d.person.id}-${d.date}-${kind}`, employeeId: d.person.id, workDate: d.date, at: local, kind: kind === "out" ? "out" : "in", source: "manual", device: "Lunch break schedule", deviceRegistered: true } };
  };
  return [...(d.lunchOut !== undefined ? [mk("out", d.lunchOut)] : []), ...(d.lunchIn !== undefined ? [mk("in", d.lunchIn)] : [])];
}

function problemOf(p: Punch, d: DayRow): string | undefined {
  if (p.voided || p.confirmed) return undefined;
  return d.issues.find((i) => i.punchId === p.id)?.text;
}

/** One day for one person: every scan, and the tools to fix them. */
function ReviewDialog({ employeeId, date, onClose }: { employeeId: string; date: string; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const dayQuery = useQuery({ queryKey: tkKeys.day(employeeId, date), queryFn: () => getDay(employeeId, date) });
  // Fixing scans and adding missing times changes the record (Edit); viewing only shows them.
  const canEdit = useCan("edit", "attendanceRecords", employeeId);
  const [asideId, setAsideId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<"in" | "out">("out");
  const [time, setTime] = useState("");
  const [nextDay, setNextDay] = useState(false);
  const [why, setWhy] = useState("");
  const refresh = (msg: string) => {
    queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
    toast.show(msg);
  };
  const keep = useMutation({ mutationFn: (p: Punch) => confirmPunch(p, actor), onSuccess: () => refresh("Scan kept.") });
  const aside = useMutation({
    mutationFn: (p: Punch) => setPunchAside(p, reason, actor),
    onSuccess: () => {
      setAsideId(null);
      setReason("");
      refresh("Scan set aside. It stays on record but isn't counted.");
    },
  });
  const restore = useMutation({ mutationFn: (p: Punch) => restorePunch(p, actor), onSuccess: () => refresh("Scan counted again.") });
  const add = useMutation({
    mutationFn: () => addCorrection({ employeeId, workDate: date, kind, time, nextDay, reason: why }, actor),
    onSuccess: () => {
      setTime("");
      setWhy("");
      refresh("Time added.");
    },
  });
  const d = dayQuery.data;

  return (
    <Dialog open size="lg" onClose={onClose} title={d ? `${d.person.name} · ${shortDate(date)}` : "Review"}>
      {!d ? (
        <p className="text-sm text-ink-3">Loading…</p>
      ) : (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-3 rounded-lg bg-surface-2 px-4 py-3 text-sm sm:grid-cols-5">
            <div>
              <dt className="text-xs text-ink-3">Shift</dt>
              <dd>{d.shift && d.kind === "work" ? `${hhmm(d.shift.start)} – ${hhmm(d.shift.end)}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Time in / out</dt>
              <dd>
                {d.timeIn ? clock(d.timeIn.at) : "—"} / {d.timeOut ? clock(d.timeOut.at) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Lunch break (auto)</dt>
              <dd>{lunchText(d)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Worked</dt>
              <dd>{d.workedMinutes ? duration(d.workedMinutes) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-3">Status</dt>
              <dd>
                <Pill tone={dayStatus(d).tone}>{dayStatus(d).label}</Pill>
              </dd>
            </div>
          </dl>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Scans</h3>
            {d.punches.length === 0 ? (
              <p className="text-sm text-ink-3">No scans this day.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {d.punches.map((p) => {
                  const problem = problemOf(p, d);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                      <span className={p.voided ? "text-ink-3 line-through" : "font-medium"}>
                        {p.kind === "in" ? "In" : "Out"} {clock(p.at)}
                      </span>
                      <span className="text-xs text-ink-2">
                        {SOURCE[p.source]}
                        {p.match !== undefined && ` · ${p.match}%`} · {p.device}
                      </span>
                      {problem && <Pill tone="crit">{problem}</Pill>}
                      {p.voided && <span className="text-xs text-ink-3">Set aside: {p.voided.reason}</span>}
                      {p.reason && <span className="text-xs text-ink-3">Reason: {p.reason}</span>}
                      <span className="ml-auto flex gap-1.5">
                        {!canEdit ? null : p.voided ? (
                          <Button size="sm" variant="ghost" onClick={() => restore.mutate(p)}>
                            Count again
                          </Button>
                        ) : (
                          <>
                            {problem && (
                              <Button size="sm" onClick={() => keep.mutate(p)}>
                                Keep
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setAsideId(asideId === p.id ? null : p.id)}>
                              Set aside
                            </Button>
                          </>
                        )}
                      </span>
                      {asideId === p.id && (
                        <span className="flex w-full gap-2">
                          <input autoFocus aria-label="Reason" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? e.g. scanned twice by mistake" />
                          <Button size="sm" onClick={() => aside.mutate(p)}>
                            Confirm
                          </Button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <ErrorNote error={aside.error} />
          </section>

          {canEdit && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Add a missing time</h3>
            <form
              className="grid gap-3 sm:grid-cols-[8rem_8rem_minmax(0,1fr)_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate();
              }}
            >
              <Field id="a-kind" label="Type">
                <select id="a-kind" className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as "in" | "out")}>
                  <option value="in">Time-in</option>
                  <option value="out">Time-out</option>
                </select>
              </Field>
              <Field id="a-time" label="Time">
                <input id="a-time" type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
              <Field id="a-why" label="Reason">
                <input id="a-why" className={inputClass} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Forgot to scan; supervisor confirmed" />
              </Field>
              <Button type="submit" disabled={add.isPending}>
                Add
              </Button>
            </form>
            {d.shift && isOvernight(d.shift) && (
              <label className="mt-2 flex items-center gap-2 text-xs text-ink-2">
                <input type="checkbox" checked={nextDay} onChange={(e) => setNextDay(e.target.checked)} /> The time is on the next morning (overnight shift)
              </label>
            )}
            <ErrorNote error={add.error} />
          </section>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** Every time-in and time-out from the fingerprint and face-recognition devices. */
export function AttendanceLogsPage() {
  const { office } = useOfficeFilter();
  const today = toIsoDate(new Date());
  const [period, setPeriod] = useState("7");
  const [source, setSource] = useState("");
  const [show, setShow] = useState("");
  const [query, setQuery] = useState("");
  const [review, setReview] = useState<{ employeeId: string; date: string } | null>(null);
  const from = addDays(today, -(Number(period) - 1));
  const daysQuery = useQuery({ queryKey: tkKeys.days(from, today), queryFn: () => listDays(from, today) });

  const scans = useMemo<Scan[]>(
    () =>
      (daysQuery.data ?? [])
        .filter((d) => office === "All offices" || d.person.branch === office)
        .flatMap((d) => [...d.punches.map((p) => ({ punch: p, day: d, problem: problemOf(p, d) })), ...lunchScans(d)])
        .sort((a, b) => b.punch.at.localeCompare(a.punch.at)),
    [daysQuery.data, office],
  );
  // Days with a missing time-out have no scan to flag, so they're listed by their time-in.
  const missingOut = new Set((daysQuery.data ?? []).filter((d) => d.issues.some((i) => i.kind === "missing-out")).map((d) => d.timeIn?.id));
  const q = query.trim().toLowerCase();
  const rows = scans.filter(
    (s) =>
      (!source || (source === "lunch" ? !!s.lunch : !s.lunch && s.punch.source === source)) &&
      (!show || (show === "review" ? s.problem || missingOut.has(s.punch.id) : s.punch.voided)) &&
      (!q || s.day.person.name.toLowerCase().includes(q)),
  );
  const toReview = scans.filter((s) => s.problem || missingOut.has(s.punch.id)).length;

  if (daysQuery.isError) return <LoadError onRetry={() => daysQuery.refetch()} />;

  return (
    <>
      <ContentHead title="Attendance logs" subtitle={`Time-in and time-out records from the fingerprint and face-recognition devices, plus the lunch out and lunch in recorded automatically from each shift.${toReview ? ` ${toReview} need review.` : ""}`} />
      <Toolbar>
        <Choice label="Period" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        <Choice
          label="Device"
          value={source}
          onChange={setSource}
          options={[
            { value: "", label: "All devices" },
            { value: "biometric", label: "Fingerprint" },
            { value: "face", label: "Face recognition" },
            { value: "manual", label: "Added by HR" },
            { value: "lunch", label: "Lunch break (automatic)" },
          ]}
        />
        <Choice
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            { value: "", label: "All scans" },
            { value: "review", label: `Needs review (${toReview})` },
            { value: "aside", label: "Set aside" },
          ]}
        />
        <SearchBox value={query} onChange={setQuery} />
      </Toolbar>
      <SimpleTable
        rows={rows}
        rowKey={(s) => s.punch.id}
        loading={daysQuery.isLoading}
        empty="No scans match these filters."
        cols={[
          { header: "Date", cell: (s) => shortDate(s.punch.at) },
          { header: "Time", cell: (s) => <span className={s.punch.voided ? "text-ink-3 line-through" : "font-medium"}>{clock(s.punch.at)}</span> },
          { header: "Employee", cell: (s) => <Name name={s.day.person.name} sub={s.day.person.departmentName} /> },
          { header: "Type", cell: (s) => (s.lunch ? (s.lunch === "out" ? "Lunch out" : "Lunch in") : s.punch.kind === "in" ? "Time-in" : "Time-out") },
          { header: "Device", cell: (s) => (s.lunch ? <Name name="Automatic" sub="From the shift's lunch break" /> : <Name name={SOURCE[s.punch.source]} sub={s.punch.device} />) },
          { header: "Face match", cell: (s) => (s.punch.match !== undefined ? <span className={s.punch.match < FACE_MATCH_THRESHOLD ? "font-semibold text-critical" : ""}>{s.punch.match}%</span> : "—") },
          {
            header: "Status",
            cell: (s) =>
              s.lunch ? <Pill tone="info">Auto</Pill> : s.punch.voided ? <Pill tone="neutral">Set aside</Pill> : s.problem ? <Pill tone="crit">{s.problem}</Pill> : missingOut.has(s.punch.id) ? <Pill tone="crit">No time-out</Pill> : s.punch.confirmed ? <Pill tone="good">Checked</Pill> : <Pill tone="good">OK</Pill>,
          },
          {
            header: "",
            align: "right",
            cell: (s) => (
              <Button size="sm" variant={s.problem || missingOut.has(s.punch.id) ? "primary" : "ghost"} onClick={() => setReview({ employeeId: s.day.person.id, date: s.day.date })}>
                {s.problem || missingOut.has(s.punch.id) ? "Review" : "View"}
              </Button>
            ),
          },
        ]}
      />
      {review && <ReviewDialog employeeId={review.employeeId} date={review.date} onClose={() => setReview(null)} />}
    </>
  );
}
