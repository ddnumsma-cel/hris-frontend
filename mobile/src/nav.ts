// Each workspace's navigation, copied from the website's sidebars (EmployeeLayout, ManagerLayout, AdminLayout
// GROUPS): same pages, order and addresses. On a phone the role's main pages become the bottom tabs and the rest
// sit under More, grouped like the sidebar. The HR workspace is filtered by the website's own access rules
// (pageNeed + can), so each role sees exactly what it sees on the website.

import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { pageNeed } from '@/features/admin/administration/access';
import { can, type RoleKey, type Who } from '@/lib/permissions';
import { REQUEST_TYPES } from '@/lib/requests/types';
import type { Role } from '@/lib/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export interface NavItem {
  label: string;
  /** Short name for the tab bar. */
  short?: string;
  to: string;
  icon?: IconName;
  children?: NavItem[];
}

export interface NavGroup {
  title: string;
  icon?: IconName;
  items: NavItem[];
}

const EMPLOYEE: NavGroup[] = [
  {
    title: 'Workspace',
    items: [
      { label: 'Home', to: '/employee', icon: 'home-outline' },
      { label: 'Leave', to: '/employee/leave', icon: 'calendar-outline' },
      { label: 'Attendance', to: '/employee/attendance', icon: 'time-outline' },
      { label: 'Payslips', to: '/employee/payslips', icon: 'cash-outline' },
      { label: '201 File', to: '/employee/201-file', icon: 'folder-outline' },
      { label: 'Trainings', to: '/employee/trainings', icon: 'school-outline' },
      { label: 'Company policies', short: 'Policies', to: '/employee/policies', icon: 'checkbox-outline' },
      { label: 'IT support', short: 'Support', to: '/employee/support', icon: 'flag-outline' },
    ],
  },
  {
    title: 'Requests',
    items: [
      { label: 'All requests', short: 'Requests', to: '/employee/requests', icon: 'checkbox-outline' },
      { label: 'Certificates', to: '/employee/certificates', icon: 'document-text-outline' },
      { label: 'Reimbursements', to: '/employee/reimbursements', icon: 'receipt-outline' },
      { label: 'HMO & Benefits', to: '/employee/benefits', icon: 'people-outline' },
      { label: 'Overtime', to: '/employee/overtime', icon: 'alarm-outline' },
      { label: 'Undertime', to: '/employee/undertime', icon: 'log-out-outline' },
    ],
  },
];

const MANAGER: NavGroup[] = [
  {
    title: 'Team',
    items: [
      { label: 'Home', to: '/manager', icon: 'home-outline' },
      { label: 'Approvals', to: '/manager/approvals', icon: 'checkbox-outline' },
      { label: 'Team Calendar', short: 'Calendar', to: '/manager/calendar', icon: 'calendar-outline' },
      { label: 'Team Attendance', short: 'Attendance', to: '/manager/attendance', icon: 'time-outline' },
    ],
  },
  { title: 'Development', items: [{ label: 'Trainings', to: '/manager/trainings', icon: 'school-outline' }] },
  {
    title: 'Reports',
    items: [
      { label: 'Payroll', to: '/manager/payroll', icon: 'cash-outline' },
      { label: 'Reports', to: '/manager/reports', icon: 'pie-chart-outline' },
    ],
  },
];

