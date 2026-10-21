import {
  LABELS,
  type ApprovalType,
  type DtrStatus,
  type EmploymentStatus,
  type RequestStatus,
} from '@msma/shared';
import { AlertTriangle, Check, CircleDashed, Clock, Minus, Plane, X } from 'lucide-react';
import { Badge } from './ui/badge';

// Every status shows text + colour (+ icon), never colour alone.

export function DtrStatusBadge({
  status,
  lateMinutes = 0,
}: {
  status: DtrStatus | null;
  lateMinutes?: number;
}) {
  if (!status) return <span className="text-muted">-</span>;
  if (status === 'PRESENT' && lateMinutes > 0)
    return (
      <Badge tone="warning">
        <Clock className="size-3" aria-hidden /> Late {lateMinutes} min
      </Badge>
    );
  const tone = {
    PRESENT: 'success',
    ABSENT: 'danger',
    LEAVE: 'accent',
    RESTDAY: 'neutral',
    HOLIDAY: 'neutral',
  } as const;
  const Icon = { PRESENT: Check, ABSENT: X, LEAVE: Plane, RESTDAY: Minus, HOLIDAY: Minus }[status];
  return (
    <Badge tone={tone[status]}>
      <Icon className="size-3" aria-hidden /> {LABELS.dtrStatus[status]}
    </Badge>
  );
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const tone = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'neutral',
  } as const;
  const Icon = { PENDING: CircleDashed, APPROVED: Check, REJECTED: X, CANCELLED: Minus }[status];
  return (
    <Badge tone={tone[status]}>
      <Icon className="size-3" aria-hidden /> {LABELS.requestStatus[status]}
    </Badge>
  );
}

export function EmploymentStatusBadge({ status }: { status: EmploymentStatus }) {
  const tone = {
    REGULAR: 'success',
    PROBATIONARY: 'warning',
    CONTRACTUAL: 'neutral',
    PROJECT: 'accent',
  } as const;
  return <Badge tone={tone[status]}>{LABELS.employmentStatus[status]}</Badge>;
}

export function ApprovalTypeBadge({ type }: { type: ApprovalType }) {
  return (
    <Badge tone="neutral" className="font-semibold">
      {LABELS.approvalType[type]}
    </Badge>
  );
}

export function PunchStatusBadge({
  kind,
  lateMinutes,
}: {
  kind: 'IN' | 'OUT';
  lateMinutes: number;
}) {
  if (kind === 'OUT') return <Badge tone="neutral">Time out</Badge>;
  if (lateMinutes > 0)
    return (
      <Badge tone="warning">
        <AlertTriangle className="size-3" aria-hidden /> Late {lateMinutes} min
      </Badge>
    );
  return (
    <Badge tone="success">
      <Check className="size-3" aria-hidden /> On time
    </Badge>
  );
}
