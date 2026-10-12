import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Skeleton } from "@/components/ui/Skeleton";
import { myRequests, type MyRequest } from "@/lib/ess/more";
import { fmtDay } from "@/lib/preferences";
import { LoadError, Pill } from "../admin/corehr/ui";

const KINDS: ("All" | MyRequest["kind"])[] = ["All", "Leave", "Overtime", "Undertime", "Time adjustment", "Reimbursement", "Certificate"];

/** Everything the employee has filed, in one list, with where each one stands. */
export function EmployeeRequests() {
  const list = useQuery({ queryKey: ["ess", "requests"], queryFn: myRequests, staleTime: 0 });
  const [kind, setKind] = useState<(typeof KINDS)[number]>("All");
  const [openOnly, setOpenOnly] = useState(false);
  if (list.isError) return <LoadError onRetry={() => list.refetch()} />;

  const all = list.data ?? [];
  const rows = all.filter((r) => (kind === "All" || r.kind === kind) && (!openOnly || r.tone === "warn"));
  const waiting = all.filter((r) => r.tone === "warn").length;

  return (
    <>
      <ContentHead title="Requests" />
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="chip-filter h-9 px-3 text-sm">
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k === "All" ? "All types" : k}
            </option>
          ))}
        </select>
        <button type="button" aria-pressed={openOnly} onClick={() => setOpenOnly((v) => !v)} className={clsx("chip-filter h-9 px-3 text-sm", openOnly && "font-semibold text-brand-ink")}>
          Still waiting{waiting ? ` · ${waiting}` : ""}
        </button>
      </div>
      {list.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-ink-2">{all.length === 0 ? "You haven't filed anything yet." : "Nothing matches these filters."}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Details</th>
                <th className="px-4 py-3 text-left">Filed</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{r.kind}</td>
                  <td className="px-4 py-3 text-ink-2">{r.detail}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-2">{fmtDay(r.filedAt.slice(0, 10))}</td>
                  <td className="px-4 py-3">
                    <Pill tone={r.tone}>{r.status}</Pill>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={r.href} className="text-[13px] font-medium whitespace-nowrap text-brand-ink hover:underline">
                      Open ›
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
