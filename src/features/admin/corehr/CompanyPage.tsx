import { useState } from "react";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import type { PositionSummary, UnitInput } from "@/lib/corehr/api";
import { CompanyChart } from "./company/CompanyChart";
import { CompanyExplorer } from "./company/CompanyExplorer";
import { CompanyTables } from "./company/CompanyTables";
import { openings, people, useCompany, useLayout, type CompanyActions, type Layout } from "./company/data";
import { JobDialog } from "./JobDialog";
import { UnitDialog } from "./UnitDialog";
import { LoadError } from "./ui";

const LAYOUTS: { value: Layout; label: string }[] = [
  { value: "tables", label: "A · Tables" },
  { value: "explorer", label: "B · Explorer" },
  { value: "chart", label: "C · Org chart" },
];

/** Branches, departments, teams and jobs. Three layouts to choose from for now. */
export function CompanyPage() {
  const toast = useToast();
  const c = useCompany();
  const [layout, setLayout] = useLayout();
  const [editingUnit, setEditingUnit] = useState<UnitInput | null>(null);
  const [job, setJob] = useState<{ job?: PositionSummary; departmentId: string } | null>(null);
  const act: CompanyActions = { editUnit: setEditingUnit, openJob: (departmentId, j) => setJob({ departmentId, job: j }) };
  // The job dialog shows the latest numbers after edits elsewhere.
  const liveJob = job?.job ? c.jobs.find((j) => j.id === job.job!.id) : undefined;

  if (c.error) return <LoadError onRetry={c.retry} />;

  return (
    <>
      <ContentHead
        title="Company"
        subtitle={`How the company is organized: ${c.branches.length} branches, ${c.departments.length} departments, ${people(c.company?.headcount ?? 0)}${c.company?.openSlots ? `, ${openings(c.company.openSlots)} to fill` : ""}.`}
        actions={
          <div role="radiogroup" aria-label="Layout to try" className="flex items-center gap-1 rounded-full border border-border bg-surface p-1">
            <span className="px-2 text-xs text-ink-3">Try a layout:</span>
            {LAYOUTS.map((l) => (
              <button key={l.value} type="button" role="radio" aria-checked={layout === l.value} onClick={() => setLayout(l.value)} className={clsx("h-7 rounded-full px-3 text-xs font-medium", layout === l.value ? "bg-ink text-surface" : "text-ink-2 hover:text-ink")}>
                {l.label}
              </button>
            ))}
          </div>
        }
      />

      {c.loading ? (
        <Skeleton className="h-96 w-full" />
      ) : layout === "tables" ? (
        <CompanyTables c={c} act={act} />
      ) : layout === "explorer" ? (
        <CompanyExplorer c={c} act={act} />
      ) : (
        <CompanyChart c={c} act={act} />
      )}

      {editingUnit && (
        <UnitDialog
          input={editingUnit}
          units={c.units}
          onClose={() => setEditingUnit(null)}
          onSaved={(name) => {
            toast.show(editingUnit.id ? `${name} saved.` : `${name} added.`);
            setEditingUnit(null);
          }}
        />
      )}
      {job && <JobDialog key={job.job?.id ?? "new"} job={liveJob ?? job.job} departmentId={job.departmentId} units={c.units} jobs={c.jobs} onClose={() => setJob(null)} />}
    </>
  );
}
