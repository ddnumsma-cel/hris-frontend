import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ArrowRightIcon, FolderIcon, SearchIcon, SearchXIcon } from "@/components/icons";
import {
  getDocumentCompletion,
  PersonnelAuditLog,
  PersonnelDocumentsPanel,
  useAuditActor,
  type DocumentCompletion,
} from "@/components/shared/PersonnelFilePanels";
import { fetchAllPersonnelDocuments, fetchEmployeeDirectory, logPersonnelView } from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { Employee } from "@/lib/types";
import { useOfficeFilter } from "./OfficeFilterContext";

type CompletionFilter = "All" | "Missing documents" | "Awaiting verification" | "Complete";
const completionFilters: CompletionFilter[] = ["All", "Missing documents", "Awaiting verification", "Complete"];

type Tab = "Documents" | "Activity log";
const tabs: Tab[] = ["Documents", "Activity log"];

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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CompletionFilter>("All");
  const [tab, setTab] = useState<Tab>("Documents");

  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const documentsQuery = useQuery({ queryKey: ["personnel", "documents", "all"], queryFn: fetchAllPersonnelDocuments });

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
        matchesFilter(completionById.get(e.id)!, filter) &&
        (!q ||
          e.name.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q)),
    );
  }, [directoryQuery.data, completionById, office, filter, search]);

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

  const totals = useMemo(() => {
    const all = [...completionById.values()];
    return {
      missing: all.filter((c) => c.missing > 0).length,
      pending: all.filter((c) => c.pending > 0).length,
    };
  }, [completionById]);

  return (
    <>
      <ContentHead
        title="201 Files"
        subtitle={`${totals.missing} with missing documents · ${totals.pending} awaiting verification · ${formatToday()}`}
      />

      <div className="grid gap-4 lg:h-[calc(100dvh-12.5rem)] lg:min-h-[28rem] lg:grid-cols-[20rem_1fr]">
        {/* Employee list */}
        <Card className={clsx("flex min-h-0 flex-col overflow-hidden", selected && "hidden lg:flex")}>
          <div className="flex flex-none flex-col gap-2 border-b border-border p-3">
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2">
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
              value={filter}
              onChange={(e) => setFilter(e.target.value as CompletionFilter)}
              aria-label="Filter by document status"
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            >
              {completionFilters.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {directoryQuery.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="p-3">
                  <Skeleton className="h-10 w-full" />
                </li>
              ))}
            {!directoryQuery.isLoading && filtered.length === 0 && (
              <li className="p-6 text-center text-xs text-ink-3">No employees match these filters.</li>
            )}
            {filtered.map((emp) => {
              const c = completionById.get(emp.id)!;
              const active = emp.id === selectedId;
              return (
                <li key={emp.id}>
                  <button
                    type="button"
                    onClick={() => select(emp.id)}
                    aria-current={active ? "true" : undefined}
                    className={clsx(
                      "flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors",
                      active ? "border-brand bg-brand-tint" : "border-transparent hover:bg-surface-2/60",
                    )}
                  >
                    <MiniAvatar initials={emp.initials} />
                    <div className="min-w-0 flex-1">
                      <div className={clsx("truncate text-sm", active ? "font-bold text-brand-ink" : "font-semibold")}>
                        {emp.name}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-good" style={{ width: `${c.pct}%` }} />
                        </div>
                        <span className="font-num flex-none text-[0.7rem] text-ink-3">
                          {c.verified}/{c.applicable}
                        </span>
                      </div>
                    </div>
                    {c.missing > 0 && (
                      <span
                        className="h-2 w-2 flex-none rounded-full bg-warning"
                        title={`${c.missing} missing`}
                        aria-label={`${c.missing} missing`}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Selected employee's 201 file */}
        <Card className={clsx("flex min-h-0 flex-col overflow-hidden", !selected && "hidden lg:flex")}>
          {selected ? (
            <>
              <div className="flex-none border-b border-border px-4.5 pt-4">
                <button
                  type="button"
                  onClick={() => select(null)}
                  className="mb-3 flex items-center gap-1 text-xs font-bold text-ink-2 lg:hidden"
                >
                  <ArrowRightIcon className="h-3.5 w-3.5 rotate-180" />
                  All employees
                </button>
                <div className="flex items-center gap-3.5">
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-ink-2">
                    {selected.initials}
                  </span>
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

                <div role="tablist" aria-label="201 file sections" className="mt-3.5 flex gap-1">
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
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={selectedId && !directoryQuery.isLoading ? <SearchXIcon /> : <FolderIcon />}
                title={selectedId && !directoryQuery.isLoading ? "Employee not found" : "Select an employee"}
                description="Choose someone from the list to review, verify or update their 201 documents."
              />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
