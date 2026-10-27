import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { DevicesModule } from '../devices/devices.module';
import { DocumentsModule } from '../documents/documents.module';
import { LeaveModule } from '../leave/leave.module';
import { EmployeesController } from './employees.controller';
import { EmployeesModule } from './employees.module';
import { OrgController } from './org.controller';
import { OrgService } from './org.service';

/** HTTP endpoints for employees. Kept apart from EmployeesModule because the profile composes attendance, leave and the 201 file. */
@Module({
  imports: [EmployeesModule, AttendanceModule, LeaveModule, DocumentsModule, DevicesModule],
  controllers: [EmployeesController, OrgController],
  providers: [OrgService],
})
export class EmployeesHttpModule {}
