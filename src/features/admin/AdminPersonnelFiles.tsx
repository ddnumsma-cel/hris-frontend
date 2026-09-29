import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ArrowRightIcon,
  BuildingIcon,
  MailIcon,
  MapPinIcon,
  SearchIcon,
  SearchXIcon,
  UsersIcon,
} from "@/components/icons";
import {
  getDocumentCompletion,
  PersonnelAuditLog,
  PersonnelDocumentsPanel,
  useAuditActor,
  type DocumentCompletion,
} from "@/components/shared/PersonnelFilePanels";
import {
  fetchAllPersonnelDocuments,
  fetchAllPersonnelProfiles,
  fetchEmployeeDirectory,
  logPersonnelView,
} from "@/lib/api";
import { formatToday } from "@/lib/format";
import { clusterOptions } from "@/lib/schemas";
import type { Cluster, Employee } from "@/lib/types";
import { useOfficeFilter } from "./OfficeFilterContext";

type CompletionFilter = "All" | "Missing documents" | "Awaiting verification" | "Complete";
const completionFilters: CompletionFilter[] = ["All", "Missing documents", "Awaiting verification", "Complete"];

type ClusterFilter = "All clusters" | Cluster;

type Tab = "Documents" | "Activity log";
const tabs: Tab[] = ["Documents", "Activity log"];

const selectClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";

const statusVariant: Record<Employee["status"], ChipVariant> = {
  Active: "good",
  "On leave": "neutral",
};

function matchesFilter(c: DocumentCompletion, filter: CompletionFilter) {
  switch (filter) {
    case "All":
      return true;
    case "Missing documents":
      return c.missing > 0;
    case "Awaiting verification":
      return c.pending > 0;
    case "Complete":
      return c.applicable > 0 && c.missing === 0 && c.pending === 0;
  }
}

