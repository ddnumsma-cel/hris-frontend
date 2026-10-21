import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { DocumentsModule } from '../documents/documents.module';
import { LeaveModule } from '../leave/leave.module';
import { EmployeesController } from './employees.controller';
import { EmployeesModule } from './employees.module';

/** HTTP endpoints for employees. Kept apart from EmployeesModule because the profile composes attendance, leave and the 201 file. */
@Module({
  imports: [EmployeesModule, AttendanceModule, LeaveModule, DocumentsModule],
  controllers: [EmployeesController],
})
export class EmployeesHttpModule {}
