import { useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { CheckIcon } from "@/components/icons";
import { documentAlert, listDocuments, updateDocument } from "@/lib/corehr/api";
import type { EmployeeDocument } from "@/lib/corehr/types";
import { useCan } from "@/lib/useCan";
import { DocumentDrawer } from "./DocumentDrawer";
import { documentState, formatDate, keys, useActor } from "./format";
import { StatusText } from "./SplitView";

/** What needs doing first: documents to check, then missing, expired, expiring, done; not applicable last. */
function rank(d: EmployeeDocument) {
  if (d.status === "Not applicable") return 6;
  const alert = documentAlert(d);
  if (alert === "expired") return 2;
  if (alert === "expiring") return 3;
  if (d.status === "Submitted") return 0;
  if (d.status === "Missing") return 1;
  return 4;
}

/**
 * One employee's 201 documents: the single view of someone's paperwork, used on their record
 * (Documents tab) and when reviewing from Maintenance › 201 documents. Submitted documents can be
 * checked in one click (or all at once); clicking a document opens what else can be done with it.
 * `columns={1}` suits a side panel. With `onOpen`, the caller shows the document instead (so a
 * panel can step aside rather than stack two drawers).
 */
export function DocumentChecklist({ employeeId, employeeName, columns = 2, onOpen }: { employeeId: string; employeeName: string; columns?: 1 | 2; onOpen?: (d: EmployeeDocument) => void }) {
  const actor = useActor();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canCheck = useCan("edit", "documents");
  const documentsQuery = useQuery({ queryKey: [...keys.documents, employeeId], queryFn: () => listDocuments(employeeId) });
  const [openId, setOpenId] = useState<string | null>(null);
  const docs = [...(documentsQuery.data ?? [])].sort((a, b) => rank(a) - rank(b));
  const toCheck = docs.filter((d) => d.status === "Submitted");
  const open = docs.find((d) => d.id === openId);

  const verify = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await updateDocument(id, { kind: "verify" }, actor);
      return ids.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      toast.show(n === 1 ? "Marked as checked." : `${n} documents marked as checked.`);
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't save.", "critical"),
  });

  if (documentsQuery.isLoading) return <Skeleton className="h-48 w-full" />;
  return (
    <div className="flex flex-col gap-3">
      {canCheck && toCheck.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
          <span className="text-xs text-ink-2">
            <span className="font-semibold text-ink">{toCheck.length}</span> submitted and waiting to be checked
          </span>
          <Button size="sm" icon={<CheckIcon className="h-4 w-4" />} disabled={verify.isPending} onClick={() => verify.mutate(toCheck.map((d) => d.id))}>
            Mark all {toCheck.length} as checked
          </Button>
        </div>
      )}
      <ul className={clsx("grid gap-2", columns === 2 && "sm:grid-cols-2")}>
        {docs.map((d) => {
          const state = documentState(d);
          const alert = documentAlert(d);
          const na = d.status === "Not applicable";
          const submitted = d.status === "Submitted";
          return (
            <li key={d.id} className={clsx("flex items-center gap-2 rounded-xl border pr-2 transition-colors", d.id === openId ? "border-ink bg-surface-2" : submitted ? "border-ink/30 hover:border-ink-3" : "border-border hover:border-ink-3", na && "opacity-60")}>
              <button type="button" onClick={() => (onOpen ? onOpen(d) : setOpenId(d.id))} className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2 pl-3.5 text-left">
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
              {canCheck && submitted && (
                <Button size="sm" disabled={verify.isPending} onClick={() => verify.mutate([d.id])} aria-label={`Mark ${d.type} as checked`}>
                  Check
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-3">Click a document to upload it, check it against the original, or send it back.</p>
      {!onOpen && open && <DocumentDrawer key={open.id + open.status} document={open} employeeName={employeeName} onClose={() => setOpenId(null)} />}
    </div>
  );
}
