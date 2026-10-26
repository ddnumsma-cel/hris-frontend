// Which mobile screen shows each website address. Pages not listed yet show the Placeholder; each phase adds a
// role's pages here.

import type { ComponentType } from 'react';
import Attendance from './employee/Attendance';
import Certificates, { CertificateNewScreen } from './employee/Certificates';
import Clock from './employee/Clock';
import File201 from './employee/File201';
import Home from './employee/Home';
import Leave from './employee/Leave';
import LeaveNew from './employee/LeaveNew';
import MyDetails from './employee/MyDetails';
import OvertimeNew from './employee/OvertimeNew';
import Payslips from './employee/Payslips';
import Reimbursements, { ReimbursementNewScreen } from './employee/Reimbursements';
import Requests from './employee/Requests';
import TimeAdjustmentNew from './employee/TimeAdjustmentNew';
import UndertimeNew from './employee/UndertimeNew';
import Approvals from './hr/Approvals';
import HrAttendance from './hr/Attendance';
import Departments from './hr/Departments';
import Documents201 from './hr/Documents201';
import Locations from './hr/Locations';
import OrgChart from './hr/OrgChart';
import HrHome from './hr/HrHome';
import People from './hr/People';
import Person from './hr/Person';

const SCREENS: Record<string, ComponentType> = {
  // Employee (backend data)
  '/employee': Home,
  '/employee/clock': Clock,
  '/employee/attendance': Attendance,
  '/employee/attendance/fix': TimeAdjustmentNew,
  '/employee/leave': Leave,
  '/employee/leave/new': LeaveNew,
  '/employee/requests': Requests,
  '/employee/overtime': OvertimeNew,
  '/employee/overtime/new': OvertimeNew,
  '/employee/undertime': UndertimeNew,
  '/employee/undertime/new': UndertimeNew,
  '/employee/payslips': Payslips,
  '/employee/201-file': File201,
  // Employee (phone-only demo data until the server has them)
  '/employee/certificates': Certificates,
  '/employee/certificates/new': CertificateNewScreen,
  '/employee/reimbursements': Reimbursements,
  '/employee/reimbursements/new': ReimbursementNewScreen,
  '/employee/my-details': MyDetails,
  // HR workspace (backend data)
  '/admin': HrHome,
  '/admin/approvals': Approvals,
  '/admin/maintenance/people': People,
  '/admin/maintenance/departments': Departments,
  '/admin/maintenance/locations': Locations,
  '/admin/maintenance/org-chart': OrgChart,
  '/admin/maintenance/documents': Documents201,
  '/admin/timekeeping': HrAttendance,
  // Approver workspace (the server limits it to their team)
  '/manager': HrHome,
  '/manager/approvals': Approvals,
  '/manager/attendance': HrAttendance,
};

export function screenFor(path: string): ComponentType | undefined {
  // One person's record: /admin/maintenance/people/<id> (HR) or /manager/people/<id> (approvers).
  if ((path.startsWith('/admin/maintenance/people/') && path.split('/').length === 5) || (path.startsWith('/manager/people/') && path.split('/').length === 4)) return Person;
  return SCREENS[path];
}
