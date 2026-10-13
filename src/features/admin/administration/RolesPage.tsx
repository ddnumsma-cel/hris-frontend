// Roles & access: the six fixed roles and what each can do, read straight from the access matrix
// (lib/permissions.ts). Pick a role to see its access in plain words, grouped from most to least
// (does everything, adds and changes, approves, only looks, only their own, no access); "Compare
// all roles" shows the whole matrix with icons. Roles are given to people on the Users page.

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { ContentHead } from "@/components/layout/RolePage";
import { CheckCircleIcon, CheckSquareIcon, EditIcon, EyeIcon, LockIcon, PersonIcon, ShieldIcon, UserCheckIcon, UsersIcon } from "@/components/icons";
import { listRoles } from "@/lib/admin/api";
import { FEATURES, grantOf, PERMISSIONS, ROLE_DESCRIPTION, ROLE_LABEL, type Feature, type RoleKey } from "@/lib/permissions";
import { LoadError } from "../corehr/ui";

const ROLES: RoleKey[] = ["system_admin", "super_admin", "hr", "approver", "accounting", "employee"];

type Group = "full" | "manage" | "final" | "approve" | "view" | "own" | "none";

/** Each group of access, from most to least, in words anyone can follow. */
const GROUPS: { key: Group; title: string; explain: string; icon: ReactNode; tone: string }[] = [
  { key: "full", title: "Can do everything", explain: "See, add, change, delete and approve.", icon: <CheckCircleIcon className="h-4 w-4" />, tone: "roles-tone-full" },
  { key: "manage", title: "Can add and change", explain: "See, add and edit, but not delete.", icon: <EditIcon className="h-4 w-4" />, tone: "roles-tone-act" },
  { key: "final", title: "Gives the final approval", explain: "The last yes or no, after the approver.", icon: <UserCheckIcon className="h-4 w-4" />, tone: "roles-tone-act" },
  { key: "approve", title: "Can approve or decline", explain: "Says yes or no to requests.", icon: <CheckSquareIcon className="h-4 w-4" />, tone: "roles-tone-act" },
  { key: "view", title: "Can only look", explain: "Sees it, can't change anything.", icon: <EyeIcon className="h-4 w-4" />, tone: "roles-tone-look" },
  { key: "own", title: "Only their own", explain: "Their own records and requests, nobody else's.", icon: <PersonIcon className="h-4 w-4" />, tone: "roles-tone-look" },
];

/** Which group a cell belongs to (its strongest level), and whether it's only their team. */
function groupOf(role: RoleKey, feature: Feature): { group: Group; team: boolean; alsoFinal: boolean } {
  const { levels, scope } = grantOf(role, feature);
  const team = scope === "team";
  if (levels.includes("full")) return { group: "full", team, alsoFinal: false };
  if (levels.includes("manage")) return { group: "manage", team, alsoFinal: levels.includes("final") };
  if (levels.includes("final")) return { group: "final", team, alsoFinal: false };
  if (levels.includes("approve")) return { group: "approve", team, alsoFinal: false };
  if (levels.includes("own")) return { group: "own", team, alsoFinal: false };
  if (levels.includes("view")) return { group: "view", team, alsoFinal: false };
  return { group: "none", team, alsoFinal: false };
}

/** "Maintenance › People (incl. 201 file)" → area "Maintenance", name "People (incl. 201 file)". */
function splitLabel(label: string) {
  const i = label.indexOf(" › ");
  return i === -1 ? { area: "", name: label } : { area: label.slice(0, i), name: label.slice(i + 3) };
}

function FeatureName({ feature }: { feature: Feature }) {
  const { area, name } = splitLabel(PERMISSIONS[feature].label);
  return (
    <span className="min-w-0">
      {area && <span className="block text-[11px] text-ink-2">{area}</span>}
      <span className="block text-[13px] font-medium text-ink">{name}</span>
    </span>
  );
}

const TeamTag = () => <span className="roles-team-tag inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
  <UsersIcon aria-hidden="true" className="h-3 w-3" />
  Their team only
</span>;

