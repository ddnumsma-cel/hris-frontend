'use client';

import {
  CIVIL_STATUS_LABELS,
  CIVIL_STATUSES,
  type CivilStatus,
  DEPENDENT_RELATIONSHIP_LABELS,
  DEPENDENT_RELATIONSHIPS,
  type DependentRelationship,
  type EmployeeDetail,
  EMPLOYMENT_EVENT_LABELS,
  formatDate,
  formatPHP,
  formatTime,
  GOV_NUMBER_FORMATS,
  LABELS,
  manilaDateKey,
  manilaToday,
  type UpdatePersonalInfo,
} from '@msma/shared';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Fingerprint,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Checklist201, CompletenessBar } from '@/components/file201';
import { ErrorNote, PageHeader } from '@/components/page-header';
import { DtrStatusBadge, EmploymentStatusBadge } from '@/components/status';
import { useToast } from '@/components/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Select, Skeleton } from '@/components/ui/form';
import { useAuth } from '@/lib/auth';
import { use201File, useEmployee, useEnrollBiometrics, useUpdatePersonal } from '@/lib/queries';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: '201', label: '201 file' },
  { id: 'personal', label: 'Personal info' },
  { id: 'attendance', label: 'Attendance & leave' },
  { id: 'history', label: 'Employment history' },
] as const;
type Tab = (typeof TABS)[number]['id'];

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={mono ? 'num text-sm' : 'text-sm'}>{value ?? '-'}</dd>
    </div>
  );
}

export default function EmployeePage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find((t) => t.id === search.get('tab'))?.id ?? 'summary') as Tab;
  const setTab = (t: Tab) => router.replace(`/employees/${id}?tab=${t}`, { scroll: false });
  const employee = useEmployee(id);
  const file = use201File(id);
  const role = useAuthRole();
  const e = employee.data;

  return (
    <>
      <Link
        href="/employees"
        className="no-print mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> All employees
      </Link>
      <PageHeader
        title={e ? e.fullName : 'Employee'}
        subtitle={
          e && (
            <span className="flex flex-wrap items-center gap-2">
              <span className="num">{e.employeeNo}</span> · {e.position} · {e.site.name}{' '}
              <EmploymentStatusBadge status={e.status} />
            </span>
          )
        }
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
        }
      />

      {employee.error && (
        <ErrorNote message={employee.error.message} onRetry={() => employee.refetch()} />
      )}
      {!e && !employee.error && <Skeleton className="h-64 rounded-xl" />}

      {e && (
        <>
          <div
            role="tablist"
            aria-label="Employee record"
            className="no-print mb-4 flex flex-wrap gap-1 border-b border-border"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  '-mb-px border-b-2 px-3 py-2 text-sm',
                  tab === t.id
                    ? 'border-accent font-semibold text-fg'
                    : 'border-transparent text-muted hover:text-fg',
                )}
              >
                {t.label}
                {t.id === '201' &&
                  file.data &&
                  file.data.summary.missing + file.data.summary.expired > 0 && (
                    <span className="ml-1.5 rounded-full bg-danger-soft px-1.5 text-xs font-semibold text-danger">
                      {file.data.summary.missing + file.data.summary.expired}
                    </span>
                  )}
              </button>
            ))}
          </div>

          {tab === 'summary' && (
            <SummaryTab e={e} file={file.data} onOpen201={() => setTab('201')} />
          )}
          {tab === '201' &&
            (file.data ? (
              <Checklist201 file={file.data} canSeeHistory={role === 'HR_ADMIN'} />
            ) : file.error ? (
              <ErrorNote message={file.error.message} />
            ) : (
              <Skeleton className="h-64 rounded-xl" />
            ))}
          {tab === 'personal' && <PersonalTab e={e} />}
          {tab === 'attendance' && <AttendanceTab e={e} />}
          {tab === 'history' && <HistoryTab e={e} />}
        </>
      )}
    </>
  );
}

function useAuthRole() {
  return useAuth().user?.role;
}

// ---------- Summary ----------

