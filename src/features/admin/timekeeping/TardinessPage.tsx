import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { listDays, type DayRow } from "@/lib/timekeeping/api";
import { addDays, toIsoDate } from "@/lib/timekeeping/compute";
import { useOfficeFilter } from "../OfficeFilterContext";
import { LoadError } from "../corehr/ui";
import { Choice, Name, SearchBox, SimpleTable, Tabs, Toolbar } from "./common";
import { PERIODS, clock, duration, hhmm, shortDate, tkKeys } from "./format";

type Tab = "list" | "summary";

/** Late arrivals: minutes after the shift start, past the grace period. */
export function TardinessPage() {
  const { office } = useOfficeFilter();
  const today = toIsoDate(new Date());
  const [tab, setTab] = useState<Tab>("list");
  const [period, setPeriod] = useState("30");
  const [query, setQuery] = useState("");
  const from = addDays(today, -(Number(period) - 1));
  const daysQuery = useQuery({ queryKey: tkKeys.days(from, today), queryFn: () => listDays(from, today) });
  const q = query.trim().toLowerCase();
  const days = useMemo(() => (daysQuery.data ?? []).filter((d) => (office === "All offices" || d.person.branch === office) && (!q || d.person.name.toLowerCase().includes(q))), [daysQuery.data, office, q]);
  const late = days.filter((d) => d.lateMinutes > 0).sort((a, b) => b.date.localeCompare(a.date) || b.lateMinutes - a.lateMinutes);
  const summary = [...new Map(late.map((d) => [d.person.id, d.person])).values()]
    .map((p) => {
      const mine = late.filter((d) => d.person.id === p.id);
      return { person: p, times: mine.length, minutes: mine.reduce((n, d) => n + d.lateMinutes, 0), last: mine[0]!.date };
    })
    .sort((a, b) => b.minutes - a.minutes);

  if (daysQuery.isError) return <LoadError onRetry={() => daysQuery.refetch()} />;

  return (
    <>
      <ContentHead title="Tardiness" subtitle={`Minutes late after each shift's grace period (8:00 AM shift, 10 min grace, in at 8:14 AM = 4 min late). ${late.length} late ${late.length === 1 ? "arrival" : "arrivals"}, ${duration(late.reduce((n, d) => n + d.lateMinutes, 0))} in total.`} />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "list", label: "Late arrivals", count: late.length },
          { value: "summary", label: "By employee", count: summary.length },
        ]}
      />
      <Toolbar>
        <Choice label="Period" value={period} onChange={setPeriod} options={PERIODS} />
        <SearchBox value={query} onChange={setQuery} />
      </Toolbar>
      {tab === "list" ? (
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
    </>
  );
}
