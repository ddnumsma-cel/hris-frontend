import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastContext";
import { MailIcon, PhoneIcon } from "@/components/icons";
import { documentAlert, getEmployee, getOrgChart, listAudit, listDocuments, listEvents, logGovernmentReveal, peso, setReportsTo, type EditableSection, type EmployeeRecord as Rec } from "@/lib/corehr/api";
import type { EventKind } from "@/lib/corehr/types";
import { useAccess } from "../administration/access";
import { DocumentChecklist } from "./DocumentChecklist";
import { EditSectionDialog } from "./EditSectionDialog";
import { formatDate, inputClass, keys, mask, statusTone, tenure, useActor, type Tone } from "./format";
import { StatusText } from "./SplitView";
import { ErrorNote, Field, Initials, LoadError, Pill } from "./ui";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "job", label: "Job & IDs" },
  { id: "documents", label: "Documents" },
  { id: "history", label: "History" },
  { id: "activity", label: "Activity" },
] as const;
type TabId = (typeof TABS)[number]["id"];
/** Older links (#contact, #employment, #audit…) still open the right tab. */
const OLD: Record<string, TabId> = { personal: "profile", contact: "profile", employment: "job", government: "job", audit: "activity" };
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
  const tab: TabId = isTab(hash) ? hash : (OLD[hash] ?? "profile");
  const select = (id: TabId) => navigate({ search: location.search, hash: id }, { replace: true });
  return [tab, select] as const;
}

/** A titled card with an optional Edit. */
function Card({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-2xl border border-border bg-surface p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EditLink({ onClick, children = "Edit" }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full border border-border px-3 py-1 text-xs font-medium text-ink-2 hover:border-ink-3 hover:text-ink">
      {children}
    </button>
  );
}

function Item({ label, children, wide }: { label: string; children?: ReactNode; wide?: boolean }) {
  const empty = children === undefined || children === null || children === "" || children === false;
  return (
    <div className={clsx("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={clsx("mt-0.5 text-sm break-words", empty && "text-ink-3")}>{empty ? "Not added yet" : children}</dd>
    </div>
  );
}

const grid = "grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2";

/** Change who an employee reports to: their direct manager, shown above them on the Org chart. */
function ReportsToDialog({ record, onClose }: { record: Rec; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const chart = useQuery({ queryKey: ["corehr", "org-chart"], queryFn: getOrgChart });
  const e = record.employee;
  const [value, setValue] = useState(e.job.supervisorId ?? "");
  const save = useMutation({
    mutationFn: () => setReportsTo(e.id, value || null, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      toast.show("Saved. The Org chart is updated too.");
      onClose();
    },
  });
  // Not themselves, and not anyone who already reports to them.
  const people = chart.data?.people ?? [];
  const below = new Set<string>();
  const walk = (id: string) => people.filter((p) => p.supervisorId === id).forEach((p) => (below.add(p.id), walk(p.id)));
  walk(e.id);
  const choices = people.filter((p) => p.id !== e.id && !below.has(p.id));
  const isHead = chart.data?.headId === e.id;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Who does this person report to?"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending || isHead} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">Reports to</span> is the person {record.summary.name.split(" ")[0]} answers to day to day, usually their team lead or department head. That person appears above them on the Org chart.
        </p>
        {isHead ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">{record.summary.name} is the head of the company, so they report to no one. Change the head on the Org chart first.</p>
        ) : (
          <Field id="rt-sup" label="Reports to">
            <select id="rt-sup" className={inputClass} value={value} onChange={(ev) => setValue(ev.target.value)}>
              <option value="">No one yet{chart.data?.headId ? " (shown under the head of the company)" : ""}</option>
              {choices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.positionTitle}
                  {p.id === chart.data?.headId ? " (head of the company)" : ""}
                </option>
              ))}
            </select>
          </Field>
        )}
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}