export function AdminPersonnelFiles() {
  const queryClient = useQueryClient();
  const actor = useAuditActor();
  const { office } = useOfficeFilter();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("employee");
  // The top-bar search lands here with ?q=.
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<CompletionFilter>("All");
  const [clusterFilter, setClusterFilter] = useState<ClusterFilter>("All clusters");
  const [tab, setTab] = useState<Tab>("Documents");

  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const documentsQuery = useQuery({ queryKey: ["personnel", "documents", "all"], queryFn: fetchAllPersonnelDocuments });
  const profilesQuery = useQuery({ queryKey: ["admin", "personnel-profiles"], queryFn: fetchAllPersonnelProfiles });

  const photoById = useMemo(
    () => new Map((profilesQuery.data ?? []).map((p) => [p.employeeId, p.photoDataUrl])),
    [profilesQuery.data],
  );

  const completionById = useMemo(() => {
    const map = new Map<string, DocumentCompletion>();
    for (const emp of directoryQuery.data ?? []) {
      map.set(emp.id, getDocumentCompletion((documentsQuery.data ?? []).filter((d) => d.employeeId === emp.id)));
    }
    return map;
  }, [directoryQuery.data, documentsQuery.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (directoryQuery.data ?? []).filter(
      (e) =>
        (office === "All offices" || e.office === office) &&
        (clusterFilter === "All clusters" || e.cluster === clusterFilter) &&
        matchesFilter(completionById.get(e.id)!, filter) &&
        (!q ||
          e.name.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q)),
    );
  }, [directoryQuery.data, completionById, office, clusterFilter, filter, search]);

  const selected = directoryQuery.data?.find((e) => e.id === selectedId) ?? null;
  const selectedCompletion = selected ? completionById.get(selected.id) : undefined;

  useEffect(() => {
    setTab("Documents");
    if (selectedId && actor) {
      logPersonnelView(selectedId, actor);
      queryClient.invalidateQueries({ queryKey: ["personnel", "audit-log", selectedId] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function select(id: string | null) {
    setSearchParams(id ? { employee: id } : {}, { replace: true });
  }

  function reportsTo(e: Employee) {
    if (!e.reportsToId || e.reportsToId === "admin") return "Reports to HR";
    const manager = directoryQuery.data?.find((m) => m.id === e.reportsToId);
    return manager ? `Reports to ${manager.name}` : "Reports to HR";
  }

  if (selected) {
    return (
      <>
        <ContentHead title="Employee Directory" subtitle={`${selected.name} · ${formatToday()}`} />

        <Card className="flex min-h-0 flex-col overflow-hidden lg:h-[calc(100dvh-12.5rem)] lg:min-h-[28rem]">
          <div className="flex-none border-b border-border px-4.5 pt-4">
            <button
              type="button"
              onClick={() => select(null)}
              className="mb-3 flex items-center gap-1 text-xs font-bold text-ink-2 hover:text-ink"
            >
              <ArrowRightIcon className="h-3.5 w-3.5 rotate-180" />
              Back to directory
            </button>
            <div className="flex items-center gap-3.5">
              <Avatar employee={selected} photoUrl={photoById.get(selected.id)} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-base font-bold">{selected.name}</div>
                <div className="truncate text-xs text-ink-2">
                  {selected.position}
                  <span className="text-ink-3"> · </span>
                  <span className="font-num">{selected.id}</span>
                  <span className="text-ink-3"> · </span>
                  {selected.department}, {selected.office}
                </div>
              </div>
              <Chip variant={statusVariant[selected.status]}>{selected.status}</Chip>
            </div>

            <div role="tablist" aria-label="Employee sections" className="mt-3.5 flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={clsx(
                    "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-bold transition-colors",
                    tab === t ? "border-brand text-brand-ink" : "border-transparent text-ink-2 hover:text-ink",
                  )}
                >
                  {t}
                  {t === "Documents" && selectedCompletion && selectedCompletion.applicable > 0 && (
                    <span className="font-num rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.65rem] text-ink-2">
                      {selectedCompletion.verified}/{selectedCompletion.applicable}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4.5">
            {tab === "Documents" && <PersonnelDocumentsPanel employeeId={selected.id} />}
            {tab === "Activity log" && <PersonnelAuditLog employeeId={selected.id} />}
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <ContentHead
        title="Employee Directory"
        subtitle={`${filtered.length} ${filtered.length === 1 ? "person" : "people"} · ${office} · ${formatToday()}`}
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 sm:max-w-xs sm:flex-1">
          <SearchIcon className="h-3.5 w-3.5 text-ink-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, ID, department…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
          />
        </div>
        <select
          value={clusterFilter}
          onChange={(e) => setClusterFilter(e.target.value as ClusterFilter)}
          aria-label="Filter by cluster"
          className={selectClass}
        >
          <option value="All clusters">All clusters</option>
          {clusterOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as CompletionFilter)}
          aria-label="Filter by document status"
          className={selectClass}
        >
          {completionFilters.map((f) => (
            <option key={f} value={f}>
              {f === "All" ? "All document statuses" : f}
            </option>
          ))}
        </select>
        {selectedId && !directoryQuery.isLoading && (
          <span className="text-xs font-semibold text-critical">That employee could not be found.</span>
        )}
      </div>

      {!directoryQuery.isLoading && filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchXIcon />}
            title={search ? `No employees match "${search}"` : "No employees match these filters"}
            description="Try a different name, or clear the filters."
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-3">
          {directoryQuery.isLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <li key={i}>
                <Card className="p-4">
                  <Skeleton className="h-32 w-full" />
                </Card>
              </li>
            ))}
          {filtered.map((emp) => {
            const c = completionById.get(emp.id)!;
            return (
              <li key={emp.id}>
                <button
                  type="button"
                  onClick={() => select(emp.id)}
                  className="group flex h-full w-full flex-col rounded-xl border border-border bg-surface p-4 text-left shadow-sm transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cat-1)]"
                >
                  <div className="flex items-start gap-3">
                    <Avatar employee={emp} photoUrl={photoById.get(emp.id)} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold group-hover:text-brand-ink">{emp.name}</div>
                      <div className="truncate text-xs text-ink-2">{emp.position}</div>
                      <div className="font-num mt-0.5 text-[0.7rem] text-ink-3">{emp.id}</div>
                    </div>
                    <span
                      className={clsx(
                        "mt-1.5 h-2 w-2 flex-none rounded-full",
                        emp.status === "Active" ? "bg-good" : "bg-ink-3",
                      )}
                      title={emp.status}
                      aria-label={emp.status}
                    />
                  </div>

                  <dl className="mt-3 flex flex-col gap-1.5 text-xs text-ink-2">
                    <div className="flex items-center gap-2">
                      <dt className="flex-none text-ink-3">
                        <BuildingIcon className="h-3.5 w-3.5" aria-label="Department" />
                      </dt>
                      <dd className="truncate">
                        {emp.department} <span className="text-ink-3">· {emp.cluster}</span>
                      </dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <dt className="flex-none text-ink-3">
                        <MapPinIcon className="h-3.5 w-3.5" aria-label="Office" />
                      </dt>
                      <dd className="truncate">{emp.office}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      {emp.email ? (
                        <>
                          <dt className="flex-none text-ink-3">
                            <MailIcon className="h-3.5 w-3.5" aria-label="Email" />
                          </dt>
                          <dd className="truncate">{emp.email}</dd>
                        </>
                      ) : (
                        <>
                          <dt className="flex-none text-ink-3">
                            <UsersIcon className="h-3.5 w-3.5" aria-label="Reports to" />
                          </dt>
                          <dd className="truncate">{reportsTo(emp)}</dd>
                        </>
                      )}
                    </div>
                  </dl>

                  <div className="mt-3.5 flex items-center gap-2 border-t border-border pt-3">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-good" style={{ width: `${c.pct}%` }} />
                    </div>
                    <span className="font-num flex-none text-[0.7rem] text-ink-3">
                      {c.verified}/{c.applicable} docs
                    </span>
                    {c.missing > 0 && (
                      <span className="flex-none text-[0.7rem] font-semibold text-warning">{c.missing} missing</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Avatar({ employee, photoUrl, size }: { employee: Employee; photoUrl?: string; size: "md" | "lg" }) {
  const box = size === "lg" ? "h-12 w-12 text-sm" : "h-11 w-11 text-[0.8rem]";
  if (photoUrl) return <img src={photoUrl} alt="" className={clsx(box, "flex-none rounded-full object-cover")} />;
  return (
    <span
      className={clsx(box, "flex flex-none items-center justify-center rounded-full bg-brand-tint font-bold text-brand-ink")}
    >
      {employee.initials}
    </span>
  );
}
