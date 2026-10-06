import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { PersonnelFileDialog } from "@/components/shared/PersonnelFileDialog";
import { fetchTeamRoster } from "@/lib/api";
import type { TeamRosterMember } from "@/lib/types";

const statusVariant: Record<string, ChipVariant> = {
  Active: "good",
  "On leave": "neutral",
};

export function TeamRoster() {
  const rosterQuery = useQuery({ queryKey: ["manager", "team-roster"], queryFn: fetchTeamRoster });
  const [profileMember, setProfileMember] = useState<TeamRosterMember | null>(null);

  return (
    <>
      <Card>
        <CardHeader
          title="Team roster"
          meta={rosterQuery.data ? `${rosterQuery.data.length} direct reports` : undefined}
        />
        {/* One card per person: fills wide screens instead of a sparse table. */}
        <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {rosterQuery.isLoading &&
            Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 flex-none rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
              </li>
            ))}
          {rosterQuery.data?.map((m) => (
            <li key={m.id} className="flex flex-col rounded-xl border border-border p-4 transition-colors hover:bg-surface-2/60">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink-2">
                  {m.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{m.name}</div>
                  <div className="truncate text-xs text-ink-2">{m.position}</div>
                </div>
                <Chip variant={statusVariant[m.status]}>{m.status}</Chip>
              </div>
              <dl className="mt-3.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="text-ink-2">Tenure</dt>
                <dd className="font-num">{m.tenureLabel}</dd>
                <dt className="text-ink-2">Contact</dt>
                <dd className="truncate" title={m.email}>
                  {m.email}
                </dd>
              </dl>
              <button
                type="button"
                onClick={() => setProfileMember(m)}
                className="mt-4 self-start rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-surface-2"
              >
                Open 201
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <PersonnelFileDialog
        subject={
          profileMember && {
            id: profileMember.id,
            name: profileMember.name,
            initials: profileMember.initials,
            position: profileMember.position,
            status: profileMember.status,
          }
        }
        onClose={() => setProfileMember(null)}
      />
    </>
  );
}
