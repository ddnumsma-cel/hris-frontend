import { useMemo, useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { CheckCircleIcon, CheckIcon, GridIcon, ListIcon, SearchIcon } from "@/components/icons";
import { DOCUMENT_TYPES, daysUntil, documentAlert, listDocuments, listEmployees } from "@/lib/corehr/api";
import type { DocumentType, EmployeeDocument } from "@/lib/corehr/types";
import { useOfficeFilter } from "../OfficeFilterContext";
import { DocumentDrawer } from "./DocumentDrawer";
import { documentTone, filterSearchClass, formatDate, keys } from "./format";
import { FilterChip, LoadError, Pill } from "./ui";

const SHORT: Record<DocumentType, string> = {
  "Application Form / Resume": "Resume",
  "Birth Certificate (PSA)": "PSA birth",
  "Marriage Certificate (PSA)": "PSA marriage",
  "Child's Birth Certificate": "Child's birth",
  "Valid Government ID": "Gov't ID",
  "Diploma / Transcript of Records": "Diploma / TOR",
  "Professional License": "License",
  "Certificate of Employment (Previous)": "Prev. COE",
  "NBI Clearance": "NBI",
  "Police/Barangay Clearance": "Police / Brgy",
  "Pre-Employment Medical Result": "Medical",
};

type Queue = "all" | "missing" | "verify" | "expiring" | "expired";
const QUEUES: { id: Queue; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "verify", label: "To verify" },
  { id: "missing", label: "Missing" },
  { id: "expiring", label: "Expiring in 30 days" },
  { id: "expired", label: "Expired" },
];

function inQueue(d: EmployeeDocument, q: Queue) {
  if (q === "all") return true;
  if (q === "missing") return d.status === "Missing";
  if (q === "verify") return d.status === "Submitted";
  return documentAlert(d) === q;
}

/** The cell glyph: what state a document is in, at a glance. */
function Cell({ d, dim, onOpen }: { d: EmployeeDocument; dim: boolean; onOpen: () => void }) {
  const alert = documentAlert(d);
  const label = `${d.type}: ${alert === "expired" ? "expired" : alert === "expiring" ? "expiring soon" : d.status.toLowerCase()}`;
  return (
    <button type="button" onClick={onOpen} title={label} aria-label={label} className={clsx("mx-auto flex h-7 w-7 items-center justify-center rounded-md transition-opacity hover:ring-2 hover:ring-ink-3/40", dim && "opacity-25")}>
      {d.status === "Not applicable" ? (
        <span className="h-px w-3 bg-ink-3" />
      ) : alert === "expired" ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-critical text-[0.6rem] font-bold text-white">!</span>
      ) : d.status === "Verified" ? (
        <span className={clsx("flex h-5 w-5 items-center justify-center rounded-full text-white", alert === "expiring" ? "bg-warning" : "bg-good")}>
          <CheckIcon className="h-3 w-3" />
        </span>
      ) : d.status === "Submitted" ? (
        <span className={clsx("h-5 w-5 rounded-full border-2", alert === "expiring" ? "border-warning" : "border-cat-1")}>
          <span className={clsx("m-auto mt-[5px] block h-1.5 w-1.5 rounded-full", alert === "expiring" ? "bg-warning" : "bg-cat-1")} />
        </span>
      ) : (
        <span className="h-5 w-5 rounded-full border-2 border-dashed border-critical/70" />
      )}
    </button>
  );
}

