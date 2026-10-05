import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/ToastContext";
import { documentAlert, listDocuments, listEmployees, updateDocument, type EmployeeSummary } from "@/lib/corehr/api";
import type { EmployeeDocument } from "@/lib/corehr/types";
import { useOfficeFilter } from "../../OfficeFilterContext";
import { keys, useActor } from "../format";

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

/** Everything the Documents layouts need: current employees, their documents, and a one-click "checked". */
export function useDocuments() {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const { office } = useOfficeFilter();
  const docsQuery = useQuery({ queryKey: keys.documents, queryFn: () => listDocuments() });
  const peopleQuery = useQuery({ queryKey: keys.employees, queryFn: listEmployees });
  const people = useMemo(() => new Map((peopleQuery.data ?? []).filter((e) => e.status !== "Separated" && (office === "All offices" || e.branchName === office)).map((e) => [e.id, e])), [peopleQuery.data, office]);
  const rows: DocRow[] = (docsQuery.data ?? []).flatMap((d) => {
    const e = people.get(d.employeeId);
    return e ? [{ d, e }] : [];
  });
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
  const required = rows.filter((r) => r.d.status !== "Not applicable");
  return {
    loading: docsQuery.isLoading || peopleQuery.isLoading,
    error: docsQuery.isError || peopleQuery.isError,
    retry: () => (docsQuery.refetch(), peopleQuery.refetch()),
    people,
    rows,
    required: required.length,
    checked: required.filter((r) => r.d.status === "Verified").length,
    verify,
  };
}
