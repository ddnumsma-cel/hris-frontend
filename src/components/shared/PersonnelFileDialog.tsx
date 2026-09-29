import { useEffect, useState } from "react";
import clsx from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Dialog } from "@/components/ui/Dialog";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { UsersIcon } from "@/components/icons";
import { fetchPersonnelDocuments,
  fetchPersonnelProfile,
  logPersonnelView } from "@/lib/api";
import { formatToday } from "@/lib/format";
import { PersonnelProfilePanel } from "./PersonnelProfilePanel";
import {
  getDocumentCompletion,
  PersonnelAuditLog,
  PersonnelDocumentsPanel,
  useAuditActor,
} from "./PersonnelFilePanels";

export interface PersonnelFileSubject {
  id: string;
  name: string;
  initials: string;
  position: string;
  department?: string;
  office?: string;
  cluster?: string;
  status?: string;
  email?: string;
  phone?: string;
  emergencyContact?: string;
}

type Tab = "Profile" | "201 Files" | "Activity log";

const statusVariant: Record<string, ChipVariant> = {
  Active: "good",
  "On leave": "neutral",
};

export function PersonnelFileDialog({
  subject,
  onClose,
  documentsHref,
}: {
  subject: PersonnelFileSubject | null;
  onClose: () => void;
  /**
   * HR's link to the employee's full record on the Employee Directory page.
   * HR's dialog also drops the Activity log tab; the full record has it.
   */
  documentsHref?: (employeeId: string) => string;
}) {
  const queryClient = useQueryClient();
  const actor = useAuditActor();
  const [tab, setTab] = useState<Tab>("Profile");
  const employeeId = subject?.id;
  const tabs: Tab[] = documentsHref ? ["Profile", "201 Files"] : ["Profile", "201 Files", "Activity log"];

  const profileQuery = useQuery({
    queryKey: ["personnel", "profile", employeeId],
    queryFn: () => fetchPersonnelProfile(employeeId!),
    enabled: !!employeeId,
  });
  const documentsQuery = useQuery({
    queryKey: ["personnel", "documents", employeeId],
    queryFn: () => fetchPersonnelDocuments(employeeId!),
    enabled: !!employeeId,
  });

  useEffect(() => {
    setTab("Profile");
    if (employeeId && actor) {
      logPersonnelView(employeeId, actor, "Employee profile");
      queryClient.invalidateQueries({ queryKey: ["personnel", "audit-log", employeeId] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const profile = profileQuery.data;
  const completion = getDocumentCompletion(documentsQuery.data ?? []);

  return (
    <>
      <Dialog open={subject !== null} onClose={onClose} title="Employee Profile"
        size="lg"
        header={subject && (
          <>
            <div className="flex items-center gap-3.5">
              {profile?.photoDataUrl ? (
                <img src={profile.photoDataUrl} alt="" className="h-12 w-12 flex-none rounded-full object-cover" />
              ) : (
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-ink-2">
                  {subject.initials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-base font-bold">{subject.name}</div>
                <div className="truncate text-xs text-ink-2">{subject.position}<span className="text-ink-3"> · </span>
              <span className="font-num">{subject.id}</span>
                  </div>
              </div>
              {subject.status && <Chip variant={statusVariant[subject.status] ?? "neutral"}>{subject.status}</Chip>}
              </div>

              <div className="mt-3.5 flex items-center justify-between gap-2">
                <div role="tablist" aria-label="Profile sections" className="flex gap-1">
                  {tabs.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      aria-selected={tab === t}
                      onClick={() => setTab(t)}
                      className={clsx(
                        "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-bold transition-colors",
                        tab === t ? "border-brand text-brand-ink" : "border-transparent text-ink-2 hover:text-ink",
                      )}
                    >
                      {t}
                      {t === "201 Files" && completion.applicable > 0 && (
                        <span className="font-num rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.65rem] text-ink-2">
                          {completion.verified}/{completion.applicable}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {documentsHref && (
                  <Link
                    to={documentsHref(subject.id)}
                    onClick={onClose}
                    className="mb-1.5 flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold text-ink-2 transition-colors hover:border-brand hover:text-ink"
                  >
                    <UsersIcon className="h-3.5 w-3.5" />
                    View employee
                  </Link>
                )}
              </div>
            </>
          )
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-[0.7rem] text-ink-3">Viewed {formatToday()} · access is logged</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
                </div>
        }
      >
        {subject && tab === "Profile" && <PersonnelProfilePanel subject={subject} />}
        {subject && tab === "201 Files" && <PersonnelDocumentsPanel employeeId={subject.id} />}
                {subject && tab === "Activity log" && <PersonnelAuditLog employeeId={subject.id} />}
      </Dialog>

      </>
  );
}
