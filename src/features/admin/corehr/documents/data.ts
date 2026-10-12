import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { documentAlert, listDocuments, listEmployees, type EmployeeSummary } from "@/lib/corehr/api";
import type { EmployeeDocument } from "@/lib/corehr/types";
import { useOfficeFilter } from "../../OfficeFilterContext";
import { keys } from "../format";

export type Stage = "missing" | "check" | "expiring" | "expired" | "done";

/** Where a document is in the review: what HR should do next. Null when it doesn't apply. */
export function stageOf(d: EmployeeDocument): Stage | null {
  const alert = documentAlert(d);
  if (alert === "expired") return "expired";
  if (alert === "expiring") return "expiring";
  if (d.status === "Submitted") return "check";
  if (d.status === "Missing") return "missing";
  if (d.status === "Verified") return "done";
  return null;
}

export interface DocRow {
  d: EmployeeDocument;
  e: EmployeeSummary;
}

/** Everything the 201 documents page needs: current employees and their documents. */
export function useDocuments() {
  const { office } = useOfficeFilter();
  const docsQuery = useQuery({ queryKey: keys.documents, queryFn: () => listDocuments() });
  const peopleQuery = useQuery({ queryKey: keys.employees, queryFn: listEmployees });
  const people = useMemo(() => new Map((peopleQuery.data ?? []).filter((e) => e.status !== "Separated" && (office === "All offices" || e.branchName === office)).map((e) => [e.id, e])), [peopleQuery.data, office]);
  const rows: DocRow[] = (docsQuery.data ?? []).flatMap((d) => {
    const e = people.get(d.employeeId);
    return e ? [{ d, e }] : [];
  });
  const required = rows.filter((r) => r.d.status !== "Not applicable");
  return {
    loading: docsQuery.isLoading || peopleQuery.isLoading,
    error: docsQuery.isError || peopleQuery.isError,
    retry: () => (docsQuery.refetch(), peopleQuery.refetch()),
    people,
    rows,
    required: required.length,
    checked: required.filter((r) => r.d.status === "Verified").length,
  };
}
