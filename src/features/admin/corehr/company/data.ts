import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listEmployees, listPositions, listUnits, type EmployeeSummary, type PositionSummary, type UnitInput, type UnitSummary } from "@/lib/corehr/api";
import { keys } from "../format";

export const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
export const openings = (n: number) => `${n} opening${n === 1 ? "" : "s"}`;

/** What the three Company layouts need: the structure, the jobs and the people, with helpers. */
export function useCompany() {
  const unitsQuery = useQuery({ queryKey: keys.units, queryFn: listUnits });
  const positionsQuery = useQuery({ queryKey: keys.positions, queryFn: listPositions });
  const employeesQuery = useQuery({ queryKey: keys.employees, queryFn: listEmployees });
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);
  const jobs = useMemo(() => (positionsQuery.data ?? []).filter((j) => j.active), [positionsQuery.data]);
  const staff = useMemo(() => (employeesQuery.data ?? []).filter((e) => e.status !== "Separated"), [employeesQuery.data]);

  const byName = (a: UnitSummary, b: UnitSummary) => a.name.localeCompare(b.name);
  const company = units.find((u) => u.type === "company");
  const branches = units.filter((u) => u.type === "branch" && u.active).sort(byName);
  const departments = units.filter((u) => u.type === "department" && u.active).sort(byName);
  const teams = units.filter((u) => u.type === "team" && u.active).sort(byName);
  const childrenOf = (id: string) => units.filter((u) => u.parentId === id && u.active).sort(byName);
  const unit = (id: string | null | undefined) => units.find((u) => u.id === id);
  const branchOf = (u?: UnitSummary): UnitSummary | undefined => (!u ? undefined : u.type === "branch" ? u : branchOf(unit(u.parentId)));

  const subtree = (id: string) => {
    const ids = new Set([id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const u of units) {
        if (u.parentId && ids.has(u.parentId) && !ids.has(u.id)) {
          ids.add(u.id);
          grew = true;
        }
      }
    }
    return ids;
  };
  const staffOf = (id: string): EmployeeSummary[] => {
    const ids = subtree(id);
    return staff.filter((e) => ids.has(e.unitId)).sort((a, b) => a.name.localeCompare(b.name));
  };
  const jobsOf = (id: string): PositionSummary[] => {
    const ids = subtree(id);
    return jobs.filter((j) => ids.has(j.departmentId)).sort((a, b) => b.open - a.open || a.title.localeCompare(b.title));
  };

  return {
    loading: unitsQuery.isLoading || positionsQuery.isLoading || employeesQuery.isLoading,
    error: unitsQuery.isError || positionsQuery.isError || employeesQuery.isError,
    retry: () => (unitsQuery.refetch(), positionsQuery.refetch(), employeesQuery.refetch()),
    units,
    jobs,
    staff,
    company,
    branches,
    departments,
    teams,
    childrenOf,
    unit,
    branchOf,
    staffOf,
    jobsOf,
  };
}

export type Company = ReturnType<typeof useCompany>;

export const editInput = (u: UnitSummary): UnitInput => ({ id: u.id, type: u.type, name: u.name, code: u.code, parentId: u.parentId, headEmployeeId: u.headEmployeeId, address: u.address });
export const newUnit = (type: UnitInput["type"], parentId: string): UnitInput => ({ type, name: "", code: "", parentId });

/** The actions every layout offers; the page owns the dialogs. */
export interface CompanyActions {
  editUnit: (input: UnitInput) => void;
  openJob: (departmentId: string, job?: PositionSummary) => void;
}

export type Layout = "tables" | "explorer" | "chart";

const KEY = "heyhr-company-layout";

/** Which layout is being tried, remembered per browser while choosing. */
export function useLayout(): [Layout, (l: Layout) => void] {
  const [layout, setLayout] = useState<Layout>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === "explorer" || v === "chart" ? v : "tables";
    } catch {
      return "tables";
    }
  });
  return [
    layout,
    (l) => {
      setLayout(l);
      try {
        localStorage.setItem(KEY, l);
      } catch {
        // Not remembered; still switches now.
      }
    },
  ];
}
