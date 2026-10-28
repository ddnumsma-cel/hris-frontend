import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { LeaveModule } from '../leave/leave.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { RemoteWorkController, RemoteWorkService } from './remote-work';
import { NoticesController, NoticesService } from './notices';

@Module({
  imports: [EmployeesModule, LeaveModule],
  controllers: [AttendanceController, RemoteWorkController, NoticesController],
  providers: [AttendanceService, RemoteWorkService, NoticesService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
