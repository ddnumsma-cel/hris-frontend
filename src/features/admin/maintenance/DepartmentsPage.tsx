import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { PlusIcon } from "@/components/icons";
import { listUnits } from "@/lib/corehr/api";
import { headChoices, listDepartments, listLocations, saveDepartment, setDepartmentActive, type DepartmentRow } from "@/lib/corehr/maintenance";
import { useCan } from "@/lib/useCan";
import { SimpleTable } from "../timekeeping/common";
import { inputClass } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";

const KEY = ["corehr", "departments"] as const;
type Draft = { id?: string; name: string; code: string; officeId: string; headEmployeeId: string };

function DepartmentDialog({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [d, setD] = useState(draft);
  const offices = useQuery({ queryKey: ["corehr", "locations"], queryFn: listLocations });
  const save = useMutation({
    mutationFn: () => saveDepartment(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      toast.show(draft.id ? `${d.name} saved.` : `${d.name} added.`);
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={draft.id ? `Edit ${draft.name}` : "Add a department"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <Field id="dp-name" label="Department">
            <input id="dp-name" className={inputClass} value={d.name} placeholder="e.g. Tax Advisory" onChange={(e) => setD({ ...d, name: e.target.value })} />
          </Field>
          <Field id="dp-code" label="Code">
            <input id="dp-code" className={inputClass} value={d.code} placeholder="TAX" onChange={(e) => setD({ ...d, code: e.target.value })} />
          </Field>
        </div>
        <Field id="dp-office" label="Office">
          <select id="dp-office" className={inputClass} value={d.officeId} onChange={(e) => setD({ ...d, officeId: e.target.value })}>
            <option value="">Choose the office</option>
            {offices.data?.filter((o) => o.active).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="dp-head" label="Department head" hint="Optional.">
          <select id="dp-head" className={inputClass} value={d.headEmployeeId} onChange={(e) => setD({ ...d, headEmployeeId: e.target.value })}>
            <option value="">No head yet</option>
            {headChoices().map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}

/** Maintenance → Department: the departments in each office. */
export function DepartmentsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canEdit = useCan("edit", "departments");
  const canAdd = useCan("create", "departments");
  const list = useQuery({ queryKey: KEY, queryFn: listDepartments, staleTime: 0 });
  // Open slots come from the org chart's positions.
  const units = useQuery({ queryKey: ["corehr", "units"], queryFn: listUnits });
  const openSlots = (id: string) => units.data?.find((u) => u.id === id)?.openSlots ?? 0;
  const [editing, setEditing] = useState<Draft | null>(null);
  const toggle = useMutation({
    mutationFn: (r: DepartmentRow) => setDepartmentActive(r.id, !r.active),
    onSuccess: (_v, r) => (queryClient.invalidateQueries({ queryKey: ["corehr"] }), toast.show(r.active ? `${r.name} deactivated.` : `${r.name} is active again.`)),
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't change it.", "critical"),
  });
  if (list.isError) return <LoadError onRetry={() => list.refetch()} />;

  return (
    <>
      <ContentHead
        title="Departments"
        subtitle="The departments in each office. Employees belong to a department or one of its teams."
        actions={
          canAdd ? (
            <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setEditing({ name: "", code: "", officeId: "", headEmployeeId: "" })}>
              Add department
            </Button>
          ) : undefined
        }
      />
      <SimpleTable
        rows={list.data ?? []}
        rowKey={(r) => r.id}
        loading={list.isLoading}
        empty="No departments yet."
        cols={[
          { header: "Department", cell: (r) => <span className="font-medium">{r.name}</span> },
          { header: "Code", cell: (r) => <span className="text-ink-2">{r.code}</span> },
          { header: "Location", cell: (r) => r.office },
          { header: "Head", cell: (r) => <span className="text-ink-2">{r.headName ?? "—"}</span> },
          { header: "People", align: "right", cell: (r) => r.headcount },
          { header: "Open slots", align: "right", cell: (r) => openSlots(r.id) },
          { header: "Teams", align: "right", cell: (r) => r.teams || "—" },
          { header: "Status", cell: (r) => <Pill tone={r.active ? "good" : "neutral"}>{r.active ? "Active" : "Inactive"}</Pill> },
          {
            header: "",
            align: "right",
            cell: (r) =>
              canEdit ? (
                <span className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ id: r.id, name: r.name, code: r.code, officeId: r.officeId, headEmployeeId: r.headEmployeeId ?? "" })}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate(r)}>
                    {r.active ? "Deactivate" : "Reactivate"}
                  </Button>
                </span>
              ) : null,
          },
        ]}
      />
      {editing && <DepartmentDialog draft={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
