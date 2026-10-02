import { useMemo, useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { GridIcon, ListIcon, SearchIcon, SearchXIcon, UserPlusIcon } from "@/components/icons";
import { listEmployees, listUnits, type EmployeeSummary } from "@/lib/corehr/api";
import { useOfficeFilter } from "../OfficeFilterContext";
import { filterSearchClass, filterSelectClass, formatDate, keys, statusTone, tenure } from "./format";
import { StatusText } from "./SplitView";
import { Initials, LoadError } from "./ui";

type View = "cards" | "table";
type SortKey = "name" | "job" | "department" | "branch" | "status" | "hired" | "documents";

const VIEW_KEY = "heyhr-people-view";
function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}


/** "3 of 9 checked", with a thin bar. */
function DocProgress({ e, wide }: { e: EmployeeSummary; wide?: boolean }) {
  const pct = e.documents.required ? Math.round((e.documents.verified / e.documents.required) * 100) : 100;
  return (
    <span className={clsx("flex items-center gap-2", wide && "w-full")}>
      <span className={clsx("h-1.5 overflow-hidden rounded-full bg-surface-2", wide ? "flex-1" : "w-14")}>
        <span className={clsx("grow-x block h-full rounded-full", pct === 100 ? "bg-good" : "bg-ink")} style={{ width: `${pct}%` }} />
      </span>
      <span className="flex-none text-xs text-ink-2">
        {e.documents.verified} of {e.documents.required}
      </span>
    </span>
  );
}

function EmployeeCard({ e, index }: { e: EmployeeSummary; index: number }) {
  return (
    <Link
      to={`/admin/people/${e.id}`}
      style={{ "--i": index } as React.CSSProperties}
      className={clsx("rise-in lift flex flex-col items-center rounded-2xl border border-border bg-surface px-4 pt-5 pb-4 text-center shadow-sm hover:border-ink-3", e.status === "Separated" && "opacity-60")}
    >
      <Initials initials={e.initials} size="lg" />
      <span className="font-display mt-3 w-full truncate text-[0.95rem] font-semibold">{e.name}</span>
      <span className="mt-0.5 w-full truncate text-xs text-ink-2">{e.positionTitle}</span>
      <span className="w-full truncate text-xs text-ink-3">
        {e.departmentName} · {e.branchName}
      </span>
      <span className="mt-3 flex h-5 items-center">
        <StatusText tone={statusTone[e.status]}>{e.status}</StatusText>
        {e.employmentType === "Probationary" && e.status !== "Separated" && <span className="ml-2 text-xs text-ink-3">· Probationary</span>}
      </span>
      <span className="mt-3 w-full border-t border-border pt-3 text-left">
        <span className="mb-1 flex items-center justify-between text-[0.7rem] text-ink-3">
          <span>201 documents checked</span>
          {e.documents.needsAction > 0 && <span className="font-medium text-warning">Needs attention</span>}
        </span>
        <DocProgress e={e} wide />
      </span>
    </Link>
  );
}

