// The Start menu's links per workspace, copied from the website's CREATE lists (EmployeeLayout, ManagerLayout,
// AdminLayout). Links that need a permission say which (action, and feature when the page belongs to another),
// and are shown only to roles that have it, as on the website.

import type { Action, Feature, Who } from '@/lib/permissions';
import { can } from '@/lib/permissions';
import type { Role } from '@/lib/types';
import { pageAllowed } from './nav';
import { pageNeed } from '@/features/admin/administration/access';

export interface StartLink {
  label: string;
  to: string;
  hint: string;
  action?: Action;
  feature?: Feature;
  /** A decision waiting on the person (shown under "Waiting on you"). */
  waiting?: 'leave' | 'time' | 'fixes' | 'claims' | 'documents';
}

export interface StartGroup {
  title: string;
  items: StartLink[];
}

const EMPLOYEE: StartGroup[] = [
  {
    title: 'Leave & time',
    items: [
      { label: 'File leave', to: '/employee/leave?create=leave', hint: 'Ask for time off' },
      { label: 'View leave balance', to: '/employee/leave', hint: 'See the days you have left' },
      { label: 'Request overtime', to: '/employee/overtime?create=overtime', hint: 'Get paid for time past your shift' },
      { label: 'Request undertime', to: '/employee/undertime?create=undertime', hint: 'Explain leaving before your shift ends' },
      { label: 'Request attendance fix', to: '/employee/attendance?create=adjustment', hint: 'Fix a missed time in or out' },
    ],
  },
  {
    title: 'Requests',
    items: [
      { label: 'Request certificate', to: '/employee/certificates?create=certificate', hint: 'Employment, compensation and more' },
      { label: 'Submit reimbursement', to: '/employee/reimbursements?create=claim', hint: 'Get paid back for work expenses' },
    ],
  },
  {
    title: 'Records',
    items: [
      { label: 'Update my details', to: '/employee/201-file?create=details', hint: 'Address, contacts and IDs' },
      { label: 'Add benefit or dependent', to: '/employee/benefits?create=benefit', hint: 'HMO, insurance and family' },
    ],
  },
  {
    title: 'Pay & learning',
    items: [
      { label: 'View payslips', to: '/employee/payslips', hint: 'Your pay for each period' },
      { label: 'View trainings', to: '/employee/trainings', hint: 'Courses assigned to you' },
    ],
  },
  { title: 'Help', items: [{ label: 'Report a problem', to: '/employee/support?create=ticket', action: 'create', hint: 'Send a ticket straight to IT support' }] },
];

const MANAGER: StartGroup[] = [
  {
    title: 'Team',
    items: [
      { label: 'Approve leave', to: '/manager/approvals?tab=leave', action: 'approve', feature: 'leave', hint: "Your team's leave requests", waiting: 'leave' },
      { label: 'Approve attendance', to: '/manager/approvals?tab=overtime', action: 'approve', feature: 'attendanceRecords', hint: 'Overtime and undertime to decide', waiting: 'time' },
      { label: 'Check team attendance', to: '/manager/attendance', hint: "Who's in, late or away today" },
      { label: 'View team calendar', to: '/manager/calendar', hint: 'Leave and remote days at a glance' },
    ],
  },
  { title: 'Development', items: [{ label: 'Assign training', to: '/manager/trainings?create=training', hint: 'Give someone a course' }] },
  {
    title: 'Company',
    items: [
      { label: 'Review payroll', to: '/manager/payroll', hint: "Check this period's pay" },
      { label: 'View reports', to: '/manager/reports', hint: 'Team numbers and trends' },
    ],
  },
];

