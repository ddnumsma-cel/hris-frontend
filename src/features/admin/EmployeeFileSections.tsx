import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuditActor } from "@/components/shared/PersonnelFilePanels";
import { CheckCircleIcon, LockIcon } from "@/components/icons";
import { fetchEmployeeFileRecords, logPersonnelView } from "@/lib/api";
import type { EmployeeFileRecords, MovementAction, RecordStatus } from "@/lib/employmentRecords";
import type { CaseStatus, TrainingStatus } from "@/lib/types";

const recordStatusVariant: Record<RecordStatus, ChipVariant> = {
  Verified: "good",
  "On file": "neutral",
  Pending: "warn",
  Missing: "crit",
};

const trainingVariant: Record<TrainingStatus, ChipVariant> = {
  Completed: "good",
  "In progress": "warn",
  "Not started": "neutral",
};

const caseVariant: Record<CaseStatus, ChipVariant> = {
  Open: "crit",
  "Under review": "warn",
  Resolved: "good",
};

const movementDot: Record<MovementAction, string> = {
  Hired: "bg-brand",
  Regularized: "bg-good",
  Promoted: "bg-[var(--color-cat-1)]",
  Transferred: "bg-warning",
  "Salary adjustment": "bg-ink-3",
};

export function useEmployeeFileRecords(employeeId: string) {
  return useQuery({
    queryKey: ["personnel", "file-records", employeeId],
    queryFn: () => fetchEmployeeFileRecords(employeeId),
    enabled: !!employeeId,
  });
}

// ---- Shared building blocks ----

