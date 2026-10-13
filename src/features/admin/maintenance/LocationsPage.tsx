import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { PlusIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { listDepartments, listLocations, saveLocation, setLocationActive, type LocationRow } from "@/lib/corehr/maintenance";
import { useCan } from "@/lib/useCan";
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

const panel = "rounded-[var(--radius-card)] border border-[var(--card-border)] bg-surface";
const COLORS = ["var(--color-cat-1)", "var(--color-cat-2)", "var(--color-cat-3)", "var(--color-cat-4)"];

/**
 * Maintenance → Locations: the company's offices. Each office shows its share of all staff, as a
 * bar as long as that share and split into its departments.
 */
export function LocationsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canEdit = useCan("edit", "locations");
  const canAdd = useCan("create", "locations");
  const list = useQuery({ queryKey: KEY, queryFn: listLocations, staleTime: 0 });
  const depts = useQuery({ queryKey: ["corehr", "departments"], queryFn: listDepartments, staleTime: 0 });
  const [editing, setEditing] = useState<Draft | null>(null);
  const toggle = useMutation({
    mutationFn: (r: LocationRow) => setLocationActive(r.id, !r.active),
    onSuccess: (_v, r) => (queryClient.invalidateQueries({ queryKey: ["corehr"] }), toast.show(r.active ? `${r.name} deactivated.` : `${r.name} is active again.`)),
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't change it.", "critical"),
  });
  if (list.isError) return <LoadError onRetry={() => list.refetch()} />;

  const rows = list.data ?? [];
  const total = Math.max(1, rows.reduce((n, r) => n + r.headcount, 0));
  const deptsOf = (id: string) => (depts.data ?? []).filter((d) => d.officeId === id && d.active && d.headcount > 0);

  return (
    <>
      <ContentHead
        title="Locations"
        actions={
          canAdd ? (
            <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setEditing({ name: "", code: "", address: "" })}>
              Add office
            </Button>
          ) : undefined
        }
      />
      {list.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <p className={clsx(panel, "p-8 text-center text-sm text-ink-2")}>No offices yet.</p>
      ) : (
        <div className={clsx(panel, "flex flex-col divide-y divide-[var(--line)]")}>
          {rows.map((r) => {
            const ds = deptsOf(r.id);
            return (
              <div key={r.id} className={clsx("grid gap-3 p-5 lg:grid-cols-[14rem_minmax(0,1fr)_auto] lg:items-center", !r.active && "opacity-70")}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold">{r.name}</span>
                    <span className="text-xs text-ink-3">{r.code}</span>
                    {!r.active && <Pill tone="neutral">Inactive</Pill>}
                  </div>
                  <div className="text-xs text-ink-2">
                    {Math.round((r.headcount / total) * 100)}% of staff · {r.headcount} {r.headcount === 1 ? "person" : "people"}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex h-3 overflow-hidden rounded-[var(--radius-pill)] bg-surface-2" style={{ width: `${Math.max(8, (r.headcount / total) * 100)}%` }}>
                    {ds.map((d, i) => (
                      <span key={d.id} title={`${d.name} · ${d.headcount}`} style={{ flexGrow: d.headcount, background: COLORS[i % COLORS.length] }} />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
                    {ds.map((d, i) => (
                      <span key={d.id} className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        {d.name} {d.headcount}
                      </span>
                    ))}
                    {ds.length === 0 && <span className="text-ink-3">No one assigned yet</span>}
                  </div>
                  <p className="mt-2 truncate text-xs text-ink-3" title={r.address}>
                    {r.address || "No address yet"}
                  </p>
                </div>
                {canEdit && (
                  <span className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: r.id, name: r.name, code: r.code, address: r.address })}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate(r)}>
                      {r.active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {editing && <LocationDialog draft={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
