import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/features/auth/AuthContext";
import { ACCESS_LABEL, deleteRole, listRoles, saveRole, type RoleRow } from "@/lib/admin/api";
import { MODULES, type Access, type ModuleKey } from "@/lib/admin/store";
import { inputClass, useActor } from "../corehr/format";
import { ErrorNote, Field, LoadError } from "../corehr/ui";
import { Name, SimpleTable, type Col } from "../timekeeping/common";

const LEVELS: Access[] = ["none", "view", "edit", "approve"];
const WORKSPACE = { admin: "HR workspace", manager: "Partner workspace", employee: "Employee self-service" } as const;

type Draft = { id?: string; name: string; description: string; access: Record<ModuleKey, Access>; workspace: RoleRow["workspace"]; locked: boolean };

function RoleDialog({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [d, setD] = useState(initial);
  const save = useMutation({
    mutationFn: () => saveRole(d, actor, user?.accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.show(d.id ? "Role saved. Changes apply the next time a page opens." : "Role added.");
      onClose();
    },
  });
  const matrix = d.workspace === "admin";

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={d.id ? `Edit ${initial.name}` : "Add a role"}
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {!d.locked && (
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field id="r-name" label="Role name" required>
            <input id="r-name" className={inputClass} value={d.name} disabled={d.locked} placeholder="e.g. Recruiter" onChange={(e) => setD({ ...d, name: e.target.value })} />
          </Field>
          <Field id="r-desc" label="What it's for">
            <input id="r-desc" className={inputClass} value={d.description} disabled={d.locked} onChange={(e) => setD({ ...d, description: e.target.value })} />
          </Field>
        </div>
        {!matrix ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">This role signs into the {WORKSPACE[d.workspace]}. What they can see there is fixed: {d.workspace === "manager" ? "their own team only" : "only their own records"}.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--card-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-left text-xs text-ink-2">
                  <th className="px-3 py-2 font-medium">Module</th>
                  {LEVELS.map((l) => (
                    <th key={l} className="px-2 py-2 text-center font-medium">
                      {ACCESS_LABEL[l]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((m) => (
                  <tr key={m.key} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{m.label}</td>
                    {LEVELS.map((l) => {
                      const na = l === "approve" && !m.approvable;
                      return (
                        <td key={l} className="px-2 py-2 text-center">
                          {na ? (
                            <span className="text-ink-3">—</span>
                          ) : (
                            <input type="radio" name={`acc-${m.key}`} aria-label={`${m.label}: ${ACCESS_LABEL[l]}`} checked={d.access[m.key] === l} disabled={d.locked} onChange={() => setD({ ...d, access: { ...d.access, [m.key]: l } })} className="h-4 w-4 accent-[var(--color-brand)]" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {matrix && <p className="text-xs text-ink-3">No access hides the module from the menu. "Edit and approve" lets them approve leave, overtime and undertime.</p>}
        {d.locked && <p className="text-xs text-ink-3">The Super Admin role is fixed: it manages users, roles and settings, and never sees employee data.</p>}
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}

const summary = (r: RoleRow) => {
  if (r.workspace !== "admin") return r.workspace === "manager" ? "Own team" : "Own records";
  const open = MODULES.filter((m) => r.access[m.key] !== "none");
  if (open.length === MODULES.length && MODULES.every((m) => r.access[m.key] === "edit" || r.access[m.key] === "approve")) return "Everything";
  return open.map((m) => m.label.split(" ")[0]).join(", ") || "Nothing";
};

export function RolesPage() {
  const toast = useToast();
  const actor = useActor();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });
  const [editing, setEditing] = useState<Draft | null>(null);
  const remove = useMutation({
    mutationFn: (r: RoleRow) => deleteRole(r.id, actor, user?.accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.show("Role deleted.");
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't delete."),
  });

  if (roles.isError) return <LoadError onRetry={() => roles.refetch()} />;

  const blank: Draft = { name: "", description: "", workspace: "admin", locked: false, access: Object.fromEntries(MODULES.map((m) => [m.key, "none"])) as Record<ModuleKey, Access> };
  const cols: Col<RoleRow>[] = [
    { header: "Role", cell: (r) => <Name name={r.name} sub={r.description} /> },
    { header: "Signs into", cell: (r) => (r.superAdmin ? "System administration" : WORKSPACE[r.workspace]) },
    { header: "Can open", cell: (r) => <span className="inline-block max-w-72 truncate align-bottom text-ink-2">{summary(r)}</span> },
    { header: "Users", cell: (r) => r.users },
    {
      header: "",
      align: "right",
      cell: (r) => (
        <span className="flex justify-end gap-1.5">
          {!r.builtIn && (
            <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(r)}>
              Delete
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setEditing({ ...r, locked: !!r.superAdmin })}>
            {r.superAdmin ? "View" : "Edit"}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <ContentHead title="Roles & access" subtitle="A role decides which modules someone can open, and whether they can only look, edit, or also approve." actions={<Button onClick={() => setEditing(blank)}>Add role</Button>} />
      <SimpleTable rows={roles.data ?? []} rowKey={(r) => r.id} cols={cols} loading={roles.isLoading} empty="No roles yet." />
      <div className={clsx("grid gap-3 text-sm sm:grid-cols-4")}>
        {LEVELS.map((l) => (
          <div key={l} className="rounded-xl border border-border bg-surface px-3.5 py-2.5">
            <div className="font-semibold">{ACCESS_LABEL[l]}</div>
            <div className="text-xs text-ink-2">{{ none: "The module is hidden from the menu.", view: "Can open and read, and download reports.", edit: "Can add and change records.", approve: "Can also approve or reject requests." }[l]}</div>
          </div>
        ))}
      </div>
      {editing && <RoleDialog initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
