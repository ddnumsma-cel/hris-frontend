// Which mobile screen shows each website address. Pages not listed yet show the Placeholder; each phase adds a
// role's pages here.

import type { ComponentType } from 'react';
import Attendance from './employee/Attendance';
import Clock from './employee/Clock';
import File201 from './employee/File201';
import Home from './employee/Home';
import Leave from './employee/Leave';
import LeaveNew from './employee/LeaveNew';
import OvertimeNew from './employee/OvertimeNew';
import Payslips from './employee/Payslips';
import Requests from './employee/Requests';
import TimeAdjustmentNew from './employee/TimeAdjustmentNew';
import UndertimeNew from './employee/UndertimeNew';

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
};

export function screenFor(path: string): ComponentType | undefined {
  return SCREENS[path];
}
