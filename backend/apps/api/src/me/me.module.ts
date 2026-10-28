import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { AuthModule } from '../auth/auth.module';
import { EmployeesModule } from '../employees/employees.module';
import { LeaveModule } from '../leave/leave.module';
import { PayrollModule } from '../payroll/payroll.module';
import { MeController } from './me.controller';

@Module({
  imports: [AttendanceModule, LeaveModule, ApprovalsModule, PayrollModule, AuthModule, EmployeesModule],
  controllers: [MeController],
})
export class MeModule {}
