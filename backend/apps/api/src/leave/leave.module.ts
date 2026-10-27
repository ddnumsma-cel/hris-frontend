import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { LeaveController } from './leave.controller';
import { LeaveAdminService } from './leave-admin.service';
import { LeaveService } from './leave.service';

/** Leave types, balances and leave requests. Requests are submitted and decided through the approvals module. */
@Module({
  imports: [EmployeesModule],
  controllers: [LeaveController],
  providers: [LeaveService, LeaveAdminService],
  exports: [LeaveService],
})
export class LeaveModule {}
