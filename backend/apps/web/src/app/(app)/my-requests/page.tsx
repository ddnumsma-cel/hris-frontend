'use client';

import {
  addDays,
  type ApprovalType,
  formatAgo,
  formatDate,
  LABELS,
  manilaToday,
} from '@msma/shared';
import { CalendarDays, Clock, LogOut, PencilLine, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorNote, PageHeader } from '@/components/page-header';
import { ApprovalTypeBadge, RequestStatusBadge } from '@/components/status';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Select, Skeleton, Textarea } from '@/components/ui/form';
import { useAuth } from '@/lib/auth';
import {
  type FileRequest,
  useFileRequest,
  useMyLeaveBalances,
  useMyRequests,
  useMyToday,
} from '@/lib/queries';

const KINDS: { kind: ApprovalType; icon: LucideIcon; label: string; hint: string }[] = [
  { kind: 'LEAVE', icon: CalendarDays, label: 'Leave', hint: 'Vacation, sick, service incentive' },
  { kind: 'OT', icon: Clock, label: 'Overtime', hint: 'Worked, or will work, extra time' },
  { kind: 'UNDERTIME', icon: LogOut, label: 'Undertime', hint: 'Leave before my shift ends' },
  {
    kind: 'DTR_FIX',
    icon: PencilLine,
    label: 'Time adjustment',
    hint: 'A missing or wrong time in / out',
  },
];

