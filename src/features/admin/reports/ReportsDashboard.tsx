import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Skeleton } from "@/components/ui/Skeleton";
import { ArrowRightIcon } from "@/components/icons";
import { getDashboard } from "@/lib/reports/api";
import { useOfficeFilter } from "../OfficeFilterContext";
import { LoadError } from "../corehr/ui";
import { shortPeso } from "./format";

const QUICK = [
  { label: "Payroll register", to: "/admin/reports/payroll?report=register" },
  { label: "SSS contributions", to: "/admin/reports/statutory?report=sss" },
  { label: "Attendance summary", to: "/admin/reports/attendance?report=attendance-summary" },
  { label: "Employee masterlist", to: "/admin/reports/hr?report=masterlist" },
];

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("flex min-w-0 flex-col rounded-xl border border-border bg-surface p-4", className)}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function ReportsDashboard() {
  const { office } = useOfficeFilter();
  const q = useQuery({ queryKey: ["reports", "dashboard", office], queryFn: () => getDashboard(office), staleTime: 0 });
  if (q.isError) return <LoadError onRetry={() => q.refetch()} />;
  const d = q.data;

  const tiles = d
    ? [
        { label: "Employees", value: String(d.headcount), sub: `${d.hiredThisYear} hired this year` },
        { label: "Attendance", value: `${d.attendanceRate}%`, sub: "Last 2 weeks" },
        { label: "Late arrivals", value: String(d.lateThisMonth), sub: "This month" },
        { label: "Leave taken", value: `${d.leaveDaysThisYear} days`, sub: "This year" },
        { label: "Monthly payroll cost", value: shortPeso(d.monthlyCost), sub: "Salaries + company contributions" },
        { label: "Waiting for approval", value: String(d.waiting.leave + d.waiting.overtime + d.waiting.undertime), sub: "Leave, overtime, undertime" },
      ]
    : [];
  const maxDept = Math.max(1, ...(d?.byDepartment.map((x) => x.count) ?? [1]));
  const waiting = d
    ? [
        { label: "Leave requests", n: d.waiting.leave, to: "/admin/leave/requests" },
        { label: "Overtime", n: d.waiting.overtime, to: "/admin/timekeeping/overtime" },
        { label: "Undertime", n: d.waiting.undertime, to: "/admin/timekeeping/undertime" },
      ]
    : [];

  return (
    <>
      <ContentHead title="Dashboard" subtitle="The key numbers across people, attendance, leave and payroll. Open a report for the details." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {q.isLoading
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24" />)
          : tiles.map((t) => (
              <div key={t.label} className="rounded-xl border border-border bg-surface p-4">
                <div className="text-xs font-semibold text-ink-2">{t.label}</div>
                <div className="mt-1 font-display text-2xl font-semibold">{t.value}</div>
                <div className="mt-0.5 truncate text-xs text-ink-3">{t.sub}</div>
              </div>
            ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr_0.9fr]">
        <Panel title="Employees by department">
          {q.isLoading ? (
            <Skeleton className="h-56" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {d!.byDepartment.slice(0, 7).map((x) => (
                <li key={x.name} className="text-sm">
                  <div className="mb-1 flex justify-between gap-2">
                    <span className="truncate text-ink-2">{x.name}</span>
                    <span className="font-semibold">{x.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(x.count / maxDept) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Attendance, last 10 working days">
          {q.isLoading ? (
            <Skeleton className="h-56" />
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="flex h-52 items-end gap-2">
                {d!.daily.map((x) => (
                  <div key={x.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${x.present} of ${x.scheduled} in, ${x.late} late`}>
                    <span className="text-[0.65rem] font-medium text-ink-2">{Math.round(x.rate)}%</span>
                    <div className="flex w-full flex-col overflow-hidden rounded-t-md" style={{ height: `${Math.max(4, x.rate)}%` }}>
                      <div className="bg-warning" style={{ height: `${x.present ? (x.late / x.present) * 100 : 0}%` }} />
                      <div className="flex-1 bg-good" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-2 border-t border-border pt-1">
                {d!.daily.map((x) => (
                  <span key={x.date} className="flex-1 text-center text-[0.65rem] text-ink-3">
                    {new Date(`${x.date}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-good" /> On time</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /> Late</span>
                <span className="text-ink-3">Bar height = share of scheduled people who came in.</span>
              </div>
            </div>
          )}
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Waiting for approval">
            <ul className="divide-y divide-border">
              {waiting.map((w) => (
                <li key={w.label}>
                  <Link to={w.to} className="flex items-center justify-between py-2 text-sm hover:text-brand">
                    <span>{w.label}</span>
                    <span className={clsx("rounded-full px-2 text-xs font-semibold", w.n ? "bg-brand-tint text-ink" : "text-ink-3")}>{w.n}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Most used reports">
            <ul className="divide-y divide-border">
              {QUICK.map((r) => (
                <li key={r.to}>
                  <Link to={r.to} className="flex items-center justify-between py-2 text-sm hover:text-brand">
                    {r.label}
                    <ArrowRightIcon className="h-3.5 w-3.5 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
