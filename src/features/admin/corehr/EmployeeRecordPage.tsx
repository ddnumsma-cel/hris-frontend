import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { HistoryIcon } from "@/components/icons";
import { documentAlert, getEmployee, listAudit, listDocuments, listEvents, logGovernmentReveal, peso, type EditableSection } from "@/lib/corehr/api";
import type { EventKind } from "@/lib/corehr/types";
import { DocumentChecklist } from "./DocumentChecklist";
import { EditSectionDialog } from "./EditSectionDialog";
import { RecordChangeDialog } from "./RecordChangeDialog";
import { formatDate, keys, mask, statusTone, tenure, useActor, type Tone } from "./format";
import { DetailHeader, DetailPlaceholder, DetailSection, StatusText, TextAction } from "./SplitView";
import { Detail, detailGrid, Initials, LoadError } from "./ui";

const TABS = [
  { id: "profile", label: "Personal & contact" },
  { id: "employment", label: "Gov't IDs & job" },
  { id: "documents", label: "Documents" },
  { id: "history", label: "History" },
  { id: "audit", label: "Audit trail" },
] as const;
type TabId = (typeof TABS)[number]["id"];
/** Older section links (#contact, #job) still open the tab holding that section. */
const SECTION_TAB: Record<string, TabId> = { personal: "profile", contact: "profile", government: "employment", job: "employment" };
const isTab = (s: string): s is TabId => TABS.some((x) => x.id === s);

const EVENT_TONE: Record<EventKind, Tone> = {
  Hired: "info",
  Promotion: "good",
  Transfer: "info",
  "Salary adjustment": "neutral",
  Regularization: "good",
  "Supervisor change": "neutral",
  "Status change": "warn",
  Separation: "crit",
};

