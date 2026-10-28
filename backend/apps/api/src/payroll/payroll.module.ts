import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { EmployeesModule } from '../employees/employees.module';
import { PayrollController } from './payroll.controller';
import { FinalPayController, FinalPayService } from './final-pay';
import { RatesController, RatesService } from './rates';
import { PayInputsService } from './pay-inputs.service';
import { PayrollRunsService } from './payroll-runs.service';
import { PayrollService } from './payroll.service';

@Module({
  imports: [EmployeesModule, AttendanceModule],
  controllers: [PayrollController, FinalPayController, RatesController],
  providers: [PayrollService, PayrollRunsService, PayInputsService, FinalPayService, RatesService],
  exports: [PayrollService],
})
export class PayrollModule {}
