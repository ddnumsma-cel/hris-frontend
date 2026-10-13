import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { EditIcon, PhoneIcon, PlusIcon, PowerIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { headChoices, listLocations, saveLocation, setLocationActive, type LocationRow } from "@/lib/corehr/maintenance";
import { useCan } from "@/lib/useCan";
import { inputClass } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";

const KEY = ["corehr", "locations"] as const;
type Draft = { id?: string; name: string; code: string; address: string; contactName: string; contactPhone: string; managerId: string };
const BLANK: Draft = { name: "", code: "", address: "", contactName: "", contactPhone: "", managerId: "" };

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
          <Field id="lc-name" label="Branch name" hint={draft.id ? "Used across attendance, holidays and payroll, so it can't be renamed." : undefined}>
            <input id="lc-name" className={inputClass} value={d.name} disabled={!!draft.id} placeholder="e.g. Iloilo" onChange={(e) => setD({ ...d, name: e.target.value })} />
          </Field>
          <Field id="lc-code" label="Code">
            <input id="lc-code" className={inputClass} value={d.code} placeholder="ILO" onChange={(e) => setD({ ...d, code: e.target.value })} />
          </Field>
        </div>
        <Field id="lc-address" label="Address">
          <textarea id="lc-address" rows={2} className={inputClass} value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="lc-contact" label="Contact person">
            <input id="lc-contact" className={inputClass} value={d.contactName} autoComplete="off" onChange={(e) => setD({ ...d, contactName: e.target.value })} />
          </Field>
          <Field id="lc-phone" label="Contact phone">
            <input id="lc-phone" type="tel" inputMode="tel" className={inputClass} value={d.contactPhone} placeholder="0917 123 4567" autoComplete="off" onChange={(e) => setD({ ...d, contactPhone: e.target.value })} />
          </Field>
        </div>
        <Field id="lc-manager" label="Branch manager" hint="Optional.">
          <select id="lc-manager" className={inputClass} value={d.managerId} onChange={(e) => setD({ ...d, managerId: e.target.value })}>
            <option value="">No manager yet</option>
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

const panel = "rounded-[var(--radius-card)] border border-[var(--card-border)] bg-surface";

/**
 * Maintenance → Locations: the company's offices as a directory, one card per office with its
 * address, branch manager and contact person.
 */
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

  const rows = list.data ?? [];
  const total = Math.max(1, rows.reduce((n, r) => n + r.headcount, 0));
  const share = (r: LocationRow) => Math.round((r.headcount / total) * 100);
  const initials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const actions = (r: LocationRow) =>
    canEdit ? (
      <span className="flex flex-none justify-end gap-2">
        <Button size="sm" variant="ghost" icon={<EditIcon className="h-4 w-4" />} aria-label={`Edit ${r.name}`} title="Edit" onClick={() => setEditing({ id: r.id, name: r.name, code: r.code, address: r.address, contactName: r.contactName, contactPhone: r.contactPhone, managerId: r.managerId ?? "" })} />
        <Button
          size="sm"
          variant="ghost"
          icon={<PowerIcon className="h-4 w-4" />}
          className={r.active ? "text-critical" : "text-good"}
          aria-label={`${r.active ? "Deactivate" : "Reactivate"} ${r.name}`}
          title={r.active ? "Deactivate" : "Reactivate"}
          disabled={toggle.isPending}
          onClick={() => toggle.mutate(r)}
        />
      </span>
    ) : null;

  return (
    <>
      <ContentHead
        title="Locations"
        actions={
          canAdd && (
            <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setEditing(BLANK)}>
              Add office
            </Button>
          )
        }
      />
      {list.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <p className={clsx(panel, "p-8 text-center text-sm text-ink-2")}>No offices yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {rows.map((r) => (
            <div key={r.id} className={clsx(panel, "flex flex-col p-5", !r.active && "opacity-70")}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-logo)] bg-surface-2 text-sm font-semibold text-ink-2">{r.code}</span>
                {actions(r)}
              </div>
              <div className="mt-4 truncate text-[15px] font-semibold">{r.name}</div>
              <p className="mt-1 line-clamp-2 min-h-8 text-xs text-ink-2">{r.address || "No address yet"}</p>
              <div className="mt-4 flex flex-col gap-3 border-t border-[var(--line)] pt-4 text-sm">
                <div className="flex items-center gap-3">
                  <span className="accent-fill flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-semibold">{r.managerName ? initials(r.managerName) : "—"}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.managerName ?? "None yet"}</span>
                    <span className="block text-xs text-ink-2">Manager</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-2 text-ink-2">
                    <PhoneIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 text-xs">
                    <span className="block truncate text-sm font-medium">{r.contactName || "None yet"}</span>
                    {r.contactPhone ? (
                      <a href={`tel:${r.contactPhone.replace(/[^\d+]/g, "")}`} className="text-brand hover:underline">
                        {r.contactPhone}
                      </a>
                    ) : (
                      <span className="text-ink-2">Contact</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-ink-2">
                <span>
                  {r.headcount} {r.headcount === 1 ? "person" : "people"} · {share(r)}%
                </span>
                {!r.active && <Pill tone="neutral">Inactive</Pill>}
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <LocationDialog draft={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