/** "17:00" → "15:00": a starting suggestion for an undertime request. */
function twoHoursBefore(hhmm: string) {
  const m = (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) - 120 + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Staff who use the web (HR, payroll, managers) file their own requests here; employees use the phone app. */
export default function MyRequestsPage() {
  const { user } = useAuth();
  const isEmployee = !!user?.employeeId;
  const requests = useMyRequests(isEmployee);
  const [open, setOpen] = useState<ApprovalType | null>(null);

  if (user && !isEmployee)
    return (
      <>
        <PageHeader title="My requests" />
        <p className="text-sm text-muted">
          This sign-in is not linked to an employee record, so there is nothing to file. Ask HR to
          link it in the employee&apos;s record.
        </p>
      </>
    );

  return (
    <>
      <PageHeader
        title="My requests"
        subtitle="File leave, overtime, undertime or a time adjustment. It goes to your manager or HR."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => setOpen(k.kind)}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left hover:bg-bg"
          >
            <k.icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
            <span>
              <span className="block font-medium">File {k.label.toLowerCase()}</span>
              <span className="block text-sm text-muted">{k.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What I filed</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.error && (
            <ErrorNote message={requests.error.message} onRetry={() => requests.refetch()} />
          )}
          {requests.isLoading && <Skeleton className="h-24" />}
          {requests.data?.length === 0 && <p className="text-sm text-muted">No requests yet.</p>}
          <ul className="divide-y divide-border">
            {(requests.data ?? []).map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ApprovalTypeBadge type={r.type} />
                  <RequestStatusBadge status={r.status} />
                  <span className="text-xs text-muted">
                    Filed {formatAgo(r.createdAt)}
                    {r.decidedAt
                      ? ` · ${LABELS.requestStatus[r.status].toLowerCase()} ${formatDate(r.decidedAt)}`
                      : ''}
                  </span>
                </div>
                <p className="mt-1 text-sm">{r.detail}</p>
                {r.reason && <p className="mt-1 text-sm text-muted">Reason: {r.reason}</p>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <FileDialog kind={open} onClose={() => setOpen(null)} />
    </>
  );
}

function FileDialog({ kind, onClose }: { kind: ApprovalType | null; onClose: () => void }) {
  const today = manilaToday();
  const file = useFileRequest();
  const toast = useToast();
  const shift = useMyToday(!!kind).data?.shift;
  const balances = useMyLeaveBalances(kind === 'LEAVE').data;
  const [date, setDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [leaveType, setLeaveType] = useState<'VL' | 'SL' | 'SIL'>('VL');
  const [hours, setHours] = useState('1');
  const [time, setTime] = useState('15:00');
  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDate(kind === 'DTR_FIX' ? addDays(today, -1) : today);
    setEndDate(today);
    setHours('1');
    setTime(shift ? twoHoursBefore(shift.endTime) : '15:00');
    setTimeIn('');
    setTimeOut('');
    setReason('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [kind]);

  if (!kind) return null;
  const meta = KINDS.find((k) => k.kind === kind)!;

  function request(): FileRequest | string {
    const why = reason.trim();
    if (why.length < 3) return 'Please give a short reason.';
    switch (kind) {
      case 'LEAVE':
        if (endDate < date) return 'The last day must be on or after the first day.';
        return {
          kind: 'LEAVE',
          body: { leaveTypeCode: leaveType, startDate: date, endDate, reason: why },
        };
      case 'OT': {
        const minutes = Math.round(Number(hours) * 60);
        if (!(minutes >= 30 && minutes <= 720)) return 'Overtime must be between 0.5 and 12 hours.';
        return {
          kind: 'OT',
          body: { date, minutes: Math.round(minutes / 15) * 15, reason: why },
        };
      }
      case 'UNDERTIME':
        return { kind: 'UNDERTIME', body: { date, leaveTime: time, reason: why } };
      default:
        if (!timeIn && !timeOut) return 'Give the correct time in, time out, or both.';
        return {
          kind: 'DTR_FIX',
          body: { date, timeIn: timeIn || undefined, timeOut: timeOut || undefined, reason: why },
        };
    }
  }

  function submit() {
    const r = request();
    if (typeof r === 'string') return setError(r);
    file.mutate(r, {
      onSuccess: () => {
        toast('success', `${meta.label} sent for approval.`);
        onClose();
      },
      onError: (e) => setError(e.message),
    });
  }

  const past = addDays(today, -30);
  const ahead = addDays(today, 30);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle>File {meta.label.toLowerCase()}</DialogTitle>
        <DialogDescription>
          {kind === 'OT' &&
            'Overtime is paid only after approval, and only for time the clock shows.'}
          {kind === 'UNDERTIME' &&
            `Leaving early${shift ? ` (your shift is ${shift.startTime} to ${shift.endTime})` : ''}. The early minutes are not paid; approval means it is allowed.`}
          {kind === 'DTR_FIX' && 'Fill in only the time that is missing or wrong.'}
          {kind === 'LEAVE' && 'Holidays and rest days are not counted.'}
        </DialogDescription>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {kind === 'LEAVE' && (
            <div className="sm:col-span-2">
              <Label htmlFor="req-leave-type">Type of leave</Label>
              <Select
                id="req-leave-type"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as typeof leaveType)}
              >
                {(['VL', 'SL', 'SIL'] as const).map((code) => {
                  const b = balances?.find((x) => x.leaveTypeCode === code);
                  return (
                    <option key={code} value={code}>
                      {b?.leaveTypeName ?? code}
                      {b ? ` (${b.remaining} days left)` : ''}
                    </option>
                  );
                })}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="req-date">{kind === 'LEAVE' ? 'First day' : 'Day'}</Label>
            <Input
              id="req-date"
              type="date"
              value={date}
              min={past}
              max={kind === 'DTR_FIX' ? today : ahead}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {kind === 'LEAVE' && (
            <div>
              <Label htmlFor="req-end">Last day</Label>
              <Input
                id="req-end"
                type="date"
                value={endDate}
                min={date}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}
          {kind === 'OT' && (
            <div>
              <Label htmlFor="req-hours">Hours</Label>
              <Input
                id="req-hours"
                type="number"
                min={0.5}
                max={12}
                step={0.25}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          )}
          {kind === 'UNDERTIME' && (
            <div>
              <Label htmlFor="req-time">I will leave at</Label>
              <Input
                id="req-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          )}
          {kind === 'DTR_FIX' && (
            <>
              <div>
                <Label htmlFor="req-in">Correct time in</Label>
                <Input
                  id="req-in"
                  type="time"
                  value={timeIn}
                  onChange={(e) => setTimeIn(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="req-out">Correct time out</Label>
                <Input
                  id="req-out"
                  type="time"
                  value={timeOut}
                  onChange={(e) => setTimeOut(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <Label htmlFor="req-reason">Reason</Label>
            <Textarea
              id="req-reason"
              rows={3}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={file.isPending}>
            Send for approval
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