const ADMIN: StartGroup[] = [
  {
    title: 'People',
    items: [
      { label: 'Add employee', to: '/admin/maintenance/people/new', hint: 'Start a new 201 record' },
      { label: 'Post announcement', to: '/admin?create=announcement', hint: "Show news on everyone's Home page" },
      { label: 'Update reporting lines', to: '/admin/maintenance/org-chart', action: 'edit', hint: 'Change who reports to whom' },
      { label: 'Review documents', to: '/admin/maintenance/documents', action: 'edit', hint: 'Uploaded 201 papers to check', waiting: 'documents' },
    ],
  },
  {
    title: 'Attendance',
    items: [
      { label: 'Add shift', to: '/admin/timekeeping/shifts?create=shift', hint: 'Set working hours and breaks' },
      { label: 'Assign schedules', to: '/admin/timekeeping/schedules', action: 'edit', hint: 'Put people on shifts' },
      { label: 'Declare remote work day', to: '/admin/timekeeping/remote?create=remote-day', hint: 'Let a team work from home' },
      { label: 'Add missing time', to: '/admin/reports/attendance-logs', action: 'edit', hint: 'Fill in a forgotten time in or out' },
      { label: 'Review time adjustments', to: '/admin/reports/time-adjustments', action: 'approve', hint: 'Corrections people asked for', waiting: 'fixes' },
      { label: 'Approve overtime', to: '/admin/reports/overtime', action: 'approve', hint: 'Overtime and undertime to decide', waiting: 'time' },
      { label: 'Send lateness notice', to: '/admin/reports/tardiness', action: 'edit', hint: 'Remind someone about tardiness' },
    ],
  },
  {
    title: 'Leave & requests',
    items: [
      { label: 'File leave', to: '/admin/maintenance/leave/requests?create=leave', action: 'create', hint: 'For yourself or someone else' },
      { label: 'Add leave type', to: '/admin/maintenance/leave/types?create=leave-type', hint: 'A new kind of leave and its credits' },
      { label: 'Adjust leave balances', to: '/admin/maintenance/leave/balances', action: 'edit', hint: 'Add or take away days' },
      { label: 'Approve leave', to: '/admin/maintenance/leave/requests', action: 'approve', hint: 'Leave requests to decide', waiting: 'leave' },
      { label: 'Review reimbursements', to: '/admin/requests/reimbursement', hint: 'Claims to endorse or approve', waiting: 'claims' },
    ],
  },
  {
    title: 'Payroll',
    items: [
      { label: 'Run payroll', to: '/admin/payroll/runs?create=payroll-run', hint: 'Start a new pay run' },
      { label: 'Update contribution rates', to: '/admin/payroll/contributions?create=contribution-rates', hint: 'SSS, PhilHealth and Pag-IBIG tables' },
      { label: 'View payroll report', to: '/admin/reports/payroll', hint: 'Totals by period and office' },
      { label: 'View government reports', to: '/admin/reports/statutory', hint: 'Ready-to-file remittances' },
    ],
  },
  {
    title: 'Other',
    items: [
      { label: 'Add user', to: '/admin/administration/users?create=user', hint: 'Give someone a login' },
      { label: 'Report a problem', to: '/admin/administration/support?create=ticket', action: 'create', hint: 'Send a ticket to support' },
      { label: 'Edit approval workflows', to: '/admin/maintenance/rules', action: 'edit', hint: 'Who approves what' },
      { label: 'View HR report', to: '/admin/reports/hr', hint: 'Head count, hires and leavers' },
      { label: 'View attendance report', to: '/admin/reports/attendance', hint: 'Present, absent and late' },
    ],
  },
];

/** A link is shown when the role may open its page and, if it names one, do its action (as useCreateAllowed). */
function allowed(who: Who, l: StartLink) {
  if (!pageAllowed(who, l.to)) return false;
  if (!l.action) return true;
  const feature = l.feature ?? pageNeed(l.to.split('?')[0]!)?.feature;
  return !feature || can(who, l.action, feature);
}

export function startFor(workspace: Role, who: Who): StartGroup[] {
  const groups = workspace === 'employee' ? EMPLOYEE : workspace === 'manager' ? MANAGER : ADMIN;
  return groups.map((g) => ({ ...g, items: g.items.filter((l) => allowed(who, l)) })).filter((g) => g.items.length > 0);
}
