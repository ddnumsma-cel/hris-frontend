import { useMemo, useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { UserPlusIcon } from "@/components/icons";
import { listEmployees, listUnits, type EmployeeSummary } from "@/lib/corehr/api";
import type { EmploymentStatus } from "@/lib/corehr/types";
import { useOfficeFilter } from "../OfficeFilterContext";
import { EmployeeRecord } from "./EmployeeRecordPage";
import { filterSelectClass, keys, statusTone } from "./format";
import { useCountUp } from "./motion";
import { DetailPlaceholder, ListBody, ListEmpty, ListRow, ListToolbar, SplitView, StatusText } from "./SplitView";
import { Initials, LoadError } from "./ui";

type ShowFilter = "Current" | "Needs documents" | "Probationary" | EmploymentStatus;
const SHOW_FILTERS: ShowFilter[] = ["Current", "Needs documents", "Probationary", "On leave", "Suspended", "Separated"];

/** Probation is six months; flag anyone whose six months end within 30 days. */
function regularizationDue(e: EmployeeSummary) {
  if (e.employmentType !== "Probationary" || e.status === "Separated") return false;
  const due = new Date(`${e.dateHired}T00:00:00`);
  due.setMonth(due.getMonth() + 6);
  return due.getTime() - Date.now() < 30 * 86_400_000;
}

function matchesShow(e: EmployeeSummary, show: ShowFilter) {
  if (show === "Current") return e.status !== "Separated";
  if (show === "Needs documents") return e.status !== "Separated" && e.documents.needsAction > 0;
  if (show === "Probationary") return e.status !== "Separated" && e.employmentType === "Probationary";
  return e.status === show;
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  const shown = useCountUp(value);
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-num font-display mt-1 text-3xl font-semibold tracking-[-0.02em]">{shown}</dd>
      {note && <dd className="mt-0.5 text-[0.7rem] text-ink-3">{note}</dd>}
    </div>
  );
}

/** Employee master records: the list on the left, the selected 201 file on the right. */
export function PeoplePage() {
  const navigate = useNavigate();
  const { employeeId } = useParams();
  const { office } = useOfficeFilter();
  const [params] = useSearchParams();
  const employeesQuery = useQuery({ queryKey: keys.employees, queryFn: listEmployees });
  const unitsQuery = useQuery({ queryKey: keys.units, queryFn: listUnits });
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [show, setShow] = useState<ShowFilter>("Current");
  const [departmentId, setDepartmentId] = useState("");

  const all = useMemo(() => (employeesQuery.data ?? []).filter((e) => office === "All offices" || e.branchName === office), [employeesQuery.data, office]);
  const current = all.filter((e) => e.status !== "Separated");
  const units = unitsQuery.data ?? [];
  const departments = units
    .filter((u) => u.type === "department" && (office === "All offices" || units.find((b) => b.id === u.parentId)?.name === office))
    .sort((a, b) => a.name.localeCompare(b.name));
  const branchOf = (id: string) => units.find((u) => u.id === units.find((d) => d.id === id)?.parentId)?.name;

  const q = query.trim().toLowerCase();
  const rows = all
    .filter(
      (e) =>
        matchesShow(e, show) &&
        (!departmentId || e.departmentId === departmentId) &&
        (!q || e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.positionTitle.toLowerCase().includes(q) || e.workEmail.toLowerCase().includes(q)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  if (employeesQuery.isError) return <LoadError onRetry={() => employeesQuery.refetch()} />;

  const list = (
    <>
      <ListToolbar query={query} onQuery={setQuery} placeholder="Search name, ID, position or email">
        <select aria-label="Show" value={show} onChange={(e) => setShow(e.target.value as ShowFilter)} className={clsx(filterSelectClass, "min-w-0 flex-1")}>
          {SHOW_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "Current" ? "Everyone current" : s} ({all.filter((e) => matchesShow(e, s)).length})
            </option>
          ))}
        </select>
        <select aria-label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={clsx(filterSelectClass, "min-w-0 flex-1")}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {office === "All offices" ? ` · ${branchOf(d.id)}` : ""}
            </option>
          ))}
        </select>
      </ListToolbar>
      <ListBody label="Employees">
        {employeesQuery.isLoading ? (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <ListEmpty>No one matches these filters.</ListEmpty>
        ) : (
          <ul className="pt-1">
            {rows.map((e) => (
              <ListRow
                key={e.id}
                to={`/admin/people/${e.id}`}
                active={e.id === employeeId}
                leading={<Initials initials={e.initials} size="sm" />}
                title={e.name}
                meta={`${e.positionTitle} · ${e.departmentName}`}
                muted={e.status === "Separated"}
                trailing={
                  e.status !== "Active" ? (
                    <StatusText tone={statusTone[e.status]}>{e.status}</StatusText>
                  ) : e.documents.needsAction > 0 ? (
                    <span className="font-medium text-warning" title={`${e.documents.needsAction} 201 documents missing, to check or expiring`}>
                      Docs needed
                    </span>
                  ) : undefined
                }
              />
            ))}
          </ul>
        )}
      </ListBody>
      <p className="flex-none border-t border-border px-4 py-2 text-[0.7rem] text-ink-3">
        Showing {rows.length} of {all.filter((e) => matchesShow(e, show)).length}
      </p>
    </>
  );

  const overview = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-5">
        <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">Workforce at a glance</h2>
        <p className="mt-0.5 text-xs text-ink-2">{office === "All offices" ? "All branches" : office} · select someone on the left to open their 201 file</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-6 px-6 py-6 lg:grid-cols-4">
        <Stat label="Current employees" value={current.length} />
        <Stat label="Probationary" value={current.filter((e) => e.employmentType === "Probationary").length} note={`${current.filter(regularizationDue).length} due for regularization`} />
        <Stat label="On leave or suspended" value={current.filter((e) => e.status === "On leave" || e.status === "Suspended").length} />
        <Stat label="201 files needing action" value={current.filter((e) => e.documents.needsAction > 0).length} note="Missing, unverified or expiring" />
      </dl>
      <div className="flex-1">
        <DetailPlaceholder title="No employee selected">Search or filter the list, then pick a name.</DetailPlaceholder>
      </div>
    </div>
  );

  return (
    <>
      <ContentHead
        title="People"
        subtitle={`Employee master records · ${office === "All offices" ? "all branches" : office}`}
        actions={
          <Button icon={<UserPlusIcon className="h-4 w-4" />} onClick={() => navigate("/admin/people/new")}>
            Add employee
          </Button>
        }
      />
      <SplitView showDetail={Boolean(employeeId)} list={list} detail={employeeId ? <EmployeeRecord key={employeeId} employeeId={employeeId} /> : overview} />
    </>
  );
}