const ADMIN: NavGroup[] = [
  { title: 'Organization', items: [{ label: 'Home', to: '/admin', icon: 'home-outline' }] },
  {
    title: 'Maintenance',
    icon: 'server-outline',
    items: [
      { label: 'People', to: '/admin/maintenance/people', icon: 'people-outline' },
      { label: 'User accounts', short: 'Accounts', to: '/admin/maintenance/user-accounts', icon: 'key-outline' },
      { label: 'Departments', to: '/admin/maintenance/departments', icon: 'business-outline' },
      { label: 'Locations', to: '/admin/maintenance/locations', icon: 'location-outline' },
      { label: 'Org chart', to: '/admin/maintenance/org-chart', icon: 'git-network-outline' },
      { label: '201 documents', short: '201 docs', to: '/admin/maintenance/documents', icon: 'folder-outline' },
      {
        label: 'Leave',
        to: '/admin/maintenance/leave',
        icon: 'calendar-outline',
        children: [
          { label: 'Overview', to: '/admin/maintenance/leave/overview' },
          { label: 'Requests', to: '/admin/maintenance/leave/requests' },
          { label: 'Balances', to: '/admin/maintenance/leave/balances' },
          { label: 'Leave types', to: '/admin/maintenance/leave/types' },
        ],
      },
      { label: 'Rules', to: '/admin/maintenance/rules', icon: 'list-outline' },
    ],
  },
  {
    title: 'Attendance',
    icon: 'time-outline',
    items: [
      { label: 'Attendance', to: '/admin/timekeeping', icon: 'time-outline' },
      { label: 'Shifts', to: '/admin/timekeeping/shifts', icon: 'swap-horizontal-outline' },
      { label: 'Schedules', to: '/admin/timekeeping/schedules', icon: 'calendar-number-outline' },
      { label: 'Remote work days', to: '/admin/timekeeping/remote', icon: 'home-outline' },
      { label: 'Holiday calendar', to: '/admin/timekeeping/holidays', icon: 'flag-outline' },
    ],
  },
  {
    title: 'Payroll',
    icon: 'cash-outline',
    items: [
      { label: 'Payroll', to: '/admin/payroll', icon: 'cash-outline' },
      { label: 'Payroll runs', to: '/admin/payroll/runs', icon: 'play-outline' },
      { label: 'Pay details', to: '/admin/payroll/pay-details', icon: 'options-outline' },
      { label: 'Loans & deductions', to: '/admin/payroll/loans', icon: 'wallet-outline' },
      { label: 'Final pay', to: '/admin/payroll/final-pay', icon: 'exit-outline' },
      { label: 'Payouts & journal', to: '/admin/payroll/payouts', icon: 'card-outline' },
      { label: 'Year-end BIR forms', to: '/admin/payroll/year-end', icon: 'document-outline' },
      { label: 'Government contributions', to: '/admin/payroll/contributions', icon: 'shield-checkmark-outline' },
    ],
  },
  {
    title: 'Onboarding',
    icon: 'clipboard-outline',
    items: [
      { label: 'Onboarding', to: '/admin/onboarding', icon: 'clipboard-outline' },
      { label: 'Trainings', to: '/admin/onboarding/trainings', icon: 'school-outline' },
    ],
  },
  {
    title: 'Reports',
    icon: 'pie-chart-outline',
    items: [
      { label: 'BIR & government forms', to: '/admin/reports/statutory', icon: 'document-text-outline' },
      { label: 'Attendance report', to: '/admin/reports/attendance', icon: 'stats-chart-outline' },
      { label: 'Attendance logs', to: '/admin/reports/attendance-logs', icon: 'list-outline' },
      { label: 'Tardiness', to: '/admin/reports/tardiness', icon: 'hourglass-outline' },
      { label: 'Leave', to: '/admin/reports/leave', icon: 'calendar-outline' },
      { label: 'Overtime', to: '/admin/reports/overtime', icon: 'alarm-outline' },
      { label: 'Undertime', to: '/admin/reports/undertime', icon: 'log-out-outline' },
      { label: 'Time adjustments', to: '/admin/reports/time-adjustments', icon: 'create-outline' },
      { label: 'Payroll report', to: '/admin/reports/payroll', icon: 'cash-outline' },
      { label: 'HR reports', to: '/admin/reports/hr', icon: 'people-outline' },
      { label: 'Management', to: '/admin/reports/management', icon: 'briefcase-outline' },
    ],
  },
  {
    title: 'Requests',
    icon: 'mail-unread-outline',
    items: REQUEST_TYPES.map((t) => ({ label: t.label, short: t.id === 'reimbursement' ? 'Claims' : undefined, to: `/admin/requests/${t.id}`, icon: t.id === 'reimbursement' ? 'receipt-outline' : 'document-text-outline' })),
  },
  {
    title: 'Administration & Security',
    icon: 'shield-outline',
    items: [
      { label: 'Users', to: '/admin/administration/users', icon: 'person-circle-outline' },
      { label: 'Audit trail', to: '/admin/administration/audit', icon: 'reader-outline' },
      { label: 'System settings', to: '/admin/administration/settings', icon: 'settings-outline' },
      { label: 'Email & text outbox', to: '/admin/administration/outbox', icon: 'mail-outline' },
      { label: 'Clients & Subscriptions', short: 'Clients', to: '/admin/administration/subscription', icon: 'pricetags-outline' },
      { label: 'Support tickets', short: 'Support', to: '/admin/administration/support', icon: 'help-buoy-outline' },
    ],
  },
];