/** One employee's 201 file: a profile card on the left, the details in tabs on the right. */
export function EmployeeRecord({ employeeId }: { employeeId: string }) {
  const actor = useActor();
  const queryClient = useQueryClient();
  const access = useAccess();
  const canEdit = access.people === "edit" || access.people === "approve";
  const recordQuery = useQuery({ queryKey: keys.employee(employeeId), queryFn: () => getEmployee(employeeId) });
  const documentsQuery = useQuery({ queryKey: [...keys.documents, employeeId], queryFn: () => listDocuments(employeeId) });
  const eventsQuery = useQuery({ queryKey: keys.events(employeeId), queryFn: () => listEvents(employeeId) });
  const auditQuery = useQuery({ queryKey: keys.audit(employeeId), queryFn: () => listAudit(employeeId) });
  const [tab, setTab] = useRecordTab();
  const [editing, setEditing] = useState<EditableSection | null>(null);
  const [reportsTo, setReportsToOpen] = useState(false);
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
      <div className="grid gap-4 lg:grid-cols-[19rem_1fr]">
        <Skeleton className="h-[30rem] w-full" />
        <Skeleton className="h-[30rem] w-full" />
      </div>
    );
  const record = recordQuery.data;
  if (!record) return <p className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-ink-2">No employee with that ID. They may have been removed, or the link is wrong.</p>;

  const { employee: e, summary: s } = record;
  const p = e.personal;
  const c = e.contact;
  const g = e.government;
  const docs = documentsQuery.data ?? [];
  const required = docs.filter((d) => d.status !== "Not applicable");
  const verified = required.filter((d) => d.status === "Verified").length;
  const needsAction = docs.filter((d) => d.status === "Missing" || d.status === "Submitted" || documentAlert(d)).length;
  const separated = e.job.status === "Separated";
  const pct = required.length ? Math.round((verified / required.length) * 100) : 0;
  const edit = (section: EditableSection) => (canEdit ? <EditLink onClick={() => setEditing(section)} /> : undefined);

  return (
    <div className="rise-in grid items-start gap-4 lg:grid-cols-[19rem_1fr]">
      {/* Profile card */}
      <aside className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-4">
        <div className="flex flex-col items-center text-center">
          <Initials initials={s.initials} size="lg" />
          <h1 className="font-display mt-3 text-xl font-semibold tracking-[-0.01em]">{s.name}</h1>
          <p className="text-sm text-ink-2">{s.positionTitle}</p>
          <p className="text-xs text-ink-3">
            {s.departmentName}
            {s.branchName && ` · ${s.branchName}`}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <Pill tone={statusTone[e.job.status]}>{e.job.status}</Pill>
            <span className="font-num rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] font-medium text-ink-2">{e.id}</span>
          </div>
        </div>

        <dl className="flex flex-col gap-2.5 border-t border-border pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-3">Employment</dt>
            <dd className="text-right">{e.job.employmentType}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-3">Hired</dt>
            <dd className="text-right">
              {formatDate(e.job.dateHired)}
              <span className="block text-xs text-ink-3">{separated ? "Separated" : tenure(e.job.dateHired)}</span>
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-3" title="The person they answer to day to day">
              Reports to
            </dt>
            <dd className="flex flex-col items-end text-right">
              {record.supervisor ? (
                <Link to={`/admin/people/${record.supervisor.id}`} className="font-medium hover:underline">
                  {record.supervisor.name}
                </Link>
              ) : (
                <span className="text-ink-3">No one yet</span>
              )}
              {canEdit && !separated && (
                <button type="button" onClick={() => setReportsToOpen(true)} className="text-xs font-medium text-brand hover:underline">
                  {record.supervisor ? "Change" : "Set"}
                </button>
              )}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-1.5 border-t border-border pt-4 text-sm">
          {c.workEmail && (
            <a href={`mailto:${c.workEmail}`} className="flex items-center gap-2 truncate text-ink-2 hover:text-ink">
              <MailIcon className="h-4 w-4 flex-none text-ink-3" />
              <span className="truncate">{c.workEmail}</span>
            </a>
          )}
          {c.mobile && (
            <a href={`tel:${c.mobile.replace(/\s/g, "")}`} className="flex items-center gap-2 text-ink-2 hover:text-ink">
              <PhoneIcon className="h-4 w-4 flex-none text-ink-3" />
              {c.mobile}
            </a>
          )}
        </div>

        <button type="button" onClick={() => setTab("documents")} className="rounded-xl bg-surface-2 p-3 text-left hover:bg-surface-2/70">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">201 file</span>
            <span className="text-ink-2">
              {verified} of {required.length} verified
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
          </div>
          {needsAction > 0 && <div className="mt-1.5 text-xs font-medium text-warning">{needsAction} need attention</div>}
        </button>
      </aside>

      {/* Details */}
      <div className="flex min-w-0 flex-col gap-4">
        <div role="tablist" aria-label="Record sections" className="no-scrollbar flex max-w-full gap-1 self-start overflow-x-auto rounded-full border border-border bg-surface p-1">
          {TABS.map((t) => {
            const count = t.id === "documents" ? needsAction : 0;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={clsx("flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap", tab === t.id ? "bg-ink text-surface" : "text-ink-2 hover:text-ink")}
              >
                {t.label}
                {count > 0 && <span className={clsx("rounded-full px-1.5 text-[0.68rem] font-semibold", tab === t.id ? "bg-surface/20" : "bg-warning-tint text-warning")}>{count}</span>}
              </button>
            );
          })}
        </div>

        <div key={tab} className="rise-in flex flex-col gap-4">
          {tab === "profile" && (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Personal information" action={edit("personal")}>
                <dl className={grid}>
                  <Item label="Full name" wide>
                    {s.name}
                  </Item>
                  <Item label="Birth date">{p.birthDate && `${formatDate(p.birthDate)} (${tenure(p.birthDate).split(" ").slice(0, 2).join(" ")} old)`}</Item>
                  <Item label="Sex">{p.sex}</Item>
                  <Item label="Civil status">{p.civilStatus}</Item>
                  <Item label="Nationality">{p.nationality}</Item>
                </dl>
              </Card>
              <Card title="Contact details" action={edit("contact")}>
                <dl className={grid}>
                  <Item label="Work email" wide>
                    {c.workEmail}
                  </Item>
                  <Item label="Mobile">{c.mobile}</Item>
                  <Item label="Personal email">{c.personalEmail}</Item>
                  <Item label="Home address" wide>
                    {[c.address, c.city, c.province].filter(Boolean).join(", ")}
                  </Item>
                </dl>
              </Card>
              <Card title="Emergency contact" action={edit("contact")} className="xl:col-span-2">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-3">
                  <Item label="Name">{c.emergencyName}</Item>
                  <Item label="Relationship">{c.emergencyRelationship}</Item>
                  <Item label="Phone">{c.emergencyPhone}</Item>
                </dl>
              </Card>
            </div>
          )}

          {tab === "job" && (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Job">
                <dl className={grid}>
                  <Item label="Position">{record.position?.title}</Item>
                  <Item label="Level">{record.position?.level}</Item>
                  <Item label="Department" wide>
                    {record.unitPath}
                  </Item>
                  <Item label="Reports to">{record.supervisor?.name}</Item>
                  <Item label="Employment type">{e.job.employmentType}</Item>
                  <Item label="Work schedule" wide>
                    {e.job.workSchedule}
                  </Item>
                </dl>
              </Card>
              <Card title="Dates and pay">
                <dl className={grid}>
                  <Item label="Date hired">{formatDate(e.job.dateHired)}</Item>
                  <Item label="Regularized">{e.job.regularizationDate && formatDate(e.job.regularizationDate)}</Item>
                  {separated && <Item label="Separated">{formatDate(e.job.separationDate)}</Item>}
                  <Item label="Monthly salary">
                    <span className="font-num">{peso(e.job.monthlySalary)}</span>
                  </Item>
                </dl>
              </Card>
              <Card
                title="Government numbers"
                className="xl:col-span-2"
                action={
                  <span className="flex gap-2">
                    {!revealed && <EditLink onClick={() => reveal.mutate()}>Show numbers</EditLink>}
                    {edit("government")}
                  </span>
                }
              >
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-4">
                  {(
                    [
                      ["SSS", g.sss],
                      ["PhilHealth", g.philhealth],
                      ["Pag-IBIG MID", g.pagibig],
                      ["TIN", g.tin],
                    ] as const
                  ).map(([label, value]) => (
                    <Item key={label} label={label}>
                      {value && <span className="font-num tracking-wide">{revealed ? value : mask(value)}</span>}
                    </Item>
                  ))}
                </dl>
                {!revealed && <p className="mt-3 text-xs text-ink-3">Hidden for privacy. Showing the full numbers is recorded in Activity.</p>}
              </Card>
            </div>
          )}

          {tab === "documents" && (
            <Card title={`201 file documents · ${verified} of ${required.length} verified`}>
              <DocumentChecklist employeeId={employeeId} employeeName={s.name} />
            </Card>
          )}

          {tab === "history" && (
            <Card title="Employment history">
              {(eventsQuery.data ?? []).length === 0 ? (
                <p className="py-4 text-sm text-ink-3">Nothing recorded yet.</p>
              ) : (
                <ol className="pt-1">
                  {eventsQuery.data!.slice(0, 8).map((ev, i, list) => (
                    <li key={ev.id} className="grid grid-cols-[6.5rem_0.75rem_minmax(0,1fr)] gap-x-3">
                      <span className="font-num pt-0.5 text-right text-xs text-ink-2">{formatDate(ev.effectiveDate)}</span>
                      <span className="flex flex-col items-center" aria-hidden="true">
                        <span className={clsx("mt-1.5 h-2.5 w-2.5 flex-none rounded-full", ev.kind === "Separation" ? "bg-critical" : i === 0 ? "bg-ink" : "bg-ink-3/60")} />
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
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}

          {tab === "activity" && (
            <Card title="Activity">
              {(auditQuery.data ?? []).length === 0 ? (
                <p className="py-4 text-sm text-ink-3">No changes yet. Every edit, and every time someone shows hidden numbers, is listed here.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {auditQuery.data!.slice(0, 8).map((a) => (
                    <li key={a.id} className="flex gap-3 py-2.5 text-sm">
                      <span className="font-num w-36 flex-none text-xs text-ink-2">{new Date(a.at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</span>
                      <span className="min-w-0">
                        <span className="font-medium">{a.actor}</span>
                        <span className="text-ink-2">
                          {" "}
                          · {a.action.toLowerCase()} {a.section.toLowerCase()}
                        </span>
                        <span className="block truncate text-xs text-ink-3" title={a.summary}>
                          {a.summary}
                        </span>
                      </span>
                    </li>
                  ))}
                  {auditQuery.data!.length > 8 && (
                    <li className="pt-2.5 text-xs text-ink-3">
                      Showing the latest 8 of {auditQuery.data!.length}.{" "}
                      <Link to="/admin/administration/audit" className="font-medium text-brand hover:underline">
                        See everything in the audit trail
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>

      {editing && <EditSectionDialog employee={e} section={editing} onClose={() => setEditing(null)} />}
      {reportsTo && <ReportsToDialog record={record} onClose={() => setReportsToOpen(false)} />}
    </div>
  );
}
