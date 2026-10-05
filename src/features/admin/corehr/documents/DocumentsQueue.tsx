import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastContext";
import { CheckIcon } from "@/components/icons";
import { documentAlert, listDocuments, listEmployees, updateDocument, type EmployeeSummary } from "@/lib/corehr/api";
import type { EmployeeDocument } from "@/lib/corehr/types";
import { useOfficeFilter } from "../../OfficeFilterContext";
import { Choice, SearchBox, SimpleTable, Toolbar, type Col } from "../../timekeeping/common";
import { DocumentDrawer } from "../DocumentDrawer";
import { formatDate, keys, useActor } from "../format";
import { Initials, LoadError } from "../ui";

type Queue = "check" | "missing" | "expiring" | "expired" | "done";
type View = "documents" | "employees";

const QUEUES: { id: Queue; label: string; hint: string; tone: string }[] = [
  { id: "check", label: "To check", hint: "Uploaded, compare with the original", tone: "text-[var(--color-info,#2f63d6)]" },
  { id: "missing", label: "Not submitted", hint: "Still needed, or sent back", tone: "text-critical" },
  { id: "expiring", label: "Expiring soon", hint: "IDs and licenses, within 30 days", tone: "text-warning" },
  { id: "expired", label: "Expired", hint: "Ask for a new copy", tone: "text-critical" },
  { id: "done", label: "Checked", hint: "Verified against the original", tone: "text-good" },
];

function queueOf(d: EmployeeDocument): Queue | null {
  const alert = documentAlert(d);
  if (alert === "expired") return "expired";
  if (alert === "expiring") return "expiring";
  if (d.status === "Submitted") return "check";
  if (d.status === "Missing") return "missing";
  if (d.status === "Verified") return "done";
  return null; // Doesn't apply
}

interface Row {
  d: EmployeeDocument;
  e: EmployeeSummary;
}

function Person({ e }: { e: EmployeeSummary }) {
  return (
    <Link to={`/admin/people/${e.id}#documents`} title={`${e.name} · ${e.departmentName}`} className="flex items-center gap-2.5 hover:underline">
      <Initials initials={e.initials} size="sm" />
      <span className="truncate font-medium">{e.name}</span>
    </Link>
  );
}

