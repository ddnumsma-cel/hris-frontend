import { useMemo, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { CheckCircleIcon, CheckIcon, SearchIcon, UploadIcon } from "@/components/icons";
import { daysUntil, documentAlert, listDocuments, listEmployees, updateDocument, type EmployeeSummary } from "@/lib/corehr/api";
import type { EmployeeDocument } from "@/lib/corehr/types";
import { useOfficeFilter } from "../OfficeFilterContext";
import { DocumentDrawer } from "./DocumentDrawer";
import { documentState, filterSearchClass, formatDate, keys, useActor } from "./format";
import { useCountUp } from "./motion";
import { StatusText } from "./SplitView";
import { Initials, LoadError } from "./ui";

type Queue = "check" | "missing" | "expiring" | "expired" | "everyone";

const QUEUES: { id: Exclude<Queue, "everyone">; title: string; hint: string; tone: string }[] = [
  { id: "check", title: "Waiting for you to check", hint: "Uploaded, not yet compared with the original", tone: "text-cat-1" },
  { id: "missing", title: "Not submitted yet", hint: "Still needed for the 201 file", tone: "text-critical" },
  { id: "expiring", title: "Expiring in 30 days", hint: "IDs and licenses about to lapse", tone: "text-warning" },
  { id: "expired", title: "Expired", hint: "Ask the employee for a new copy", tone: "text-critical" },
];

function inQueue(d: EmployeeDocument, q: Queue) {
  if (q === "everyone") return d.status !== "Not applicable";
  if (q === "check") return d.status === "Submitted" && documentAlert(d) !== "expired";
  if (q === "missing") return d.status === "Missing";
  return documentAlert(d) === q;
}

function QueueCard({ q, count, active, onClick, index }: { q: (typeof QUEUES)[number]; count: number; active: boolean; onClick: () => void; index: number }) {
  const shown = useCountUp(count);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{ "--i": index } as React.CSSProperties}
      className={clsx("rise-in lift flex flex-col rounded-2xl border bg-surface px-5 py-4 text-left shadow-sm transition-colors", active ? "border-ink ring-1 ring-ink" : "border-border hover:border-ink-3")}
    >
      <span className={clsx("font-display text-3xl font-semibold tracking-[-0.02em]", count > 0 ? q.tone : "text-ink-3")}>{shown}</span>
      <span className="mt-1 text-sm font-semibold">{q.title}</span>
      <span className="mt-0.5 text-xs text-ink-3">{q.hint}</span>
    </button>
  );
}

/** The row action that finishes the job in one click, where one click is enough. */
function DocRow({ d, onOpen }: { d: EmployeeDocument; onOpen: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const state = documentState(d);
  const alert = documentAlert(d);
  const verify = useMutation({
    mutationFn: () => updateDocument(d.id, { kind: "verify" }, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      toast.show(`${d.type} checked.`);
    },
  });
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium hover:underline">{d.type}</span>
        <span className="block text-xs text-ink-3">
          {alert && d.expiresOn ? (daysUntil(d.expiresOn) < 0 ? `Expired ${formatDate(d.expiresOn)}` : `Expires ${formatDate(d.expiresOn)}`) : d.uploadedAt ? `Uploaded ${formatDate(d.uploadedAt)}${d.fileName ? ` · ${d.fileName}` : ""}` : d.note ? `Sent back: ${d.note}` : <StatusText tone={state.tone}>{state.label}</StatusText>}
        </span>
      </button>
      {d.status === "Submitted" && !alert ? (
        <Button size="sm" variant="ghost" icon={<CheckIcon className="h-3.5 w-3.5" />} disabled={verify.isPending} onClick={() => verify.mutate()}>
          Mark as checked
        </Button>
      ) : d.status === "Missing" ? (
        <Button size="sm" variant="ghost" icon={<UploadIcon className="h-3.5 w-3.5" />} onClick={onOpen}>
          Upload
        </Button>
      ) : alert ? (
        <Button size="sm" variant="ghost" icon={<UploadIcon className="h-3.5 w-3.5" />} onClick={onOpen}>
          Upload new copy
        </Button>
      ) : (
        <button type="button" onClick={onOpen} className="text-xs text-ink-2 hover:text-ink hover:underline">
          View
        </button>
      )}
    </li>
  );
}

