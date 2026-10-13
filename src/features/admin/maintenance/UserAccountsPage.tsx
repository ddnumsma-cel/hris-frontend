import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { useAuth } from "@/features/auth/AuthContext";
import { listUserAccounts, resetPassword, setAccountStatus, unlockAccount, type UserAccountRow } from "@/lib/admin/api";
import { fmtDay, fmtTime } from "@/lib/preferences";
import { useActor } from "../corehr/format";
import { LoadError, Pill } from "../corehr/ui";
import { Choice, Name, SearchBox, SimpleTable, Toolbar, type Col } from "../timekeeping/common";

const KEY = ["admin", "accounts"] as const;
const when = (iso?: string) => (iso ? `${fmtDay(iso.slice(0, 10))} · ${fmtTime(iso)}` : "Never");

function Password({ r }: { r: UserAccountRow }) {
  const toast = useToast();
  const [shown, setShown] = useState(false);
  if (r.demo) return <span className="text-xs text-ink-3">Demo login</span>;
  if (!r.tempPassword) return <span className="text-xs text-ink-3">Set by the user</span>;
  return (
    <span className="flex items-center gap-2">
      <code className="font-num rounded-[var(--radius-logo)] bg-surface-2 px-2 py-0.5 text-[13px]">{shown ? r.tempPassword : "••••••••••"}</code>
      <button type="button" onClick={() => setShown((v) => !v)} className="text-xs font-medium text-brand-ink hover:underline">
        {shown ? "Hide" : "Show"}
      </button>
      <button type="button" onClick={() => navigator.clipboard?.writeText(r.tempPassword!).then(() => toast.show("Password copied."))} className="text-xs font-medium text-brand-ink hover:underline">
        Copy
      </button>
    </span>
  );
}

/**
 * Maintenance → User accounts. Every account the System Admin adds shows up here straight away
 * (same account list), with its username, temporary password, role and status. A temporary
 * password is shown only until the person signs in and sets their own.
 */
export function UserAccountsPage() {
  const toast = useToast();
  const actor = useActor();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: [...KEY, "full"], queryFn: listUserAccounts, staleTime: 0, refetchInterval: 15_000 });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [reset, setReset] = useState<{ username: string; password: string } | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  const onError = (e: Error) => toast.show(e.message, "critical");
  const doReset = useMutation({ mutationFn: (r: UserAccountRow) => resetPassword(r.id, actor, user?.accountId), onSuccess: (p) => (refresh(), setReset(p)), onError });
  const doStatus = useMutation({
    mutationFn: (r: UserAccountRow) => setAccountStatus(r.id, r.status === "active" ? "disabled" : "active", actor, user?.accountId),
    onSuccess: (_v, r) => (refresh(), toast.show(r.status === "active" ? `${r.username} turned off.` : `${r.username} turned on.`)),
    onError,
  });
  const doUnlock = useMutation({ mutationFn: (r: UserAccountRow) => unlockAccount(r.id, actor, user?.accountId), onSuccess: (_v, r) => (refresh(), toast.show(`${r.username} unlocked.`)), onError });
  if (list.isError) return <LoadError onRetry={() => list.refetch()} />;

  const all = list.data ?? [];
  const roles = [...new Set(all.map((r) => r.roleName))].sort();
  const q = search.trim().toLowerCase();
  const rows = all.filter((r) => (role === "all" || r.roleName === role) && (!q || r.name.toLowerCase().includes(q) || r.username.includes(q) || (r.employeeCode ?? "").toLowerCase().includes(q)));

  const status = (r: UserAccountRow) =>
    r.status === "disabled" ? <Pill tone="neutral">Turned off</Pill> : r.locked ? <Pill tone="crit">Locked</Pill> : r.tempPassword ? <Pill tone="warn">Not signed in yet</Pill> : <Pill tone="good">Active</Pill>;

  const cols: Col<UserAccountRow>[] = [
    { header: "Name", cell: (r) => <Name name={r.name} sub={[r.employeeCode, r.email].filter(Boolean).join(" · ") || "Not linked to an employee"} /> },
    { header: "Username", cell: (r) => <code className="font-num text-[13px]">{r.username}</code> },
    { header: "Password", cell: (r) => <Password r={r} /> },
    { header: "Role", cell: (r) => <span className="font-medium">{r.roleName}</span> },
    { header: "Status", cell: (r) => <span className="flex flex-col items-start gap-1">{status(r)}<span className="text-xs whitespace-nowrap text-ink-3">Last sign-in: {when(r.lastSignIn)}</span></span> },
    { header: "Added", cell: (r) => <Name name={fmtDay(r.createdAt.slice(0, 10))} sub={r.createdBy ? `by ${r.createdBy}${r.createdByRole ? ` (${r.createdByRole})` : ""}` : "Built in"} /> },
    {
      header: "",
      align: "right",
      cell: (r) =>
        r.demo || r.id === user?.accountId ? null : (
          <span className="flex justify-end gap-1.5">
            {r.locked && (
              <Button size="sm" variant="ghost" disabled={doUnlock.isPending} onClick={() => doUnlock.mutate(r)}>
                Unlock
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={doReset.isPending} onClick={() => doReset.mutate(r)}>
              Reset password
            </Button>
            <Button size="sm" variant="ghost" disabled={doStatus.isPending} onClick={() => doStatus.mutate(r)}>
              {r.status === "active" ? "Turn off" : "Turn on"}
            </Button>
          </span>
        ),
    },
  ];

  return (
    <>
      <ContentHead title="User accounts" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Accounts", all.length],
          ["Active", all.filter((r) => r.status === "active" && !r.locked && !r.tempPassword).length],
          ["Not signed in yet", all.filter((r) => r.tempPassword).length],
          ["Turned off or locked", all.filter((r) => r.status === "disabled" || r.locked).length],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[var(--radius-card)] border border-[var(--card-border)] bg-surface p-4">
            <div className="text-xs text-ink-2">{k}</div>
            <div className="mt-1 text-2xl font-semibold">{v}</div>
          </div>
        ))}
      </div>
      <Toolbar>
        <SearchBox value={search} onChange={setSearch} placeholder="Search name, username or ID" />
        <Choice label="Role" value={role} onChange={setRole} options={[{ value: "all", label: "All roles" }, ...roles.map((r) => ({ value: r, label: r }))]} />
      </Toolbar>
      <SimpleTable rows={rows} rowKey={(r) => r.id} cols={cols} loading={list.isLoading} empty="No accounts match." />
      {reset && (
        <Dialog
          open
          onClose={() => setReset(null)}
          title="Password reset"
          footer={
            <div className="flex justify-end">
              <Button onClick={() => setReset(null)}>Done</Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-ink-2">Give these to the person. They'll be asked to set their own password when they sign in.</p>
            <dl className="grid grid-cols-[8rem_1fr] gap-2 rounded-[var(--radius-control)] bg-surface-2 p-3">
              <dt className="text-ink-2">Username</dt>
              <dd className="font-num font-medium">{reset.username}</dd>
              <dt className="text-ink-2">Temporary password</dt>
              <dd className="font-num font-medium">{reset.password}</dd>
            </dl>
          </div>
        </Dialog>
      )}
    </>
  );
}