/** The open tab lives in the URL hash, so links like #documents open it. */
function useRecordTab() {
  const location = useLocation();
  const navigate = useNavigate();
  const hash = location.hash.slice(1);
  const tab: TabId = isTab(hash) ? hash : (SECTION_TAB[hash] ?? "profile");
  const select = (id: TabId) => navigate({ search: location.search, hash: id }, { replace: true });
  return [tab, select] as const;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

/** One employee's 201 file, shown in the right-hand pane of People. */
export function EmployeeRecord({ employeeId }: { employeeId: string }) {
  const actor = useActor();
  const queryClient = useQueryClient();
  const recordQuery = useQuery({ queryKey: keys.employee(employeeId), queryFn: () => getEmployee(employeeId) });
  const documentsQuery = useQuery({ queryKey: [...keys.documents, employeeId], queryFn: () => listDocuments(employeeId) });
  const eventsQuery = useQuery({ queryKey: keys.events(employeeId), queryFn: () => listEvents(employeeId) });
  const auditQuery = useQuery({ queryKey: keys.audit(employeeId), queryFn: () => listAudit(employeeId) });
  const [tab, setTab] = useRecordTab();
  const [editing, setEditing] = useState<EditableSection | null>(null);
  const [recording, setRecording] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const reveal = useMutation({
    mutationFn: () => logGovernmentReveal(employeeId, actor),
    onSuccess: () => {
      setRevealed(true);
      queryClient.invalidateQueries({ queryKey: keys.audit(employeeId) });
    },
  });

  if (recordQuery.isError) return <LoadError onRetry={() => recordQuery.refetch()} />;
  if (recordQuery.isLoading)
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  const record = recordQuery.data;
  if (!record) return <DetailPlaceholder title="No employee with that ID">They may have been removed, or the link is wrong.</DetailPlaceholder>;

  const { employee: e, summary: s } = record;
  const p = e.personal;
  const c = e.contact;
  const g = e.government;
  const docs = documentsQuery.data ?? [];
  const required = docs.filter((d) => d.status !== "Not applicable");
  const verified = required.filter((d) => d.status === "Verified").length;
  const needsAction = docs.filter((d) => d.status === "Missing" || d.status === "Submitted" || documentAlert(d)).length;
  const separated = e.job.status === "Separated";

  return (
    <div className="rise-in flex min-h-full flex-col">
      <DetailHeader
        leading={<Initials initials={s.initials} size="md" />}
        title={s.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              {s.positionTitle} · {record.unitPath}
            </span>
            <span className="font-num text-ink-3">{e.id}</span>
          </span>
        }
        actions={
          !separated && (
            <Button size="sm" icon={<HistoryIcon className="h-3.5 w-3.5" />} onClick={() => setRecording(true)}>
              Record job change
            </Button>
          )
        }
      />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-border px-5 py-3 sm:grid-cols-5 sm:px-6">
        <Fact label="Status">
          <StatusText tone={statusTone[e.job.status]}>{e.job.status}</StatusText>
        </Fact>
        <Fact label="Employment">{e.job.employmentType}</Fact>
        <Fact label="Hired">
          {formatDate(e.job.dateHired)}
          <span className="block text-xs text-ink-3">{separated ? "Separated" : tenure(e.job.dateHired)}</span>
        </Fact>
        <Fact label="Reports to">
          {record.supervisor ? (
            <Link to={`/admin/people/${record.supervisor.id}`} className="hover:underline">
              {record.supervisor.name}
            </Link>
          ) : (
            "—"
          )}
        </Fact>
        <Fact label="201 file">
          <span className="font-num">
            {verified}/{required.length}
          </span>{" "}
          <span className="text-ink-3">verified</span>
        </Fact>
      </dl>

      <div
        role="tablist"
        aria-label="201 file sections"
        className="no-scrollbar flex flex-none gap-5 overflow-x-auto border-b border-border px-5 sm:px-6"
        onKeyDown={(ev) => {
          if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
          const i = TABS.findIndex((t) => t.id === tab);
          const next = TABS[(i + (ev.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length]!.id;
          setTab(next);
          document.getElementById(`tab-${next}`)?.focus();
        }}
      >
        {TABS.map((t) => {
          const count = t.id === "documents" ? needsAction : t.id === "history" ? (eventsQuery.data ?? []).length : 0;
          return (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls="record-panel"
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={clsx(
                "-mb-px flex flex-none items-center gap-1.5 border-b-2 py-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                tab === t.id ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink",
              )}
            >
              {t.label}
              {count > 0 && <span className={clsx("font-num text-[0.68rem]", t.id === "documents" ? "text-warning" : "text-ink-3")}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div id="record-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} key={tab} className="rise-in">
        {tab === "profile" && (
          <>
            <DetailSection title="Personal information" action={<TextAction onClick={() => setEditing("personal")}>Edit</TextAction>}>
              <dl className={detailGrid}>
                <Detail label="Full name">{s.name}</Detail>
                <Detail label="Birth date">{p.birthDate && `${formatDate(p.birthDate)} · ${tenure(p.birthDate).split(" ").slice(0, 2).join(" ")}`}</Detail>
                <Detail label="Sex">{p.sex}</Detail>
                <Detail label="Civil status">{p.civilStatus}</Detail>
                <Detail label="Nationality">{p.nationality}</Detail>
              </dl>
            </DetailSection>
            <DetailSection title="Contact details" action={<TextAction onClick={() => setEditing("contact")}>Edit</TextAction>}>
              <dl className={detailGrid}>
                <Detail label="Work email">{c.workEmail}</Detail>
                <Detail label="Personal email">{c.personalEmail}</Detail>
                <Detail label="Mobile">{c.mobile}</Detail>
                <Detail label="Home address">{[c.address, c.city, c.province].filter(Boolean).join(", ")}</Detail>
                <Detail label="Emergency contact">{c.emergencyName && [c.emergencyName, c.emergencyRelationship].filter(Boolean).join(" · ")}</Detail>
                <Detail label="Emergency phone">{c.emergencyPhone}</Detail>
              </dl>
            </DetailSection>
          </>
        )}

        {tab === "employment" && (
          <>
            <DetailSection
              title="Government numbers"
              action={
                <span className="flex gap-4">
                  {!revealed && <TextAction onClick={() => reveal.mutate()}>Show numbers</TextAction>}
                  <TextAction onClick={() => setEditing("government")}>Edit</TextAction>
                </span>
              }
            >
              <dl className={detailGrid}>
                {(
                  [
                    ["SSS", g.sss],
                    ["PhilHealth", g.philhealth],
                    ["Pag-IBIG MID", g.pagibig],
                    ["TIN", g.tin],
                  ] as const
                ).map(([label, value]) => (
                  <Detail key={label} label={label}>
                    {value && <span className="font-num tracking-wide">{revealed ? value : mask(value)}</span>}
                  </Detail>
                ))}
              </dl>
              {!revealed && <p className="mt-1 text-[0.7rem] text-ink-3">Masked. Showing the full numbers is recorded in the audit trail.</p>}
            </DetailSection>
            <DetailSection title="Job" action={!separated && <TextAction onClick={() => setRecording(true)}>Record change</TextAction>}>
              <dl className={detailGrid}>
                <Detail label="Position">{record.position?.title}</Detail>
                <Detail label="Level">{record.position?.level}</Detail>
                <Detail label="Unit" wide>
                  {record.unitPath}
                </Detail>
                <Detail label="Supervisor">{record.supervisor?.name}</Detail>
                <Detail label="Employment type">{e.job.employmentType}</Detail>
                <Detail label="Monthly salary">
                  <span className="font-num">{peso(e.job.monthlySalary)}</span>
                </Detail>
                <Detail label="Work schedule">{e.job.workSchedule}</Detail>
                <Detail label="Date hired">{formatDate(e.job.dateHired)}</Detail>
                <Detail label="Regularized">{e.job.regularizationDate && formatDate(e.job.regularizationDate)}</Detail>
                {separated && <Detail label="Separated">{formatDate(e.job.separationDate)}</Detail>}
              </dl>
              <p className="mt-1 text-[0.7rem] text-ink-3">Position, unit, pay and status change through a recorded job change, so the history stays complete.</p>
            </DetailSection>
          </>
        )}

        {tab === "documents" && (
          <DetailSection title={`Documents · ${verified} of ${required.length} checked`}>
            <DocumentChecklist employeeId={employeeId} employeeName={s.name} />
          </DetailSection>
        )}

        {tab === "history" && (
          <DetailSection title="Employment history" action={!separated && <TextAction onClick={() => setRecording(true)}>Record change</TextAction>}>
            {(eventsQuery.data ?? []).length === 0 ? (
              <p className="py-4 text-sm text-ink-3">Nothing recorded yet.</p>
            ) : (
              <ol className="pt-1">
                {eventsQuery.data!.map((ev, i, list) => (
                  <li key={ev.id} style={{ "--i": i } as React.CSSProperties} className="rise-in grid grid-cols-[6rem_0.75rem_minmax(0,1fr)] gap-x-3">
                    <span className="font-num pt-0.5 text-right text-xs text-ink-2">{formatDate(ev.effectiveDate)}</span>
                    <span className="flex flex-col items-center" aria-hidden="true">
                      <span className={clsx("mt-1.5 h-2 w-2 flex-none rounded-full", ev.kind === "Separation" ? "bg-critical" : i === 0 ? "bg-ink" : "bg-ink-3/60")} />
                      {i < list.length - 1 && <span className="w-px flex-1 bg-border" />}
                    </span>
                    <div className="pb-4">
                      <StatusText tone={EVENT_TONE[ev.kind]}>
                        <span className="font-semibold text-ink">{ev.kind}</span>
                      </StatusText>
                      <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                        {ev.changes.map((ch) => (
                          <li key={ch.label}>
                            <span className="text-ink-3">{ch.label}: </span>
                            {ch.from && (
                              <>
                                <span className="text-ink-2">{ch.from}</span>
                                <span className="px-1 text-ink-3">→</span>
                              </>
                            )}
                            <span className="font-medium">{ch.to}</span>
                          </li>
                        ))}
                      </ul>
                      {ev.remarks && <p className="mt-1 text-xs text-ink-2">{ev.remarks}</p>}
                      <p className="mt-0.5 text-[0.7rem] text-ink-3">
                        Recorded by {ev.recordedBy} · {formatDate(ev.recordedAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </DetailSection>
        )}

        {tab === "audit" && (
          <DetailSection title="Audit trail">
            {(auditQuery.data ?? []).length === 0 ? (
              <p className="py-4 text-sm text-ink-3">No edits since Core HR was set up. Every change, and every time someone reveals sensitive data, is listed here.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[0.7rem] text-ink-3">
                    <th className="pb-1.5 font-medium">When</th>
                    <th className="pb-1.5 font-medium">Who</th>
                    <th className="pb-1.5 font-medium">What</th>
                  </tr>
                </thead>
                <tbody>
                  {auditQuery.data!.map((a) => (
                    <tr key={a.id} className="border-t border-border align-top">
                      <td className="font-num py-2 pr-3 text-xs whitespace-nowrap text-ink-2">{new Date(a.at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{a.actor}</td>
                      <td className="py-2">
                        <span className="text-ink-2">
                          {a.action} · {a.section}
                        </span>
                        <span className="block text-xs text-ink-3">{a.summary}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </DetailSection>
        )}
      </div>

      {editing && <EditSectionDialog employee={e} section={editing} onClose={() => setEditing(null)} />}
      {recording && <RecordChangeDialog record={record} onClose={() => setRecording(false)} />}
    </div>
  );
}