function RoleView({ role, users }: { role: RoleKey; users: number }) {
  const rows = FEATURES.map((f) => ({ f, ...groupOf(role, f) }));
  const none = rows.filter((r) => r.group === "none");
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-start gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <span aria-hidden="true" className="accent-fill flex h-10 w-10 flex-none items-center justify-center rounded-[var(--radius-logo)]">
          <ShieldIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink">{ROLE_LABEL[role]}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{ROLE_DESCRIPTION[role]}</p>
        </div>
        <Link to="/admin/administration/users" className="btn btn-secondary px-3 py-2 text-[13px] font-medium whitespace-nowrap">
          {users} {users === 1 ? "person has" : "people have"} this role
        </Link>
      </section>

      {/* Two flowing columns, so a short group doesn't leave a gap under it. */}
      <div className="gap-4 lg:columns-2">
        {GROUPS.map((g) => {
          const list = rows.filter((r) => r.group === g.key);
          if (!list.length) return null;
          return (
            <section key={g.key} className="mb-4 flex break-inside-avoid flex-col rounded-[var(--radius-card)] border border-border bg-surface">
              <header className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
                <span aria-hidden="true" className={clsx("flex h-8 w-8 flex-none items-center justify-center rounded-full", g.tone)}>
                  {g.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{g.title}</span>
                  <span className="block text-xs text-ink-2">{g.explain}</span>
                </span>
                <span className="text-xs font-semibold text-ink-2">{list.length}</span>
              </header>
              <ul className="flex flex-col divide-y divide-[var(--line)]">
                {list.map((r) => (
                  <li key={r.f} className="flex items-center justify-between gap-3 px-4 py-2">
                    <FeatureName feature={r.f} />
                    <span className="flex flex-none flex-wrap justify-end gap-1">
                      {r.alsoFinal && <span className="roles-team-tag rounded-full px-2 py-0.5 text-[11px] font-medium">Also gives the final approval</span>}
                      {r.team && <TeamTag />}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {none.length > 0 && (
        <details className="group rounded-[var(--radius-card)] border border-border bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
            <span aria-hidden="true" className="roles-tone-none flex h-8 w-8 flex-none items-center justify-center rounded-full">
              <LockIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">No access</span>
              <span className="block text-xs text-ink-2">
                {none.length} {none.length === 1 ? "area" : "areas"} this role can't open. <span className="text-brand group-open:hidden">Show them</span>
                <span className="hidden text-brand group-open:inline">Hide them</span>
              </span>
            </span>
          </summary>
          <ul className="grid gap-x-6 gap-y-2 border-t border-[var(--line)] px-4 py-3 sm:grid-cols-2">
            {none.map((r) => (
              <li key={r.f}>
                <FeatureName feature={r.f} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** The whole matrix, one icon per cell, for comparing roles side by side. */
function CompareView() {
  const cell = (role: RoleKey, f: Feature) => {
    const { group, team } = groupOf(role, f);
    const g = GROUPS.find((x) => x.key === group);
    if (!g) return <span className="text-ink-3" aria-label="No access">—</span>;
    return (
      <span className="inline-flex items-center gap-1.5" title={`${g.title}${team ? ", their team only" : ""}`}>
        <span aria-hidden="true" className={clsx("flex h-6 w-6 items-center justify-center rounded-full", g.tone)}>
          {g.icon}
        </span>
        <span className="sr-only">{g.title}</span>
        {team && <UsersIcon aria-label="Their team only" className="h-3.5 w-3.5 text-ink-2" />}
      </span>
    );
  };
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-2" aria-label="What the icons mean">
        {GROUPS.map((g) => (
          <li key={g.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={clsx("flex h-5 w-5 items-center justify-center rounded-full [&_svg]:h-3 [&_svg]:w-3", g.tone)}>
              {g.icon}
            </span>
            {g.title}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <UsersIcon aria-hidden="true" className="h-3.5 w-3.5" />
          Their team only
        </li>
        <li className="flex items-center gap-1.5">— No access</li>
      </ul>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left">
                  Area
                </th>
                {ROLES.map((r) => (
                  <th key={r} scope="col" className="px-3 py-2.5 text-center">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f}>
                  <th scope="row" className="px-4 py-2 text-left tracking-normal normal-case">
                    <FeatureName feature={f} />
                  </th>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-2 text-center">
                      {cell(r, f)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function RolesPage() {
  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: listRoles });
  const [picked, setPicked] = useState<RoleKey>("hr");
  const [compare, setCompare] = useState(false);
  if (roles.isError) return <LoadError onRetry={() => roles.refetch()} />;
  const users = (key: RoleKey) => roles.data?.find((r) => r.key === key)?.users ?? 0;

  return (
    <>
      <ContentHead
        title="Roles & access"
        actions={
          <div role="group" aria-label="View" className="flex rounded-full border border-border bg-surface p-1">
            {[
              [false, "One role"],
              [true, "Compare all roles"],
            ].map(([value, label]) => (
              <button key={String(value)} type="button" aria-pressed={compare === value} onClick={() => setCompare(value as boolean)} className="roles-switch rounded-full px-3 py-1 text-xs font-medium text-ink-2 transition-colors duration-150 hover:text-ink">
                {label}
              </button>
            ))}
          </div>
        }
      />
      {compare ? (
        <CompareView />
      ) : (
        <>
          <div role="tablist" aria-label="Role" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {ROLES.map((r) => (
              <button key={r} type="button" role="tab" aria-selected={picked === r} onClick={() => setPicked(r)} className="roles-pick flex flex-col items-start gap-1 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3 text-left transition-colors duration-150">
                <span className="text-sm font-semibold text-ink">{ROLE_LABEL[r]}</span>
                <span className="text-xs text-ink-2">
                  {users(r)} {users(r) === 1 ? "person" : "people"}
                </span>
              </button>
            ))}
          </div>
          <RoleView role={picked} users={users(picked)} />
        </>
      )}
    </>
  );
}
