import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';

/** Employee master data. No HTTP here, so other modules can depend on it without cycles (see EmployeesHttpModule). */
@Module({
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