/** Option A: a review queue by status, or progress by employee. */
export function DocumentsQueue({ switcher }: { switcher: React.ReactNode }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const { office } = useOfficeFilter();
  const docsQuery = useQuery({ queryKey: keys.documents, queryFn: () => listDocuments() });
  const peopleQuery = useQuery({ queryKey: keys.employees, queryFn: listEmployees });
  const [queue, setQueue] = useState<Queue>("check");
  const [view, setView] = useState<View>("documents");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  const people = useMemo(() => new Map((peopleQuery.data ?? []).filter((e) => e.status !== "Separated" && (office === "All offices" || e.branchName === office)).map((e) => [e.id, e])), [peopleQuery.data, office]);
  const all: Row[] = (docsQuery.data ?? []).flatMap((d) => {
    const e = people.get(d.employeeId);
    return e ? [{ d, e }] : [];
  });
  const counts = Object.fromEntries(QUEUES.map((q) => [q.id, all.filter((r) => queueOf(r.d) === q.id).length])) as Record<Queue, number>;
  const required = all.filter((r) => r.d.status !== "Not applicable");
  const checked = required.filter((r) => r.d.status === "Verified").length;
  const pct = required.length ? Math.round((checked / required.length) * 100) : 0;
  const q = query.trim().toLowerCase();
  const types = [...new Set(all.map((r) => r.d.type))].sort();
  const rows = all
    .filter((r) => queueOf(r.d) === queue && (type === "all" || r.d.type === type) && (!q || `${r.e.name} ${r.e.departmentName} ${r.d.type}`.toLowerCase().includes(q)))
    .sort((a, b) => (a.d.uploadedAt ?? a.d.expiresOn ?? "").localeCompare(b.d.uploadedAt ?? b.d.expiresOn ?? "") || a.e.name.localeCompare(b.e.name));
  const open = all.find((r) => r.d.id === openId);

  const verify = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await updateDocument(id, { kind: "verify" }, actor);
      return ids.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      setSelected(new Set());
      toast.show(n === 1 ? "Marked as checked." : `${n} documents marked as checked.`);
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't save.", "critical"),
  });

  if (docsQuery.isError || peopleQuery.isError) return <LoadError onRetry={() => (docsQuery.refetch(), peopleQuery.refetch())} />;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const selectable = queue === "check";
  const allSelected = selectable && rows.length > 0 && rows.every((r) => selected.has(r.d.id));

  const cols: Col<Row>[] = [
    ...(selectable
      ? [
          {
            header: "select",
            label: <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.d.id)))} className="h-4 w-4 accent-[var(--color-ink)]" />,
            cell: (r: Row) => <input type="checkbox" aria-label={`Select ${r.d.type} for ${r.e.name}`} checked={selected.has(r.d.id)} onChange={() => toggle(r.d.id)} className="h-4 w-4 accent-[var(--color-ink)]" />,
          },
        ]
      : []),
    { header: "Employee", cell: (r) => <Person e={r.e} /> },
    { header: "Document", cell: (r) => <span className="font-medium">{r.d.type}</span> },
    { header: "Department", cell: (r) => <span className="text-ink-2">{r.e.departmentName}</span> },
    {
      header: queue === "expiring" || queue === "expired" ? "Expires" : queue === "missing" ? "Note" : queue === "done" ? "Checked" : "Uploaded",
      cell: (r) =>
        queue === "expiring" || queue === "expired" ? (
          <span className={queue === "expired" ? "font-medium text-critical" : "font-medium text-warning"}>{formatDate(r.d.expiresOn)}</span>
        ) : queue === "missing" ? (
          <span className="inline-block max-w-56 truncate align-bottom text-ink-2" title={r.d.note}>
            {r.d.note ? `Sent back: ${r.d.note}` : "Not uploaded yet"}
          </span>
        ) : (
          <span className="inline-block max-w-72 truncate align-bottom text-ink-2" title={r.d.fileName}>
            {queue === "done" && r.d.verifiedBy ? `Checked by ${r.d.verifiedBy}${r.d.verifiedAt ? ` · ${formatDate(r.d.verifiedAt)}` : ""}` : `${r.d.uploadedAt ? `${formatDate(r.d.uploadedAt)} · ` : ""}${r.d.fileName ?? ""}`}
          </span>
        ),
    },
    {
      header: "",
      align: "right",
      cell: (r) => (
        <span className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setOpenId(r.d.id)}>
            {queue === "missing" ? "Upload" : queue === "expiring" || queue === "expired" ? "Replace" : "Open"}
          </Button>
          {queue === "check" && (
            <Button size="sm" icon={<CheckIcon className="h-3.5 w-3.5" />} disabled={verify.isPending} onClick={() => verify.mutate([r.d.id])}>
              Check
            </Button>
          )}
        </span>
      ),
    },
  ];

  // By employee: everyone's 201 file at a glance.
  const byPerson = [...people.values()]
    .map((e) => {
      const mine = all.filter((r) => r.e.id === e.id && r.d.status !== "Not applicable");
      return {
        e,
        total: mine.length,
        done: mine.filter((r) => r.d.status === "Verified").length,
        check: mine.filter((r) => queueOf(r.d) === "check").length,
        missing: mine.filter((r) => queueOf(r.d) === "missing").length,
        expiring: mine.filter((r) => queueOf(r.d) === "expiring" || queueOf(r.d) === "expired").length,
      };
    })
    .filter((p) => !q || `${p.e.name} ${p.e.departmentName}`.toLowerCase().includes(q))
    .sort((a, b) => a.done / (a.total || 1) - b.done / (b.total || 1) || a.e.name.localeCompare(b.e.name));
  const personCols: Col<(typeof byPerson)[number]>[] = [
    { header: "Employee", cell: (p) => <Person e={p.e} /> },
    { header: "Department", cell: (p) => <span className="text-ink-2">{p.e.departmentName}</span> },
    {
      header: "201 file",
      cell: (p) => (
        <span className="flex items-center gap-2.5">
          <span className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-2">
            <span className={clsx("block h-full rounded-full", p.done === p.total ? "bg-good" : "bg-ink")} style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
          </span>
          <span className="text-xs text-ink-2">
            {p.done} of {p.total} checked
          </span>
        </span>
      ),
    },
    { header: "To check", cell: (p) => (p.check ? <span className="font-medium">{p.check}</span> : <span className="text-ink-3">—</span>) },
    { header: "Not submitted", cell: (p) => (p.missing ? <span className="font-medium text-critical">{p.missing}</span> : <span className="text-ink-3">—</span>) },
    { header: "Expiring / expired", cell: (p) => (p.expiring ? <span className="font-medium text-warning">{p.expiring}</span> : <span className="text-ink-3">—</span>) },
    {
      header: "",
      align: "right",
      cell: (p) => (
        <Link to={`/admin/people/${p.e.id}#documents`} className="inline-flex h-8 items-center rounded-full border border-border px-3 text-xs font-medium hover:border-ink-3">
          Open 201 file
        </Link>
      ),
    },
  ];

  return (
    <>
      {switcher}
      <ContentHead
        title="Documents"
        subtitle={`201 file paperwork for ${people.size} employees. Open a document to compare it with the original, or tick several and mark them checked.`}
        actions={
          selected.size > 0 ? (
            <Button icon={<CheckIcon className="h-4 w-4" />} disabled={verify.isPending} onClick={() => verify.mutate([...selected])}>
              Mark {selected.size} as checked
            </Button>
          ) : (
          <div className="min-w-56 rounded-xl border border-border bg-surface px-3.5 py-2">
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="font-semibold">Overall</span>
              <span className="text-ink-2">
                {checked} of {required.length} checked
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
            </div>
          </div>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Show" className="flex flex-wrap gap-2">
          {QUEUES.map((qq) => {
            const active = view === "documents" && queue === qq.id;
            return (
              <button
                key={qq.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={qq.hint}
                onClick={() => (setView("documents"), setQueue(qq.id), setSelected(new Set()))}
                className={clsx("flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors", active ? "border-ink bg-ink text-surface" : "border-border bg-surface text-ink-2 hover:border-ink-3 hover:text-ink")}
              >
                {qq.label}
                <span className={clsx("rounded-full px-1.5 text-xs font-semibold", active ? "bg-surface/20 text-surface" : qq.tone)}>{counts[qq.id]}</span>
              </button>
            );
          })}
        </div>
        <Toolbar>
          <SearchBox value={query} onChange={setQuery} placeholder="Search employee or document" />
          {view === "documents" && <Choice label="Document type" value={type} onChange={setType} options={[{ value: "all", label: "All document types" }, ...types.map((t) => ({ value: t, label: t }))]} />}
        </Toolbar>
        <div role="group" aria-label="View" className="flex rounded-full border border-border bg-surface p-0.5">
          {(
            [
              ["documents", "By document"],
              ["employees", "By employee"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={clsx("h-7 rounded-full px-3 text-xs font-medium", view === id ? "bg-ink text-surface" : "text-ink-2 hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>
      </div>


      {view === "documents" ? (
        <SimpleTable rows={rows} rowKey={(r) => r.d.id} cols={cols} loading={docsQuery.isLoading || peopleQuery.isLoading} empty={queue === "check" ? "Nothing waiting to be checked. Nice work." : "Nothing here."} />
      ) : (
        <SimpleTable rows={byPerson} rowKey={(p) => p.e.id} cols={personCols} loading={docsQuery.isLoading || peopleQuery.isLoading} empty="No employees match." />
      )}

      {open && <DocumentDrawer key={open.d.id + open.d.status} document={open.d} employeeName={open.e.name} onClose={() => setOpenId(null)} />}
    </>
  );
}
