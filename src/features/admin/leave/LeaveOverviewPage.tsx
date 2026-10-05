import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { holidayOn } from "@/lib/holidays";
import { addDays, decideRequest, isoToday, listCredits, listRequests, type RequestRow } from "@/lib/leave/api";
import { LEAVE_CREDITS_PER_YEAR } from "@/lib/leave/store";
import { useOfficeFilter } from "../OfficeFilterContext";
import { useActor } from "../corehr/format";
import { Initials, LoadError, Pill } from "../corehr/ui";
import { FileLeaveDialog, RequestDialog } from "./dialogs";
import { dateRange, leaveKeys, num, STATUS, useLeaveRefresh } from "./format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-surface p-4", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function PersonLine({ r, right }: { r: RequestRow; right: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 py-2">
      <Initials initials={r.person.initials} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{r.person.name}</div>
        <div className="truncate text-xs text-ink-2">
          {r.type.name} · {dateRange(r.start, r.end)} · {num(r.days)} {r.days === 1 ? "day" : "days"}
        </div>
      </div>
      {right}
    </li>
  );
}

export function LeaveOverviewPage() {
  const toast = useToast();
  const actor = useActor();
  const refresh = useLeaveRefresh();
  const { office } = useOfficeFilter();
  const today = isoToday();
  const requestsQuery = useQuery({ queryKey: leaveKeys.requests, queryFn: listRequests });
  const balancesQuery = useQuery({ queryKey: leaveKeys.balances, queryFn: listCredits });
  const [month, setMonth] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [picked, setPicked] = useState(today);
  const [filing, setFiling] = useState(false);
  const [open, setOpen] = useState<{ r: RequestRow; reject?: boolean } | null>(null);
  const [awayAll, setAwayAll] = useState(false);
  const approve = useMutation({
    mutationFn: (r: RequestRow) => decideRequest(r.id, true, "", actor),
    onSuccess: (_, r) => {
      refresh();
      toast.show(`Approved ${r.person.name}'s leave.`);
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't approve."),
  });

  if (requestsQuery.isError || balancesQuery.isError) return <LoadError onRetry={() => (requestsQuery.refetch(), balancesQuery.refetch())} />;

  const inOffice = (branch: string) => office === "All offices" || branch === office;
  const requests = (requestsQuery.data ?? []).filter((r) => inOffice(r.person.branch));
  const live = requests.filter((r) => r.status === "approved" || r.status === "pending");
  const waiting = requests.filter((r) => r.status === "pending").sort((a, b) => a.start.localeCompare(b.start));
  const on = (date: string) => live.filter((r) => r.start <= date && r.end >= date);
  const weekEnd = addDays(today, 6);
  const away = live.filter((r) => r.status === "approved" && r.start <= weekEnd && r.end >= today).sort((a, b) => a.start.localeCompare(b.start));

  // Company-wide use of the yearly leaves for the cards.
  const rows = (balancesQuery.data ?? []).filter((r) => inOffice(r.person.branch));
  const total = rows.reduce((n, r) => n + r.credits.total, 0);
  const used = rows.reduce((n, r) => n + r.credits.used, 0);
  const pending = rows.reduce((n, r) => n + r.credits.pending, 0);
  const left = rows.reduce((n, r) => n + r.credits.available, 0);
  const noneLeft = rows.filter((r) => r.credits.available === 0).length;
  const pct = (n: number) => `${total ? Math.min(100, (n / total) * 100) : 0}%`;
  const cards = [
    { id: "left", name: "Leaves left", value: num(left), sub: `of ${num(total)} given this year`, bar: pct(left), note: `${LEAVE_CREDITS_PER_YEAR} per employee, given on January 1`, tone: "bg-brand" },
    { id: "used", name: "Leaves used", value: num(used), sub: `of ${num(total)}`, bar: pct(used), note: "Each paid leave uses 1, however many days", tone: "bg-brand" },
    { id: "waiting", name: "Waiting for approval", value: num(pending), sub: pending === 1 ? "leave" : "leaves", bar: pct(pending), note: pending ? "Approve or reject below" : "Nothing waiting", tone: "bg-warning" },
    { id: "none", name: "No leaves left", value: num(noneLeft), sub: noneLeft === 1 ? "employee" : "employees", bar: `${rows.length ? (noneLeft / rows.length) * 100 : 0}%`, note: noneLeft ? "Further leave goes as Leave without pay" : "Everyone still has leaves", tone: "bg-critical" },
  ];

  // Month grid
  const first = new Date(month.y, month.m, 1);
  const daysIn = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array<null>(first.getDay()).fill(null), ...Array.from({ length: daysIn }, (_, i) => iso(month.y, month.m, i + 1))];
  while (cells.length % 7) cells.push(null);
  const shiftMonth = (n: number) => setMonth(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  const pickedList = on(picked);
  const pickedHoliday = holidayOn(picked);
  const loading = requestsQuery.isLoading || balancesQuery.isLoading;

  return (
    <>
      <ContentHead title="Leave" subtitle="Who's off, what's waiting for approval, and how much leave has been used this year." actions={<Button onClick={() => setFiling(true)}>File leave</Button>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="text-xs font-semibold text-ink-2">{c.name}</div>
            {loading ? (
              <Skeleton className="mt-2 h-10 w-full" />
            ) : (
              <>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-semibold">{c.value}</span>
                  <span className="text-xs text-ink-2">{c.sub}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className={clsx("h-full rounded-full", c.tone)} style={{ width: c.bar }} />
                </div>
                <div className="mt-1.5 text-xs text-ink-3">{c.note}</div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Panel
          title={first.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
          action={
            <span className="flex items-center gap-1">
              <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2">
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => (setMonth({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }), setPicked(today))} className="h-7 rounded-lg px-2 text-xs font-medium text-ink-2 hover:bg-surface-2">
                Today
              </button>
              <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2">
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </span>
          }
        >
          <div className="grid grid-cols-7 text-center text-[0.7rem] font-medium text-ink-3">
            {WEEKDAYS.map((w) => (
              <div key={w} className="pb-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={`x${i}`} />;
              const list = on(d);
              const approved = list.filter((r) => r.status === "approved").length;
              const pending = list.length - approved;
              const hol = holidayOn(d);
              const weekend = [0, 6].includes(new Date(`${d}T12:00:00`).getDay());
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPicked(d)}
                  aria-pressed={picked === d}
                  aria-label={`${d}: ${list.length} away${hol ? `, ${hol.name}` : ""}`}
                  title={hol?.name}
                  className={clsx("flex min-h-10 flex-col items-center justify-center gap-1 rounded-lg text-sm", picked === d ? "bg-ink text-surface" : d === today ? "bg-brand-tint font-semibold" : "hover:bg-surface-2", weekend && picked !== d && "text-ink-3")}
                >
                  {Number(d.slice(8))}
                  <span className="flex h-1.5 gap-0.5">
                    {approved > 0 && <span className="h-1.5 w-1.5 rounded-full bg-good" />}
                    {pending > 0 && <span className="h-1.5 w-1.5 rounded-full bg-warning" />}
                    {hol && <span className="h-1.5 w-1.5 rounded-full bg-critical" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2 text-xs text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-good" /> Approved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-warning" /> Waiting
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-critical" /> Holiday
            </span>
            <span className="ml-auto min-w-0 truncate font-medium text-ink">
              {new Date(`${picked}T12:00:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}:{" "}
              {pickedHoliday ? `${pickedHoliday.name}. ` : ""}
              {pickedList.length ? pickedList.map((r) => r.person.name.split(" ")[0]).join(", ") + " off" : "No one off"}
            </span>
          </div>
        </Panel>

        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <Panel
            title={`Waiting for approval (${waiting.length})`}
            action={
              waiting.length > 4 && (
                <Link to="/admin/leave/requests" className="text-xs font-medium text-brand hover:underline">
                  See all
                </Link>
              )
            }
          >
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : waiting.length === 0 ? (
              <p className="py-4 text-sm text-ink-3">Nothing waiting. You're all caught up.</p>
            ) : (
              <ul className="divide-y divide-border">
                {waiting.slice(0, 4).map((r) => (
                  <PersonLine
                    key={r.id}
                    r={r}
                    right={
                      <span className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setOpen({ r })}>
                          View
                        </Button>
                        <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(r)}>
                          Approve
                        </Button>
                      </span>
                    }
                  />
                ))}
              </ul>
            )}
          </Panel>
          <Panel
            title="Who's away (next 7 days)"
            action={
              away.length > 3 && (
                <button type="button" onClick={() => setAwayAll(true)} className="text-xs font-medium text-brand hover:underline">
                  See all
                </button>
              )
            }
          >
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : away.length === 0 ? (
              <p className="py-4 text-sm text-ink-3">Everyone's in this week.</p>
            ) : (
              <ul className="divide-y divide-border">
                {away.slice(0, 3).map((r) => (
                  <PersonLine key={r.id} r={r} right={<Pill tone={r.start <= today ? "info" : "neutral"}>{r.start <= today ? "Off now" : `From ${dateRange(r.start, r.start)}`}</Pill>} />
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {filing && <FileLeaveDialog onClose={() => setFiling(false)} />}
      {open && <RequestDialog key={open.r.id} r={open.r} startWith={open.reject ? "reject" : undefined} onClose={() => setOpen(null)} />}
      {awayAll && (
        <Dialog open onClose={() => setAwayAll(false)} title="Who's away in the next 7 days">
          <ul className="divide-y divide-border">
            {away.map((r) => (
              <PersonLine key={r.id} r={r} right={<Pill tone={STATUS[r.status].tone}>{r.start <= today ? "Off now" : `From ${dateRange(r.start, r.start)}`}</Pill>} />
            ))}
          </ul>
        </Dialog>
      )}
    </>
  );
}
