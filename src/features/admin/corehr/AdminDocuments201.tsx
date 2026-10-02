import { useMemo, useState } from "react";
import clsx from "clsx";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { CheckIcon, SearchIcon } from "@/components/icons";
import { useAuditActor } from "@/components/shared/PersonnelFilePanels";
import { fetchAllPersonnelDocuments, fetchEmployeeDirectory, updatePersonnelDocument } from "@/lib/api";
import { formatToday } from "@/lib/format";
import type { PersonnelDocument } from "@/lib/types";
import { useOfficeFilter } from "../OfficeFilterContext";
import { formatDate } from "./format";
import { Badge } from "./ui";

type Queue = "For verification" | "Missing" | "Expiring soon" | "Expired";
const QUEUES: Queue[] = ["For verification", "Missing", "Expiring soon", "Expired"];
const QUEUE_HINT: Record<Queue, string> = {
  "For verification": "Uploaded by the employee or HR, waiting for someone to check the original",
  Missing: "Required for the 201 file but not submitted yet",
  "Expiring soon": "IDs and licenses that lapse within 30 days",
  Expired: "IDs and licenses past their expiry date",
};

const DAY = 86_400_000;
const expiryOf = (d: PersonnelDocument) => d.idExpiry || d.licenseExpiry;
const daysLeft = (iso: string) => Math.ceil((new Date(iso + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime()) / DAY);

/** Every employee's 201 documents, sorted into what HR needs to act on. */
export function AdminDocuments201() {
  const toast = useToast();
  const actor = useAuditActor();
  const queryClient = useQueryClient();
  const { office } = useOfficeFilter();
  const documentsQuery = useQuery({ queryKey: ["personnel", "documents", "all"], queryFn: fetchAllPersonnelDocuments });
  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const [queue, setQueue] = useState<Queue>("For verification");
  const [query, setQuery] = useState("");

  const employees = useMemo(() => new Map((directoryQuery.data ?? []).map((e) => [e.id, e])), [directoryQuery.data]);

  const byQueue = useMemo(() => {
    const docs = (documentsQuery.data ?? []).filter((d) => {
      const e = employees.get(d.employeeId);
      return e && (office === "All offices" || e.office === office);
    });
    const withExpiry = docs.filter((d) => d.status !== "Missing" && d.status !== "Not applicable" && expiryOf(d));
    return {
      "For verification": docs.filter((d) => d.status === "Submitted"),
      Missing: docs.filter((d) => d.status === "Missing"),
      "Expiring soon": withExpiry.filter((d) => daysLeft(expiryOf(d)!) >= 0 && daysLeft(expiryOf(d)!) <= 30).sort((a, b) => expiryOf(a)!.localeCompare(expiryOf(b)!)),
      Expired: withExpiry.filter((d) => daysLeft(expiryOf(d)!) < 0).sort((a, b) => expiryOf(a)!.localeCompare(expiryOf(b)!)),
    } satisfies Record<Queue, PersonnelDocument[]>;
  }, [documentsQuery.data, employees, office]);

  const applicable = (documentsQuery.data ?? []).filter((d) => d.status !== "Not applicable" && employees.has(d.employeeId) && (office === "All offices" || employees.get(d.employeeId)!.office === office));
  const verified = applicable.filter((d) => d.status === "Verified").length;
  const pct = applicable.length ? Math.round((verified / applicable.length) * 100) : 0;

  const q = query.trim().toLowerCase();
  const rows = byQueue[queue].filter((d) => {
    const e = employees.get(d.employeeId)!;
    return !q || e.name.toLowerCase().includes(q) || d.type.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);
  });

  const verify = useMutation({
    mutationFn: (d: PersonnelDocument) => updatePersonnelDocument(d.id, { status: "Verified" }, actor),
    onSuccess: (_, d) => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "personnel-documents"] });
      toast.show(`${d.type} verified for ${employees.get(d.employeeId)?.name}.`);
    },
  });

  return (
    <>
      <ContentHead title="201 Documents" subtitle={`${verified} of ${applicable.length} required documents verified (${pct}%) · ${formatToday()}`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {QUEUES.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setQueue(k)}
            aria-pressed={queue === k}
            className={clsx(
              "rounded-2xl border bg-surface px-4 py-3.5 text-left transition-colors",
              queue === k ? "border-brand ring-1 ring-brand" : "border-border hover:border-brand",
            )}
          >
            <p className={clsx("font-num font-display text-2xl font-semibold", k === "Expired" && byQueue[k].length > 0 && "text-critical", k === "Expiring soon" && byQueue[k].length > 0 && "text-warning")}>
              {documentsQuery.isLoading ? "–" : byQueue[k].length}
            </p>
            <p className="text-xs font-medium text-ink-2">{k}</p>
          </button>
        ))}
      </div>

      <Card className="mt-4 flex flex-col overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">{queue}</h2>
            <p className="text-xs text-ink-3">{QUEUE_HINT[queue]}</p>
          </div>
          <div className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 sm:w-72">
            <SearchIcon className="h-4 w-4 flex-none text-ink-3" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Employee or document" aria-label="Search documents" className="w-full bg-transparent text-sm outline-none placeholder:text-ink-3" />
          </div>
        </div>
        {documentsQuery.isLoading ? (
          <Skeleton className="m-4 h-48" />
        ) : rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-ink-3">{q ? "Nothing matches that search." : "Nothing here. All caught up."}</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((d) => {
              const e = employees.get(d.employeeId)!;
              const exp = expiryOf(d);
              const left = exp ? daysLeft(exp) : undefined;
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <MiniAvatar initials={e.initials} />
                  <div className="min-w-[12rem] flex-1">
                    <p className="text-sm font-medium">{d.type}</p>
                    <p className="text-xs text-ink-2">
                      {e.name} <span className="text-ink-3">· {e.department}, {e.office}</span>
                    </p>
                  </div>
                  <div className="text-xs text-ink-2">
                    {queue === "For verification" && d.uploadedOn && <>Uploaded {formatDate(d.uploadedOn)}</>}
                    {(queue === "Expiring soon" || queue === "Expired") && exp && (
                      <span className="flex items-center gap-2">
                        {formatDate(exp)}
                        <Badge tone={left! < 0 ? "crit" : "warn"}>{left! < 0 ? `${-left!} days ago` : left === 0 ? "Today" : `in ${left} days`}</Badge>
                      </span>
                    )}
                    {queue === "Missing" && <Badge tone="crit">Not submitted</Badge>}
                  </div>
                  <div className="flex gap-1.5">
                    {queue === "For verification" && (
                      <Button size="sm" icon={<CheckIcon className="h-3.5 w-3.5" />} disabled={verify.isPending && verify.variables?.id === d.id} onClick={() => verify.mutate(d)}>
                        Verify
                      </Button>
                    )}
                    <Link to={`/admin/directory?employee=${e.id}`} className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-brand">
                      Open 201 file
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
