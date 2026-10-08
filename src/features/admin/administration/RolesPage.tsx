// Roles & access: the six fixed roles and what each can do, read straight from the access matrix
// (lib/permissions.ts). Roles are given to people on the Users page.

import { useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { listRoles } from "@/lib/admin/api";
import { FEATURES, grantOf, PERMISSIONS, ROLE_DESCRIPTION, ROLE_LABEL, type Level, type RoleKey } from "@/lib/permissions";
import { LoadError } from "../corehr/ui";

const ROLES: RoleKey[] = ["system_admin", "super_admin", "hr", "approver", "accounting", "employee"];
const LEVEL: Record<Level, string> = { full: "Full", manage: "Manage", approve: "Approve", final: "Final Approve", view: "View", own: "Own", none: "None" };

/** "Approve (team)", "Manage + Final Approve", "—". */
function cellText(role: RoleKey, feature: (typeof FEATURES)[number]) {
  const { levels, scope } = grantOf(role, feature);
  if (!levels.length) return "—";
  return `${levels.map((l) => LEVEL[l]).join(" + ")}${scope === "team" ? " (team)" : ""}`;
}

export function RolesPage() {
  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });
  if (roles.isError) return <LoadError onRetry={() => roles.refetch()} />;
  const users = (key: RoleKey) => roles.data?.find((r) => r.key === key)?.users ?? 0;

  return (
    <>
      <ContentHead title="Roles & access" subtitle="The six roles and what each can do. Roles are fixed; give them to people on the Users page." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">{ROLE_LABEL[r]}</h2>
              <span className="text-xs text-ink-2">
                {users(r)} {users(r) === 1 ? "user" : "users"}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-2">{ROLE_DESCRIPTION[r]}</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left">
                  Module / feature
                </th>
                {ROLES.map((r) => (
                  <th key={r} scope="col" className="px-3 py-2.5 text-left">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f}>
                  <th scope="row" className="px-4 py-2.5 text-left text-[13px] font-medium tracking-normal normal-case">
                    {PERMISSIONS[f].label}
                  </th>
                  {ROLES.map((r) => (
                    <td key={r} className={cellText(r, f) === "—" ? "px-3 py-2.5 text-ink-3" : "px-3 py-2.5"}>
                      {cellText(r, f)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-ink-2">Full: view, create, edit, delete · Manage: view, create, edit · Approve: view and approve or decline · Final Approve: the last approval, after the approver · View: read only · Own: their own records only · (team): only the people who report to them.</p>
    </>
  );
}
