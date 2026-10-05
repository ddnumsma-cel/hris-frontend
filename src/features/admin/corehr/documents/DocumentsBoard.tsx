import { useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { SearchBox, Toolbar } from "../../timekeeping/common";
import { DocumentDrawer } from "../DocumentDrawer";
import { formatDate } from "../format";
import { Initials, LoadError } from "../ui";
import { stageOf, useDocuments, type DocRow } from "./data";

const COLUMNS = [
  { id: "missing", title: "Not submitted", hint: "Still needed, or sent back", dot: "bg-critical" },
  { id: "check", title: "To check", hint: "Compare with the original", dot: "bg-brand" },
  { id: "expiring", title: "Expiring or expired", hint: "Ask for a new copy", dot: "bg-warning" },
  { id: "done", title: "Checked", hint: "All good", dot: "bg-good" },
] as const;

/** Option C: every document on a board, moving left to right as it gets sorted out. */
export function DocumentsBoard({ switcher }: { switcher: React.ReactNode }) {
  const docs = useDocuments();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  if (docs.error) return <LoadError onRetry={docs.retry} />;

  const q = query.trim().toLowerCase();
  const visible = docs.rows.filter((r) => !q || `${r.e.name} ${r.e.departmentName} ${r.d.type}`.toLowerCase().includes(q));
  const column = (id: string): DocRow[] =>
    visible
      .filter((r) => {
        const s = stageOf(r.d);
        return id === "expiring" ? s === "expiring" || s === "expired" : s === id;
      })
      .sort((a, b) => (a.d.expiresOn ?? a.d.uploadedAt ?? "").localeCompare(b.d.expiresOn ?? b.d.uploadedAt ?? "") || a.e.name.localeCompare(b.e.name));
  const open = docs.rows.find((r) => r.d.id === openId);
  const pct = docs.required ? Math.round((docs.checked / docs.required) * 100) : 0;

  return (
    <>
      {switcher}
      <ContentHead title="Documents" subtitle={`201 file paperwork for ${docs.people.size} employees · ${docs.checked} of ${docs.required} checked (${pct}%). Work each column from left to right.`} />
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} placeholder="Search employee or document" />
      </Toolbar>
      {docs.loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((c) => {
            const list = column(c.id);
            return (
              <section key={c.id} style={{ height: "calc(100dvh - 20rem)" }} className="flex min-h-80 flex-col rounded-2xl border border-border bg-surface-2/60">
                <header className="flex flex-none items-center justify-between gap-2 px-3.5 pt-3 pb-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className={clsx("h-2 w-2 rounded-full", c.dot)} />
                    {c.title}
                  </span>
                  <span className="rounded-full bg-surface px-2 text-xs font-semibold text-ink-2">{list.length}</span>
                </header>
                <p className="flex-none px-3.5 pb-2 text-xs text-ink-3">{c.hint}</p>
                <ul className="no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
                  {list.length === 0 && <li className="px-1 py-6 text-center text-xs text-ink-3">Nothing here.</li>}
                  {list.map((r) => {
                    const s = stageOf(r.d);
                    return (
                      <li key={r.d.id} className="rounded-xl border border-border bg-surface p-3 shadow-sm">
                        <div className="text-sm leading-snug font-medium">{r.d.type}</div>
                        <Link to={`/admin/people/${r.e.id}#documents`} className="mt-1.5 flex items-center gap-2 text-xs text-ink-2 hover:underline">
                          <Initials initials={r.e.initials} size="sm" />
                          <span className="truncate">{r.e.name}</span>
                        </Link>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className={clsx("text-xs", s === "expired" ? "font-medium text-critical" : s === "expiring" ? "font-medium text-warning" : "text-ink-3")}>
                            {s === "expired" ? `Expired ${formatDate(r.d.expiresOn)}` : s === "expiring" ? `Expires ${formatDate(r.d.expiresOn)}` : s === "missing" ? (r.d.note ? "Sent back" : "Not uploaded") : s === "done" ? `By ${r.d.verifiedBy ?? "HR"}` : r.d.uploadedAt ? `Uploaded ${formatDate(r.d.uploadedAt)}` : ""}
                          </span>
                          <span className="flex gap-1">
                            {s === "check" ? (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => setOpenId(r.d.id)}>
                                  Open
                                </Button>
                                <Button size="sm" disabled={docs.verify.isPending} onClick={() => docs.verify.mutate([r.d.id])}>
                                  Check
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => setOpenId(r.d.id)}>
                                {s === "missing" ? "Upload" : s === "done" ? "Open" : "Replace"}
                              </Button>
                            )}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {open && <DocumentDrawer key={open.d.id + open.d.status} document={open.d} employeeName={open.e.name} onClose={() => setOpenId(null)} />}
    </>
  );
}
