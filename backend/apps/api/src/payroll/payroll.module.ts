import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { EmployeesModule } from '../employees/employees.module';
import { PayrollController } from './payroll.controller';
import { PayInputsService } from './pay-inputs.service';
import { PayrollRunsService } from './payroll-runs.service';
import { PayrollService } from './payroll.service';

@Module({
  imports: [EmployeesModule, AttendanceModule],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollRunsService, PayInputsService],
  exports: [PayrollService],
})
export class PayrollModule {}