function SummaryTab({
  e,
  file,
  onOpen201,
}: {
  e: EmployeeDetail;
  file: ReturnType<typeof use201File>['data'];
  onOpen201: () => void;
}) {
  const role = useAuthRole();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Site" value={e.site.name} />
            <Field label="Department" value={e.department.name} />
            <Field label="Manager" value={e.manager?.fullName} />
            <Field label="Hired" value={formatDate(e.hireDate)} />
            <Field
              label="Regularized"
              value={
                e.personal?.regularizationDate ? formatDate(e.personal.regularizationDate) : null
              }
            />
            <Field label="Shift" value={`${e.shift.startTime}–${e.shift.endTime}`} />
            <Field label="Daily rate" value={formatPHP(e.dailyRate)} mono />
            <Field label="Work email" value={e.email} />
            <Field label="Mobile" value={e.personal?.mobileNo ?? e.mobileNo} mono />
            <Field label="Birth date" value={e.birthDate ? formatDate(e.birthDate) : null} />
            <Field
              label="Civil status"
              value={e.personal?.civilStatus ? CIVIL_STATUS_LABELS[e.personal.civilStatus] : null}
            />
            <Field label="Today" value={<DtrStatusBadge status={e.todayStatus} />} />
          </dl>
          <h3 className="mt-6 mb-2 text-sm font-semibold">Government numbers</h3>
          {e.govIds ? (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="TIN" value={e.govIds.tin} mono />
              <Field label="SSS" value={e.govIds.sss} mono />
              <Field label="PhilHealth" value={e.govIds.philhealth} mono />
              <Field label="Pag-IBIG MID" value={e.govIds.pagibig} mono />
            </dl>
          ) : (
            <p className="text-sm text-muted">No government numbers on file.</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>201 file</CardTitle>
          </CardHeader>
          <CardContent>
            {file ? (
              <>
                <CompletenessBar {...file.summary} />
                <Button className="mt-4 w-full" variant="outline" onClick={onOpen201}>
                  Open the 201 checklist
                </Button>
              </>
            ) : (
              <Skeleton className="h-20" />
            )}
          </CardContent>
        </Card>
        {file && (
          <BiometricCard
            e={e}
            file={file}
            canEnroll={role === 'HR_ADMIN' || role === 'SYSTEM_ADMIN'}
          />
        )}
      </div>
    </div>
  );
}

function BiometricCard({
  e,
  file,
  canEnroll,
}: {
  e: EmployeeDetail;
  file: NonNullable<ReturnType<typeof use201File>['data']>;
  canEnroll: boolean;
}) {
  const enroll = useEnrollBiometrics();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const { consentOnFile, enrolledAt } = file.biometric;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="size-4" aria-hidden /> Time clock (face / fingerprint)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {enrolledAt && consentOnFile && (
          <p className="flex items-center gap-2 text-success">
            <Check className="size-4" aria-hidden /> Enrolled on{' '}
            {formatDate(manilaDateKey(enrolledAt))}. Consent form on file.
          </p>
        )}
        {enrolledAt && !consentOnFile && (
          <p className="flex items-start gap-2 rounded-md bg-danger-soft p-2 text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Enrolled on the time clocks, but the signed biometric consent form is not on file.
            Upload it in the 201 file.
          </p>
        )}
        {!enrolledAt && !consentOnFile && (
          <p className="text-muted">
            Not enrolled. Upload the signed biometric consent form first; enrollment is blocked
            until then.
          </p>
        )}
        {!enrolledAt && consentOnFile && (
          <p className="text-muted">Consent form on file. Ready to enroll.</p>
        )}
        {canEnroll && (
          <Button
            variant="outline"
            className="w-full"
            disabled={!consentOnFile || enroll.isPending}
            title={consentOnFile ? undefined : 'Upload the biometric consent form first'}
            onClick={() => setConfirm(true)}
          >
            {enrolledAt ? 'Record re-enrollment' : 'Record enrollment'}
          </Button>
        )}
      </CardContent>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>Record time clock enrollment for {e.fullName}?</DialogTitle>
          <DialogDescription>
            Do this after enrolling their face or fingerprint on the terminal (PIN {e.employeeNo}).
          </DialogDescription>
          <p className="mt-3 rounded-md bg-bg px-3 py-2 text-sm">
            The date and your name are saved in the audit log. The consent form on file covers this
            enrollment.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              disabled={enroll.isPending}
              onClick={() =>
                enroll.mutate(e.id, {
                  onSuccess: () => {
                    toast('success', `Enrollment recorded for ${e.fullName}.`);
                    setConfirm(false);
                  },
                  onError: (err) => toast('error', err.message),
                })
              }
            >
              Record enrollment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------- Personal info ----------

type Draft = {
  civilStatus: CivilStatus | '';
  address: string;
  mobileNo: string;
  personalEmail: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  licenseType: string;
  regularizationDate: string;
  dependents: { name: string; relationship: DependentRelationship; birthDate: string }[];
  tin: string;
  sss: string;
  philhealth: string;
  pagibig: string;
  effectiveDate: string;
};

function toDraft(e: EmployeeDetail): Draft {
  const p = e.personal;
  return {
    civilStatus: p?.civilStatus ?? '',
    address: p?.address ?? '',
    mobileNo: p?.mobileNo ?? '',
    personalEmail: p?.personalEmail ?? '',
    emergencyName: p?.emergencyContact?.name ?? '',
    emergencyRelationship: p?.emergencyContact?.relationship ?? '',
    emergencyPhone: p?.emergencyContact?.phone ?? '',
    licenseType: p?.licenseType ?? '',
    regularizationDate: p?.regularizationDate ?? '',
    dependents: (p?.dependents ?? []).map((d) => ({ ...d, birthDate: d.birthDate ?? '' })),
    tin: e.govIds?.tin ?? '',
    sss: e.govIds?.sss ?? '',
    philhealth: e.govIds?.philhealth ?? '',
    pagibig: e.govIds?.pagibig ?? '',
    effectiveDate: manilaToday(),
  };
}

function PersonalTab({ e }: { e: EmployeeDetail }) {
  const role = useAuthRole();
  const canEditAll = role === 'HR_ADMIN';
  const canEditIds = canEditAll || role === 'PAYROLL_ADMIN';
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = useUpdatePersonal();
  const toast = useToast();
  const p = e.personal;

  if (!draft && !p) {
    // Payroll and managers: the personal data sheet is HR-only (Data Privacy Act).
    return (
      <Card>
        <CardHeader>
          <CardTitle>Personal info</CardTitle>
          {canEditIds && (
            <Button size="sm" variant="outline" onClick={() => setDraft(toDraft(e))}>
              <Pencil /> Edit government numbers
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">
            The personal data sheet (address, emergency contact, dependents) is visible to HR only.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!draft && p) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal data sheet</CardTitle>
            {canEditIds && (
              <Button size="sm" variant="outline" onClick={() => setDraft(toDraft(e))}>
                <Pencil /> Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Field
                label="Civil status"
                value={p.civilStatus ? CIVIL_STATUS_LABELS[p.civilStatus] : null}
              />
              <Field label="Mobile" value={p.mobileNo} mono />
              <div className="col-span-2">
                <Field label="Home address" value={p.address} />
              </div>
              <Field label="Personal email" value={p.personalEmail} />
              <Field label="Professional license" value={p.licenseType ?? 'Not required'} />
              <div className="col-span-2">
                <Field
                  label="Emergency contact"
                  value={
                    p.emergencyContact ? (
                      <>
                        {p.emergencyContact.name} ({p.emergencyContact.relationship}) ·{' '}
                        <span className="num">{p.emergencyContact.phone}</span>
                      </>
                    ) : (
                      <span className="text-danger">
                        Missing: needed for the personal data sheet
                      </span>
                    )
                  }
                />
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dependents</CardTitle>
          </CardHeader>
          <CardContent>
            {p.dependents.length === 0 ? (
              <p className="text-sm text-muted">No dependents listed.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {p.dependents.map((d, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2">
                    <span>
                      {d.name}{' '}
                      <span className="text-muted">
                        · {DEPENDENT_RELATIONSHIP_LABELS[d.relationship]}
                      </span>
                    </span>
                    <span className="text-muted">{d.birthDate ? formatDate(d.birthDate) : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!draft) return null;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });

  function save() {
    if (!draft) return;
    const idsChanged =
      draft.tin !== (e.govIds?.tin ?? '') ||
      draft.sss !== (e.govIds?.sss ?? '') ||
      draft.philhealth !== (e.govIds?.philhealth ?? '') ||
      draft.pagibig !== (e.govIds?.pagibig ?? '');
    const body: UpdatePersonalInfo = { effectiveDate: draft.effectiveDate || undefined };
    if (idsChanged)
      body.govIds = {
        tin: draft.tin,
        sss: draft.sss,
        philhealth: draft.philhealth,
        pagibig: draft.pagibig,
      };
    if (canEditAll) {
      Object.assign(body, {
        civilStatus: draft.civilStatus || null,
        address: draft.address,
        mobileNo: draft.mobileNo,
        personalEmail: draft.personalEmail,
        licenseType: draft.licenseType,
        regularizationDate: draft.regularizationDate || null,
        emergencyContact: draft.emergencyName
          ? {
              name: draft.emergencyName,
              relationship: draft.emergencyRelationship,
              phone: draft.emergencyPhone,
            }
          : null,
        dependents: draft.dependents
          .filter((d) => d.name.trim())
          .map((d) => ({ ...d, birthDate: d.birthDate || null })),
      });
    }
    setErrors({});
    update.mutate(
      { id: e.id, ...body },
      {
        onSuccess: () => {
          toast('success', `Saved ${e.fullName}'s personal info. The change is in the audit log.`);
          setDraft(null);
        },
        onError: (err) => {
          const issues = (err as { issues?: { path: string; message: string }[] }).issues ?? [];
          setErrors(Object.fromEntries(issues.map((i) => [i.path, i.message])));
          toast('error', err.message);
        },
      },
    );
  }

  const text = (
    k: keyof Draft,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div>
      <Label htmlFor={`pi-${k}`}>{label}</Label>
      <Input
        id={`pi-${k}`}
        value={draft[k] as string}
        disabled={!canEditAll}
        onChange={(ev) => set(k, ev.target.value as never)}
        {...props}
      />
    </div>
  );
  const gov = (k: 'tin' | 'sss' | 'philhealth' | 'pagibig') => (
    <div>
      <Label htmlFor={`pi-${k}`}>{GOV_NUMBER_FORMATS[k].label}</Label>
      <Input
        id={`pi-${k}`}
        className="num"
        value={draft[k]}
        placeholder={GOV_NUMBER_FORMATS[k].example}
        onChange={(ev) => set(k, ev.target.value)}
        aria-invalid={!!errors[`govIds.${k}`]}
      />
      {errors[`govIds.${k}`] && <p className="mt-1 text-xs text-danger">{errors[`govIds.${k}`]}</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit personal info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!canEditAll && (
          <p className="rounded-md bg-bg px-3 py-2 text-sm">
            Payroll can change the government numbers only.
          </p>
        )}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="pi-civil">Civil status</Label>
            <Select
              id="pi-civil"
              value={draft.civilStatus}
              disabled={!canEditAll}
              onChange={(ev) => set('civilStatus', ev.target.value as CivilStatus | '')}
            >
              <option value="">Not set</option>
              {CIVIL_STATUSES.map((c) => (
                <option key={c} value={c}>
                  {CIVIL_STATUS_LABELS[c]}
                </option>
              ))}
            </Select>
            {draft.civilStatus === 'MARRIED' && p?.civilStatus !== 'MARRIED' && (
              <p className="mt-1 text-xs text-muted">
                The 201 checklist will ask for the marriage certificate.
              </p>
            )}
          </div>
          {text('mobileNo', 'Mobile number')}
          {text('personalEmail', 'Personal email', { type: 'email' })}
          <div className="sm:col-span-2 lg:col-span-3">{text('address', 'Home address')}</div>
          {text('emergencyName', 'Emergency contact: name')}
          {text('emergencyRelationship', 'Relationship')}
          {text('emergencyPhone', 'Emergency contact: phone')}
          {text('licenseType', 'Professional license (leave empty if not required)', {
            placeholder: 'e.g. PRC (CPA)',
          })}
          {text('regularizationDate', 'Regularization date', { type: 'date' })}
        </section>

        {canEditAll && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Dependents</h3>
            <div className="space-y-2">
              {draft.dependents.map((d, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]"
                >
                  <Input
                    aria-label="Dependent name"
                    value={d.name}
                    placeholder="Full name"
                    onChange={(ev) =>
                      set(
                        'dependents',
                        draft.dependents.map((x, j) =>
                          j === i ? { ...x, name: ev.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Select
                    aria-label="Relationship"
                    value={d.relationship}
                    onChange={(ev) =>
                      set(
                        'dependents',
                        draft.dependents.map((x, j) =>
                          j === i
                            ? { ...x, relationship: ev.target.value as DependentRelationship }
                            : x,
                        ),
                      )
                    }
                  >
                    {DEPENDENT_RELATIONSHIPS.map((r) => (
                      <option key={r} value={r}>
                        {DEPENDENT_RELATIONSHIP_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                  <Input
                    aria-label="Birth date"
                    type="date"
                    value={d.birthDate}
                    onChange={(ev) =>
                      set(
                        'dependents',
                        draft.dependents.map((x, j) =>
                          j === i ? { ...x, birthDate: ev.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${d.name || 'dependent'}`}
                    onClick={() =>
                      set(
                        'dependents',
                        draft.dependents.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  set('dependents', [
                    ...draft.dependents,
                    { name: '', relationship: 'CHILD', birthDate: '' },
                  ])
                }
              >
                <Plus /> Add dependent
              </Button>
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold">Government numbers</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {gov('tin')}
            {gov('sss')}
            {gov('philhealth')}
            {gov('pagibig')}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="pi-effective">These changes take effect on</Label>
            <Input
              id="pi-effective"
              type="date"
              value={draft.effectiveDate}
              onChange={(ev) => set('effectiveDate', ev.target.value)}
            />
          </div>
          <p className="self-end text-sm text-muted sm:col-span-2">
            For a change in civil status, dependents or address, also upload the supporting document
            in the 201 file (&ldquo;Updates to civil status, dependents and address&rdquo;).
          </p>
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDraft(null)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Attendance & leave ----------

const mins = (m: number) => (m ? m : '-');

function AttendanceTab({ e }: { e: EmployeeDetail }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {e.leaveBalances.map((b) => (
          <Card key={b.leaveTypeCode} className="p-4">
            <p className="num text-2xl font-semibold">{b.remaining}</p>
            <p className="text-sm">{b.leaveTypeName} days left</p>
            <p className="num mt-1 text-xs text-muted">
              {b.used} used of {b.entitled} ({b.year})
            </p>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Daily time record, last 14 days</CardTitle>
        </CardHeader>
        <div className="relative overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead className="bg-bg text-left text-xs text-muted">
              <tr>
                <th className="font-medium">Date</th>
                <th className="font-medium">Time in</th>
                <th className="font-medium">Time out</th>
                <th className="text-right font-medium">Late (min)</th>
                <th className="text-right font-medium">Undertime (min)</th>
                <th className="text-right font-medium">Overtime (min)</th>
                <th className="font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {e.dtrs.map((d) => (
                <tr key={d.date} className="border-t border-border">
                  <td className="whitespace-nowrap">{formatDate(d.date)}</td>
                  <td className="num">{d.timeIn ? formatTime(d.timeIn) : '-'}</td>
                  <td className="num">
                    {d.timeOut ? (
                      formatTime(d.timeOut)
                    ) : d.remarks?.includes('MISSING_TIME_OUT') && d.date !== manilaToday() ? (
                      <span className="text-warning">No time out</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="num text-right">{mins(d.lateMinutes)}</td>
                  <td className="num text-right">{mins(d.undertimeMinutes)}</td>
                  <td className="num text-right">{mins(d.otMinutes)}</td>
                  <td>
                    <DtrStatusBadge status={d.status} lateMinutes={d.lateMinutes} />
                    {d.remarks?.includes('CORRECTED') && (
                      <span className="ml-1 text-xs text-muted">corrected</span>
                    )}
                    {d.remarks?.includes('UNDERTIME_APPROVED') && (
                      <span className="ml-1 text-xs text-muted">undertime approved</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-muted">
          Times are Philippine time. {LABELS.dtrStatus.RESTDAY} = Sunday.
        </p>
      </Card>
    </div>
  );
}

// ---------- Employment history ----------

function HistoryTab({ e }: { e: EmployeeDetail }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Employment history</CardTitle>
        <p className="text-xs text-muted">
          Newest first. Each change is dated from when it took effect.
        </p>
      </CardHeader>
      <div className="relative overflow-x-auto">
        <table className="data-table w-full text-sm">
          <thead className="bg-bg text-left text-xs text-muted">
            <tr>
              <th className="font-medium">Effective</th>
              <th className="font-medium">What happened</th>
              <th className="font-medium">Position</th>
              <th className="font-medium">Site</th>
              <th className="text-right font-medium">Daily rate</th>
              <th className="font-medium">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {e.history.map((h) => (
              <tr key={h.id} className="border-t border-border">
                <td className="whitespace-nowrap">{formatDate(h.effectiveDate)}</td>
                <td>
                  <Badge
                    tone={
                      h.type === 'HIRED' ? 'accent' : h.type === 'SEPARATED' ? 'danger' : 'neutral'
                    }
                  >
                    {EMPLOYMENT_EVENT_LABELS[h.type]}
                  </Badge>
                </td>
                <td>{h.positionTitle ?? '-'}</td>
                <td>{h.siteName?.replace(' branch', '') ?? '-'}</td>
                <td className="num text-right">{h.dailyRate ? formatPHP(h.dailyRate) : '-'}</td>
                <td className="text-muted">{h.remarks ?? ''}</td>
              </tr>
            ))}
            {e.history.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">
                  No history recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
