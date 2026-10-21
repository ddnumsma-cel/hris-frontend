'use client';

import type { ApprovalItem } from '@msma/shared';
import { LABELS } from '@msma/shared';
import { useEffect, useState } from 'react';
import { useDecision } from '@/lib/queries';
import { useToast } from './toast';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { Label, Textarea } from './ui/form';

const APPROVE_EFFECT: Record<ApprovalItem['type'], string> = {
  LEAVE: 'The days will be deducted from their leave balance and their DTR will show "On leave".',
  OT: 'The overtime will be paid in payroll (up to the time the clock shows they worked).',
  UNDERTIME:
    'Leaving early is allowed. The early minutes stay unpaid, and their DTR will show "Undertime approved".',
  DTR_FIX: 'Their daily time record will be updated with the corrected time.',
};

export type Decision = { item: ApprovalItem; decision: 'approve' | 'reject' } | null;

/** Confirm dialog for approving/rejecting. Rejecting requires a reason the employee will see. */
export function DecisionDialog({ value, onClose }: { value: Decision; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const mutation = useDecision();
  const toast = useToast();
  useEffect(() => setReason(''), [value]);
  if (!value) return null;
  const { item, decision } = value;
  const isReject = decision === 'reject';
  const tooShort = isReject && reason.trim().length < 3;
  const typeLabel = LABELS.approvalType[item.type].toLowerCase();

  const submit = () =>
    mutation.mutate(
      { id: item.id, decision, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast(
            'success',
            `${isReject ? 'Rejected' : 'Approved'} ${item.employee.fullName}'s ${typeLabel} request.`,
          );
          onClose();
        },
        onError: (e) => toast('error', e.message),
      },
    );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>
          {isReject ? 'Reject' : 'Approve'} {item.employee.fullName}&apos;s {typeLabel} request?
        </DialogTitle>
        <DialogDescription>{item.detail}</DialogDescription>
        <p className="mt-3 rounded-md bg-bg px-3 py-2 text-sm">
          {isReject
            ? `${item.employee.fullName} will see your reason in the mobile app.`
            : APPROVE_EFFECT[item.type]}
        </p>
        <div className="mt-4">
          <Label htmlFor="decision-reason">
            {isReject ? 'Reason (required)' : 'Note (optional)'}
          </Label>
          <Textarea
            id="decision-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isReject ? 'e.g. Not pre-approved by the supervisor' : ''}
            maxLength={500}
            autoFocus={isReject}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant={isReject ? 'danger' : 'default'}
            onClick={submit}
            disabled={tooShort || mutation.isPending}
          >
            {mutation.isPending ? 'Saving…' : isReject ? 'Reject request' : 'Approve request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
