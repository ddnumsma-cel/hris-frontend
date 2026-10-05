import { useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { documentAlert, listDocuments } from "@/lib/corehr/api";
import { DocumentDrawer } from "./DocumentDrawer";
import { documentState, formatDate, keys } from "./format";
import { StatusText } from "./SplitView";

/**
 * One employee's 201 documents as a compact two-column grid, so the whole file
 * fits without scrolling. Clicking one opens what can be done with it in a side panel.
 */
export function DocumentChecklist({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const documentsQuery = useQuery({ queryKey: [...keys.documents, employeeId], queryFn: () => listDocuments(employeeId) });
  const [openId, setOpenId] = useState<string | null>(null);
  // Documents that don't apply go last.
  const docs = [...(documentsQuery.data ?? [])].sort((a, b) => Number(a.status === "Not applicable") - Number(b.status === "Not applicable"));
  const open = docs.find((d) => d.id === openId);

  if (documentsQuery.isLoading) return <Skeleton className="h-48 w-full" />;
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-2 sm:grid-cols-2">
        {docs.map((d) => {
          const state = documentState(d);
          const alert = documentAlert(d);
          const na = d.status === "Not applicable";
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setOpenId(d.id)}
                className={clsx("flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors", d.id === openId ? "border-ink bg-surface-2" : "border-border hover:border-ink-3", na && "opacity-60")}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{d.type}</span>
                  <span className="block text-xs">
                    <StatusText tone={state.tone}>{state.label}</StatusText>
                  </span>
                </span>
                {d.expiresOn && (
                  <span className={clsx("flex-none text-right text-xs", alert === "expired" ? "font-medium text-critical" : alert === "expiring" ? "font-medium text-warning" : "text-ink-3")}>
                    {alert === "expired" ? "Expired" : "Expires"}
                    <span className="block">{formatDate(d.expiresOn)}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-3">Click a document to upload it, check it against the original, or send it back.</p>
      {open && <DocumentDrawer key={open.id + open.status} document={open} employeeName={employeeName} onClose={() => setOpenId(null)} />}
    </div>
  );
}
