'use client';

import {
  APPROVAL_TYPES,
  type ApprovalType,
  formatAgo,
  formatDate,
  LABELS,
  type RequestStatus,
} from '@msma/shared';
import { useState } from 'react';
import { type Decision, DecisionDialog } from '@/components/decision-dialog';
import { ErrorNote, PageHeader, Segmented } from '@/components/page-header';
import { ApprovalTypeBadge, RequestStatusBadge } from '@/components/status';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/form';
import { useAuth } from '@/lib/auth';
import { useApprovals } from '@/lib/queries';

type Tab = RequestStatus | 'ALL';

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('PENDING');
  const [type, setType] = useState<ApprovalType | ''>('');
  const [decision, setDecision] = useState<Decision>(null);
  const approvals = useApprovals(tab === 'ALL' ? undefined : tab, type || undefined, {
    refetchInterval: 15_000,
  });
  const items = approvals.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle={
          user?.role === 'MANAGER'
            ? 'Requests from your team'
            : 'Leave, overtime, undertime and time adjustment requests from all sites'
        }
        actions={
          <>
            <Select
              aria-label="Request type"
              value={type}
              onChange={(e) => setType(e.target.value as ApprovalType | '')}
              className="w-40"
            >
              <option value="">All types</option>
              {APPROVAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LABELS.approvalType[t]}
                </option>
              ))}
            </Select>
            <Segmented
              label="Status"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'PENDING', label: 'Pending' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'REJECTED', label: 'Rejected' },
                { value: 'ALL', label: 'All' },
              ]}
            />
          </>
        }
      />

      {approvals.error && (
        <ErrorNote message={approvals.error.message} onRetry={() => approvals.refetch()} />
      )}

      <Card className="overflow-hidden">
        <div className="relative overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead className="bg-bg text-left text-xs text-muted">
              <tr>
                <th className="hidden font-medium sm:table-cell">Type</th>
                <th className="font-medium">Employee</th>
                <th className="font-medium">Details</th>
                <th className="hidden font-medium md:table-cell">Filed</th>
                <th className="font-medium">Status</th>
                <th className="text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!approvals.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted">
                    {tab === 'PENDING' ? 'Nothing to approve. All caught up.' : 'No requests here.'}
                  </td>
                </tr>
              )}
              {items.map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="hidden sm:table-cell">
                    <ApprovalTypeBadge type={a.type} />
                  </td>
                  <td>
                    <p className="font-medium">{a.employee.fullName}</p>
                    <p className="text-xs text-muted">
                      <span className="num">{a.employee.employeeNo}</span> · {a.employee.siteName}
                    </p>
                  </td>
                  <td className="max-w-md">
                    <p>{a.detail}</p>
                    {a.status !== 'PENDING' && (
                      <p className="mt-0.5 text-xs text-muted">
                        {LABELS.requestStatus[a.status]} by {a.decidedBy ?? '-'}
                        {a.decidedAt && ` · ${formatDate(a.decidedAt)}`}
                        {a.reason && ` · "${a.reason}"`}
                      </p>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap text-muted md:table-cell">
                    {formatAgo(a.createdAt)}
                  </td>
                  <td>
                    <RequestStatusBadge status={a.status} />
                  </td>
                  <td className="text-right">
                    {a.status === 'PENDING' && (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDecision({ item: a, decision: 'reject' })}
                          aria-label={`Reject ${a.employee.fullName}'s request`}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setDecision({ item: a, decision: 'approve' })}
                          aria-label={`Approve ${a.employee.fullName}'s request`}
                        >
                          Approve
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted">
        Every decision is recorded in the audit log with who decided, when and why.
      </p>

      <DecisionDialog value={decision} onClose={() => setDecision(null)} />
    </>
  );
}
