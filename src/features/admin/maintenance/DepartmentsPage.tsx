// Departments and Locations: the org chart's departments and offices as lists. They're edited in
// the Org chart; these pages read the same data (listUnits).

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { listUnits, type UnitSummary } from "@/lib/corehr/api";
import { LoadError } from "../corehr/ui";
import { SimpleTable, type Col } from "../timekeeping/common";

const editLink = (
  <Link to="/admin/maintenance/org-chart" className="btn btn-secondary inline-flex items-center px-4 py-2 text-[13px] font-medium">
    Edit in Org chart
  </Link>
);

function useUnits() {
  return useQuery({ queryKey: ["corehr", "units"], queryFn: listUnits });
}

export function DepartmentsPage() {
  const units = useUnits();
  if (units.isError) return <LoadError onRetry={() => units.refetch()} />;
  const all = units.data ?? [];
  const name = (id: string | null | undefined) => all.find((u) => u.id === id)?.name ?? "—";
  const rows = all.filter((u) => u.type === "department" && u.active).sort((a, b) => a.name.localeCompare(b.name) || name(a.parentId).localeCompare(name(b.parentId)));
  const cols: Col<UnitSummary>[] = [
    { header: "Department", cell: (u) => <span className="font-medium">{u.name}</span> },
    { header: "Code", cell: (u) => <span className="text-ink-2">{u.code}</span> },
    { header: "Location", cell: (u) => name(u.parentId) },
    { header: "Head", cell: (u) => u.headName ?? <span className="text-ink-2">—</span> },
    { header: "People", align: "right", cell: (u) => u.headcount },
    { header: "Open slots", align: "right", cell: (u) => u.openSlots },
  ];
  return (
    <>
      <ContentHead title="Departments" subtitle={`${rows.length} departments across your offices.`} actions={editLink} />
      <SimpleTable rows={rows} rowKey={(u) => u.id} cols={cols} loading={units.isLoading} empty="No departments yet." />
    </>
  );
}

export function LocationsPage() {
  const units = useUnits();
  if (units.isError) return <LoadError onRetry={() => units.refetch()} />;
  const all = units.data ?? [];
  const rows = all.filter((u) => u.type === "branch" && u.active).sort((a, b) => a.name.localeCompare(b.name));
  const departments = (id: string) => all.filter((u) => u.type === "department" && u.active && u.parentId === id).length;
  const cols: Col<UnitSummary>[] = [
    { header: "Location", cell: (u) => <span className="font-medium">{u.name}</span> },
    { header: "Code", cell: (u) => <span className="text-ink-2">{u.code}</span> },
    { header: "Address", cell: (u) => u.address || <span className="text-ink-2">—</span> },
    { header: "Departments", align: "right", cell: (u) => departments(u.id) },
    { header: "People", align: "right", cell: (u) => u.headcount },
  ];
  return (
    <>
      <ContentHead title="Locations" subtitle={`${rows.length} offices.`} actions={editLink} />
      <SimpleTable rows={rows} rowKey={(u) => u.id} cols={cols} loading={units.isLoading} empty="No locations yet." />
    </>
  );
}
