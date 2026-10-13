import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { GridIcon, ListIcon } from "@/components/icons";
import { SearchBox, SimpleTable, Tabs, Toolbar } from "../../timekeeping/common";
import { DocumentChecklist } from "../DocumentChecklist";
import { DocumentDrawer } from "../DocumentDrawer";
import { Drawer, Initials, LoadError } from "../ui";
import { stageOf, useDocuments } from "./data";
import { NotifyButton } from "./NotifyDialog";
import { useCan } from "@/lib/useCan";

type Filter = "all" | "todo" | "check" | "missing" | "expiring" | "done";
const FILTERS: Filter[] = ["all", "todo", "check", "missing", "expiring", "done"];
type View = "cards" | "table";

// Cards or table, remembered in this browser (like People).
const VIEW_KEY = "heyhr-documents-view";
function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
}

/** The status pills for one person: to check, missing, expiring, complete. */
function Badges({ p }: { p: { total: number; done: number; check: number; missing: number; expiring: number } }) {
  return (
    <>
      {p.check > 0 && <span className="rounded-full bg-[color-mix(in_srgb,var(--color-brand)_14%,transparent)] px-2 py-0.5 text-[0.7rem] font-semibold text-brand-ink">{p.check} to check</span>}
      {p.missing > 0 && <span className="rounded-full bg-critical-tint px-2 py-0.5 text-[0.7rem] font-semibold text-critical">{p.missing} missing</span>}
      {p.expiring > 0 && <span className="rounded-full bg-warning-tint px-2 py-0.5 text-[0.7rem] font-semibold text-warning">{p.expiring} expiring</span>}
      {p.total > 0 && p.done === p.total && <span className="rounded-full bg-good-tint px-2 py-0.5 text-[0.7rem] font-semibold text-good">Complete</span>}
    </>
  );
}

