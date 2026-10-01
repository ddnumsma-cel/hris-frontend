import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import clsx from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ArrowRightIcon,
  GridIcon,
  ListIcon,
  MailIcon,
  MapPinIcon,
  MoreVerticalIcon,
  PhoneIcon,
  SearchIcon,
  SearchXIcon,
} from "@/components/icons";
import {
  getDocumentCompletion,
  PersonnelDocumentsPanel,
  useAuditActor,
  type DocumentCompletion,
} from "@/components/shared/PersonnelFilePanels";
import { PersonnelProfilePanel } from "@/components/shared/PersonnelProfilePanel";
import {
  fetchAllPersonnelDocuments,
  fetchAllPersonnelProfiles,
  fetchEmployeeDirectory,
  fetchEmployeeHireDates,
  logPersonnelView,
} from "@/lib/api";
import { formatToday } from "@/lib/format";
import { clusterOptions } from "@/lib/schemas";
import type { Cluster, Employee } from "@/lib/types";
import {
  EmploymentPanel,
  GovernmentNumbersPanel,
  InServicePanel,
  SeparationPanel,
  useEmployeeFileRecords,
} from "./EmployeeFileSections";
import { useOfficeFilter } from "./OfficeFilterContext";

type CompletionFilter = "All" | "Missing documents" | "Awaiting verification" | "Complete";
const completionFilters: CompletionFilter[] = ["All", "Missing documents", "Awaiting verification", "Complete"];

type ClusterFilter = "All clusters" | Cluster;

// The employee's profile, then the 201 File's sections with short labels to
// keep the tab bar compact: pre-employment & identity documents, government registration numbers,
// employment records, records kept during employment, and separation.
const tabs = ["Profile", "Pre-hire & IDs", "Gov't Nos.", "Employment", "In Service", "Separation"] as const;
type Tab = (typeof tabs)[number];

type DirectoryView = "cards" | "table";
const DIRECTORY_VIEW_KEY = "msma-directory-view";