function SortHeader({ label, k, sort, onSort, className }: { label: string; k: SortKey; sort: { key: SortKey; asc: boolean }; onSort: (k: SortKey) => void; className?: string }) {
  const active = sort.key === k;
  return (
    <th scope="col" aria-sort={active ? (sort.asc ? "ascending" : "descending") : "none"} className={clsx("px-4 py-2.5 font-medium", className)}>
      <button type="button" onClick={() => onSort(k)} className={clsx("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
        {label}
        <span aria-hidden="true" className={clsx("text-[0.6rem]", !active && "opacity-0")}>
          {sort.asc ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

/** Everyone's 201 file, as cards or as a table: HR picks whichever they prefer. */
export function PeoplePage() {
  const navigate = useNavigate();
  const { office } = useOfficeFilter();
  const [params] = useSearchParams();
  const employeesQuery = useQuery({ queryKey: keys.employees, queryFn: listEmployees });
  const unitsQuery = useQuery({ queryKey: keys.units, queryFn: listUnits });
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [departmentId, setDepartmentId] = useState("");
  const [view, setView] = useState<View>(loadView);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "name", asc: true });

  function changeView(v: View) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Storage blocked: the choice still holds until the page reloads.
    }
  }
  const onSort = (key: SortKey) => setSort((s) => ({ key, asc: s.key === key ? !s.asc : key !== "hired" }));

  const all = useMemo(() => (employeesQuery.data ?? []).filter((e) => office === "All offices" || e.branchName === office), [employeesQuery.data, office]);
  const units = unitsQuery.data ?? [];
  const departments = units
    .filter((u) => u.type === "department" && (office === "All offices" || units.find((b) => b.id === u.parentId)?.name === office))
    .sort((a, b) => a.name.localeCompare(b.name));
  const branchOf = (id: string) => units.find((u) => u.id === units.find((d) => d.id === id)?.parentId)?.name;
  const current = all.filter((e) => e.status !== "Separated");

  const q = query.trim().toLowerCase();
  const value = (e: EmployeeSummary, k: SortKey): string | number =>
    k === "name" ? e.name : k === "job" ? e.positionTitle : k === "department" ? e.departmentName : k === "branch" ? e.branchName : k === "status" ? e.status : k === "hired" ? e.dateHired : e.documents.required ? e.documents.verified / e.documents.required : 1;
  const rows = all
    .filter((e) => e.status !== "Separated" && (!departmentId || e.departmentId === departmentId) && (!q || e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.positionTitle.toLowerCase().includes(q) || e.workEmail.toLowerCase().includes(q)))
    .sort((a, b) => {
      const x = value(a, sort.key);
      const y = value(b, sort.key);
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return (sort.asc ? c : -c) || a.name.localeCompare(b.name);
    });

  const onLeave = current.filter((e) => e.status === "On leave" || e.status === "Suspended").length;
  const needDocs = current.filter((e) => e.documents.needsAction > 0).length;

  if (employeesQuery.isError) return <LoadError onRetry={() => employeesQuery.refetch()} />;

  return (
    <>
      <ContentHead
        title="People"
        subtitle={`${current.length} employees${onLeave ? ` · ${onLeave} on leave or suspended` : ""}${needDocs ? ` · ${needDocs} with 201 documents to sort out` : ""}`}
        actions={
          <Button icon={<UserPlusIcon className="h-4 w-4" />} onClick={() => navigate("/admin/people/new")}>
            Add employee
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, ID, job or email" aria-label="Search employees" className={filterSearchClass} />
        </div>
        <select aria-label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={filterSelectClass}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {office === "All offices" ? ` · ${branchOf(d.id)}` : ""}
            </option>
          ))}
        </select>
        {view === "cards" && (
          <select aria-label="Sort by" value={`${sort.key}:${sort.asc}`} onChange={(e) => setSort({ key: e.target.value.split(":")[0] as SortKey, asc: e.target.value.endsWith("true") })} className={filterSelectClass}>
            <option value="name:true">Name A–Z</option>
            <option value="hired:false">Newest hires first</option>
            <option value="documents:true">Fewest documents checked</option>
          </select>
        )}
        <div role="group" aria-label="View" className="ml-auto flex rounded-full border border-border bg-surface p-0.5">
          {(
            [
              ["cards", "Cards", GridIcon],
              ["table", "Table", ListIcon],
            ] as const
          ).map(([id, label, Icon]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => changeView(id)} className={clsx("flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors", view === id ? "bg-ink text-surface" : "text-ink-2 hover:text-ink")}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {employeesQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-60 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<SearchXIcon />} title="No one matches" description="Try a different search or department." />
      ) : view === "cards" ? (
        <div key="cards" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {rows.map((e, i) => (
            <EmployeeCard key={e.id} e={e} index={i} />
          ))}
        </div>
      ) : (
        <div key="table" className="rise-in overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="no-scrollbar overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <caption className="sr-only">Employees</caption>
              <thead>
                <tr className="border-b border-border bg-surface-2/50 text-left text-xs text-ink-2">
                  <SortHeader label="Name" k="name" sort={sort} onSort={onSort} />
                  <SortHeader label="Job" k="job" sort={sort} onSort={onSort} />
                  <SortHeader label="Department" k="department" sort={sort} onSort={onSort} />
                  <SortHeader label="Branch" k="branch" sort={sort} onSort={onSort} />
                  <SortHeader label="Status" k="status" sort={sort} onSort={onSort} />
                  <SortHeader label="Hired" k="hired" sort={sort} onSort={onSort} />
                  <SortHeader label="201 documents" k="documents" sort={sort} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} onClick={() => navigate(`/admin/people/${e.id}`)} className={clsx("cursor-pointer border-b border-border last:border-0 hover:bg-surface-2/60", e.status === "Separated" && "opacity-60")}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-3">
                        <Initials initials={e.initials} size="sm" />
                        <Link to={`/admin/people/${e.id}`} onClick={(ev) => ev.stopPropagation()} className="font-medium hover:underline">
                          {e.name}
                        </Link>
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{e.positionTitle}</td>
                    <td className="px-4 py-2.5 text-ink-2">{e.departmentName}</td>
                    <td className="px-4 py-2.5 text-ink-2">{e.branchName}</td>
                    <td className="px-4 py-2.5">
                      <StatusText tone={statusTone[e.status]}>{e.status}</StatusText>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="block">{formatDate(e.dateHired)}</span>
                      <span className="block text-xs text-ink-3">{tenure(e.dateHired)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <DocProgress e={e} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {rows.length > 0 && (
        <p className="text-xs text-ink-3">
          Showing {rows.length} of {current.length}
        </p>
      )}
    </>
  );
}

