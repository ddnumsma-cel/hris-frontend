import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
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
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {["Employee", "Tenure", "Contact", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-4 py-2.5 text-left text-[0.7rem] font-bold uppercase tracking-wider text-ink-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rosterQuery.data?.map((m) => (
                <tr key={m.id}>
                  <td className="border-b border-border px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <MiniAvatar initials={m.initials} />
                      <div>
                        <div>{m.name}</div>
                        <div className="text-xs text-ink-2">{m.position}</div>
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-border px-4 py-2.5">{m.tenureLabel}</td>
                  <td className="border-b border-border px-4 py-2.5 text-ink-2">{m.email}</td>
                  <td className="border-b border-border px-4 py-2.5">
                    <Chip variant={statusVariant[m.status]}>{m.status}</Chip>
                  </td>
                  <td className="border-b border-border px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setProfileMember(m)}
                      className="text-xs font-bold text-brand-ink"
                    >
                      Open 201
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