/** The viewer's last-chosen layout, remembered in this browser only. */
function loadDirectoryView(): DirectoryView {
  try {
    return localStorage.getItem(DIRECTORY_VIEW_KEY) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

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
  const toast = useToast();
  const actor = useAuditActor();
  const { office } = useOfficeFilter();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("employee");
  // The top-bar search lands here with ?q=.
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<CompletionFilter>("All");
  const [clusterFilter, setClusterFilter] = useState<ClusterFilter>("All clusters");
  const [tab, setTab] = useState<Tab>("Profile");
  const recordCardRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<DirectoryView>(loadDirectoryView);

  function changeView(next: DirectoryView) {
    setView(next);
    try {
      localStorage.setItem(DIRECTORY_VIEW_KEY, next);
    } catch {
      // Storage blocked — the choice still applies until the page reloads.
    }
  }

  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const documentsQuery = useQuery({ queryKey: ["personnel", "documents", "all"], queryFn: fetchAllPersonnelDocuments });
  const profilesQuery = useQuery({ queryKey: ["admin", "personnel-profiles"], queryFn: fetchAllPersonnelProfiles });
  const hireDatesQuery = useQuery({ queryKey: ["personnel", "hire-dates"], queryFn: fetchEmployeeHireDates });

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
  const recordCardHeight = useFillWindowHeight(recordCardRef, selected?.id);
  const fileRecordsQuery = useEmployeeFileRecords(selected?.id ?? "");
  const fileRecords = selected ? fileRecordsQuery.data : undefined;

  /** Small count shown beside a tab label, e.g. "1/9" verified documents. */
  function tabBadge(t: Tab) {
    if (t === "Pre-hire & IDs" && selectedCompletion && selectedCompletion.applicable > 0)
      return `${selectedCompletion.verified}/${selectedCompletion.applicable}`;
    if (t === "Gov't Nos." && fileRecords)
      return `${fileRecords.government.filter((g) => g.status === "Verified").length}/${fileRecords.government.length}`;
    return null;
  }

  useEffect(() => {
    setTab("Profile");
    if (selectedId && actor) {
      logPersonnelView(selectedId, actor);
      queryClient.invalidateQueries({ queryKey: ["personnel", "audit-log", selectedId] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function select(id: string | null) {
    setSearchParams(id ? { employee: id } : {}, { replace: true });
    // Opening a card from further down the grid shouldn't land mid-page.
    window.scrollTo({ top: 0 });
  }

  function copyEmployeeId(e: Employee) {
    navigator.clipboard
      ?.writeText(e.id)
      .then(() => toast.show(`Copied ${e.id}.`))
      .catch(() => toast.show("Couldn't copy — your browser blocked clipboard access."));
  }

  if (selected) {
    return (
      <>
        <ContentHead
          title="Employee Profile"
          subtitle={`Employee Directory · ${selected.name} · ${formatToday()}`}
          actions={
            <Button
              variant="ghost"
              icon={<ArrowRightIcon className="h-3.75 w-3.75 rotate-180" />}
              onClick={() => select(null)}
            >
              Back to directory
            </Button>
          }
        />

        {/* Fills the window below the title so the page itself never scrolls;
            a section longer than that scrolls inside the card instead. */}
        <Card
          ref={recordCardRef}
          style={recordCardHeight ? { height: recordCardHeight } : undefined}
          className="flex min-h-0 flex-col overflow-hidden"
        >
          <div className="flex-none border-b border-border px-4.5 pt-4">
            <div className="flex items-center gap-3.5">
              <Avatar employee={selected} photoUrl={photoById.get(selected.id)} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-base font-semibold">{selected.name}</div>
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

            <div role="tablist" aria-label="201 File sections" className="no-scrollbar mt-3.5 flex gap-1 overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={clsx(
                    "-mb-px flex flex-none items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors",
                    tab === t ? "border-brand text-brand-ink" : "border-transparent text-ink-2 hover:text-ink",
                  )}
                >
                  {t}
                  {tabBadge(t) && (
                    <span className="font-num rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.65rem] text-ink-2">
                      {tabBadge(t)}
                    </span>
                  )}
                  {t === "Separation" && fileRecords?.separation && (
                    <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-label="Offboarding in progress" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4.5">
            {tab === "Profile" && <PersonnelProfilePanel subject={selected} />}
            {tab === "Pre-hire & IDs" && <PersonnelDocumentsPanel employeeId={selected.id} readOnly />}
            {tab === "Gov't Nos." && <GovernmentNumbersPanel employeeId={selected.id} />}
            {tab === "Employment" && <EmploymentPanel employeeId={selected.id} />}
            {tab === "In Service" && <InServicePanel employeeId={selected.id} />}
            {tab === "Separation" && <SeparationPanel employeeId={selected.id} />}
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
      <p className="-mt-2 text-sm text-ink-2">New hires fill in their own details from Onboarding in the employee app; they appear here once they submit.</p>

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
        <ViewToggle view={view} onChange={changeView} />
      </div>

      {!directoryQuery.isLoading && filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchXIcon />}
            title={search ? `No employees match "${search}"` : "No employees match these filters"}
            description="Try a different name, or clear the filters."
          />
        </Card>
      ) : view === "table" ? (
        <DirectoryTable
          key={`${office}|${clusterFilter}|${filter}|${search}`}
          employees={filtered}
          isLoading={directoryQuery.isLoading}
          photoById={photoById}
          completionById={completionById}
          hireDates={hireDatesQuery.data}
          onPreview={select}
        />
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
          {filtered.map((emp) => (
            <li key={emp.id}>
              <DirectoryCard
                employee={emp}
                photoUrl={photoById.get(emp.id)}
                completion={completionById.get(emp.id)!}
                hiredOn={hireDatesQuery.data?.[emp.id]}
                onPreview={() => select(emp.id)}
                onCopyId={() => copyEmployeeId(emp)}
              />
            </li>
          ))}
        </ul>
      )}

    </>
  );
}

function Avatar({ employee, photoUrl }: { employee: Employee; photoUrl?: string }) {
  const box = "h-12 w-12 text-sm";
  if (photoUrl) return <img src={photoUrl} alt="" className={clsx(box, "flex-none rounded-full object-cover")} />;
  return (
    <span
      className={clsx(box, "flex flex-none items-center justify-center rounded-full bg-brand-tint font-semibold text-brand-ink")}
    >
      {employee.initials}
    </span>
  );
}

function DirectoryCard({
  employee,
  photoUrl,
  completion,
  hiredOn,
  onPreview,
  onCopyId,
}: {
  employee: Employee;
  photoUrl?: string;
  completion: DocumentCompletion;
  hiredOn?: string;
  onPreview: () => void;
  onCopyId: () => void;
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar employee={employee} photoUrl={photoUrl} />
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="truncate text-[0.95rem] font-semibold">{employee.name}</h2>
          <div className="truncate text-xs text-ink-2">{employee.position}</div>
        </div>
        <CardMenu employeeName={employee.name} onPreview={onPreview} onCopyId={onCopyId} />
      </div>

      <dl className="mt-3.5 flex flex-col gap-1.5 border-t border-border pt-3.5 text-xs text-ink-2">
        <div className="flex min-w-0 gap-1">
          <dt>Department:</dt>
          <dd className="truncate font-semibold text-ink">{employee.department}</dd>
        </div>
        <ContactLine icon={<MapPinIcon className="h-3.5 w-3.5" />} label="Office">
          {employee.office} <span className="text-ink-3">· {employee.cluster}</span>
        </ContactLine>
        <ContactLine icon={<MailIcon className="h-3.5 w-3.5" />} label="Email">
          {employee.email ?? <span className="text-ink-3">No email on file</span>}
        </ContactLine>
        <ContactLine icon={<PhoneIcon className="h-3.5 w-3.5" />} label="Phone">
          {employee.phone ?? <span className="text-ink-3">No phone on file</span>}
        </ContactLine>
      </dl>

      <div className="mt-3.5 flex items-center gap-2 border-t border-border pt-3.5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div data-motion="fill" className="h-full rounded-full bg-good" style={{ width: `${completion.pct}%` }} />
        </div>
        <span className="font-num flex-none text-[0.7rem] text-ink-3">
          {completion.verified}/{completion.applicable} docs
        </span>
        {completion.missing > 0 && (
          <span className="flex-none text-[0.7rem] font-semibold text-warning">{completion.missing} missing</span>
        )}
      </div>

      {/* Footer pinned to the card bottom so rows of cards line up. */}
      <div className="mt-auto pt-3.5">
        <div className="flex items-end justify-between gap-2 border-t border-border pt-3.5">
          <div className="min-w-0 text-xs">
            <div className="text-ink-3">Hired:</div>
            <div className="truncate text-ink-2">{hiredOn ?? "—"}</div>
          </div>
          <div className="flex flex-none items-center gap-2">
            <Chip variant={statusVariant[employee.status]}>{employee.status}</Chip>
            <button
              type="button"
              onClick={onPreview}
              aria-label={`Preview ${employee.name}'s record`}
              className="rounded-lg border border-brand px-3 py-1 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cat-1)]"
            >
              Preview
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ContactLine({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <dt className="flex-none text-ink-3">
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="truncate">{children}</dd>
    </div>
  );
}

function CardMenu({
  employeeName,
  onPreview,
  onCopyId,
}: {
  employeeName: string;
  onPreview: () => void;
  onCopyId: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const items = [
    { label: "Preview record", action: onPreview },
    { label: "Copy employee ID", action: onCopyId },
  ];

  return (
    <div ref={menuRef} className="relative flex-none">
      <button
        type="button"
        aria-label={`More actions for ${employeeName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="-mr-1.5 flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
      >
        <MoreVerticalIcon className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-8 right-0 z-20 w-44 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.action();
              }}
              className="block w-full px-3 py-2 text-left text-xs font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Below this height the card stops shrinking and the page is allowed to scroll.
const MIN_RECORD_CARD_HEIGHT = 320;

/**
 * Height that makes an element reach exactly to the bottom of the window,
 * leaving the main area's bottom padding (kept clear for the assistant button).
 * Desktop only — on phones the page scrolls normally, so this returns undefined.
 */
function useFillWindowHeight(ref: RefObject<HTMLElement | null>, remeasureKey: unknown) {
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    function measure() {
      const el = ref.current;
      if (!el || !window.matchMedia("(min-width: 640px)").matches) return setHeight(undefined);
      const main = el.closest("main");
      const mainPaddingBottom = main ? parseFloat(getComputedStyle(main).paddingBottom) : 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(MIN_RECORD_CARD_HEIGHT, Math.floor(window.innerHeight - top - mainPaddingBottom)));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref, remeasureKey]);

  return height;
}

function ViewToggle({ view, onChange }: { view: DirectoryView; onChange: (view: DirectoryView) => void }) {
  const options: { value: DirectoryView; label: string; icon: ReactNode }[] = [
    { value: "cards", label: "Cards", icon: <GridIcon className="h-3.5 w-3.5" /> },
    { value: "table", label: "Table", icon: <ListIcon className="h-3.5 w-3.5" /> },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Directory layout"
      className="ml-auto flex rounded-lg border border-border bg-surface p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={view === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            view === o.value ? "bg-brand-tint text-brand-ink" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Rows per page in the table layout; the Previous/Next bar sits under the table.
const TABLE_PAGE_SIZE = 7;

const thClass =
  "whitespace-nowrap border-b border-border bg-surface px-3 py-2.5 text-left text-xs font-medium tracking-[0.01em] text-ink-3";
// Compact rows so a full page of 7 fits the window without the page or the table scrolling.
const tdClass = "border-b border-border px-3 py-2 align-middle";

function DirectoryTable({
  employees,
  isLoading,
  photoById,
  completionById,
  hireDates,
  onPreview,
}: {
  employees: Employee[];
  isLoading: boolean;
  photoById: Map<string, string | undefined>;
  completionById: Map<string, DocumentCompletion>;
  hireDates?: Record<string, string>;
  onPreview: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(employees.length / TABLE_PAGE_SIZE));
  // Clamped so removing people (or a smaller result set) never strands you past the last page.
  const currentPage = Math.min(page, pageCount);
  const pageRows = employees.slice((currentPage - 1) * TABLE_PAGE_SIZE, currentPage * TABLE_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <Card className="overflow-hidden">
        <table className="w-full table-fixed border-collapse text-[0.82rem]">
          <colgroup>
            {/* Employee takes whatever width is left. */}
            <col />
            <col className="w-[17%]" />
            <col className="w-[21%]" />
            <col className="w-[12%]" />
            <col className="w-[7.5rem]" />
            <col className="w-[7rem]" />
            <col className="w-[6.5rem]" />
          </colgroup>
          <thead>
            <tr>
              <th className={thClass}>Employee</th>
              <th className={thClass}>Department</th>
              <th className={thClass}>Contact</th>
              <th className={thClass}>201 Files</th>
              <th className={thClass}>Hired</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonRows columns={7} rows={TABLE_PAGE_SIZE} />}
            {pageRows.map((emp) => {
              const c = completionById.get(emp.id)!;
              return (
                <tr key={emp.id} className="transition-colors hover:bg-surface-2/60">
                  <td className={tdClass}>
                    <div className="flex items-center gap-2.5">
                      <MiniAvatar initials={emp.initials} photoUrl={photoById.get(emp.id)} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{emp.name}</div>
                        <div className="truncate text-xs text-ink-2">
                          {emp.position} · <span className="font-num">{emp.id}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={tdClass}>
                    <div className="truncate">{emp.department}</div>
                    <div className="truncate text-xs text-ink-2">
                      {emp.office} <span className="text-ink-3">· {emp.cluster}</span>
                    </div>
                  </td>
                  <td className={tdClass}>
                    <div className="truncate" title={emp.email}>
                      {emp.email ?? <span className="text-ink-3">—</span>}
                    </div>
                    <div className="truncate text-xs text-ink-2">{emp.phone}</div>
                  </td>
                  <td className={tdClass}>
                    <div className="flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div data-motion="fill" className="h-full rounded-full bg-good" style={{ width: `${c.pct}%` }} />
                      </div>
                      <span className="font-num flex-none text-[0.7rem] text-ink-3">
                        {c.verified}/{c.applicable}
                      </span>
                    </div>
                    {c.missing > 0 && (
                      <div className="mt-0.5 text-[0.7rem] font-semibold text-warning">{c.missing} missing</div>
                    )}
                  </td>
                  <td className={clsx(tdClass, "whitespace-nowrap text-ink-2")}>{hireDates?.[emp.id] ?? "—"}</td>
                  <td className={clsx(tdClass, "whitespace-nowrap")}>
                    <Chip variant={statusVariant[emp.status]}>{emp.status}</Chip>
                  </td>
                  <td className={clsx(tdClass, "text-right")}>
                    <button
                      type="button"
                      onClick={() => onPreview(emp.id)}
                      aria-label={`Preview ${emp.name}'s record`}
                      className="rounded-lg border border-brand px-3 py-1 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cat-1)]"
                    >
                      Preview
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {employees.length > TABLE_PAGE_SIZE && (
        // Right padding keeps Next clear of the floating assistant button.
        <div className="sm:pr-14">
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            pageSize={TABLE_PAGE_SIZE}
            total={employees.length}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
