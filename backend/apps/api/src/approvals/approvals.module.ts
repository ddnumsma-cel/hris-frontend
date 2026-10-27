import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { EmployeesModule } from '../employees/employees.module';
import { LeaveModule } from '../leave/leave.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';

@Module({
  imports: [EmployeesModule, LeaveModule, AttendanceModule],
  controllers: [ApprovalsController, WorkflowsController],
  providers: [ApprovalsService, WorkflowsService],
  exports: [ApprovalsService, WorkflowsService],
})
export class ApprovalsModule {}
