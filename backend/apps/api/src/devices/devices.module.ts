import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { EmployeesModule } from '../employees/employees.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { IclockController } from './iclock.controller';
import { PUNCH_PROTOCOL } from './punch-protocol';
import { ZkAdmsAdapter } from './zk-adms.adapter';

@Module({
  imports: [AttendanceModule, EmployeesModule],
  controllers: [IclockController, DevicesController],
  providers: [DevicesService, { provide: PUNCH_PROTOCOL, useClass: ZkAdmsAdapter }],
  exports: [DevicesService],
})
export class DevicesModule {}
