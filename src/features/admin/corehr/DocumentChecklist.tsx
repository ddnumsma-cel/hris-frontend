import { useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { documentAlert, listDocuments } from "@/lib/corehr/api";
import { DocumentDrawer } from "./DocumentDrawer";
import { documentState, formatDate, keys } from "./format";
import { StatusText } from "./SplitView";

/** One employee's 201 documents. Clicking a row opens what can be done with it, right above the list. */
export function DocumentChecklist({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const documentsQuery = useQuery({ queryKey: [...keys.documents, employeeId], queryFn: () => listDocuments(employeeId) });
  const [openId, setOpenId] = useState<string | null>(null);
  const docs = documentsQuery.data ?? [];
  const open = docs.find((d) => d.id === openId);

  if (documentsQuery.isLoading) return <Skeleton className="h-48 w-full" />;
  return (
    <div className="flex flex-col gap-4">
      {open && <DocumentDrawer key={open.id + open.status} inline document={open} employeeName={employeeName} onClose={() => setOpenId(null)} />}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th className="pb-2 font-medium">Document</th>
            <th className="pb-2 font-medium">Where it stands</th>
            <th className="hidden pb-2 text-right font-medium sm:table-cell">Expires</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => {
            const state = documentState(d);
            const alert = documentAlert(d);
            return (
              <tr key={d.id} onClick={() => setOpenId(d.id)} className={clsx("cursor-pointer border-t border-border hover:bg-surface-2/60", d.id === openId && "bg-surface-2")}>
                <td className={clsx("py-2.5 pr-3", d.status === "Not applicable" && "text-ink-3")}>
                  <button type="button" className="text-left hover:underline" onClick={() => setOpenId(d.id)}>
                    {d.type}
                  </button>
                </td>
                <td className="py-2.5 pr-3">
                  <StatusText tone={state.tone}>{state.label}</StatusText>
                </td>
                <td className={clsx("hidden py-2.5 text-right sm:table-cell", alert === "expired" ? "text-critical" : alert === "expiring" ? "text-warning" : "text-ink-3")}>{d.expiresOn ? formatDate(d.expiresOn) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-ink-3">Click a document to upload it, check it against the original, or send it back.</p>
    </div>
  );
}