/** Allowed by the website's page rules (pages without a rule are open to the workspace). */
export const pageAllowed = (who: Who, to: string) => {
  const need = pageNeed(to.split('?')[0]!);
  return !need || can(who, need.action, need.feature);
};

/** The workspace's sidebar groups the signed-in person may open. */
export function navFor(workspace: Role, who: Who): NavGroup[] {
  const groups = workspace === 'employee' ? EMPLOYEE : workspace === 'manager' ? MANAGER : ADMIN;
  if (workspace !== 'admin') return groups;
  return groups
    .map((g) => ({
      ...g,
      items: g.items
        .map((i) => (i.children ? { ...i, children: i.children.filter((c) => pageAllowed(who, c.to)) } : i))
        .filter((i) => (i.children ? i.children.length > 0 : pageAllowed(who, i.to))),
    }))
    .filter((g) => g.items.length > 0);
}

/** The four bottom tabs per role (the rest go under More); pages the role can't open are skipped. */
const TABS: Record<RoleKey, string[]> = {
  employee: ['/employee', '/employee/attendance', '/employee/payslips', '/employee/requests'],
  approver: ['/manager', '/manager/approvals', '/manager/calendar', '/manager/attendance'],
  hr: ['/admin', '/admin/maintenance/people', '/admin/timekeeping', '/admin/requests/reimbursement'],
  accounting: ['/admin', '/admin/payroll', '/admin/requests/reimbursement', '/admin/reports/payroll'],
  super_admin: ['/admin', '/admin/maintenance/people', '/admin/payroll', '/admin/requests/reimbursement'],
  system_admin: ['/admin', '/admin/administration/subscription', '/admin/administration/support', '/admin/administration/users'],
};

const flat = (groups: NavGroup[]) => groups.flatMap((g) => g.items.flatMap((i) => [i, ...(i.children ?? [])]));

export function tabsFor(role: RoleKey, groups: NavGroup[]): NavItem[] {
  const all = flat(groups);
  const picked = TABS[role].flatMap((to) => all.find((i) => i.to === to) ?? []);
  // Fill up to four from the role's own pages if some aren't allowed.
  for (const i of all) if (picked.length < 4 && !i.children && !picked.includes(i)) picked.push(i);
  return picked.slice(0, 4);
}

/** The role's pages that aren't bottom tabs (sub-pages listed on their own), in sidebar order. */
export function othersFor(groups: NavGroup[], tabs: NavItem[]): NavItem[] {
  const inTabs = new Set(tabs.map((t) => t.to));
  return groups.flatMap((g) => g.items.flatMap((i) => (i.children ? i.children.map((ch) => ({ ...ch, icon: i.icon, short: ch.label === 'Leave types' ? ch.label : `${i.label} ${ch.label.toLowerCase()}` })) : [i]))).filter((i) => !inTabs.has(i.to));
}

/** The same pages, kept in their sidebar sections (sections left empty are dropped). */
export function othersGroupedFor(groups: NavGroup[], tabs: NavItem[]): NavGroup[] {
  const others = othersFor(groups, tabs);
  const byTo = new Map(others.map((i) => [i.to, i]));
  return groups
    .map((g) => ({ ...g, items: g.items.flatMap((i) => (i.children ? i.children : [i])).flatMap((i) => byTo.get(i.to) ?? []) }))
    .filter((g) => g.items.length > 0);
}

/** The nav item for an address (for the page title), including Leave's sub-pages. */
export function itemFor(groups: NavGroup[], path: string): NavItem | undefined {
  const all = flat(groups);
  return all.find((i) => i.to === path) ?? all.filter((i) => path.startsWith(`${i.to}/`)).sort((a, b) => b.to.length - a.to.length)[0];
}

export const homeOf = (workspace: Role) => (workspace === 'employee' ? '/employee' : workspace === 'manager' ? '/manager' : '/admin');
