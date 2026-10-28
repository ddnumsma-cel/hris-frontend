import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { LeaveModule } from '../leave/leave.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { RemoteWorkController, RemoteWorkService } from './remote-work';

@Module({
  imports: [EmployeesModule, LeaveModule],
  controllers: [AttendanceController, RemoteWorkController],
  providers: [AttendanceService, RemoteWorkService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