/** One card per employee: the company-wide to-do list. Review opens the same view as the Documents tab on their record. */
export function DocumentsCards() {
  const docs = useDocuments();
  const canNotify = useCan("edit", "documents");
  // People › "… with 201 documents to sort out" links here with ?filter=todo.
  const [params] = useSearchParams();
  const initial = params.get("filter") as Filter | null;
  const [filter, setFilter] = useState<Filter>(initial && FILTERS.includes(initial) ? initial : "all");
  const [query, setQuery] = useState("");
  const [personId, setPersonId] = useState<string | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [view, setView] = useState<View>(loadView);
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Not remembered; fine.
    }
  };

  if (docs.error) return <LoadError onRetry={docs.retry} />;

  const people = [...docs.people.values()].map((e) => {
    const mine = docs.rows.filter((r) => r.e.id === e.id && r.d.status !== "Not applicable");
    const count = (s: string) => mine.filter((r) => stageOf(r.d) === s).length;
    return { e, mine, total: mine.length, done: count("done"), check: count("check"), missing: count("missing"), expiring: count("expiring") + count("expired") };
  });
  const q = query.trim().toLowerCase();
  const shown = people
    .filter((p) => {
      const match = filter === "all" || (filter === "todo" && p.check + p.missing + p.expiring > 0) || (filter === "check" && p.check > 0) || (filter === "missing" && p.missing > 0) || (filter === "expiring" && p.expiring > 0) || (filter === "done" && p.total > 0 && p.done === p.total);
      return match && (!q || `${p.e.name} ${p.e.departmentName}`.toLowerCase().includes(q));
    })
    .sort((a, b) => b.check - a.check || a.e.name.localeCompare(b.e.name));
  const person = people.find((p) => p.e.id === personId);
  const openDoc = docs.rows.find((r) => r.d.id === docId);
  const pct = docs.required ? Math.round((docs.checked / docs.required) * 100) : 0;

  return (
    <>
      <ContentHead
        title="201 documents"
        subtitle={`${docs.people.size} employees · ${docs.checked} of ${docs.required} checked (${pct}%)`}
        actions={
          <div role="group" aria-label="View" className="flex rounded-full border border-border bg-surface p-0.5">
            {(
              [
                ["cards", "Cards", GridIcon],
                ["table", "Table", ListIcon],
              ] as const
            ).map(([id, label, Icon]) => (
              <button key={id} type="button" aria-pressed={view === id} onClick={() => changeView(id)} className={clsx("flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors", view === id ? "bg-ink text-bg" : "text-ink-2 hover:text-ink")}>
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        }
      />
      <Tabs
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Everyone", count: people.length },
          { value: "todo", label: "Needs action", count: people.filter((p) => p.check + p.missing + p.expiring > 0).length },
          { value: "check", label: "Has documents to check", count: people.filter((p) => p.check).length },
          { value: "missing", label: "Missing documents", count: people.filter((p) => p.missing).length },
          { value: "expiring", label: "Expiring or expired", count: people.filter((p) => p.expiring).length },
          { value: "done", label: "Complete", count: people.filter((p) => p.total && p.done === p.total).length },
        ]}
      />
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} placeholder="Search employee or department" />
        {canNotify && (
          <span className="ml-auto">
            <NotifyButton />
          </span>
        )}
      </Toolbar>

      {view === "table" ? (
        <SimpleTable
          rows={shown}
          rowKey={(p) => p.e.id}
          loading={docs.loading}
          empty="No one matches."
          cols={[
            {
              header: "Employee",
              cell: (p) => (
                <span className="flex items-center gap-3">
                  <Initials initials={p.e.initials} size="sm" />
                  <span className="min-w-0">
                    <Link to={`/admin/maintenance/people/${p.e.id}#documents`} className="block truncate font-medium hover:underline">
                      {p.e.name}
                    </Link>
                    <span className="block truncate text-xs text-ink-3">{p.e.departmentName}</span>
                  </span>
                </span>
              ),
            },
            {
              header: "Checked",
              cell: (p) => {
                const ppct = p.total ? Math.round((p.done / p.total) * 100) : 0;
                return (
                  <span className="flex items-center gap-3">
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-good" style={{ width: `${ppct}%` }} />
                    </span>
                    <span className="text-xs text-ink-2">
                      <span className="font-semibold text-ink">{p.done}</span> of {p.total}
                    </span>
                  </span>
                );
              },
            },
            {
              header: "Status",
              cell: (p) => (
                <span className="flex flex-wrap gap-1">
                  <Badges p={p} />
                </span>
              ),
            },
            {
              header: "",
              align: "right",
              cell: (p) => (
                <Button size="sm" variant={p.check ? "primary" : "ghost"} onClick={() => setPersonId(p.e.id)}>
                  {p.check ? `Review ${p.check}` : "View documents"}
                </Button>
              ),
            },
          ]}
        />
      ) : docs.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((p, i) => {
            const ppct = p.total ? Math.round((p.done / p.total) * 100) : 0;
            return (
              <article key={p.e.id} style={{ "--i": i } as React.CSSProperties} className="rise-in lift flex flex-col rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  {/* Progress ring around the initials */}
                  <span className="relative flex h-14 w-14 flex-none items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--color-good) ${ppct * 3.6}deg, var(--color-surface-2) 0deg)` }}>
                    <span className="rounded-full bg-surface p-0.5">
                      <Initials initials={p.e.initials} size="md" />
                    </span>
                  </span>
                  <div className="min-w-0">
                    <Link to={`/admin/maintenance/people/${p.e.id}#documents`} className="font-display line-clamp-2 text-[0.95rem] leading-tight font-semibold hover:underline">
                      {p.e.name}
                    </Link>
                    <div className="truncate text-xs text-ink-3">{p.e.departmentName}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-ink-2">
                  <span className="font-semibold text-ink">{p.done}</span> of {p.total} checked
                </div>
                <div className="mt-2 flex min-h-6 flex-wrap gap-1">
                  <Badges p={p} />
                </div>
                <Button size="sm" variant={p.check ? "primary" : "ghost"} className="mt-3 w-full justify-center" onClick={() => setPersonId(p.e.id)}>
                  {p.check ? `Review ${p.check}` : "View documents"}
                </Button>
              </article>
            );
          })}
          {shown.length === 0 && <p className="text-sm text-ink-3">No one matches.</p>}
        </div>
      )}

      {person && !openDoc && (
        <Drawer
          open
          onClose={() => setPersonId(null)}
          title={person.e.name}
          subtitle={`${person.e.positionTitle} · ${person.e.departmentName}`}
          footer={
            <span className="flex justify-end pr-16">
              <Link to={`/admin/maintenance/people/${person.e.id}#documents`} className="text-sm font-medium text-brand hover:underline">
                Open their record
              </Link>
            </span>
          }
        >
          {/* The same view as the Documents tab on their record. */}
          <DocumentChecklist employeeId={person.e.id} employeeName={person.e.name} columns={1} onOpen={(d) => setDocId(d.id)} />
        </Drawer>
      )}
      {openDoc && <DocumentDrawer key={openDoc.d.id + openDoc.d.status} document={openDoc.d} employeeName={openDoc.e.name} onClose={() => setDocId(null)} />}
    </>
  );
}
