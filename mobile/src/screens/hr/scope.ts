// HR and managers share Home, Approvals and Attendance. The server already limits a manager's data to their team;
// this says what differs on the phone: which requests they decide, where links go and how the scope is named.

import { LABELS } from '@msma/shared';
import { useSession } from '~/session';

export type ApprovalKind = keyof typeof LABELS.approvalType;

/** HR decides leave and attendance fixes; overtime and undertime go to the employee's approver. */
export const HR_KINDS: ApprovalKind[] = ['LEAVE', 'DTR_FIX'];
const ALL_KINDS = Object.keys(LABELS.approvalType) as ApprovalKind[];

export function useScope() {
  const { user } = useSession();
  const team = user?.workspace === 'manager';
  return {
    team,
    label: team ? 'My team' : 'All branches',
    kinds: team ? ALL_KINDS : HR_KINDS,
    approvals: team ? '/manager/approvals' : '/admin/approvals',
    person: (id: string) => (team ? `/manager/people/${id}` : `/admin/maintenance/people/${id}`),
  };
}