function Section({
  title,
  meta,
  action,
  children,
  flush = false,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border">
      <div className="flex min-h-9 items-center justify-between gap-2 border-b border-border bg-surface-2/50 px-3.5 py-1.5">
        <h3 className="text-xs font-medium tracking-[0.01em] text-ink-3">{title}</h3>
        {action ?? (meta && <span className="text-xs text-ink-3">{meta}</span>)}
      </div>
      <div className={flush ? undefined : "p-3.5"}>{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || <span className="text-ink-3">—</span>}</dd>
    </div>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border">{children}</ul>;
}

function Row({ title, meta, trailing }: { title: ReactNode; meta?: ReactNode; trailing?: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        {meta && <div className="truncate text-xs text-ink-2">{meta}</div>}
      </div>
      {trailing && <div className="flex-none">{trailing}</div>}
    </li>
  );
}

function NoneOnFile({ children }: { children: ReactNode }) {
  return <p className="px-3.5 py-3 text-xs text-ink-3">{children}</p>;
}

function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function WithRecords({
  employeeId,
  children,
}: {
  employeeId: string;
  children: (records: EmployeeFileRecords) => ReactNode;
}) {
  const query = useEmployeeFileRecords(employeeId);
  if (query.isLoading) return <Loading />;
  if (!query.data) return <EmptyState icon={<LockIcon />} title="No 201 File records found" />;
  return <div className="flex flex-col gap-4">{children(query.data)}</div>;
}

// ---- Gov't Nos. ----

function maskNumber(value: string) {
  const visible = value.slice(-4);
  return value.slice(0, -4).replace(/\d/g, "•") + visible;
}

export function GovernmentNumbersPanel({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const actor = useAuditActor();
  const [revealed, setRevealed] = useState(false);

  function toggle() {
    if (!revealed && actor) {
      logPersonnelView(employeeId, actor, "Government numbers");
      queryClient.invalidateQueries({ queryKey: ["personnel", "audit-log", employeeId] });
    }
    setRevealed(!revealed);
  }

  return (
    <WithRecords employeeId={employeeId}>
      {({ government }) => {
        const verified = government.filter((g) => g.status === "Verified").length;
        return (
          <Section
            title="Government registration numbers"
            flush
            action={
              <button
                type="button"
                onClick={toggle}
                className="flex items-center gap-1 text-xs font-semibold text-brand-ink hover:underline"
              >
                <LockIcon className="h-3.5 w-3.5" />
                {revealed ? "Hide numbers" : "Show numbers"}
              </button>
            }
          >
            <ul className="divide-y divide-border">
              {government.map((g) => (
                <li key={g.agency} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3.5 py-3 sm:grid-cols-[14rem_1fr_7rem]">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{g.agency}</div>
                    <div className="truncate text-xs text-ink-2">{g.description}</div>
                  </div>
                  <div className="order-3 col-span-2 min-w-0 sm:order-none sm:col-span-1">
                    {g.number ? (
                      <>
                        <div className="font-num text-sm tracking-wide">{revealed ? g.number : maskNumber(g.number)}</div>
                        <div className="truncate text-xs text-ink-3">
                          {g.detail}
                          {g.registeredOn && ` · Registered ${g.registeredOn}`}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-ink-3">Not yet submitted</div>
                    )}
                  </div>
                  <div className="justify-self-end">
                    <Chip variant={recordStatusVariant[g.status]}>{g.status}</Chip>
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-border px-3.5 py-2.5 text-[0.7rem] text-ink-3">
              {verified} of {government.length} verified against agency records · revealing full numbers is logged
            </p>
          </Section>
        );
      }}
    </WithRecords>
  );
}

// ---- Employment ----

export function EmploymentPanel({ employeeId }: { employeeId: string }) {
  return (
    <WithRecords employeeId={employeeId}>
      {({ employment }) => (
        <>
          <Section title="Hiring & employment terms">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-3">
              <Field label="Date hired" value={employment.dateHired} />
              <Field
                label="Employment status"
                value={
                  <Chip variant={employment.employmentType === "Regular" ? "good" : "warn"}>
                    {employment.employmentType}
                  </Chip>
                }
              />
              <Field
                label={employment.regularizedOn ? "Regularized on" : "Probation ends"}
                value={employment.regularizedOn ?? employment.probationEnds}
              />
              <Field label="Work schedule" value={employment.schedule} />
              <Field label="Payroll" value={employment.payrollType} />
              <Field label="Immediate supervisor" value={employment.supervisor} />
            </dl>
          </Section>

          <Section title="Contracts & agreements" flush>
            <Rows>
              {employment.documents.map((d) => (
                <Row
                  key={d.name}
                  title={d.name}
                  meta={d.signedOn ? `Signed ${d.signedOn}` : "Awaiting signature"}
                  trailing={<Chip variant={recordStatusVariant[d.status]}>{d.status}</Chip>}
                />
              ))}
            </Rows>
          </Section>

          <Section title="Movement history" meta="Personnel action notices" flush>
            <ol className="px-3.5 py-3">
              {employment.movements.map((m, i) => (
                <li key={m.reference} className="relative flex gap-3 pb-3.5 last:pb-0">
                  {i < employment.movements.length - 1 && (
                    <span className="absolute top-3 left-[0.3rem] h-full w-px bg-border" aria-hidden="true" />
                  )}
                  <span className={clsx("relative mt-1.5 h-2.5 w-2.5 flex-none rounded-full", movementDot[m.action])} />
                  <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{m.action}</div>
                      <div className="text-xs text-ink-2">{m.detail}</div>
                    </div>
                    <div className="text-right text-xs text-ink-3">
                      {m.date}
                      <div className="font-num">{m.reference}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Previous employment" flush>
            {employment.previousEmployment.length ? (
              <Rows>
                {employment.previousEmployment.map((p) => (
                  <Row key={p.company} title={p.company} meta={`${p.position} · ${p.period}`} />
                ))}
              </Rows>
            ) : (
              <NoneOnFile>No previous employment declared.</NoneOnFile>
            )}
          </Section>
        </>
      )}
    </WithRecords>
  );
}

// ---- In Service ----

export function InServicePanel({ employeeId }: { employeeId: string }) {
  return (
    <WithRecords employeeId={employeeId}>
      {({ during }) => (
        <>
          <Section title="Performance appraisals" flush>
            {during.appraisals.length ? (
              <Rows>
                {during.appraisals.map((a) => (
                  <Row
                    key={a.period}
                    title={a.period}
                    meta={a.ratingLabel ? `${a.ratingLabel} · ${a.reviewer}` : a.reviewer}
                    trailing={
                      a.status === "Completed" && a.rating !== undefined ? (
                        <span className="font-num text-sm font-semibold">
                          {a.rating.toFixed(1)}
                          <span className="text-xs font-semibold text-ink-3"> / 5</span>
                        </span>
                      ) : (
                        <Chip variant="warn">Pending</Chip>
                      )
                    }
                  />
                ))}
              </Rows>
            ) : (
              <NoneOnFile>No appraisals yet — the first review is due after one year of service.</NoneOnFile>
            )}
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Trainings & seminars" flush>
              {during.trainings.length ? (
                <Rows>
                  {during.trainings.map((t) => (
                    <Row
                      key={t.id}
                      title={t.course}
                      meta={`Due ${t.dueDate}`}
                      trailing={<Chip variant={trainingVariant[t.status]}>{t.status}</Chip>}
                    />
                  ))}
                </Rows>
              ) : (
                <NoneOnFile>No trainings assigned.</NoneOnFile>
              )}
            </Section>

            <Section title="Professional licenses & CPD" flush>
              {during.licenses.length ? (
                <Rows>
                  {during.licenses.map((l) => (
                    <Row
                      key={l.id}
                      title={l.licenseType}
                      meta={`No. ${l.licenseNumber} · cycle ends ${l.cycleEndDate}`}
                      trailing={
                        <span className="font-num text-xs font-semibold text-ink-2">
                          {l.cpdUnitsEarned}/{l.cpdUnitsRequired} CPD
                        </span>
                      }
                    />
                  ))}
                </Rows>
              ) : (
                <NoneOnFile>No professional license on file.</NoneOnFile>
              )}
            </Section>

            <Section title="Company assets issued" flush>
              {during.assets.length ? (
                <Rows>
                  {during.assets.map((a) => (
                    <Row
                      key={a.id}
                      title={`${a.type} · ${a.assetTag}`}
                      meta={`Issued ${a.issuedOn}`}
                      trailing={<Chip variant={a.status === "Issued" ? "good" : "neutral"}>{a.status}</Chip>}
                    />
                  ))}
                </Rows>
              ) : (
                <NoneOnFile>No company assets issued.</NoneOnFile>
              )}
            </Section>

            <Section title="Commendations" flush>
              {during.commendations.length ? (
                <Rows>
                  {during.commendations.map((c) => (
                    <Row
                      key={c.title}
                      title={
                        <span className="flex items-center gap-1.5">
                          <CheckCircleIcon className="h-3.5 w-3.5 text-good" />
                          {c.title}
                        </span>
                      }
                      meta={`${c.date} · ${c.detail}`}
                    />
                  ))}
                </Rows>
              ) : (
                <NoneOnFile>No commendations on record.</NoneOnFile>
              )}
            </Section>
          </div>

          <Section title="Corrective actions & employee relations" flush>
            {during.cases.length ? (
              <Rows>
                {during.cases.map((c) => (
                  <Row
                    key={c.id}
                    title={`${c.type} · filed ${c.filedOn}`}
                    meta={c.summary}
                    trailing={<Chip variant={caseVariant[c.status]}>{c.status}</Chip>}
                  />
                ))}
              </Rows>
            ) : (
              <NoneOnFile>Clean record — no notices to explain or disciplinary actions.</NoneOnFile>
            )}
          </Section>
        </>
      )}
    </WithRecords>
  );
}

// ---- Separation ----

export function SeparationPanel({ employeeId }: { employeeId: string }) {
  return (
    <WithRecords employeeId={employeeId}>
      {({ separation }) =>
        separation ? (
          <>
            <Section title="Separation details" action={<Chip variant="warn">{separation.case.stage}</Chip>}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-3">
                <Field label="Type" value={separation.type} />
                <Field label="Notice filed" value={separation.noticeFiledOn} />
                <Field label="Last working day" value={separation.case.lastDay} />
                <Field label="Reason" value={separation.reason} />
                <Field label="Department" value={separation.case.department} />
              </dl>
            </Section>

            <div className="grid gap-4 lg:grid-cols-2">
              <Section
                title="Clearance"
                meta={`${separation.clearance.filter((c) => c.status === "Cleared").length} of ${separation.clearance.length} cleared`}
                flush
              >
                <Rows>
                  {separation.clearance.map((c) => (
                    <Row
                      key={c.department}
                      title={c.department}
                      trailing={<Chip variant={c.status === "Cleared" ? "good" : "warn"}>{c.status}</Chip>}
                    />
                  ))}
                </Rows>
              </Section>

              <Section title="Exit requirements & post-employment" flush>
                <Rows>
                  {separation.requirements.map((r) => (
                    <Row
                      key={r.name}
                      title={r.name}
                      trailing={<Chip variant={recordStatusVariant[r.status]}>{r.status}</Chip>}
                    />
                  ))}
                </Rows>
              </Section>
            </div>
          </>
        ) : (
          <Section title="Separation">
            <EmptyState
              icon={<CheckCircleIcon />}
              title="Currently employed"
              description="No separation on record. Resignation, clearance, final pay, COE and BIR 2316 appear here once offboarding starts."
            />
          </Section>
        )
      }
    </WithRecords>
  );
}
