import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/features/auth/AuthContext";
import { createAccount, employeesWithoutAccount, listAccounts, listRoles, resetPassword, setAccountRole, setAccountStatus, unlockAccount, type AccountRow } from "@/lib/admin/api";
import { inputClass, useActor } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { Choice, Name, SearchBox, SimpleTable, Toolbar, type Col } from "../timekeeping/common";
import { shortDate } from "../timekeeping/format";

const KEYS = { accounts: ["admin", "accounts"] as const, roles: ["admin", "roles"] as const };

function PasswordNote({ username, password }: { username: string; password: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3 text-sm">
      <p className="text-ink-2">Give these to the person. The password is shown only once.</p>
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <span className="text-ink-2">Username</span>
        <span className="font-mono font-semibold">{username}</span>
        <span className="text-ink-2">Temporary password</span>
        <span className="font-mono font-semibold">{password}</span>
      </div>
    </div>
  );
}

function AddUserDialog({ onClose }: { onClose: () => void }) {
  const actor = useActor();
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: KEYS.roles, queryFn: listRoles });
  const [staff] = useState(employeesWithoutAccount);
  const [form, setForm] = useState({ employeeId: "", name: "", username: "", roleId: "employee" });
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const save = useMutation({
    mutationFn: () => createAccount(form, actor),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      setCreated(r);
    },
  });
  const pickEmployee = (id: string) => {
    const e = staff.find((x) => x.id === id);
    setForm({ ...form, employeeId: id, name: e?.name ?? form.name, username: e ? (e.email.split("@")[0] ?? "").toLowerCase() : form.username });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={created ? "User added" : "Add a user"}
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          {created ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={save.isPending} onClick={() => save.mutate()}>
                Add user
              </Button>
            </>
          )}
        </div>
      }
    >
      {created ? (
        <PasswordNote {...created} />
      ) : (
        <div className="flex flex-col gap-3">
          <Field id="u-emp" label="Employee" hint="Link the account to their 201 file. Leave blank for outside accounts, e.g. an auditor.">
            <select id="u-emp" className={inputClass} value={form.employeeId} onChange={(e) => pickEmployee(e.target.value)}>
              <option value="">Not an employee</option>
              {staff.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="u-name" label="Name" required>
              <input id="u-name" className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field id="u-user" label="Username" required>
              <input id="u-user" className={inputClass} value={form.username} autoComplete="off" onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Field>
          </div>
          <Field id="u-role" label="Role" required hint={roles.data?.find((r) => r.id === form.roleId)?.description}>
            <select id="u-role" className={inputClass} value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              {(roles.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-ink-3">A temporary password is made for them. They'll be asked to change it.</p>
          <ErrorNote error={save.error} />
        </div>
      )}
    </Dialog>
  );
}

function ManageDialog({ a, onClose }: { a: AccountRow; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: KEYS.roles, queryFn: listRoles });
  const [roleId, setRoleId] = useState(a.roleId);
  const [newPassword, setNewPassword] = useState<{ username: string; password: string } | null>(null);
  const done = (msg: string) => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    toast.show(msg);
  };
  const role = useMutation({ mutationFn: () => setAccountRole(a.id, roleId, actor, user?.accountId), onSuccess: () => (done("Role changed."), onClose()) });
  const status = useMutation({ mutationFn: () => setAccountStatus(a.id, a.status === "active" ? "disabled" : "active", actor, user?.accountId), onSuccess: () => (done(a.status === "active" ? "Account turned off. They can't sign in." : "Account turned on."), onClose()) });
  const unlock = useMutation({ mutationFn: () => unlockAccount(a.id, actor), onSuccess: () => (done("Account unlocked."), onClose()) });
  const reset = useMutation({ mutationFn: () => resetPassword(a.id, actor), onSuccess: (r) => (done("Password reset."), setNewPassword(r)) });
  const self = a.id === user?.accountId;

  return (
    <Dialog open onClose={onClose} title={a.name} footer={<div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Close</Button></div>}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-2">
          Username <span className="font-mono font-semibold text-ink">{a.username}</span>
          {a.employeeName && <> · linked to {a.employeeName}</>}
          {a.lastSignIn && <> · last signed in {shortDate(a.lastSignIn)}</>}
        </p>
        {self && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">This is your own account. Ask another HR administrator to change your role or turn it off.</p>}
        <div className="flex items-end gap-2">
          <Field id="m-role" label="Role" className="flex-1" hint={roles.data?.find((r) => r.id === roleId)?.description}>
            <select id="m-role" className={inputClass} value={roleId} disabled={self} onChange={(e) => setRoleId(e.target.value)}>
              {(roles.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Button disabled={self || roleId === a.roleId || role.isPending} onClick={() => role.mutate()} className="mb-5">
            Save role
          </Button>
        </div>
        {newPassword && <PasswordNote {...newPassword} />}
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {a.locked && (
            <Button variant="ghost" size="sm" disabled={unlock.isPending} onClick={() => unlock.mutate()}>
              Unlock
            </Button>
          )}
          {!a.demoRole && (
            <Button variant="ghost" size="sm" disabled={reset.isPending} onClick={() => reset.mutate()}>
              Reset password
            </Button>
          )}
          <Button variant={a.status === "active" ? "danger" : "ghost"} size="sm" disabled={self || status.isPending} onClick={() => status.mutate()}>
            {a.status === "active" ? "Turn off account" : "Turn on account"}
          </Button>
        </div>
        <ErrorNote error={role.error ?? status.error ?? unlock.error ?? reset.error} />
      </div>
    </Dialog>
  );
}

export function UsersPage() {
  const accounts = useQuery({ queryKey: KEYS.accounts, queryFn: listAccounts });
  const roles = useQuery({ queryKey: KEYS.roles, queryFn: listRoles });
  const [query, setQuery] = useState("");
  const [roleId, setRoleId] = useState("all");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<AccountRow | null>(null);

  if (accounts.isError) return <LoadError onRetry={() => accounts.refetch()} />;

  const q = query.trim().toLowerCase();
  const rows = (accounts.data ?? []).filter((a) => (roleId === "all" || a.roleId === roleId) && (!q || a.name.toLowerCase().includes(q) || a.username.includes(q)));
  const cols: Col<AccountRow>[] = [
    { header: "User", cell: (a) => <Name name={a.name} sub={a.username} /> },
    { header: "Role", cell: (a) => a.roleName },
    { header: "Employee record", cell: (a) => <span className="text-ink-2">{a.employeeName ?? (a.demoRole ? "Demo login" : "Not linked")}</span> },
    { header: "Status", cell: (a) => (a.locked ? <Pill tone="warn">Locked</Pill> : a.status === "active" ? <Pill tone="good">Active</Pill> : <Pill tone="neutral">Turned off</Pill>) },
    { header: "Last sign-in", cell: (a) => <span className="text-ink-2">{a.lastSignIn ? shortDate(a.lastSignIn) : "Never"}</span> },
    {
      header: "",
      align: "right",
      cell: (a) => (
        <Button size="sm" variant="ghost" onClick={() => setOpen(a)}>
          Manage
        </Button>
      ),
    },
  ];

  return (
    <>
      <ContentHead title="Users" subtitle="Who can sign in, and with what role. Turned-off accounts can't sign in." actions={<Button onClick={() => setAdding(true)}>Add user</Button>} />
      <Toolbar>
        <SearchBox value={query} onChange={setQuery} placeholder="Search name or username" />
        <Choice label="Role" value={roleId} onChange={setRoleId} options={[{ value: "all", label: "All roles" }, ...(roles.data ?? []).map((r) => ({ value: r.id, label: r.name }))]} />
      </Toolbar>
      <SimpleTable rows={rows} rowKey={(a) => a.id} cols={cols} loading={accounts.isLoading} empty="No users match." />
      {adding && <AddUserDialog onClose={() => setAdding(false)} />}
      {open && <ManageDialog key={open.id} a={open} onClose={() => setOpen(null)} />}
    </>
  );
}
