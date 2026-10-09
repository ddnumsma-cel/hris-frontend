import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { PlusIcon } from "@/components/icons";
import { listLocations, saveLocation, setLocationActive, type LocationRow } from "@/lib/corehr/maintenance";
import { useCan } from "@/lib/useCan";
import { SimpleTable } from "../timekeeping/common";
import { inputClass } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";

const KEY = ["corehr", "locations"] as const;
type Draft = { id?: string; name: string; code: string; address: string };

function LocationDialog({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [d, setD] = useState(draft);
  const save = useMutation({
    mutationFn: () => saveLocation(d),
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
      title={draft.id ? `Edit ${draft.name}` : "Add an office"}
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
          <Field id="lc-name" label="Office" hint={draft.id ? "Used across attendance, holidays and payroll, so it can't be renamed." : undefined}>
            <input id="lc-name" className={inputClass} value={d.name} disabled={!!draft.id} placeholder="e.g. Iloilo" onChange={(e) => setD({ ...d, name: e.target.value })} />
          </Field>
          <Field id="lc-code" label="Code">
            <input id="lc-code" className={inputClass} value={d.code} placeholder="ILO" onChange={(e) => setD({ ...d, code: e.target.value })} />
          </Field>
        </div>
        <Field id="lc-address" label="Address">
          <textarea id="lc-address" rows={2} className={inputClass} value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} />
        </Field>
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}

/** Maintenance → Locations: the company's offices. */
export function LocationsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canEdit = useCan("edit", "locations");
  const canAdd = useCan("create", "locations");
  const list = useQuery({ queryKey: KEY, queryFn: listLocations, staleTime: 0 });
  const [editing, setEditing] = useState<Draft | null>(null);
  const toggle = useMutation({
    mutationFn: (r: LocationRow) => setLocationActive(r.id, !r.active),
    onSuccess: (_v, r) => (queryClient.invalidateQueries({ queryKey: ["corehr"] }), toast.show(r.active ? `${r.name} deactivated.` : `${r.name} is active again.`)),
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't change it.", "critical"),
  });
  if (list.isError) return <LoadError onRetry={() => list.refetch()} />;

  return (
    <>
      <ContentHead
        title="Locations"
        subtitle="The company's offices. Departments, attendance scanners and local holidays belong to an office."
        actions={
          canAdd ? (
            <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setEditing({ name: "", code: "", address: "" })}>
              Add office
            </Button>
          ) : undefined
        }
      />
      <SimpleTable
        rows={list.data ?? []}
        rowKey={(r) => r.id}
        loading={list.isLoading}
        empty="No offices yet."
        cols={[
          { header: "Office", cell: (r) => <span className="font-medium">{r.name}</span> },
          { header: "Code", cell: (r) => <span className="text-ink-2">{r.code}</span> },
          { header: "Address", cell: (r) => <span className="inline-block max-w-80 truncate align-bottom text-ink-2" title={r.address}>{r.address || "—"}</span> },
          { header: "Departments", align: "right", cell: (r) => r.departments || "—" },
          { header: "People", align: "right", cell: (r) => r.headcount },
          { header: "Status", cell: (r) => <Pill tone={r.active ? "good" : "neutral"}>{r.active ? "Active" : "Inactive"}</Pill> },
          {
            header: "",
            align: "right",
            cell: (r) =>
              canEdit ? (
                <span className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ id: r.id, name: r.name, code: r.code, address: r.address })}>
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
      {editing && <LocationDialog draft={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