export function DocumentsPage() {
  const { office } = useOfficeFilter();
  const employeesQuery = useQuery({ queryKey: keys.employees, queryFn: listEmployees });
  const documentsQuery = useQuery({ queryKey: keys.documents, queryFn: () => listDocuments() });
  const [queue, setQueue] = useState<Queue>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<EmployeeDocument | null>(null);

  const employees = useMemo(() => (employeesQuery.data ?? []).filter((e) => e.status !== "Separated" && (office === "All offices" || e.branchName === office)), [employeesQuery.data, office]);
  const ids = new Set(employees.map((e) => e.id));
  const docs = (documentsQuery.data ?? []).filter((d) => ids.has(d.employeeId));
  const byEmployee = useMemo(() => {
    const m = new Map<string, Map<DocumentType, EmployeeDocument>>();
    for (const d of documentsQuery.data ?? []) {
      if (!m.has(d.employeeId)) m.set(d.employeeId, new Map());
      m.get(d.employeeId)!.set(d.type, d);
    }
    return m;
  }, [documentsQuery.data]);
  const count = (q: Queue) => docs.filter((d) => d.status !== "Not applicable" && inQueue(d, q)).length;
  const required = docs.filter((d) => d.status !== "Not applicable");
  const verified = required.filter((d) => d.status === "Verified").length;

  const q = query.trim().toLowerCase();
  const rows = employees.filter((e) => (!q || e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)) && (queue === "all" || docs.some((d) => d.employeeId === e.id && inQueue(d, queue))));
  const nameOf = (id: string) => employees.find((e) => e.id === id)?.name ?? id;
  const listItems = docs
    .filter((d) => d.status !== "Not applicable" && (queue === "all" ? d.status !== "Verified" || documentAlert(d) : inQueue(d, queue)) && (!q || nameOf(d.employeeId).toLowerCase().includes(q) || d.type.toLowerCase().includes(q)))
    .sort((a, b) => (a.expiresOn ?? "9").localeCompare(b.expiresOn ?? "9") || nameOf(a.employeeId).localeCompare(nameOf(b.employeeId)));

  const loading = employeesQuery.isLoading || documentsQuery.isLoading;
  if (employeesQuery.isError || documentsQuery.isError) return <LoadError onRetry={() => (employeesQuery.refetch(), documentsQuery.refetch())} />;

  return (
    <>
      <ContentHead title="Documents" subtitle={`201 checklists · ${verified} of ${required.length} required documents verified (${required.length ? Math.round((verified / required.length) * 100) : 0}%)`} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
          {QUEUES.map((x) => (
            <FilterChip key={x.id} active={queue === x.id} onClick={() => setQueue(x.id)} count={x.id === "all" ? undefined : count(x.id)}>
              {x.label}
            </FilterChip>
          ))}
        </div>
        <div className="relative w-full sm:w-56">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Employee or document" aria-label="Search documents" className={filterSearchClass} />
        </div>
        <div role="group" aria-label="View" className="flex rounded-lg border border-border bg-surface p-0.5">
          {(
            [
              ["grid", "Grid", GridIcon],
              ["list", "Action list", ListIcon],
            ] as const
          ).map(([id, label, Icon]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={clsx("flex h-[1.625rem] items-center gap-1.5 rounded-md px-2.5 text-xs font-medium", view === id ? "bg-ink text-surface" : "text-ink-2 hover:text-ink")}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : view === "grid" ? (
        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState icon={<CheckCircleIcon />} title="Nothing in this queue" description="Every 201 file here is up to date." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[58rem] text-sm">
                <caption className="sr-only">201 document status by employee</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="sticky left-0 z-[1] bg-surface px-4 py-2.5 text-left text-xs font-medium text-ink-3">
                      Employee
                    </th>
                    {DOCUMENT_TYPES.map((t) => (
                      <th key={t} scope="col" title={t} className="px-1 py-2.5 text-center text-[0.68rem] leading-tight font-medium text-ink-3">
                        {SHORT[t]}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2.5 text-right text-xs font-medium text-ink-3">
                      Verified
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e, i) => {
                    const mine = byEmployee.get(e.id);
                    return (
                      <tr key={e.id} style={{ "--i": i } as React.CSSProperties} className="rise-in border-b border-border last:border-0 hover:bg-surface-2/50">
                        <th scope="row" className="sticky left-0 z-[1] bg-surface px-4 py-1.5 text-left font-normal">
                          <Link to={`/admin/people/${e.id}#documents`} className="block truncate font-medium hover:underline">
                            {e.name}
                          </Link>
                          <span className="block text-xs text-ink-3">{e.departmentName}</span>
                        </th>
                        {DOCUMENT_TYPES.map((t) => {
                          const d = mine?.get(t);
                          return <td key={t} className="px-1 py-1.5 text-center">{d ? <Cell d={d} dim={queue !== "all" && !inQueue(d, queue)} onOpen={() => setOpen(d)} /> : null}</td>;
                        })}
                        <td className="font-num px-3 py-1.5 text-right text-xs text-ink-2">
                          {e.documents.verified}/{e.documents.required}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border px-4 py-2.5 text-xs text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-good text-white">
                <CheckIcon className="h-2.5 w-2.5" />
              </span>
              Verified
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-cat-1" />
              Submitted, to verify
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-dashed border-critical/70" />
              Missing
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-full bg-warning" />
              Expiring soon
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-critical text-[0.5rem] font-bold text-white">!</span>
              Expired
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-px w-3 bg-ink-3" />
              Not applicable
            </span>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {listItems.length === 0 ? (
            <EmptyState icon={<CheckCircleIcon />} title="Nothing needs action" description="No missing, unverified or lapsing documents here." />
          ) : (
            <ul className="divide-y divide-border">
              {listItems.map((d, i) => {
                const alert = documentAlert(d);
                return (
                  <li key={d.id} className="rise-in" style={{ "--i": i } as React.CSSProperties}>
                    <button type="button" onClick={() => setOpen(d)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-surface-2/60">
                      <span className="min-w-[12rem] flex-1">
                        <span className="block text-sm font-medium">{d.type}</span>
                        <span className="block text-xs text-ink-2">{nameOf(d.employeeId)}</span>
                      </span>
                      <span className="text-xs text-ink-3">
                        {alert && d.expiresOn ? (daysUntil(d.expiresOn) < 0 ? `Expired ${formatDate(d.expiresOn)}` : `Expires ${formatDate(d.expiresOn)}`) : d.uploadedAt ? `Uploaded ${formatDate(d.uploadedAt)}` : d.note ? "Returned to employee" : "Not submitted"}
                      </span>
                      {alert ? <Pill tone={alert === "expired" ? "crit" : "warn"}>{alert === "expired" ? "Expired" : "Expiring"}</Pill> : <Pill tone={documentTone[d.status]}>{d.status === "Submitted" ? "To verify" : d.status}</Pill>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {open && <DocumentDrawer document={open} employeeName={nameOf(open.employeeId)} onClose={() => setOpen(null)} />}
    </>
  );
}