function PersonCard({ e, docs, queue, index, onOpenDoc }: { e: EmployeeSummary; docs: EmployeeDocument[]; queue: Queue; index: number; onOpenDoc: (d: EmployeeDocument) => void }) {
  const required = docs.filter((d) => d.status !== "Not applicable");
  const checked = required.filter((d) => d.status === "Verified").length;
  const pct = required.length ? Math.round((checked / required.length) * 100) : 100;
  const [expanded, setExpanded] = useState(false);
  const matching = queue === "everyone" ? required.filter((d) => d.status !== "Verified" || documentAlert(d)) : docs.filter((d) => inQueue(d, queue));
  const LIMIT = 4;
  const shown = expanded ? matching : matching.slice(0, LIMIT);
  return (
    <article style={{ "--i": index } as React.CSSProperties} className="rise-in flex min-w-0 flex-col rounded-2xl border border-border bg-surface shadow-sm">
      <header className="flex items-center gap-3 px-5 pt-4 pb-3">
        <Initials initials={e.initials} size="md" />
        <div className="min-w-0 flex-1">
          <Link to={`/admin/people/${e.id}#documents`} className="font-display block truncate text-[0.95rem] font-semibold hover:underline">
            {e.name}
          </Link>
          <p className="truncate text-xs text-ink-3">
            {e.positionTitle} · {e.departmentName}, {e.branchName}
          </p>
        </div>
      </header>
      <div className="flex items-center gap-3 px-5 pb-3">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <span className={clsx("grow-x block h-full rounded-full", pct === 100 ? "bg-good" : "bg-ink")} style={{ width: `${pct}%` }} />
        </span>
        <span className="flex-none text-xs text-ink-2">
          {checked} of {required.length} checked
        </span>
      </div>
      <ul className="flex-1 divide-y divide-border border-t border-border px-5">
        {shown.length === 0 ? (
          <li className="py-3 text-sm text-good">Everything is checked.</li>
        ) : (
          shown.map((d) => <DocRow key={d.id} d={d} onOpen={() => onOpenDoc(d)} />)
        )}
        {matching.length > LIMIT && (
          <li className="py-2">
            <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs font-medium text-ink-2 hover:text-ink hover:underline">
              {expanded ? "Show fewer" : `Show ${matching.length - LIMIT} more`}
            </button>
          </li>
        )}
      </ul>
      <footer className="rounded-b-2xl border-t border-border bg-surface-2/50 px-5 py-2.5">
        <Link to={`/admin/people/${e.id}#documents`} className="text-xs font-medium text-ink-2 hover:text-ink hover:underline">
          Open full checklist in their 201 file →
        </Link>
      </footer>
    </article>
  );
}

/** 201 documents by what HR needs to do: check, chase, renew. */
export function DocumentsPage() {
  const { office } = useOfficeFilter();
  const employeesQuery = useQuery({ queryKey: keys.employees, queryFn: listEmployees });
  const documentsQuery = useQuery({ queryKey: keys.documents, queryFn: () => listDocuments() });
  const [queue, setQueue] = useState<Queue>("check");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const employees = useMemo(() => (employeesQuery.data ?? []).filter((e) => e.status !== "Separated" && (office === "All offices" || e.branchName === office)), [employeesQuery.data, office]);
  const ids = new Set(employees.map((e) => e.id));
  const docs = (documentsQuery.data ?? []).filter((d) => ids.has(d.employeeId));
  const docsOf = (id: string) => docs.filter((d) => d.employeeId === id);
  const count = (q: Queue) => docs.filter((d) => inQueue(d, q)).length;
  const required = docs.filter((d) => d.status !== "Not applicable");
  const checked = required.filter((d) => d.status === "Verified").length;

  const q = query.trim().toLowerCase();
  const people = employees
    .filter((e) => (!q || e.name.toLowerCase().includes(q) || e.departmentName.toLowerCase().includes(q)) && (queue === "everyone" || docsOf(e.id).some((d) => inQueue(d, queue))))
    .sort((a, b) => docsOf(b.id).filter((d) => inQueue(d, queue)).length - docsOf(a.id).filter((d) => inQueue(d, queue)).length || a.name.localeCompare(b.name));
  const open = docs.find((d) => d.id === openId);
  const openName = employees.find((e) => e.id === open?.employeeId)?.name ?? "";
  const loading = employeesQuery.isLoading || documentsQuery.isLoading;
  const current = QUEUES.find((x) => x.id === queue);

  if (employeesQuery.isError || documentsQuery.isError) return <LoadError onRetry={() => (employeesQuery.refetch(), documentsQuery.refetch())} />;

  return (
    <>
      <ContentHead title="Documents" subtitle={`201 file paperwork for ${employees.length} employees · ${checked} of ${required.length} documents checked so far.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {QUEUES.map((x, i) => (
          <QueueCard key={x.id} q={x} index={i} count={loading ? 0 : count(x.id)} active={queue === x.id} onClick={() => setQueue(x.id)} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-base font-semibold">{current ? current.title : "Everyone's progress"}</h2>
        <span className="text-xs text-ink-3">
          {people.length} {people.length === 1 ? "person" : "people"}
        </span>
        <button
          type="button"
          onClick={() => setQueue(queue === "everyone" ? "check" : "everyone")}
          className="text-xs font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          {queue === "everyone" ? "Back to what needs checking" : "See everyone's progress"}
        </button>
        <div className="relative ml-auto w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee or department" aria-label="Search employees" className={filterSearchClass} />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <EmptyState icon={<CheckCircleIcon />} title={q ? "No one matches that search" : "Nothing here, all caught up"} description={q ? "Try another name or department." : "Pick another card above to see what else needs doing."} />
      ) : (
        <div key={queue} className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {people.map((e, i) => (
            <PersonCard key={e.id} e={e} docs={docsOf(e.id)} queue={queue} index={i} onOpenDoc={(d) => setOpenId(d.id)} />
          ))}
        </div>
      )}

      {open && <DocumentDrawer key={open.id + open.status} document={open} employeeName={openName} onClose={() => setOpenId(null)} />}
    </>
  );
}
