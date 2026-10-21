import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

/** Leave types, balances and leave requests. Requests are submitted and decided through the approvals module. */
@Module({
  imports: [EmployeesModule],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
